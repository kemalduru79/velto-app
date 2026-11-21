import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { resolveCreatorPublishAuthority } from "@/lib/creator/publishReadiness.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const projectId = new URL(request.url).searchParams.get("projectId")?.trim() || "";
    if (!projectId) {
      return NextResponse.json({ ready: false, status: "final_video_required", message: "Build your final video before publishing." }, { status: 400 });
    }
    const decision = await resolveCreatorPublishAuthority({ ownerUserId: principal.id, projectId });
    if (decision.ready) {
      return NextResponse.json({ ready: true, status: "ready", message: "Final video is current." }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
    }
    const status = decision.blocker === "project_required" || decision.blocker === "final_video_required"
      ? "final_video_required"
      : decision.blocker === "music_attention" ? "music_attention" : "production_changed";
    return NextResponse.json({ ready: false, status, message: decision.message }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ready: false, status: "final_video_required", message: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json({ ready: false, status: "production_changed", message: "Project readiness could not be verified." }, { status: 500 });
  }
}
