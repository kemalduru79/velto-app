import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { createPinnedDnsLookup } from "../security/pinnedDnsLookup.ts";
import { normalizeStage4b2VerbatimPassage } from "./stage4b2Verbatim.ts";

export const STAGE4B2_SOURCE_IDENTITY = "arxiv:2304.03442v2" as const;
export const STAGE4B2_APPROVED_ABSTRACT_URL = "https://arxiv.org/abs/2304.03442" as const;
export const STAGE4B2_APPROVED_PDF_URL = "https://arxiv.org/pdf/2304.03442v2" as const;
export const STAGE4B2_PDF_MAX_BYTES = 20 * 1024 * 1024;
export const STAGE4B2_PDF_PAGE_COUNT = 22;
export const STAGE4B2_APPROVED_REPRESENTATIONS = Object.freeze({
  abstract: Object.freeze({ sourceIdentity: STAGE4B2_SOURCE_IDENTITY, representation: "abstract" as const, representationUrl: STAGE4B2_APPROVED_ABSTRACT_URL }),
  pdf_v2: Object.freeze({ sourceIdentity: STAGE4B2_SOURCE_IDENTITY, representation: "pdf_v2" as const, representationUrl: STAGE4B2_APPROVED_PDF_URL, expectedPageCount: STAGE4B2_PDF_PAGE_COUNT }),
});

export type Stage4b2PdfPage = { page: number; blocks: string[] };
export type Stage4b2PdfArtifact = {
  sourceIdentity: typeof STAGE4B2_SOURCE_IDENTITY;
  representation: "pdf_v2";
  representationUrl: typeof STAGE4B2_APPROVED_PDF_URL;
  byteLength: number;
  documentSha256: string;
  extractionSha256: string;
  pages: Stage4b2PdfPage[];
};

export class Stage4b2PdfEvidenceError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; this.name = "Stage4b2PdfEvidenceError"; }
}

type PdfResponse = { status: number; url: string; contentType: string; contentLength?: number; body: Uint8Array; location?: string };
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const compact = (value: string) => value.replace(/\s+/gu, " ").trim();
const unsafeIpv4 = (address: string) => {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c, d] = parts; const value = (((a * 256 + b) * 256 + c) * 256 + d) >>> 0;
  const inCidr = (base: number, bits: number) => bits === 0 || (value >>> (32 - bits)) === (base >>> (32 - bits));
  return [[0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8], [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24], [0xc0586300, 24], [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24], [0xcb007100, 24], [0xe0000000, 4], [0xf0000000, 4]].some(([base, bits]) => inCidr(base, bits));
};
const unsafeIpv6 = (address: string) => {
  const zoneFree = address.split("%", 1)[0].toLowerCase(); const mapped = zoneFree.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/u); let normalized = zoneFree;
  if (mapped) { const octets = mapped[2].split(".").map(Number); normalized = `${mapped[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`; }
  const halves = normalized.split("::"); if (halves.length > 2) return true;
  const left = halves[0] ? halves[0].split(":") : []; const right = halves[1] ? halves[1].split(":") : []; const zeros = halves.length === 2 ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array(zeros).fill("0"), ...right]; if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/u.test(group))) return true;
  const numbers = groups.map((group) => Number.parseInt(group, 16));
  if (numbers.slice(0, 5).every((group) => group === 0) && numbers[5] === 0xffff) return unsafeIpv4(`${numbers[6] >> 8}.${numbers[6] & 255}.${numbers[7] >> 8}.${numbers[7] & 255}`);
  return numbers.every((group) => group === 0) || (numbers.slice(0, 7).every((group) => group === 0) && numbers[7] === 1) || (numbers[0] & 0xfe00) === 0xfc00 || (numbers[0] & 0xffc0) === 0xfe80 || (numbers[0] & 0xff00) === 0xff00;
};
const isUnsafeNetworkAddress = (address: string) => isIP(address) === 4 ? unsafeIpv4(address) : isIP(address) === 6 ? unsafeIpv6(address) : true;
const approvedPdfUrl = (value: string) => {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.protocol === "https:" && !url.username && !url.password && url.hostname.toLowerCase() === "arxiv.org" && url.pathname.replace(/\/+$/u, "") === "/pdf/2304.03442v2" && !url.search;
  } catch { return false; }
};

