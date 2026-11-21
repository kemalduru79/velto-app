import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
  type AuthenticatedPrincipal,
} from "@/lib/auth/server";
import {
  CREATOR_IMAGE_REQUEST_BODY_BYTES,
  CREATOR_VIDEO_REQUEST_BODY_BYTES,
} from "@/lib/security/creatorMediaStoragePolicy";

const LEGACY_MEDIA_POLICIES = {
  "store-image": {
    maxBodyBytes: CREATOR_IMAGE_REQUEST_BODY_BYTES,
    rateLimit: 20,
    windowMs: 60_000,
  },
  "store-video": {
    maxBodyBytes: CREATOR_VIDEO_REQUEST_BODY_BYTES,
    rateLimit: 6,
    windowMs: 60_000,
  },
} as const;

export type LegacyMediaRouteId = keyof typeof LEGACY_MEDIA_POLICIES;

type RateLimitEntry = { count: number; expiresAt: number };

// Beta-only, process-local protection. It does not coordinate limits across
// multiple workers, processes, regions, or containers.
const MAX_RATE_LIMIT_KEYS = 10_000;
const CLEANUP_INTERVAL_MS = 30_000;
const rateLimitEntries = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;

function errorResponse(status: number, error: string, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}

function isJsonContentType(value: string | null) {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

function applyRateLimit(userId: string, routeId: LegacyMediaRouteId, now = Date.now()) {
  if (
    rateLimitEntries.size >= MAX_RATE_LIMIT_KEYS ||
    now - lastCleanupAt >= CLEANUP_INTERVAL_MS
  ) {
    for (const [key, entry] of rateLimitEntries) {
      if (entry.expiresAt <= now) rateLimitEntries.delete(key);
    }
    lastCleanupAt = now;
  }

  const policy = LEGACY_MEDIA_POLICIES[routeId];
  const key = `${userId}:${routeId}`;
  const existing = rateLimitEntries.get(key);
  if (existing && existing.expiresAt > now) {
    if (existing.count >= policy.rateLimit) {
      return Math.max(1, Math.ceil((existing.expiresAt - now) / 1_000));
    }
    existing.count += 1;
    return null;
  }

  if (rateLimitEntries.size >= MAX_RATE_LIMIT_KEYS) {
    const oldestKey = rateLimitEntries.keys().next().value as string | undefined;
    if (oldestKey) rateLimitEntries.delete(oldestKey);
  }
  rateLimitEntries.set(key, { count: 1, expiresAt: now + policy.windowMs });
  return null;
}

async function readBoundedBody(request: Request, maxBytes: number) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RangeError("request_too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
}

export type LegacyMediaBoundaryResult<TBody> =
  | { ok: true; user: AuthenticatedPrincipal; body: TBody }
  | { ok: false; response: NextResponse };

export async function enforceLegacyMediaBoundary<TBody = unknown>(
  request: Request,
  routeId: LegacyMediaRouteId,
): Promise<LegacyMediaBoundaryResult<TBody>> {
  let user: AuthenticatedPrincipal;
  try {
    // Authentication is intentionally the first operation that can consume
    // request-controlled work. In particular, the body is untouched here.
    user = await authenticateRequest(request);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { ok: false, response: errorResponse(401, "Authentication required.") };
    }
    throw error;
  }

  const policy = LEGACY_MEDIA_POLICIES[routeId];
  const retryAfter = applyRateLimit(user.id, routeId);
  if (retryAfter !== null) {
    return {
      ok: false,
      response: errorResponse(429, "Too many requests. Please retry later.", {
        "Retry-After": String(retryAfter),
      }),
    };
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return { ok: false, response: errorResponse(415, "Content-Type must be application/json.") };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength.trim())) {
    const declaredBytes = Number(contentLength);
    if (Number.isSafeInteger(declaredBytes) && declaredBytes > policy.maxBodyBytes) {
      return { ok: false, response: errorResponse(413, "Request body exceeds the configured limit.") };
    }
  }

  let rawBody: string;
  try {
    rawBody = await readBoundedBody(request, policy.maxBodyBytes);
  } catch (error) {
    if (error instanceof RangeError && error.message === "request_too_large") {
      return { ok: false, response: errorResponse(413, "Request body exceeds the configured limit.") };
    }
    return { ok: false, response: errorResponse(400, "Malformed request body.") };
  }

  try {
    return { ok: true, user, body: JSON.parse(rawBody) as TBody };
  } catch {
    return { ok: false, response: errorResponse(400, "Malformed JSON request body.") };
  }
}
