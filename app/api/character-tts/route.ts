import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is missing`);
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const text =
      typeof body?.text === "string" ? body.text.trim() : "";
    const voiceId =
      typeof body?.voiceId === "string" && body.voiceId.trim()
        ? body.voiceId.trim()
        : process.env.ELEVENLABS_VOICE_ID?.trim();

    const modelId =
      typeof body?.modelId === "string" && body.modelId.trim()
        ? body.modelId.trim()
        : "eleven_multilingual_v2";

    const stability =
      typeof body?.stability === "number" ? body.stability : 0.5;

    const similarityBoost =
      typeof body?.similarityBoost === "number" ? body.similarityBoost : 0.8;

    if (!text) {
      return NextResponse.json(
        { ok: false, error: "text is required" },
        { status: 400 }
      );
    }

    if (!voiceId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "voiceId is required. Either provide a character voiceId or set ELEVENLABS_VOICE_ID.",
        },
        { status: 400 }
      );
    }

    const apiKey = getRequiredEnv("ELEVENLABS_API_KEY");

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
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
      const errorText = await elevenRes.text();

      return NextResponse.json(
        {
          ok: false,
          error: errorText || "Character TTS request failed",
        },
        { status: elevenRes.status }
      );
    }

    const audioBuffer = await elevenRes.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("character-tts error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Character TTS failed",
      },
      { status: 500 }
    );
  }
}