import { NextRequest, NextResponse } from "next/server";
import {
  getCreatorMediaRoute,
  normalizeCreatorQualityMode,
} from "@/lib/creator/mediaRouting";
import { getMediaProviderFacade } from "@/lib/providers";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const qualityMode = normalizeCreatorQualityMode(
    new URL(req.url).searchParams.get("qualityMode"),
    "standard",
  );
  const route = getCreatorMediaRoute(qualityMode);

  if (!route.actions.ai_video_blocks) {
    return NextResponse.json({
      ok: true,
      canGenerate: false,
      qualityMode,
      serviceTier: null,
      fallbackUsed: false,
      reason:
        qualityMode === "draft"
          ? "Draft is a text-only planning mode. Select Pro or Cinematic for AI motion generation."
          : "Standard uses still visuals, voice-over and light image motion. Select Pro or Cinematic to convert scene images into AI video blocks.",
    });
  }

  const health = getMediaProviderFacade().getCreatorVideoHealth(route);

  if (!health.canGenerate) {
    return NextResponse.json(
      {
        ok: true,
        canGenerate: false,
        qualityMode,
        serviceTier: null,
        fallbackUsed: false,
        reason: "The motion generation service is not configured for this environment.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    canGenerate: true,
    qualityMode,
    serviceTier: health.activeTier,
    fallbackUsed: health.fallbackUsed,
    routingStatus: health.reasonCode,
  });
}
