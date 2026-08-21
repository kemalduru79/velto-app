import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { ProviderError } from "@/lib/providers/core/providerError";
import { isUnsafeNetworkAddress } from "@/lib/security/safeRemoteMediaFetch";
import { resolveProviderEnvironmentValue } from "@/lib/runtime/providerEnvironment.mjs";

// A five-minute 320 kbps MP3 is roughly 12 MiB. Thirty MiB leaves controlled
// headroom without permitting an unbounded provider response in memory.
export const MAX_PREMIUM_MUSIC_DOWNLOAD_BYTES = 30 * 1024 * 1024;
export const PREMIUM_MUSIC_DOWNLOAD_TIMEOUT_MS = 30_000;
export const PREMIUM_MUSIC_CONTENT_TYPE = "audio/mpeg" as const;
const PROVIDER_API_HOST = "partner-content-api.epidemicsound.com";

export function isPremiumMusicAcquisitionEnabled(env = process.env) {
  return resolveProviderEnvironmentValue(
    "epidemic",
    "acquisitionEnabled",
    env,
  ) === "true";
}

export function validateProviderMusicUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ProviderError("Premium music acquisition is unavailable.", {
      code: "invalid_request",
      retryable: false,
    });
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    (isIP(hostname) !== 0 && isUnsafeNetworkAddress(hostname)) ||
    hostname !== PROVIDER_API_HOST
  ) {
    throw new ProviderError("Premium music acquisition is unavailable.", {
      code: "invalid_request",
      retryable: false,
    });
  }

  return url;
}

function normalizeContentType(value: string | null) {
  return (value || "").split(";", 1)[0].trim().toLowerCase();
}

function isMp3(bytes: Uint8Array) {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

function responseError(status: number) {
  if (status === 401 || status === 403) {
    return new ProviderError("Premium music acquisition is unavailable.", {
      code: "authentication",
      retryable: false,
      status,
    });
  }
  if (status === 429) {
    return new ProviderError("Premium music acquisition is unavailable.", {
      code: "rate_limit",
      retryable: true,
      status,
    });
  }
  return new ProviderError("Premium music acquisition is unavailable.", {
    code: "upstream",
    retryable: status >= 500,
    status,
  });
}

export async function readBoundedPremiumMusicResponse(
  response: Response,
  maxBytes = MAX_PREMIUM_MUSIC_DOWNLOAD_BYTES,
) {
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw responseError(response.status);
    validateProviderMusicUrl(location);
    throw responseError(response.status);
  }
  if (!response.ok) throw responseError(response.status);
  if (!response.body) throw responseError(502);

  const declaredType = normalizeContentType(response.headers.get("content-type"));
  if (declaredType !== PREMIUM_MUSIC_CONTENT_TYPE) {
    await response.body.cancel();
    throw new ProviderError("Premium music media format is unsupported.", {
      code: "invalid_request",
      retryable: false,
      status: 415,
    });
  }

  const declaredLengthText = response.headers.get("content-length")?.trim() || "";
  const declaredLength = declaredLengthText ? Number(declaredLengthText) : null;
  if (
    declaredLength !== null &&
    (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > maxBytes)
  ) {
    await response.body.cancel();
    throw new ProviderError("Premium music media size is invalid.", {
      code: "invalid_request",
      retryable: false,
      status: declaredLength !== null && declaredLength > maxBytes ? 413 : 400,
    });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ProviderError("Premium music media exceeds the size limit.", {
          code: "invalid_request",
          retryable: false,
          status: 413,
        });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0 || (declaredLength !== null && declaredLength !== total)) {
    throw new ProviderError("Premium music media response is incomplete.", {
      code: "upstream",
      retryable: true,
      status: 502,
    });
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!isMp3(body)) {
    throw new ProviderError("Premium music media format is unsupported.", {
      code: "invalid_request",
      retryable: false,
      status: 415,
    });
  }

  return {
    body,
    contentType: PREMIUM_MUSIC_CONTENT_TYPE,
    contentLength: total,
    checksum: createHash("sha256").update(body).digest("hex"),
  };
}
