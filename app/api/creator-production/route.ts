import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

type CreatorMentorResult = {
  audienceInsight?: string[];
  hookPatterns?: string[];
  videoIdeas?: Array<{ title?: string; concept?: string }>;
  recommendedIdea?: {
    title?: string;
    reason?: string;
  };
  productionPlan?: string[];
};

type CreatorProductionRequest = {
  topic?: string;
  country?: string;
  ageGroup?: string;
  contentType?: string;
  format?: string;
  durationSec?: number;
  sceneCount?: number;
  language?: "tr" | "en";
  mentorAnalysis?: CreatorMentorResult;
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
    hook: `Scenes 1-${hookEnd}: hook, curiosity gap, and immediate visual payoff`,
    setup: `Scenes ${hookEnd + 1}-${setupEnd}: setup, context, and the first clear learning promise`,
    development: `Scenes ${setupEnd + 1}-${developmentEnd}: core explanation with escalating visual examples`,
    climax: `Scenes ${developmentEnd + 1}-${climaxEnd}: strongest fact, surprise, or visual demonstration`,
    resolution: `Scenes ${climaxEnd + 1}-${sceneCount}: recap, memorable takeaway, and soft engagement question`,
  };
}


function extractJsonObject(raw: string) {
  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    return cleaned;
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}


function normalizeCharacters(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 4).map((item, index) => {
    const character = item as Record<string, unknown>;

    return {
      name: asString(character.name, `Character ${index + 1}`),
      age: asString(character.age, ""),
      appearance: asString(character.appearance, ""),
      outfit: asString(character.outfit, ""),
      accessory: asString(character.accessory, ""),
      personality: asString(character.personality, ""),
      referenceImage: "",
      voiceId: "",
    };
  });
}

