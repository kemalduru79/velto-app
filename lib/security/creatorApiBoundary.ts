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

export const CREATOR_API_POLICIES = {
  "creator-mentor": {
    maxBodyBytes: 256 * 1024,
    rateLimit: 20,
    windowMs: 60_000,
  },
  "creator-research": {
    maxBodyBytes: 64 * 1024,
    rateLimit: 8,
    windowMs: 60_000,
  },
  "creator-youtube-metadata": {
    maxBodyBytes: 128 * 1024,
    rateLimit: 10,
    windowMs: 60_000,
  },
  "creator-thumbnail": {
    maxBodyBytes: 128 * 1024,
    rateLimit: 4,
    windowMs: 60_000,
  },
  "creator-store-image": {
    maxBodyBytes: CREATOR_IMAGE_REQUEST_BODY_BYTES,
    rateLimit: 20,
    windowMs: 60_000,
  },
  "creator-store-video": {
    maxBodyBytes: CREATOR_VIDEO_REQUEST_BODY_BYTES,
    rateLimit: 6,
    windowMs: 60_000,
  },
} as const;

export type CreatorApiRouteId = keyof typeof CREATOR_API_POLICIES;

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

// Beta-only, process-local protection. This is neither distributed nor sufficient
// for coordinated enforcement across multiple processes or containers.
const MAX_RATE_LIMIT_KEYS = 10_000;
const CLEANUP_INTERVAL_MS = 30_000;
const rateLimitEntries = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;

type CreatorApiSecurityErrorCode =
  | "authentication_required"
  | "invalid_json"
  | "request_too_large"
  | "rate_limit_exceeded"
  | "unsupported_content_type";

function securityError(
  status: number,
  code: CreatorApiSecurityErrorCode,
  message: string,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { success: false, error: message, code },
    { status, headers },
  );
}

function cleanupExpiredEntries(now: number) {
  if (
    rateLimitEntries.size < MAX_RATE_LIMIT_KEYS &&
    now - lastCleanupAt < CLEANUP_INTERVAL_MS
  ) {
    return;
  }

  for (const [key, entry] of rateLimitEntries) {
    if (entry.expiresAt <= now) rateLimitEntries.delete(key);
  }
  lastCleanupAt = now;
}

function applyRateLimit(
  userId: string,
  routeId: CreatorApiRouteId,
  now = Date.now(),
) {
  cleanupExpiredEntries(now);
  const policy = CREATOR_API_POLICIES[routeId];
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

function isJsonContentType(value: string | null) {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

export type CreatorApiRequestContext<TBody> = {
  user: AuthenticatedPrincipal;
  body: TBody;
  routeId: CreatorApiRouteId;
};

export type CreatorApiBoundaryResult<TBody> =
  | { ok: true; context: CreatorApiRequestContext<TBody> }
  | { ok: false; response: NextResponse };

export async function enforceCreatorApiBoundary<TBody = unknown>(
  request: Request,
  routeId: CreatorApiRouteId,
): Promise<CreatorApiBoundaryResult<TBody>> {
  const policy = CREATOR_API_POLICIES[routeId];

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      ok: false,
      response: securityError(
        415,
        "unsupported_content_type",
        "Content-Type must be application/json.",
      ),
    };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength.trim())) {
    const declaredBytes = Number(contentLength);
    if (Number.isSafeInteger(declaredBytes) && declaredBytes > policy.maxBodyBytes) {
      return {
        ok: false,
        response: securityError(
          413,
          "request_too_large",
          "Request body exceeds the configured limit.",
        ),
      };
    }
  }

  let user: AuthenticatedPrincipal;
  try {
    user = await authenticateRequest(request);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return {
        ok: false,
        response: securityError(
          401,
          "authentication_required",
          "Authentication required.",
        ),
      };
    }
    throw error;
  }

  const retryAfter = applyRateLimit(user.id, routeId);
  if (retryAfter !== null) {
    return {
      ok: false,
      response: securityError(
        429,
        "rate_limit_exceeded",
        "Too many requests. Please retry later.",
        { "Retry-After": String(retryAfter) },
      ),
    };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > policy.maxBodyBytes) {
    return {
      ok: false,
      response: securityError(
        413,
        "request_too_large",
        "Request body exceeds the configured limit.",
      ),
    };
  }

  let body: TBody;
  try {
    body = JSON.parse(rawBody) as TBody;
  } catch {
    return {
      ok: false,
      response: securityError(400, "invalid_json", "Malformed JSON request body."),
    };
  }

  return { ok: true, context: { user, body, routeId } };
}
