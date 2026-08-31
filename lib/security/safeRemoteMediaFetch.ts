import { randomInt } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import {
  CREATOR_MEDIA_CONNECTION_TIMEOUT_MS,
  CREATOR_MEDIA_TOTAL_TIMEOUT_MS,
} from "@/lib/security/creatorMediaStoragePolicy";
import { createPinnedDnsLookup } from "@/lib/security/pinnedDnsLookup";

export type VerifiedMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "video/mp4"
  | "video/webm";

export type SafeMediaFailureCategory =
  | "unsafe_host"
  | "dns_resolution_failed"
  | "network_unreachable"
  | "redirect_rejected"
  | "remote_http_error"
  | "invalid_content_type"
  | "media_too_large";

export type SafeMediaFailureDiagnostic = {
  stage: "url_validation" | "dns_resolution" | "network" | "redirect_validation" | "response_validation";
  hostname?: string;
  addressFamily?: 4 | 6;
  redirectCount?: number;
  responseStatus?: number;
  contentType?: string;
  contentLength?: number;
};

export class SafeMediaError extends Error {
  constructor(
    public readonly status: 400 | 413 | 415 | 422 | 502 | 504,
    message: string,
    public readonly category: SafeMediaFailureCategory = "network_unreachable",
    public readonly diagnostic?: SafeMediaFailureDiagnostic,
  ) {
    super(message);
    this.name = "SafeMediaError";
  }
}

const TYPE_DETAILS: Record<VerifiedMediaType, { extension: string; kind: "image" | "video" }> = {
  "image/jpeg": { extension: "jpg", kind: "image" },
  "image/png": { extension: "png", kind: "image" },
  "image/webp": { extension: "webp", kind: "image" },
  "video/mp4": { extension: "mp4", kind: "video" },
  "video/webm": { extension: "webm", kind: "video" },
};

function unsafeIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c, d] = parts;
  const value = (((a * 256 + b) * 256 + c) * 256 + d) >>> 0;
  const inCidr = (base: number, bits: number) =>
    bits === 0 || (value >>> (32 - bits)) === (base >>> (32 - bits));
  return [
    [0x00000000, 8], [0x0a000000, 8], [0x64400000, 10], [0x7f000000, 8],
    [0xa9fe0000, 16], [0xac100000, 12], [0xc0000000, 24], [0xc0000200, 24],
    [0xc0586300, 24], [0xc0a80000, 16], [0xc6120000, 15], [0xc6336400, 24],
    [0xcb007100, 24], [0xe0000000, 4], [0xf0000000, 4],
  ].some(([base, bits]) => inCidr(base, bits));
}

