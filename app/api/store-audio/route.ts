import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

async function rewriteNarration(text: string) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return text;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You rewrite children's story narration for expressive text-to-speech performance.",
          },
          {
            role: "user",
            content: `
Rewrite this narration for a professional children's storyteller voice.

Rules:
- Keep the meaning the same
- Use shorter spoken sentences
- Add natural pauses using "..." where appropriate
- Add light emotional direction tags like [warm], [curious], [soft], [gentle surprise]
- Do not overact
- Do not make it theatrical
- Make it sound natural for narration
- Keep it concise

Narration:
${text}
            `,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      return text;
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const text =
      typeof body?.text === "string" ? body.text.trim() : "";

    const sceneId =
      typeof body?.sceneId === "number" || typeof body?.sceneId === "string"
        ? String(body.sceneId)
        : "unknown";

    const projectKey =
      typeof body?.projectKey === "string" && body.projectKey.trim()
        ? body.projectKey.trim()
        : "temp-project";

    const narratorSettings = body?.narratorSettings || {};

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Text is required" },
        { status: 400 }
      );
    }

    const enhancedText = await rewriteNarration(text);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const fallbackVoiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is missing");
    }

    const voiceId =
      typeof narratorSettings.voiceId === "string" &&
      narratorSettings.voiceId.trim()
        ? narratorSettings.voiceId.trim()
        : fallbackVoiceId?.trim();

    if (!voiceId) {
      throw new Error(
        "No narrator voiceId provided. Set narratorSettings.voiceId or ELEVENLABS_VOICE_ID."
      );
    }

    const modelId =
      typeof narratorSettings.modelId === "string" &&
      narratorSettings.modelId.trim()
        ? narratorSettings.modelId.trim()
        : "eleven_multilingual_v2";

    const stability =
      typeof narratorSettings.stability === "number"
        ? narratorSettings.stability
        : 0.32;

    const similarityBoost =
      typeof narratorSettings.similarityBoost === "number"
        ? narratorSettings.similarityBoost
        : 0.8;

    const style =
      typeof narratorSettings.style === "number"
        ? narratorSettings.style
        : 0.35;

    const speed =
      typeof narratorSettings.speed === "number"
        ? narratorSettings.speed
        : 0.93;

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: enhancedText,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            speed,
            use_speaker_boost: true,
          },
        }),
      }
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
      audioSourceText: text,
      enhancedText,
      settingsKey: [
        voiceId,
        modelId,
        stability,
        similarityBoost,
        style,
        speed,
      ].join("-"),
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