function normalizeScenes(value: unknown, sceneCount: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, sceneCount).map((item, index) => {
    const scene = item as Record<string, unknown>;

    return {
      id: Number(scene.id) || index + 1,
      text: asString(scene.text),
      narration: asString(scene.narration),
      dialogue: asString(scene.dialogue),
      cameraDirection: asString(
        scene.cameraDirection,
        "Clean animated framing with clear focus."
      ),
      emotion: asString(scene.emotion, "curious and energetic"),
      motionHint: asString(
        scene.motionHint,
        asString(scene.visualPrompt, "Simple animated movement.")
      ),
      visualPrompt: asString(scene.visualPrompt),
    };
  });
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

    const body = (await req.json().catch(() => null)) as CreatorProductionRequest | null;

    const topic = asString(body?.topic);
    const country = asString(body?.country, "Global / International");
    const ageGroup = asString(body?.ageGroup, "8-12");
    const contentType = asString(body?.contentType, "Educational");
    const format = asString(body?.format, "Shorts / 60 sec");
    const durationSec = clampNumber(body?.durationSec, 60, 45, 360);
    const sceneCount = clampNumber(body?.sceneCount, 7, 5, 36);
    const targetSceneDurationSec = Math.max(5, Math.round(durationSec / sceneCount));
    const language = body?.language === "tr" ? "tr" : "en";
    const mentorAnalysis = body?.mentorAnalysis || {};
    const pacingBlueprint = getPacingBlueprint(sceneCount);

    if (!topic && !mentorAnalysis?.recommendedIdea?.title) {
      return NextResponse.json(
        { error: "topic veya recommendedIdea zorunlu." },
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

    const systemPrompt = [
      "You are a senior YouTube animated video producer, retention editor, and child-safe storytelling designer.",
      "You convert a creator mentor analysis into a production-ready package for an AI video generation pipeline.",
      "This is Smart Production Sync: duration, scene count, pacing, and story structure must match.",
      "Return strict JSON only. No markdown. No code fences.",
      "The output must be compatible with a scene-based animation engine.",
    ].join(" ");

    const userPrompt = {
      task: "Create a synchronized production-ready video package.",
      target: {
        market: country,
        ageGroup,
        contentType,
        format,
        durationSec,
        sceneCount,
        targetSceneDurationSec,
        outputLanguage: language === "en" ? "English" : "Turkish",
      },
      pacingBlueprint,
      topic,
      mentorAnalysis,
      requiredJsonShape: {
        title: "string",
        hook: "string",
        storyPremise: "string",
        characters: [
          {
            name: "string",
            age: "string",
            appearance: "string",
            outfit: "string",
            accessory: "string",
            personality: "string"
          }
        ],
        visualBible: {
          style: "string",
          palette: "string",
          camera: "string",
          consistencyRules: "string"
        },
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
        ],
        thumbnailIdea: "string",
        youtubeTitle: "string",
        caption: "string"
      },
      rules: [
        `Create exactly ${sceneCount} scenes.`,
        `Design the video for approximately ${durationSec} seconds total.`,
        `Each scene should fit roughly ${targetSceneDurationSec} seconds.`,
        "Scene 1 must open with a strong 3-second curiosity hook.",
        "Follow the provided pacingBlueprint so the video has a clear beginning, development, climax, and resolution.",
        "Do not create a 7-scene short if sceneCount is larger; match the requested scene count.",
        "Keep narration clean. Do not include emotion tags, voice labels, or sound-effect labels inside narration.",
        "Keep each narration line concise enough for the target scene duration.",
        "Dialogue may be empty if the format is narrator-led.",
        "Scenes must be visual and easy for AI image/video generation.",
        "Keep content age-appropriate, educational, and safe.",
        "Create simple reusable characters if the video benefits from character continuity.",
        "Avoid repetitive scene openings; each scene should advance the story or explanation."
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
      temperature: 0.62,
    });

    const rawText = response.output_text || "";
    const cleanedJson = extractJsonObject(rawText);

    let parsed: any;

    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      console.error("creator-production JSON parse error:", rawText);

      return NextResponse.json(
        { error: "Creator production çıktısı JSON olarak parse edilemedi." },
        { status: 500 }
      );
    }

    const characters = normalizeCharacters(parsed.characters);
    const scenes = normalizeScenes(parsed.scenes, sceneCount);

    if (!characters.length || !scenes.length) {
      return NextResponse.json(
        { error: "Production package eksik karakter veya sahne içeriyor." },
        { status: 500 }
      );
    }

    if (scenes.length < Math.max(5, Math.floor(sceneCount * 0.75))) {
      return NextResponse.json(
        {
          error: `Production package beklenen sahne sayısına ulaşamadı. Beklenen: ${sceneCount}, gelen: ${scenes.length}.`,
        },
        { status: 500 }
      );
    }

    const productionPackage = {
      title: asString(
        parsed.title,
        asString(mentorAnalysis?.recommendedIdea?.title, "Creator Lab Video")
      ),
      hook: asString(parsed.hook),
      storyPremise: asString(parsed.storyPremise),
      characters,
      visualBible: {
        style: asString(
          parsed?.visualBible?.style,
          "Bright, clean 2D animated style suitable for children."
        ),
        palette: asString(
          parsed?.visualBible?.palette,
          "Vivid but balanced colors with strong subject/background contrast."
        ),
        camera: asString(
          parsed?.visualBible?.camera,
          "Simple clear shots, gentle pans, and occasional close-ups."
        ),
        consistencyRules: asString(
          parsed?.visualBible?.consistencyRules,
          "Keep characters, colors, and accessories consistent across scenes."
        ),
      },
      scenes,
      thumbnailIdea: asString(parsed.thumbnailIdea),
      youtubeTitle: asString(parsed.youtubeTitle),
      caption: asString(parsed.caption),
      durationSec,
      sceneCount,
      targetSceneDurationSec,
      pacingBlueprint,
    };

    return NextResponse.json({
      success: true,
      productionPackage,
    });
  } catch (e: any) {
    console.error("creator-production error:", e);

    return NextResponse.json(
      { error: e?.message || "Creator production paketi oluşturulurken hata oluştu." },
      { status: 500 }
    );
  }
}
