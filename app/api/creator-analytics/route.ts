import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_BODY_BYTES = 16 * 1024;
const MAX_METADATA_BYTES = 6 * 1024;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT = 180;

const EVENT_NAMES = new Set([
  "outcome_selected",
  "workspace_opened",
  "stage_viewed",
  "brief_ready",
  "strategy_ready",
  "production_ready",
  "package_exported",
  "director_action_applied",
  "director_action_failed",
  "export_started",
  "export_succeeded",
  "export_failed",
]);

type RateBucket = {
  startedAt: number;
  count: number;
};

const rateBuckets = new Map<string, RateBucket>();

function safeString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizeMetadata(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: Record<string, string | number | boolean | null> = {};

  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = safeString(rawKey, 64);
    if (!key) continue;

    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("prompt") ||
      normalizedKey.includes("message") ||
      normalizedKey.includes("topic") ||
      normalizedKey.includes("title") ||
      normalizedKey.includes("narration") ||
      normalizedKey.includes("dialogue") ||
      normalizedKey.includes("input")
    ) {
      continue;
    }

    if (
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean" ||
      rawValue === null
    ) {
      result[key] =
        typeof rawValue === "string" ? rawValue.slice(0, 160) : rawValue;
    }
  }

  return result;
}

function isRateLimited(userId: string) {
  const now = Date.now();
  const current = rateBuckets.get(userId);

  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(userId, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  rateBuckets.set(userId, current);
  return current.count > RATE_LIMIT;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { accepted: false, error: "Telemetry payload is too large.", requestId },
        { status: 413 },
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { accepted: false, error: "Yetkisiz istek.", requestId },
        { status: 401 },
      );
    }

    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { accepted: false, error: "Geçersiz oturum.", requestId },
        { status: 401 },
      );
    }

    if (isRateLimited(user.id)) {
      return NextResponse.json(
        { accepted: false, error: "Telemetry rate limit exceeded.", requestId },
        { status: 429 },
      );
    }

    const body = await req.json();
    const eventName = safeString(body?.eventName, 64);
    const sessionId = safeString(body?.sessionId, 96);
    const projectState = body?.projectState === "saved" ? "saved" : "draft";
    const stage = Number(body?.stage);
    const metadata = sanitizeMetadata(body?.metadata);
    const metadataJson = JSON.stringify(metadata);

    if (!EVENT_NAMES.has(eventName)) {
      return NextResponse.json(
        { accepted: false, error: "Unsupported telemetry event.", requestId },
        { status: 400 },
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { accepted: false, error: "Telemetry session is required.", requestId },
        { status: 400 },
      );
    }

    if (Buffer.byteLength(metadataJson, "utf8") > MAX_METADATA_BYTES) {
      return NextResponse.json(
        { accepted: false, error: "Telemetry metadata is too large.", requestId },
        { status: 413 },
      );
    }

    const telemetryRecord = {
      type: "creatorlab_product_event",
      version: 1,
      requestId,
      receivedAt: new Date().toISOString(),
      userId: user.id,
      sessionId,
      projectState,
      stage: Number.isFinite(stage) && stage >= 1 && stage <= 4 ? stage : null,
      eventName,
      metadata,
      release:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
        process.env.NEXT_PUBLIC_APP_VERSION ||
        "local",
    };

    console.info(JSON.stringify(telemetryRecord));

    return NextResponse.json(
      {
        accepted: true,
        requestId,
        receivedAt: telemetryRecord.receivedAt,
      },
      {
        status: 202,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        type: "creatorlab_product_event_error",
        requestId,
        receivedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown telemetry error",
      }),
    );

    return NextResponse.json(
      {
        accepted: false,
        requestId,
        error: "Telemetry event could not be accepted.",
      },
      { status: 500 },
    );
  }
}
