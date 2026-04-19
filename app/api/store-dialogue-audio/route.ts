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

function buildDialogueText(lines: DialogueLine[]) {
  return lines
    .filter((line) => line?.text?.trim())
    .map((line) => {
      const speaker = line.speaker?.trim() || "Karakter";
      const text = line.text.trim();
      return `${speaker}: ${text}`;
    })
    .join("\n");
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

    const modelId =
      typeof body?.modelId === "string" && body.modelId.trim()
        ? body.modelId.trim()
        : "eleven_multilingual_v2";

    const stability =
      typeof body?.stability === "number" ? body.stability : 0.5;

    const similarityBoost =
      typeof body?.similarityBoost === "number" ? body.similarityBoost : 0.8;

    if (!lines.length) {
      return NextResponse.json(
        { ok: false, error: "Dialogue lines are required" },
        { status: 400 }
      );
    }

    const fullText = buildDialogueText(lines);

    if (!fullText.trim()) {
      return NextResponse.json(
        { ok: false, error: "No dialogue audio could be generated" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const fallbackVoiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is missing");
    }

    const firstLineVoiceId =
      lines.find((line) => line?.voiceId?.trim())?.voiceId?.trim() || "";
    const finalVoiceId = firstLineVoiceId || fallbackVoiceId?.trim();

    if (!finalVoiceId) {
      throw new Error("No voiceId provided for dialogue synthesis");
    }

    const elevenRes = await fetch(
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
            stability,
            similarity_boost: similarityBoost,
            use_speaker_boost: true,
          },
        }),
      }
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

    return NextResponse.json({
      ok: true,
      audioUrl: publicData.publicUrl,
      audioPath: filePath,
      sourceText,
      settingsKey: `${modelId}-${stability}-${similarityBoost}`,
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