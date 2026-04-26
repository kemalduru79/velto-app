import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
    const text = cleanTextForTTS(rawText);

    const sceneId =
      typeof body?.sceneId === "number" || typeof body?.sceneId === "string"
        ? String(body.sceneId)
        : "unknown";

    const projectKey =
      typeof body?.projectKey === "string" && body.projectKey.trim()
        ? body.projectKey.trim()
        : "temp-project";

    const narratorSettings = body?.narratorSettings || {};
    const language = body?.language === "en" ? "en" : "tr";

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Text is required after TTS cleanup" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is missing");
    }

    const fallbackVoiceId =
      language === "en"
        ? process.env.ELEVENLABS_EN_NARRATOR_VOICE_ID
        : process.env.ELEVENLABS_TR_NARRATOR_VOICE_ID;

    const voiceId =
      typeof narratorSettings.voiceId === "string" &&
      narratorSettings.voiceId.trim()
        ? narratorSettings.voiceId.trim()
        : fallbackVoiceId;

    if (!voiceId) {
      throw new Error("Narrator voiceId missing");
    }

    const modelId =
      typeof narratorSettings.modelId === "string" &&
      narratorSettings.modelId.trim()
        ? narratorSettings.modelId.trim()
        : "eleven_multilingual_v2";

    const stability = language === "en" ? 0.65 : 0.6;
    const similarityBoost = language === "en" ? 0.85 : 0.8;
    const style = 0.1;
    const speed = 1.0;

    const finalText = text;

    const elevenRes = await fetchWithTimeout(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: finalText,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            speed,
            use_speaker_boost: true,
          },
        }),
      },
      30000
    );

    if (!elevenRes.ok) {
      const errorText = await elevenRes.text().catch(() => "");
      throw new Error(errorText || "ElevenLabs error");
    }

    const arrayBuffer = await elevenRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const supabase = getSupabaseAdmin();

    const safeProjectKey = safeName(projectKey);
    const safeSceneId = safeName(sceneId);

    const filePath = `${safeProjectKey}/scene-${safeSceneId}-narration-${Date.now()}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from("audio")
      .upload(filePath, buffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from("audio")
      .getPublicUrl(filePath);

    return NextResponse.json({
      ok: true,
      audioUrl: publicData.publicUrl,
      audioPath: filePath,
      audioSourceText: finalText,
      cleanedText: finalText,
      originalText: rawText,
      language,
    });
  } catch (error: any) {
    console.error("store-audio error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Audio generation failed",
      },
      { status: 500 }
    );
  }
}