const decodeXml = (value: string) => value
  .replace(/&#(\d+);/gu, (match, digits) => Number(digits) <= 0x10ffff ? String.fromCodePoint(Number(digits)) : match)
  .replace(/&#x([\da-f]+);/giu, (match, digits) => Number.parseInt(digits, 16) <= 0x10ffff ? String.fromCodePoint(Number.parseInt(digits, 16)) : match)
  .replace(/&(?:amp|lt|gt|quot|apos);/gu, (match) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'" }[match] ?? match));

export function parseStage4b2PdfLayout(xml: string): Stage4b2PdfPage[] {
  const pages = [...xml.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/giu)].map((pageMatch, pageIndex) => ({
    page: pageIndex + 1,
    blocks: [...pageMatch[1].matchAll(/<block\b[^>]*>([\s\S]*?)<\/block>/giu)].map((blockMatch) => compact(decodeXml([...blockMatch[1].matchAll(/<word\b[^>]*>([\s\S]*?)<\/word>/giu)].map((word) => word[1]).join(" ")))).filter(Boolean),
  }));
  if (!pages.length || pages.some((page) => !page.blocks.length)) throw new Stage4b2PdfEvidenceError("PDF_TEXT_EXTRACTION_INVALID");
  return pages;
}

async function defaultExtractPages(bytes: Uint8Array): Promise<Stage4b2PdfPage[]> {
  const binary = process.env.STAGE4B2_PDFTOTEXT_BIN || "pdftotext";
  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(binary, ["-bbox-layout", "-", "-"], { stdio: ["pipe", "pipe", "ignore"], env: { PATH: process.env.PATH || "", NODE_ENV: process.env.NODE_ENV || "production" } });
    const chunks: Buffer[] = []; let total = 0; let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; child.kill("SIGKILL"); reject(new Stage4b2PdfEvidenceError("PDF_TEXT_EXTRACTION_TIMEOUT")); } }, 20_000);
    child.stdout.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > 8 * 1024 * 1024) { child.kill("SIGKILL"); reject(new Stage4b2PdfEvidenceError("PDF_TEXT_EXTRACTION_TOO_LARGE")); return; }
      chunks.push(chunk);
    });
    child.on("error", () => { clearTimeout(timer); if (!settled) { settled = true; reject(new Stage4b2PdfEvidenceError("PDF_TEXT_EXTRACTION_UNAVAILABLE")); } });
    child.on("close", (code) => { clearTimeout(timer); if (settled) return; settled = true; code === 0 ? resolve(Buffer.concat(chunks, total).toString("utf8")) : reject(new Stage4b2PdfEvidenceError("PDF_TEXT_EXTRACTION_FAILED")); });
    child.stdin.end(Buffer.from(bytes));
  });
  return parseStage4b2PdfLayout(stdout);
}

async function defaultRequest(url: string): Promise<PdfResponse> {
  const parsed = new URL(url);
  const addresses = await lookup(parsed.hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length) throw new Stage4b2PdfEvidenceError("PDF_DNS_FAILED");
  if (addresses.some(({ address }) => isUnsafeNetworkAddress(address))) throw new Stage4b2PdfEvidenceError("PDF_SSRF_REJECTED");
  const selected = addresses.find(({ family }) => family === 4) ?? addresses[0];
  return new Promise((resolve, reject) => {
    const request = httpsRequest(parsed, { method: "GET", agent: false, servername: parsed.hostname, lookup: createPinnedDnsLookup({ address: selected.address, family: selected.family as 4 | 6 }), headers: { Accept: "application/pdf", "User-Agent": "Velto-Stage4B2-Pdf-Evidence/1.0" } }, (response) => {
      const declared = Number(response.headers["content-length"] || 0) || undefined;
      if (declared && declared > STAGE4B2_PDF_MAX_BYTES) { response.destroy(); reject(new Stage4b2PdfEvidenceError("PDF_TOO_LARGE")); return; }
      const chunks: Buffer[] = []; let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > STAGE4B2_PDF_MAX_BYTES) { response.destroy(); reject(new Stage4b2PdfEvidenceError("PDF_TOO_LARGE")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ status: response.statusCode || 0, url, contentType: response.headers["content-type"] || "", contentLength: declared, body: Buffer.concat(chunks, total), location: response.headers.location }));
      response.on("error", () => reject(new Stage4b2PdfEvidenceError("PDF_FETCH_INTERRUPTED")));
    });
    request.setTimeout(20_000, () => request.destroy(new Stage4b2PdfEvidenceError("PDF_FETCH_TIMEOUT")));
    request.on("error", (error) => reject(error instanceof Stage4b2PdfEvidenceError ? error : new Stage4b2PdfEvidenceError("PDF_FETCH_FAILED")));
    request.end();
  });
}

