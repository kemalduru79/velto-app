import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import {
  creatorBriefRequestsDialogue,
  normalizeCreatorAdultScene,
} from "../../../lib/creator/adultContentGuard";

type SceneInput = {
  id?: unknown;
  text?: unknown;
  narration?: unknown;
  dialogue?: unknown;
  cameraDirection?: unknown;
  emotion?: unknown;
  motionHint?: unknown;
  visualPrompt?: unknown;
};

type RequestBody = {
  topic?: unknown;
  contentType?: unknown;
  format?: unknown;
  language?: unknown;
  isOpeningScene?: unknown;
  dialogueRequested?: unknown;
  scene?: SceneInput | null;
  previousScene?: SceneInput | null;
  nextScene?: SceneInput | null;
  targetDurationSec?: unknown;
  minWords?: unknown;
  targetWords?: unknown;
  maxWords?: unknown;
};

function asString(value: unknown, fallback = "") {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function countWords(value: string) {
  return value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

function extractJsonObject(raw: string) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
}

function parseJson(raw: string) {
  const extracted = extractJsonObject(raw);

  try {
    return JSON.parse(extracted) as Record<string, unknown>;
  } catch {
    return JSON.parse(
      extracted
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, "$1"),
    ) as Record<string, unknown>;
  }
}

function normalizeScene(value: SceneInput | null | undefined) {
  if (!value || typeof value !== "object") return null;

  return {
    id: Math.round(asNumber(value.id, 0)),
    text: asString(value.text),
    narration: asString(value.narration),
    dialogue: asString(value.dialogue),
    cameraDirection: asString(value.cameraDirection),
    emotion: asString(value.emotion),
    motionHint: asString(value.motionHint),
    visualPrompt: asString(value.visualPrompt),
  };
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const authorization = req.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as RequestBody | null;
    const scene = normalizeScene(body?.scene);

    if (!scene) {
      return NextResponse.json({ error: "scene is required." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const language: "tr" | "en" = body?.language === "tr" ? "tr" : "en";
    const contentType = asString(body?.contentType, "Professional creator video");
    const format = asString(body?.format, "youtube_video");
    const topic = asString(body?.topic, "CreatorLab video");
    const isOpeningScene = body?.isOpeningScene === true;
    const dialogueRequested =
      typeof body?.dialogueRequested === "boolean"
        ? body.dialogueRequested
        : creatorBriefRequestsDialogue({ topic, contentType, format });
    const allowDialogue = dialogueRequested || Boolean(scene.dialogue);
    const targetDurationSec = clamp(asNumber(body?.targetDurationSec, 12), 3, 60);
    const minWords = Math.max(3, Math.round(asNumber(body?.minWords, 10)));
    const targetWords = Math.max(minWords, Math.round(asNumber(body?.targetWords, 18)));
    const maxWords = Math.max(targetWords + 1, Math.round(asNumber(body?.maxWords, 24)));
    const currentWords = countWords([scene.narration, scene.dialogue].filter(Boolean).join(" "));
    const mode = currentWords < minWords ? "expand" : currentWords > maxWords ? "condense" : "balance";
    const previousScene = normalizeScene(body?.previousScene);
    const nextScene = normalizeScene(body?.nextScene);

    const systemPrompt = [
      "You are a senior documentary writer, YouTube script editor, and spoken-word timing editor for CreatorLab, an adult 18+ professional creator product.",
      "Rewrite only the supplied scene narration and optional dialogue so the scene is information-rich, natural, and safely timed.",
      "Never introduce child-audience language, a child host, Joe, classroom framing, cartoon dialogue, or juvenile audience-address formulas.",
      "Dialogue is opt-in: do not create dialogue when the source scene has none and the brief does not explicitly request a conversational format.",
      "Return strict valid JSON only. No markdown, comments, or code fences.",
      "Do not invent facts, quotes, dates, statistics, names, or claims that are not present in the supplied topic or neighboring scene context.",
      "Preserve the scene's meaning, sequence role, tone, and factual boundaries.",
      "Avoid filler, generic slogans, repetition, abrupt fragments, and empty short narration.",
      "Use multiple natural sentences when the duration budget supports them.",
      "Do not include speaker labels, emotion tags, SFX labels, or camera directions inside spoken text.",
      allowDialogue
        ? "Dialogue is allowed because the source scene or brief explicitly requests it. Keep it professional and necessary."
        : "Keep dialogue empty. Use professional narration or voice-over only.",
    ].join(" ");

    const userPrompt = {
      task:
        mode === "expand"
          ? "Expand the scene with meaningful detail already supported by the supplied context."
          : mode === "condense"
            ? "Condense the scene without losing its essential information or logical continuity."
            : "Polish and balance the scene for natural delivery within the supplied timing budget.",
      topic,
      contentType,
      format,
      isOpeningScene,
      dialogueRequested,
      outputLanguage: language === "tr" ? "Turkish" : "English",
      timingBudget: {
        targetDurationSec,
        minWords,
        targetWords,
        maxWords,
        currentWords,
      },
      previousScene,
      currentScene: scene,
      nextScene,
      requiredJsonShape: {
        narration: "string",
        dialogue: "string",
      },
      rules: [
        `Keep total narration plus dialogue between ${minWords} and ${maxWords} words, targeting about ${targetWords} words.`,
        "The revised scene must connect naturally to the previous and next scenes without repeating them.",
        "Preserve the current scene's factual boundaries and central purpose.",
        "Make the result immediately usable for professional voice generation.",
        "Do not open with Hey kids, Did you know, Can you guess, Wow, Wait, or equivalent childlike audience-address formulas.",
      ],
    };

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPrompt) },
      ],
      temperature: 0.25,
    });
    const parsed = parseJson(response.output_text || "");
    const normalizedScene = normalizeCreatorAdultScene(
      {
        ...scene,
        narration: asString(parsed.narration, scene.narration),
        dialogue: asString(parsed.dialogue, scene.dialogue),
      },
      {
        language,
        isOpeningScene,
        allowDialogue,
      },
    );
    const narration = asString(normalizedScene.narration);
    const dialogue = asString(normalizedScene.dialogue);
    const wordCount = countWords([narration, dialogue].filter(Boolean).join(" "));

    return NextResponse.json({
      success: true,
      narration,
      dialogue,
      wordCount,
      targetWords,
      mode,
    });
  } catch (error: unknown) {
    console.error("creator-scene-script-fit error:", error);
    return NextResponse.json(
      {
        error:
          (error instanceof Error ? error.message : "") ||
          "The scene script could not be fitted to the timing budget.",
      },
      { status: 500 },
    );
  }
}
