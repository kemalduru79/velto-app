import "server-only";

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { createPinnedDnsLookup } from "../security/pinnedDnsLookup.ts";
import { isUnsafeNetworkAddress } from "../security/safeRemoteMediaFetch.ts";
import { canonicalResearchUrl } from "./orchestratedResearch.ts";
import type { OriginalSourceDocument } from "./originalSourceEvidence.ts";
import type { ResearchSource } from "./sourceContract.ts";

export type OriginalSourceAcquisitionProvenance = {
  sourceId: string;
  requestedUrl: string;
  finalUrl: string;
  redirectChain: string[];
  acquiredAt: string;
  contentType: string;
  byteLength: number;
  sha256: string;
  transport: "pinned_https";
};

export class OriginalSourceAcquisitionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "OriginalSourceAcquisitionError";
  }
}

type ResolvedAddress = { address: string; family: 4 | 6 };
type ResponseBody = { status: number; headers: Record<string, string | undefined>; body: Buffer };

const normalizeHost = (value: string) => value.toLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
const parseUrl = (rawUrl: string) => {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new OriginalSourceAcquisitionError("SOURCE_URL_INVALID", "Original-source URL is invalid."); }
  const hostname = normalizeHost(url.hostname);
  if (url.protocol !== "https:" || url.username || url.password || !hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new OriginalSourceAcquisitionError("SOURCE_URL_UNSAFE", "Original-source URL is not an allowed public HTTPS URL.");
  return url;
};

async function defaultResolve(hostname: string): Promise<ResolvedAddress[]> {
  const literal = isIP(hostname);
  const records = literal ? [{ address: hostname, family: literal as 4 | 6 }] : await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family as 4 | 6 }));
}

async function defaultRequest(url: URL, selected: ResolvedAddress, timeoutMs: number, maxBytes: number): Promise<ResponseBody> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(url, { method: "GET", agent: false, servername: url.hostname, lookup: createPinnedDnsLookup(selected), headers: { Accept: "text/plain,text/html,application/xhtml+xml", "User-Agent": "Velto-Original-Source-Acquisition/1.0" } }, (response) => {
      const declared = Number(response.headers["content-length"] || 0);
      if (Number.isFinite(declared) && declared > maxBytes) { response.destroy(); reject(new OriginalSourceAcquisitionError("SOURCE_DOCUMENT_TOO_LARGE", "Original-source document exceeds the configured size limit.")); return; }
      const chunks: Buffer[] = []; let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) { response.destroy(); reject(new OriginalSourceAcquisitionError("SOURCE_DOCUMENT_TOO_LARGE", "Original-source document exceeds the configured size limit.")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ status: response.statusCode || 0, headers: { location: response.headers.location, "content-type": response.headers["content-type"] }, body: Buffer.concat(chunks, total) }));
      response.on("error", () => reject(new OriginalSourceAcquisitionError("SOURCE_FETCH_FAILED", "Original-source response was interrupted.")));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new OriginalSourceAcquisitionError("SOURCE_FETCH_TIMEOUT", "Original-source acquisition timed out.")));
    request.on("error", (error) => reject(error instanceof OriginalSourceAcquisitionError ? error : new OriginalSourceAcquisitionError("SOURCE_FETCH_FAILED", "Original-source acquisition failed.")));
    request.end();
  });
}

const decodeDocument = (body: Buffer, contentType: string) => {
  if (!/^(?:text\/plain|text\/html|application\/xhtml\+xml)(?:;|$)/iu.test(contentType)) throw new OriginalSourceAcquisitionError("SOURCE_CONTENT_TYPE_UNSUPPORTED", "Original-source content type is unsupported.");
  const decoded = body.toString("utf8");
  if (!decoded.trim() || Buffer.from(decoded, "utf8").length !== body.length) throw new OriginalSourceAcquisitionError("SOURCE_DOCUMENT_DECODE_UNCERTAIN", "Original-source document could not be decoded exactly as UTF-8.");
  return decoded;
};

export async function acquireOriginalSourceDocument(input: {
  source: ResearchSource;
  authority: OriginalSourceDocument["authority"];
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  now?: () => string;
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
  request?: (url: URL, selected: ResolvedAddress, timeoutMs: number, maxBytes: number) => Promise<ResponseBody>;
}) {
  const maxBytes = input.maxBytes ?? 2 * 1024 * 1024;
  const timeoutMs = input.timeoutMs ?? 15_000;
  const maxRedirects = input.maxRedirects ?? 3;
  const resolve = input.resolve ?? defaultResolve;
  const request = input.request ?? defaultRequest;
  let current = parseUrl(input.source.url);
  const requestedUrl = canonicalResearchUrl(current.toString());
  const redirectChain: string[] = [];
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const hostname = normalizeHost(current.hostname);
    const addresses = await resolve(hostname).catch(() => []);
    if (!addresses.length) throw new OriginalSourceAcquisitionError("SOURCE_DNS_FAILED", "Original-source host could not be resolved.");
    if (addresses.some(({ address }) => isUnsafeNetworkAddress(address))) throw new OriginalSourceAcquisitionError("SOURCE_SSRF_REJECTED", "Original-source host resolved to a non-public address.");
    const selected = addresses.find(({ family }) => family === 4) ?? addresses[0];
    const response = await request(current, selected, timeoutMs, maxBytes);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      if (!location || redirectCount === maxRedirects) throw new OriginalSourceAcquisitionError("SOURCE_REDIRECT_REJECTED", "Original-source redirect is invalid or exceeded the limit.");
      current = parseUrl(new URL(location, current).toString());
      redirectChain.push(canonicalResearchUrl(current.toString()));
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new OriginalSourceAcquisitionError("SOURCE_HTTP_FAILED", `Original-source request returned HTTP ${response.status}.`);
    if (!response.body.length || response.body.length > maxBytes) throw new OriginalSourceAcquisitionError("SOURCE_DOCUMENT_TOO_LARGE", "Original-source document is empty or exceeds the configured size limit.");
    const contentType = response.headers["content-type"]?.toLowerCase() || "";
    const content = decodeDocument(response.body, contentType);
    const finalUrl = canonicalResearchUrl(current.toString());
    const sha256 = createHash("sha256").update(content).digest("hex");
    const provenance: OriginalSourceAcquisitionProvenance = { sourceId: input.source.sourceId, requestedUrl, finalUrl, redirectChain, acquiredAt: (input.now ?? (() => new Date().toISOString()))(), contentType, byteLength: response.body.length, sha256, transport: "pinned_https" };
    return { document: { sourceId: input.source.sourceId, url: finalUrl, content, acquisition: "trusted_fetch" as const, authority: input.authority, expectedSha256: sha256 }, provenance };
  }
  throw new OriginalSourceAcquisitionError("SOURCE_REDIRECT_REJECTED", "Original-source redirect limit exceeded.");
}
