import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

type CreatorProductionScene = {
  id?: number;
  text?: string;
  narration?: string;
  dialogue?: string;
  cameraDirection?: string;
  emotion?: string;
  motionHint?: string;
  visualPrompt?: string;
};

type CreatorRefineRequest = {
  topic?: string;
  country?: string;
  ageGroup?: string;
  contentType?: string;
  format?: string;
  durationSec?: number;
  sceneCount?: number;
  language?: "tr" | "en";
  productionPackage?: unknown;
  scenes?: CreatorProductionScene[];
};

function asString(value: unknown, fallback = "") {
  const result = String(value || "").trim();
  return result || fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(numericValue), min), max);
}

function getPacingBlueprint(sceneCount: number) {
  const hookEnd = Math.max(1, Math.ceil(sceneCount * 0.15));
  const setupEnd = Math.max(hookEnd + 1, Math.ceil(sceneCount * 0.3));
  const developmentEnd = Math.max(setupEnd + 1, Math.ceil(sceneCount * 0.72));
  const climaxEnd = Math.max(developmentEnd + 1, Math.ceil(sceneCount * 0.88));

  return {
    hook: `Scenes 1-${hookEnd}: preserve or strengthen the opening hook`,
    setup: `Scenes ${hookEnd + 1}-${setupEnd}: clarify context and promise`,
    development: `Scenes ${setupEnd + 1}-${developmentEnd}: improve pacing and visual examples`,
    climax: `Scenes ${developmentEnd + 1}-${climaxEnd}: sharpen the strongest fact or payoff`,
    resolution: `Scenes ${climaxEnd + 1}-${sceneCount}: recap and close with a memorable takeaway`,
  };
}

function normalizeScenes(value: unknown, fallbackScenes: CreatorProductionScene[]) {
  if (!Array.isArray(value)) {
    value = fallbackScenes;
  }

  const rawScenes = value as CreatorProductionScene[];

  return rawScenes.map((scene, index) => ({
    id: Number(scene.id) || fallbackScenes[index]?.id || index + 1,
    text: asString(scene.text, fallbackScenes[index]?.text || ""),
    narration: asString(scene.narration, fallbackScenes[index]?.narration || ""),
    dialogue: asString(scene.dialogue, fallbackScenes[index]?.dialogue || ""),
    cameraDirection: asString(
      scene.cameraDirection,
      fallbackScenes[index]?.cameraDirection || "Clean animated framing with clear focus."
    ),
    emotion: asString(scene.emotion, fallbackScenes[index]?.emotion || "curious and energetic"),
    motionHint: asString(
      scene.motionHint,
      fallbackScenes[index]?.motionHint || scene.visualPrompt || "Simple animated motion."
    ),
    visualPrompt: asString(scene.visualPrompt, fallbackScenes[index]?.visualPrompt || ""),
  }));
}

function extractJsonObject(rawText: string) {
  try {
    return JSON.parse(rawText);
  } catch {
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = rawText.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced);
    }

    throw new Error("JSON parse failed");
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Geçersiz oturum." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as CreatorRefineRequest | null;

    const scenes = Array.isArray(body?.scenes) ? body?.scenes || [] : [];

    if (!scenes.length) {
      return NextResponse.json(
        { error: "Refine için sahne listesi zorunlu." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY tanımlı değil." },
        { status: 500 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const language = body?.language === "tr" ? "Turkish" : "English";
    const sceneCount = clampNumber(body?.sceneCount, scenes.length, scenes.length, scenes.length);
    const durationSec = clampNumber(body?.durationSec, sceneCount * 8, 45, 360);
    const targetSceneDurationSec = Math.max(5, Math.round(durationSec / sceneCount));
    const pacingBlueprint = getPacingBlueprint(sceneCount);

    const systemPrompt = [
      "You are an expert animation director, YouTube retention editor, and child-safe content producer.",
      "This is Smart Production Sync refinement: improve scenes while preserving duration, scene count, and pacing strategy.",
      "Your job is to refine scene objects for stronger retention, clearer narration, better animation direction, and better first-3-second hook.",
      "Do not change the number of scenes.",
      "Keep the same JSON structure.",
      "Return strict JSON only. No markdown. No code fences.",
    ].join(" ");

    const userPrompt = {
      task: "Refine these production scenes for a high-retention animated YouTube video.",
      target: {
        topic: body?.topic || "",
        market: body?.country || "Global / International",
        ageGroup: body?.ageGroup || "8-12",
        contentType: body?.contentType || "Educational",
        format: body?.format || "Shorts / 60 sec",
        durationSec,
        sceneCount,
        targetSceneDurationSec,
        language,
      },
      pacingBlueprint,
      productionPackage: body?.productionPackage || null,
      scenes,
      requiredJsonShape: {
        scenes: [
          {
            id: 1,
            text: "string",
            narration: "string",
            dialogue: "string",
            cameraDirection: "string",
            emotion: "string",
            motionHint: "string",
            visualPrompt: "string"
          }
        ]
      },
      rules: [
        `Return exactly ${sceneCount} scenes.`,
        `Each scene should fit roughly ${targetSceneDurationSec} seconds.`,
        "Improve hook and pacing.",
        "Respect beginning-development-climax-resolution flow based on pacingBlueprint.",
        "Keep narration clean: no emotion tags, no sound-effect labels, no voice direction metadata.",
        "Make each scene visually clear for AI image generation.",
        "Keep language age-appropriate.",
        "Do not include unsafe content.",
        "Avoid long narration; each scene should be concise.",
        "Preserve the educational point of each scene.",
        "Do not collapse multiple scenes into one."
      ]
    };

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(userPrompt),
        },
      ],
      temperature: 0.5,
    });

    const rawText = response.output_text || "";

    let parsed: any;

    try {
      parsed = extractJsonObject(rawText);
    } catch {
      console.error("creator-refine-scenes JSON parse error:", rawText);
      return NextResponse.json(
        { error: "Creator refine çıktısı JSON olarak parse edilemedi." },
        { status: 500 }
      );
    }

    const refinedScenes = normalizeScenes(parsed.scenes, scenes).slice(0, scenes.length);

    if (refinedScenes.length !== scenes.length) {
      return NextResponse.json(
        { error: "Refine sonucu sahne sayısını değiştirdiği için reddedildi." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scenes: refinedScenes,
      durationSec,
      sceneCount,
      targetSceneDurationSec,
      pacingBlueprint,
    });
  } catch (e: any) {
    console.error("creator-refine-scenes error:", e);

    return NextResponse.json(
      { error: e?.message || "Sahneler geliştirilirken hata oluştu." },
      { status: 500 }
    );
  }
}
