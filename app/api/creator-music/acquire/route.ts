import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { acquireCreatorPremiumMusic, CreatorMusicAcquisitionError } from "@/lib/creator/musicEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_BODY_KEYS = new Set(["productProfile", "projectId", "trackId"]);

export async function POST(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => !ALLOWED_BODY_KEYS.has(key)) || input.productProfile !== "creatorlab" || typeof input.projectId !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }
    const result = await acquireCreatorPremiumMusic({ userId: principal.id, projectId: input.projectId, trackId: input.trackId });
    return NextResponse.json({ ok: true, status: result.status, entitlementId: result.entitlement.id, reused: result.reused });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    if (error instanceof CreatorMusicAcquisitionError) {
      const status = error.code === "invalid_request" ? 400 : error.code === "forbidden" ? 404 : error.code === "in_progress" ? 409 : 503;
      return NextResponse.json({ ok: false, error: "Premium music acquisition is unavailable." }, { status });
    }
    console.error("creator premium music acquisition failed", { type: "unknown" });
    return NextResponse.json({ ok: false, error: "Premium music acquisition is unavailable." }, { status: 503 });
  }
}
