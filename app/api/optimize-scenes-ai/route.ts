import OpenAI from "openai";
import { NextResponse } from "next/server";
import { CREATOR_COST_BASIS_LABEL, CREATOR_DEFAULT_VIDEO_SCENE_COST_USD } from "@/lib/creatorCostConfig";

export const runtime = "nodejs";

type ExportMode = "video" | "image";
type Confidence = "low" | "medium" | "high";

type SceneOptimizationItem = {
  sceneId: number;
  exportMode: ExportMode;
  reason: string;
  confidence: Confidence;
  estimatedCostUsd: number;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({ apiKey });
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeMode(value: unknown): ExportMode {
  return value === "video" ? "video" : "image";
}

function normalizeConfidence(value: unknown): Confidence {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return "medium";
}

function parseJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

function fallbackOptimizeScenes(
  scenes: any[],
  estimatedVideoCostUsd: number
): SceneOptimizationItem[] {
  const motionTerms = [
    "run", "running", "jump", "jumping", "fly", "flying", "rocket", "launch",
    "race", "chase", "spin", "fall", "transform", "motion", "speed", "fast",
    "open", "turn", "walk", "walking", "zoom", "travel", "time travel"
  ];

  const explanationTerms = [
    "explain", "explains", "learn", "means", "because", "idea", "concept",
    "fact", "question", "imagine", "narrator"
  ];

  return scenes.map((scene, index) => {
    const text = [
      scene?.text,
      scene?.narration,
      scene?.dialogue,
      scene?.motionHint,
      scene?.cameraDirection,
      scene?.emotion,
      scene?.visualPrompt,
    ]
      .map((item) => safeString(item).toLowerCase())
      .join(" ");

    const motionScore = motionTerms.filter((term) => text.includes(term)).length;
    const explanationScore = explanationTerms.filter((term) => text.includes(term)).length;

    const exportMode: ExportMode =
      motionScore >= 2 || (motionScore >= 1 && explanationScore === 0)
        ? "video"
        : "image";

    return {
      sceneId: Number(scene?.id || index + 1),
      exportMode,
      reason:
        exportMode === "video"
          ? "Fallback: visible movement or visual payoff detected."
          : "Fallback: explanation/static scene can use image to reduce cost.",
      confidence: motionScore >= 2 ? "high" : "medium",
      estimatedCostUsd: exportMode === "video" ? estimatedVideoCostUsd : 0,
    };
  });
}

function buildSummary(result: SceneOptimizationItem[], estimatedVideoCostUsd: number) {
  const recommendedVideoScenes = result.filter((item) => item.exportMode === "video").length;
  const recommendedImageScenes = result.length - recommendedVideoScenes;
  const estimatedRunwayCostUsd = Number((recommendedVideoScenes * estimatedVideoCostUsd).toFixed(2));
  const estimatedFullVideoCostUsd = Number((result.length * estimatedVideoCostUsd).toFixed(2));
  const estimatedSavingsPercent =
    estimatedFullVideoCostUsd > 0
      ? Math.round(((estimatedFullVideoCostUsd - estimatedRunwayCostUsd) / estimatedFullVideoCostUsd) * 100)
      : 0;

  return {
    totalScenes: result.length,
    recommendedVideoScenes,
    recommendedImageScenes,
    estimatedRunwayCostUsd,
    estimatedFullVideoCostUsd,
    estimatedSavingsPercent,
    pricingBasis: CREATOR_COST_BASIS_LABEL,
  };
}

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const client = getOpenAIClient();

    const scenes = Array.isArray(body?.scenes) ? body.scenes : [];
    const estimatedVideoCostUsd =
      typeof body?.estimatedVideoCostUsd === "number" && body.estimatedVideoCostUsd >= 0
        ? body.estimatedVideoCostUsd
        : CREATOR_DEFAULT_VIDEO_SCENE_COST_USD;

    if (scenes.length === 0) {
      return NextResponse.json({
        ok: true,
        result: [],
        summary: buildSummary([], estimatedVideoCostUsd),
      });
    }

    const compactScenes = scenes.slice(0, 60).map((scene: any, index: number) => ({
      id: Number(scene?.id || index + 1),
      text: safeString(scene?.text).slice(0, 600),
      narration: safeString(scene?.narration).slice(0, 600),
      dialogue: safeString(scene?.dialogue).slice(0, 400),
      cameraDirection: safeString(scene?.cameraDirection).slice(0, 300),
      emotion: safeString(scene?.emotion).slice(0, 120),
      motionHint: safeString(scene?.motionHint).slice(0, 300),
      visualPrompt: safeString(scene?.visualPrompt).slice(0, 500),
    }));

    const prompt = `
You are a production cost optimization director for an AI video generation product.

Goal:
Choose whether each scene should be exported as "video" or "image" to reduce Runway video cost while preserving YouTube viewing quality.

Return STRICT JSON only:
{
  "items": [
    {
      "sceneId": 1,
      "exportMode": "video" | "image",
      "reason": "short practical reason",
      "confidence": "low" | "medium" | "high"
    }
  ]
}

Decision rules:
- Choose "video" when motion is essential: movement, transformation, reveal, travel, action, physical change, strong visual payoff.
- Choose "image" when the scene is explanation-heavy, narration-heavy, static, conceptual, or can be understood from one strong illustration.
- For educational videos for kids, use video only where it improves understanding or engagement.
- Balanced mode: prefer cost savings but keep important motion moments.
- Avoid recommending video for every scene.
- Avoid recommending image for every scene unless all scenes are static.
- Keep reasons concise and practical.

Context:
Title: ${safeString(body?.title)}
Story premise: ${safeString(body?.storyPremise)}
Language: ${safeString(body?.language, "en")}
Age group: ${safeString(body?.ageGroup, "8-12")}
Content type: ${safeString(body?.contentType, "educational")}
Target duration: ${safeString(body?.videoDurationSec, "60")} seconds

Scenes:
${JSON.stringify(compactScenes, null, 2)}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: "You return strict JSON only. No markdown. No commentary outside JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const parsed = parseJson(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    let result: SceneOptimizationItem[] = compactScenes.map((scene: any) => {
      const match = items.find((item: any) => Number(item?.sceneId) === Number(scene.id));

      const exportMode = normalizeMode(match?.exportMode);
      const confidence = normalizeConfidence(match?.confidence);

      return {
        sceneId: Number(scene.id),
        exportMode,
        reason:
          safeString(match?.reason) ||
          (exportMode === "video"
            ? "AI recommends video for visual engagement."
            : "AI recommends image to reduce cost."),
        confidence,
        estimatedCostUsd: exportMode === "video" ? estimatedVideoCostUsd : 0,
      };
    });

    if (result.length >= 6 && result.every((item) => item.exportMode === "video")) {
      const fallback = fallbackOptimizeScenes(compactScenes, estimatedVideoCostUsd);
      result = result.map((item: SceneOptimizationItem, index: number) =>
        fallback[index]?.exportMode === "image" ? fallback[index] : item
      );
    }

    return NextResponse.json({
      ok: true,
      result,
      summary: buildSummary(result, estimatedVideoCostUsd),
      engine: "ai",
    });
  } catch (error: any) {
    console.error("optimize-scenes-ai error:", error);

    const scenes = Array.isArray(body?.scenes) ? body.scenes : [];
    const estimatedVideoCostUsd =
      typeof body?.estimatedVideoCostUsd === "number" && body.estimatedVideoCostUsd >= 0
        ? body.estimatedVideoCostUsd
        : CREATOR_DEFAULT_VIDEO_SCENE_COST_USD;
    const result = fallbackOptimizeScenes(scenes, estimatedVideoCostUsd);

    return NextResponse.json({
      ok: true,
      result,
      summary: buildSummary(result, estimatedVideoCostUsd),
      engine: "fallback",
      warning: error?.message || "AI optimizer failed; fallback optimizer used.",
    });
  }
}
