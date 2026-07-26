import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type CreatorQualityMode = "draft" | "standard" | "pro" | "cinematic";

function normalizeQualityMode(value: string | null): CreatorQualityMode {
  if (
    value === "draft" ||
    value === "standard" ||
    value === "pro" ||
    value === "cinematic"
  ) {
    return value;
  }

  return "standard";
}

export async function GET(req: NextRequest) {
  const qualityMode = normalizeQualityMode(
    new URL(req.url).searchParams.get("qualityMode"),
  );
  const primaryConfigured = Boolean(
    process.env.RUNWAY_API_KEY?.trim() ||
      process.env.RUNWAYML_API_SECRET?.trim(),
  );
  const premiumConfigured = Boolean(
    process.env.VEO_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim(),
  );

  if (qualityMode === "draft") {
    return NextResponse.json({
      ok: true,
      canGenerate: false,
      qualityMode,
      selectedProvider: null,
      fallbackUsed: false,
      reason:
        "Draft is a text-only planning mode. Select Pro or Cinematic for AI motion generation.",
    });
  }

  if (qualityMode === "standard") {
    return NextResponse.json({
      ok: true,
      canGenerate: false,
      qualityMode,
      selectedProvider: null,
      fallbackUsed: false,
      reason:
        "Standard uses still visuals, voice-over and light image motion. Select Pro or Cinematic to convert scene images into AI video blocks.",
    });
  }

  if (qualityMode === "cinematic" && premiumConfigured) {
    return NextResponse.json({
      ok: true,
      canGenerate: true,
      qualityMode,
      selectedProvider: "premium",
      fallbackUsed: false,
      primaryConfigured,
      premiumConfigured,
    });
  }

  if (primaryConfigured) {
    return NextResponse.json({
      ok: true,
      canGenerate: true,
      qualityMode,
      selectedProvider: "primary",
      fallbackUsed: qualityMode === "cinematic" && !premiumConfigured,
      primaryConfigured,
      premiumConfigured,
    });
  }

  return NextResponse.json(
    {
      ok: true,
      canGenerate: false,
      qualityMode,
      selectedProvider: null,
      fallbackUsed: false,
      primaryConfigured,
      premiumConfigured,
      reason:
        qualityMode === "cinematic"
          ? "Neither the premium nor the primary video production service is configured."
          : "The primary video production service is not configured.",
    },
    { status: 503 },
  );
}