function expandedIpv6(address: string) {
  const zoneFree = address.split("%", 1)[0].toLowerCase();
  const mapped = zoneFree.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  let normalized = zoneFree;
  if (mapped) {
    const octets = mapped[2].split(".").map(Number);
    normalized = `${mapped[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const zeros = halves.length === 2 ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array(zeros).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

function unsafeIpv6(address: string) {
  const groups = expandedIpv6(address);
  if (!groups) return true;
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return unsafeIpv4(`${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`);
  }
  const [first] = groups;
  const allZero = groups.every((group) => group === 0);
  const loopback = groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1;
  return allZero || loopback || (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00;
}

export function isUnsafeNetworkAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? unsafeIpv4(address) : family === 6 ? unsafeIpv6(address) : true;
}

function parseSafeUrl(rawUrl: string) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new SafeMediaError(400, "Media URL is invalid.", "unsafe_host", { stage: "url_validation" }); }
  if (url.protocol !== "https:") throw new SafeMediaError(400, "Media URL must use HTTPS.", "unsafe_host", { stage: "url_validation", hostname: url.hostname });
  if (url.username || url.password) throw new SafeMediaError(400, "Media URL credentials are not allowed.", "unsafe_host", { stage: "url_validation", hostname: url.hostname });
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new SafeMediaError(400, "Media URL host is not allowed.", "unsafe_host", { stage: "url_validation", hostname });
  }
  return url;
}

async function resolveSafeAddress(hostname: string) {
  const literalFamily = isIP(hostname);
  const records = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!records.length) throw new SafeMediaError(502, "Remote media host could not be resolved.", "dns_resolution_failed", { stage: "dns_resolution", hostname });
  if (records.some(({ address }) => isUnsafeNetworkAddress(address))) {
    throw new SafeMediaError(400, "Media URL host is not allowed.", "unsafe_host", { stage: "dns_resolution", hostname });
  }
  // Container runtimes may resolve public CDNs to IPv6 even when their
  // outbound network has no working IPv6 route. Prefer a verified public IPv4
  // address when available instead of randomly selecting an unreachable AAAA
  // record; retain IPv6 for IPv6-only hosts.
  const routable = records.filter((record) => record.family === 4);
  const candidates = routable.length > 0 ? routable : records;
  const selected = candidates[randomInt(candidates.length)];
  return { address: selected.address, family: selected.family as 4 | 6 };
}

async function resolveSafeAddressBeforeDeadline(hostname: string, deadline: number) {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new SafeMediaError(504, "Remote media fetch timed out.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      resolveSafeAddress(hostname),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new SafeMediaError(504, "Remote media fetch timed out.")),
          remainingMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeDeclaredType(value: string | undefined) {
  return value?.split(";", 1)[0].trim().toLowerCase() || "";
}

export function detectMediaType(buffer: Uint8Array): VerifiedMediaType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && Buffer.from(buffer.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer.length >= 12 && Buffer.from(buffer.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(buffer.subarray(8, 12)).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.length >= 12 && Buffer.from(buffer.subarray(4, 8)).toString("ascii") === "ftyp") return "video/mp4";
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return "video/webm";
  return null;
}

export function verifyMediaBytes(buffer: Buffer, declaredType: string | undefined, kind: "image" | "video") {
  const verifiedType = detectMediaType(buffer);
  const normalized = normalizeDeclaredType(declaredType);
  if (!verifiedType || TYPE_DETAILS[verifiedType].kind !== kind || !(verifiedType in TYPE_DETAILS)) {
    throw new SafeMediaError(415, "Media format is unsupported or could not be verified.", "invalid_content_type", { stage: "response_validation", contentType: normalized });
  }
  if (normalized !== verifiedType && !(verifiedType === "image/jpeg" && normalized === "image/jpg")) {
    throw new SafeMediaError(415, "Declared media type does not match its content.", "invalid_content_type", { stage: "response_validation", contentType: normalized });
  }
  return { buffer, mimeType: verifiedType, extension: TYPE_DETAILS[verifiedType].extension };
}

export function decodeImageDataUrl(value: string, maxBytes: number) {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match) throw new SafeMediaError(400, "Image data URL is malformed.");
  const estimatedBytes = Math.floor(match[2].length * 3 / 4);
  if (estimatedBytes > maxBytes) throw new SafeMediaError(413, "Image exceeds the configured size limit.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > maxBytes || buffer.toString("base64").replace(/=+$/, "") !== match[2].replace(/=+$/, "")) {
    throw new SafeMediaError(buffer.length > maxBytes ? 413 : 400, "Image data URL is malformed.");
  }
  return verifyMediaBytes(buffer, match[1], "image");
}

export async function safeRemoteMediaFetch({ rawUrl, kind, maxBytes, redirects = 0, deadline = Date.now() + CREATOR_MEDIA_TOTAL_TIMEOUT_MS }: {
  rawUrl: string; kind: "image" | "video"; maxBytes: number; redirects?: number; deadline?: number;
}): Promise<{ buffer: Buffer; mimeType: VerifiedMediaType; extension: string }> {
  const url = parseSafeUrl(rawUrl);
  const selected = await resolveSafeAddressBeforeDeadline(
    url.hostname.replace(/^\[|\]$/g, ""),
    deadline,
  );
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new SafeMediaError(504, "Remote media fetch timed out.");
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => { if (!settled) { settled = true; reject(error); } };
    const request = httpsRequest(url, {
      method: "GET", headers: { Accept: kind === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm", "User-Agent": "Velto-Media-Fetch/1.0" },
      agent: false,
      servername: url.hostname,
      lookup: createPinnedDnsLookup(selected),
    }, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume();
        clearTimeout(totalTimer);
        if (redirects >= 3) return fail(new SafeMediaError(422, "Remote media redirect limit exceeded.", "redirect_rejected", { stage: "redirect_validation", hostname: url.hostname, addressFamily: selected.family, redirectCount: redirects }));
        const location = response.headers.location;
        if (!location) return fail(new SafeMediaError(502, "Remote media redirect is invalid.", "redirect_rejected", { stage: "redirect_validation", hostname: url.hostname, addressFamily: selected.family, redirectCount: redirects, responseStatus: status }));
        let next: URL;
        try { next = new URL(location, url); } catch { return fail(new SafeMediaError(422, "Remote media redirect is invalid.", "redirect_rejected", { stage: "redirect_validation", hostname: url.hostname, addressFamily: selected.family, redirectCount: redirects, responseStatus: status })); }
        settled = true;
        safeRemoteMediaFetch({ rawUrl: next.toString(), kind, maxBytes, redirects: redirects + 1, deadline }).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) { response.resume(); clearTimeout(totalTimer); return fail(new SafeMediaError(502, "Remote media download failed.", "remote_http_error", { stage: "response_validation", hostname: url.hostname, addressFamily: selected.family, redirectCount: redirects, responseStatus: status, contentType: normalizeDeclaredType(response.headers["content-type"]), contentLength: Number(response.headers["content-length"] || 0) || undefined })); }
      const length = Number(response.headers["content-length"] || 0);
      if (Number.isFinite(length) && length > maxBytes) { response.destroy(); clearTimeout(totalTimer); return fail(new SafeMediaError(413, "Remote media exceeds the configured size limit.", "media_too_large", { stage: "response_validation", hostname: url.hostname, addressFamily: selected.family, redirectCount: redirects, responseStatus: status, contentType: normalizeDeclaredType(response.headers["content-type"]), contentLength: length })); }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) { response.destroy(); clearTimeout(totalTimer); fail(new SafeMediaError(413, "Remote media exceeds the configured size limit.", "media_too_large", { stage: "response_validation", hostname: url.hostname, addressFamily: selected.family, redirectCount: redirects, responseStatus: status, contentType: normalizeDeclaredType(response.headers["content-type"]), contentLength: total })); return; }
        chunks.push(chunk);
      });
      response.on("end", () => {
        clearTimeout(totalTimer);
        if (settled) return;
        try { settled = true; resolve(verifyMediaBytes(Buffer.concat(chunks, total), response.headers["content-type"], kind)); }
        catch (error) { reject(error); }
      });
      response.on("error", () => { clearTimeout(totalTimer); fail(new SafeMediaError(502, "Remote media download failed.", "network_unreachable", { stage: "network", hostname: url.hostname, addressFamily: selected.family, redirectCount: redirects, responseStatus: status })); });
    });
    const totalTimer = setTimeout(() => request.destroy(new SafeMediaError(504, "Remote media fetch timed out.")), remainingMs);
    request.setTimeout(
      Math.min(CREATOR_MEDIA_CONNECTION_TIMEOUT_MS, remainingMs),
      () => request.destroy(new SafeMediaError(504, "Remote media connection timed out.")),
    );
    request.on("error", (error) => { clearTimeout(totalTimer); fail(error instanceof SafeMediaError ? error : new SafeMediaError(502, "Remote media download failed.", "network_unreachable", { stage: "network", hostname: url.hostname, addressFamily: selected.family, redirectCount: redirects })); });
    request.end();
  });
}
