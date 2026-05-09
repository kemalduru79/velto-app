import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type DialogueLine = {
  speaker: string;
  text: string;
  voiceId?: string;
};

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is missing");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function cleanTextForTTS(value: string) {
  if (!value) {
    return "";
  }

  let text = value;

  text = text
    .replace(
      /\([^)]*(?:ton|anlatım|duygu|emotion|style|voice|narrator|ses|sakin|doğal|heyecanlı|neşeli|duygusal|yumuşak|enerjik|meraklı|sıcak)[^)]*\)/gi,
      ""
    )
    .replace(
      /\[[^\]]*(?:ton|anlatım|duygu|emotion|style|voice|narrator|ses|sakin|doğal|heyecanlı|neşeli|duygusal|yumuşak|enerjik|meraklı|sıcak)[^\]]*\]/gi,
      ""
    )
    .replace(
      /(?:^|\n)\s*(?:ses\s*tonu|anlatım\s*tonu|duygu|emotion|voice\s*style|narration\s*style)\s*:\s*[^\n.]*[.\n]?/gi,
      "\n"
    )
    .replace(
      /(?:sakin|doğal|heyecanlı|neşeli|duygusal|yumuşak|enerjik|meraklı|sıcak)\s*,?\s*(?:ve\s*)?(?:sakin|doğal|heyecanlı|neşeli|duygusal|yumuşak|enerjik|meraklı|sıcak)?\s*(?:anlatım\s*)?tonu\.?/gi,
      ""
    )
    .replace(
      /(?:calm|natural|warm|excited|gentle|soft|emotional|cheerful|curious)\s*(?:and\s*)?(?:calm|natural|warm|excited|gentle|soft|emotional|cheerful|curious)?\s*(?:narration\s*)?(?:tone|voice)\.?/gi,
      ""
    )
    .replace(/\*\*/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

function buildDialogueText(lines: DialogueLine[]) {
  return lines
    .filter((line) => line?.text?.trim())
    .map((line) => cleanTextForTTS(line.text))
    .filter((text) => text.trim())
    .join("\n");
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getNumericSetting(
  value: unknown,
  fallback: number,
  min = 0,
  max = 1.2
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(max, Math.max(min, value));
  }

  return fallback;
}

function getCharacterVoiceSettings(language: "tr" | "en", body: any) {
  const defaults =
    language === "en"
      ? {
          stability: 0.28,
          similarityBoost: 0.86,
          style: 0.62,
          speed: 1.02,
        }
      : {
          stability: 0.38,
          similarityBoost: 0.8,
          style: 0.44,
          speed: 0.95,
        };

  return {
    stability: getNumericSetting(body?.stability, defaults.stability),
    similarityBoost: getNumericSetting(body?.similarityBoost, defaults.similarityBoost),
    style: getNumericSetting(body?.style, defaults.style),
    speed: getNumericSetting(body?.speed, defaults.speed, 0.7, 1.2),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const lines: DialogueLine[] = Array.isArray(body?.lines) ? body.lines : [];

    const projectKey =
      typeof body?.projectKey === "string" && body.projectKey.trim()
        ? body.projectKey.trim()
        : "temp-project";

    const sceneId =
      typeof body?.sceneId === "number" || typeof body?.sceneId === "string"
        ? String(body.sceneId)
        : "unknown";

    const sourceText =
      typeof body?.sourceText === "string" ? body.sourceText : "";

    const language = body?.language === "en" ? "en" : "tr";

    const modelId =
      typeof body?.modelId === "string" && body.modelId.trim()
        ? body.modelId.trim()
        : "eleven_multilingual_v2";

    if (!lines.length) {
      return NextResponse.json(
        { ok: false, error: "Dialogue lines are required" },
        { status: 400 }
      );
    }

    const fullText = buildDialogueText(lines);

    if (!fullText.trim()) {
      return NextResponse.json(
        { ok: false, error: "No dialogue audio could be generated after TTS cleanup" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is missing");
    }

    const defaultCharacterVoiceId =
      language === "en"
        ? process.env.ELEVENLABS_EN_CHARACTER_VOICE_ID
        : process.env.ELEVENLABS_TR_CHARACTER_VOICE_ID;

    const narratorVoiceId =
      language === "en"
        ? process.env.ELEVENLABS_EN_NARRATOR_VOICE_ID
        : process.env.ELEVENLABS_TR_NARRATOR_VOICE_ID;

    const legacyFallbackVoiceId = process.env.ELEVENLABS_VOICE_ID;

    const firstLineVoiceId =
      lines.find((line) => line?.voiceId?.trim())?.voiceId?.trim() || "";

    const finalVoiceId =
      firstLineVoiceId?.trim() &&
      firstLineVoiceId?.trim() !== narratorVoiceId?.trim()
        ? firstLineVoiceId.trim()
        : defaultCharacterVoiceId?.trim() ||
          legacyFallbackVoiceId?.trim();

    if (!finalVoiceId) {
      throw new Error(
        "No character voiceId provided. Set character voiceId or ELEVENLABS_TR_CHARACTER_VOICE_ID / ELEVENLABS_EN_CHARACTER_VOICE_ID."
      );
    }

    const voiceSettings = getCharacterVoiceSettings(language, body);

    const elevenRes = await fetchWithTimeout(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: fullText,
          model_id: modelId,
          voice_settings: {
            stability: voiceSettings.stability,
            similarity_boost: voiceSettings.similarityBoost,
            style: voiceSettings.style,
            speed: voiceSettings.speed,
            use_speaker_boost: true,
          },
        }),
      },
      30000
    );

    if (!elevenRes.ok) {
      const errorText = await elevenRes.text().catch(() => "");
      throw new Error(errorText || "ElevenLabs dialogue synthesis failed");
    }

    const arrayBuffer = await elevenRes.arrayBuffer();
    const outputBuffer = Buffer.from(arrayBuffer);

    const supabase = getSupabaseAdmin();

    const safeProjectKey = safeName(projectKey);
    const safeSceneId = safeName(sceneId);
    const filePath = `${safeProjectKey}/scene-${safeSceneId}-dialogue-${Date.now()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("dialogue-audio")
      .upload(filePath, outputBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from("dialogue-audio")
      .getPublicUrl(filePath);

    const settingsKey = [
      finalVoiceId,
      modelId,
      voiceSettings.stability,
      voiceSettings.similarityBoost,
      voiceSettings.style,
      voiceSettings.speed,
      language,
    ].join("-");

    return NextResponse.json({
      ok: true,
      audioUrl: publicData.publicUrl,
      audioPath: filePath,
      sourceText,
      cleanedText: fullText,
      language,
      voiceId: finalVoiceId,
      voiceSettings,
      settingsKey,
    });
  } catch (error: any) {
    console.error("store-dialogue-audio error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Dialogue audio could not be stored",
      },
      { status: 500 }
    );
  }
}
