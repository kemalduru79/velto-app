import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { getCreatorVoiceScriptGuidance } from "../../../lib/creator/voiceRouting";

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
  if (sceneCount <= 3) {
    return {
      hook: "Scene 1: preserve or strengthen the immediate hook",
      setup: "Scene 1: clarify the promise without a slow introduction",
      development: `Scene ${Math.min(2, sceneCount)}: deliver the core explanation or example`,
      climax: `Scene ${sceneCount}: sharpen the strongest payoff`,
      resolution: `Scene ${sceneCount}: close with one memorable takeaway`,
    };
  }

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


function stripSpeechMetadata(value: string) {
  return value
    .replace(/\[[^\]]{1,80}\]/g, " ")
    .replace(/\([^)]{1,80}\)/g, (match) => {
      const lower = match.toLowerCase();
      if (
        lower.includes("excited") ||
        lower.includes("whisper") ||
        lower.includes("sad") ||
        lower.includes("happy") ||
        lower.includes("angry") ||
        lower.includes("sfx") ||
        lower.includes("music") ||
        lower.includes("sound") ||
        lower.includes("emotion") ||
        lower.includes("voice")
      ) {
        return " ";
      }

      return match;
    })
    .replace(/\b(SFX|VFX|MUSIC|BGM|EMOTION|VOICE|NARRATOR|CAMERA)\s*:/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value: string) {
  return value
    .replace(/[“”"'’.,!?;:()\[\]{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function limitWords(value: string, maxWords: number) {
  const cleanValue = stripSpeechMetadata(value);
  const words = cleanValue.split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return cleanValue;
  }

  const clipped = words.slice(0, maxWords).join(" " );
  return clipped.replace(/[,:;\-–—]+$/, "") + ".";
}

function estimateSpeechSeconds(value: string, language: "tr" | "en") {
  const words = countWords(value);
  if (!words) {
    return 0;
  }

  const wordsPerMinute = language === "tr" ? 129 : 141;
  return Number(((words / wordsPerMinute) * 60).toFixed(2));
}

function getSceneWordBudget(
  durationSec: number,
  sceneCount: number,
  format: string,
  language: "tr" | "en",
) {
  const guidance = getCreatorVoiceScriptGuidance({
    format,
    durationSec,
    sceneCount,
    language,
  });
  const maxTotalWordsPerScene = guidance.maxWordsPerScene;
  const maxNarrationWords = Math.max(
    5,
    Math.floor(maxTotalWordsPerScene * 0.78),
  );
  const maxDialogueWords = Math.max(
    3,
    Math.floor(maxTotalWordsPerScene * 0.45),
  );

  return {
    targetSceneDuration: guidance.targetSceneDurationSec,
    maxTotalWordsPerScene,
    maxNarrationWords,
    maxDialogueWords,
    deliveryStyle: guidance.deliveryStyle,
    openingRule: guidance.openingRule,
    structureRule: guidance.structureRule,
  };
}

function fitSceneSpeechToBudget(scene: CreatorProductionScene, budget: ReturnType<typeof getSceneWordBudget>) {
  let narration = limitWords(asString(scene.narration, scene.text || ""), budget.maxNarrationWords);
  let dialogue = limitWords(asString(scene.dialogue, ""), budget.maxDialogueWords);

  const totalWords = countWords(`${narration} ${dialogue}`);

  if (totalWords > budget.maxTotalWordsPerScene) {
    const narrationShare = narration ? Math.max(5, Math.floor(budget.maxTotalWordsPerScene * 0.7)) : 0;
    const dialogueShare = dialogue ? Math.max(4, budget.maxTotalWordsPerScene - narrationShare) : 0;

    narration = narration ? limitWords(narration, narrationShare) : "";
    dialogue = dialogue ? limitWords(dialogue, dialogueShare) : "";
  }

  return { narration, dialogue };
}

function normalizeScenes(
  value: unknown,
  fallbackScenes: CreatorProductionScene[],
  budget: ReturnType<typeof getSceneWordBudget>,
  language: "tr" | "en",
) {
  if (!Array.isArray(value)) {
    value = fallbackScenes;
  }

  const rawScenes = value as CreatorProductionScene[];

  return rawScenes.map((scene, index) => {
    const fallbackScene = fallbackScenes[index] || {};
    const speech = fitSceneSpeechToBudget(
      {
        ...fallbackScene,
        ...scene,
      },
      budget
    );

    const narration = speech.narration;
    const dialogue = speech.dialogue;
    const text = limitWords(
      asString(scene.text, fallbackScene.text || narration || dialogue || ""),
      budget.maxTotalWordsPerScene
    );

    return {
      id: Number(scene.id) || fallbackScene.id || index + 1,
      text,
      narration,
      dialogue,
      cameraDirection: asString(
        stripSpeechMetadata(asString(scene.cameraDirection, fallbackScene.cameraDirection || "")),
        "Clean animated framing with clear focus."
      ),
      emotion: asString(
        stripSpeechMetadata(asString(scene.emotion, fallbackScene.emotion || "")),
        "curious and energetic"
      ),
      motionHint: asString(
        stripSpeechMetadata(
          asString(scene.motionHint, fallbackScene.motionHint || scene.visualPrompt || "")
        ),
        "Simple animated motion."
      ),
      visualPrompt: asString(scene.visualPrompt, fallbackScene.visualPrompt || ""),
      estimatedSpeechSeconds: estimateSpeechSeconds(
        `${narration} ${dialogue}`,
        language,
      ),
      speechWordCount: countWords(`${narration} ${dialogue}`),
    };
  });
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

    const contentLanguage = body?.language === "tr" ? "tr" : "en";
    const language = contentLanguage === "tr" ? "Turkish" : "English";
    const sceneCount = clampNumber(body?.sceneCount, scenes.length, scenes.length, scenes.length);
    const durationSec = clampNumber(body?.durationSec, sceneCount * 8, 5, 3600);
    const format = body?.format || "Shorts / 60 sec";
    const speechBudget = getSceneWordBudget(
      durationSec,
      sceneCount,
      format,
      contentLanguage,
    );
    const targetSceneDurationSec = speechBudget.targetSceneDuration;
    const pacingBlueprint = getPacingBlueprint(sceneCount);

    const systemPrompt = [
      "You are an expert CreatorLab director, YouTube retention editor, and professional voice-over producer for an 18+ creator workflow.",
      "This is Smart Production Sync refinement: improve scenes while preserving duration, scene count, and pacing strategy.",
      "Your job is to refine scene objects for stronger retention, clearer narration, better animation direction, and better first-3-second hook.",
      "Do not change the number of scenes.",
      "Keep the same JSON structure.",
      "Return strict JSON only. No markdown. No code fences.",
      "Never add emotion tags, SFX labels, camera labels, bracketed voice directions, or metadata inside narration/dialogue.",
      "Refinement must not make speech longer than the original timing budget.",
    ].join(" ");

    const userPrompt = {
      task: "Refine these production scenes for a high-retention animated YouTube video.",
      target: {
        topic: body?.topic || "",
        market: body?.country || "Global / International",
        ageGroup: body?.ageGroup || "Professional creator audience / 18+",
        contentType: body?.contentType || "Educational",
        format,
        durationSec,
        sceneCount,
        targetSceneDurationSec,
        maxTotalWordsPerScene: speechBudget.maxTotalWordsPerScene,
        maxNarrationWords: speechBudget.maxNarrationWords,
        maxDialogueWords: speechBudget.maxDialogueWords,
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
        `Hard speech budget per scene: maximum ${speechBudget.maxTotalWordsPerScene} total spoken words across narration + dialogue.`,
        `Narration should stay under ${speechBudget.maxNarrationWords} words per scene.`,
        `Dialogue should stay under ${speechBudget.maxDialogueWords} words per scene.`,
        "If you improve a scene, make it clearer and tighter; do not make it longer.",
        "Improve hook and pacing.",
        speechBudget.deliveryStyle,
        speechBudget.openingRule,
        speechBudget.structureRule,
        "Respect beginning-development-climax-resolution flow based on pacingBlueprint.",
        "Keep narration clean: no emotion tags, no sound-effect labels, no voice direction metadata.",
        "Make each scene visually clear for AI image generation.",
        "Keep language appropriate for the selected adult creator audience and subject.",
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

    let parsed: { scenes?: unknown };

    try {
      parsed = extractJsonObject(rawText) as { scenes?: unknown };
    } catch {
      console.error("creator-refine-scenes JSON parse error:", rawText);
      return NextResponse.json(
        { error: "Creator refine çıktısı JSON olarak parse edilemedi." },
        { status: 500 }
      );
    }

    const refinedScenes = normalizeScenes(
      parsed.scenes,
      scenes,
      speechBudget,
      contentLanguage,
    ).slice(0, scenes.length);

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
      speechBudget,
      pacingBlueprint,
    });
  } catch (e: unknown) {
    console.error("creator-refine-scenes error:", e);

    return NextResponse.json(
      {
        error:
          (e instanceof Error ? e.message : "") ||
          "Sahneler geliştirilirken hata oluştu.",
      },
      { status: 500 }
    );
  }
}
