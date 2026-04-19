import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = body?.text;

    if (!text || typeof text !== "string" || !text.trim()) {
      return Response.json(
        { error: "Seslendirme için metin bulunamadı." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey) {
      return Response.json(
        { error: "ELEVENLABS_API_KEY eksik." },
        { status: 500 }
      );
    }

    if (!voiceId) {
      return Response.json(
        { error: "ELEVENLABS_VOICE_ID eksik." },
        { status: 500 }
      );
    }

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
          },
        }),
      }
    );

    if (!elevenRes.ok) {
      const errorText = await elevenRes.text();

      return Response.json(
        {
          error: "ElevenLabs ses üretimini reddetti.",
          details: errorText,
          voiceId,
        },
        { status: 500 }
      );
    }

    return new Response(elevenRes.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("TTS route error:", error);

    return Response.json(
      {
        error: "Sunucu hatası oluştu.",
        details:
          process.env.NODE_ENV === "development"
            ? error?.message || "Bilinmeyen hata"
            : undefined,
      },
      { status: 500 }
    );
  }
}