import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ExportMode = "video" | "image";

type SceneOptimizationItem = {
  sceneId: number;
  exportMode: ExportMode;
  reason: string;
  confidence: "low" | "medium" | "high";
  estimatedCostUsd: number;
};

function safeText(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function scoreScene(scene: any) {
  const combined = [
    safeText(scene?.text),
    safeText(scene?.narration),
    safeText(scene?.dialogue),
    safeText(scene?.motionHint),
    safeText(scene?.cameraDirection),
    safeText(scene?.emotion),
    safeText(scene?.visualPrompt),
  ].join(" ");

  let score = 0;
  const reasons: string[] = [];

  if (
    includesAny(combined, [
      "run",
      "running",
      "jump",
      "jumping",
      "fly",
      "flying",
      "rocket",
      "race",
      "chase",
      "spin",
      "fall",
      "falling",
      "explode",
      "blast",
      "transform",
      "moving",
      "motion",
      "zoom",
      "camera moves",
      "time travel",
      "speed",
      "fast",
      "launch",
      "walk",
      "walking",
      "turns",
      "opens",
    ])
  ) {
    score += 3;
    reasons.push("visible motion or action");
  }

  if (
    includesAny(combined, [
      "surprise",
      "wow",
      "magic",
      "dramatic",
      "big reveal",
      "reveal",
      "discovery",
      "appears",
      "suddenly",
      "changes",
    ])
  ) {
    score += 2;
    reasons.push("strong reveal or emotional beat");
  }

  if (
    includesAny(combined, [
      "explains",
      "learn",
      "question",
      "because",
      "means",
      "idea",
      "concept",
      "fact",
      "simple",
      "imagine",
      "narrator",
    ])
  ) {
    score -= 1;
    reasons.push("explanation-heavy scene can work as image");
  }

  if ((safeText(scene?.dialogue).length || 0) + (safeText(scene?.narration).length || 0) > 260) {
    score -= 1;
    reasons.push("long narration favors lower-cost image scene");
  }

  return { score, reasons };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scenes = Array.isArray(body?.scenes) ? body.scenes : [];
    const mode = body?.mode === "cinematic" || body?.mode === "conservative" ? body.mode : "balanced";
    const estimatedVideoCostUsd =
      typeof body?.estimatedVideoCostUsd === "number" && body.estimatedVideoCostUsd >= 0
        ? body.estimatedVideoCostUsd
        : 0.05;

    const threshold = mode === "cinematic" ? 1 : mode === "conservative" ? 4 : 2;

    const result: SceneOptimizationItem[] = scenes.map((scene: any, index: number) => {
      const { score, reasons } = scoreScene(scene);
      const exportMode: ExportMode = score >= threshold ? "video" : "image";
      const confidence =
        Math.abs(score - threshold) >= 3 ? "high" : Math.abs(score - threshold) >= 1 ? "medium" : "low";

      return {
        sceneId: Number(scene?.id || index + 1),
        exportMode,
        reason:
          reasons.length > 0
            ? reasons.join("; ")
            : exportMode === "video"
              ? "video recommended for visual energy"
              : "image recommended to reduce cost",
        confidence,
        estimatedCostUsd: exportMode === "video" ? estimatedVideoCostUsd : 0,
      };
    });

    const recommendedVideoScenes = result.filter((item: SceneOptimizationItem) => item.exportMode === "video").length;
    const recommendedImageScenes = result.length - recommendedVideoScenes;
    const estimatedRunwayCostUsd = Number((recommendedVideoScenes * estimatedVideoCostUsd).toFixed(2));
    const estimatedFullVideoCostUsd = Number((result.length * estimatedVideoCostUsd).toFixed(2));
    const estimatedSavingsPercent =
      estimatedFullVideoCostUsd > 0
        ? Math.round(((estimatedFullVideoCostUsd - estimatedRunwayCostUsd) / estimatedFullVideoCostUsd) * 100)
        : 0;

    return NextResponse.json({
      ok: true,
      result,
      summary: {
        totalScenes: result.length,
        recommendedVideoScenes,
        recommendedImageScenes,
        estimatedRunwayCostUsd,
        estimatedFullVideoCostUsd,
        estimatedSavingsPercent,
      },
    });
  } catch (error: any) {
    console.error("optimize-scenes error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Scene optimization failed.",
      },
      { status: 500 }
    );
  }
}