export async function acquireStage4b2ApprovedPdf(input: {
  request?: (url: string) => Promise<PdfResponse>;
  extractPages?: (bytes: Uint8Array) => Promise<Stage4b2PdfPage[]>;
} = {}): Promise<Stage4b2PdfArtifact> {
  const request = input.request ?? defaultRequest;
  let requestedUrl: string = STAGE4B2_APPROVED_PDF_URL;
  let response = await request(requestedUrl);
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (!response.location) throw new Stage4b2PdfEvidenceError("PDF_REDIRECT_REJECTED");
    const redirected = new URL(response.location, requestedUrl).toString();
    if (!approvedPdfUrl(redirected)) throw new Stage4b2PdfEvidenceError("PDF_REDIRECT_REJECTED");
    requestedUrl = redirected;
    response = await request(requestedUrl);
  }
  if (response.status < 200 || response.status >= 300) throw new Stage4b2PdfEvidenceError("PDF_HTTP_FAILED");
  if (!approvedPdfUrl(requestedUrl) || !approvedPdfUrl(response.url)) throw new Stage4b2PdfEvidenceError("PDF_IDENTITY_MISMATCH");
  if (!/^application\/pdf(?:;|$)/iu.test(response.contentType)) throw new Stage4b2PdfEvidenceError("PDF_CONTENT_TYPE_INVALID");
  if (response.contentLength && response.contentLength > STAGE4B2_PDF_MAX_BYTES) throw new Stage4b2PdfEvidenceError("PDF_TOO_LARGE");
  if (response.contentLength && response.contentLength !== response.body.byteLength) throw new Stage4b2PdfEvidenceError("PDF_LENGTH_MISMATCH");
  if (!response.body.byteLength || response.body.byteLength > STAGE4B2_PDF_MAX_BYTES) throw new Stage4b2PdfEvidenceError("PDF_TOO_LARGE");
  const prefix = Buffer.from(response.body.subarray(0, 8)).toString("ascii");
  const suffix = Buffer.from(response.body.subarray(Math.max(0, response.body.byteLength - 2048))).toString("latin1");
  if (!prefix.startsWith("%PDF-") || !suffix.includes("%%EOF")) throw new Stage4b2PdfEvidenceError("PDF_STRUCTURE_INVALID");
  const pages = await (input.extractPages ?? defaultExtractPages)(response.body);
  if (pages.length !== STAGE4B2_PDF_PAGE_COUNT || pages.some((page, index) => page.page !== index + 1 || !page.blocks.length)) throw new Stage4b2PdfEvidenceError("PDF_PAGE_STRUCTURE_INVALID");
  const identityText = compact(pages.flatMap((page) => page.blocks).join(" "));
  if (!/Generative Agents:\s*Interactive Simulacra of Human Behavior/iu.test(identityText) || !/Joon Sung Park/iu.test(identityText) || !/arXiv:2304\.03442v2/iu.test(identityText)) throw new Stage4b2PdfEvidenceError("PDF_VERSION_IDENTITY_INVALID");
  return { sourceIdentity: STAGE4B2_SOURCE_IDENTITY, representation: "pdf_v2", representationUrl: STAGE4B2_APPROVED_PDF_URL, byteLength: response.body.byteLength, documentSha256: sha256(response.body), extractionSha256: sha256(JSON.stringify(pages)), pages };
}

export function verifyStage4b2PdfPassage(input: { artifact: Stage4b2PdfArtifact; passage: string }) {
  const passage = compact(input.passage);
  if (input.artifact.sourceIdentity !== STAGE4B2_SOURCE_IDENTITY || input.artifact.representation !== "pdf_v2" || input.artifact.representationUrl !== STAGE4B2_APPROVED_PDF_URL || !/^[a-f0-9]{64}$/u.test(input.artifact.documentSha256) || input.artifact.extractionSha256 !== sha256(JSON.stringify(input.artifact.pages)) || passage.length < 24) return { ok: false as const, reason: "PDF_EVIDENCE_AUTHORITY_INVALID" as const };
  const normalizedPassage = normalizeStage4b2VerbatimPassage(passage);
  const matches = input.artifact.pages.flatMap((page) => page.blocks.flatMap((block, blockIndex) => {
    const exact = compact(block).includes(passage);
    const normalized = !exact && normalizeStage4b2VerbatimPassage(block).includes(normalizedPassage);
    return exact || normalized ? [{ page: page.page, block: blockIndex + 1, matchMode: exact ? "compact_exact" as const : "normalized_verbatim" as const, pageSha256: sha256(page.blocks.join("\n\n")), blockSha256: sha256(block) }] : [];
  }));
  if (matches.length !== 1) return { ok: false as const, reason: matches.length ? "PDF_PASSAGE_AMBIGUOUS" as const : "PDF_PASSAGE_NOT_VERIFIED" as const };
  return { ok: true as const, sourceIdentity: STAGE4B2_SOURCE_IDENTITY, representation: "pdf_v2" as const, representationUrl: STAGE4B2_APPROVED_PDF_URL, passage, passageSha256: sha256(passage), documentSha256: input.artifact.documentSha256, locator: { page: matches[0].page, block: matches[0].block }, pageSha256: matches[0].pageSha256, blockSha256: matches[0].blockSha256, matchMode: matches[0].matchMode };
}
