import { NextRequest, NextResponse } from "next/server";
import {
  getRuntimeHealth,
  normalizeRuntimeHealthMode,
} from "@/lib/runtime/runtimeHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const mode = normalizeRuntimeHealthMode(
    req.nextUrl.searchParams.get("mode"),
  );
  const health = getRuntimeHealth(mode);

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
