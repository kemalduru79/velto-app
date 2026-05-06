import { NextRequest } from "next/server";

export const runtime = "nodejs";

type VoiceRole = "narrator" | "character" | "joe";

type ElevenLabsVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style?: number;
  speed?: number;
};

function normalizeRole(value: unknown): VoiceRole {
  if (value === "character" || value === "joe") {
    return value;
  }

  return "narrator";
}

function getVoiceIdForRole(role: VoiceRole, explicitVoiceId?: unknown) {
  if (typeof explicitVoiceId === "string" && explicitVoiceId.trim()) {
    return explicitVoiceId.trim();
  }

  if (role === "character" || role === "joe") {
    return (
      process.env.ELEVENLABS_JOE_VOICE_ID ||
      process.env.ELEVENLABS_CHARACTER_VOICE_ID ||
      process.env.ELEVENLABS_VOICE_ID ||
      ""
    ).trim();
  }

  return (
    process.env.ELEVENLABS_NARRATOR_VOICE_ID ||
    process.env.ELEVENLABS_VOICE_ID ||
    ""
  ).trim();
}

function getDefaultSettingsForRole(role: VoiceRole): ElevenLabsVoiceSettings {
  if (role === "character" || role === "joe") {
    return {
      stability: 0.34,
      similarity_boost: 0.82,
      style: 0.48,
      speed: 0.96,
    };
  }

  return {
    stability: 0.55,
    similarity_boost: 0.82,
    style: 0.22,
    speed: 0.9,
  };
}

function mergeVoiceSettings(
  role: VoiceRole,
  bodySettings: any
): ElevenLabsVoiceSettings {
  const defaults = getDefaultSettingsForRole(role);

  return {
    stability:
      typeof bodySettings?.stability === "number"
        ? bodySettings.stability
        : defaults.stability,
    similarity_boost:
      typeof bodySettings?.similarity_boost === "number"
        ? bodySettings.similarity_boost
        : typeof bodySettings?.similarityBoost === "number"
          ? bodySettings.similarityBoost
          : defaults.similarity_boost,
    style:
      typeof bodySettings?.style === "number" ? bodySettings.style : defaults.style,
    speed:
      typeof bodySettings?.speed === "number" ? bodySettings.speed : defaults.speed,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = body?.text;
    const role = normalizeRole(body?.role);

    if (!text || typeof text !== "string" || !text.trim()) {
      return Response.json(
        { error: "Seslendirme için metin bulunamadı." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = getVoiceIdForRole(role, body?.voiceId);
    const modelId =
      typeof body?.modelId === "string" && body.modelId.trim()
        ? body.modelId.trim()
        : "eleven_multilingual_v2";

    if (!apiKey) {
      return Response.json(
        { error: "ELEVENLABS_API_KEY eksik." },
        { status: 500 }
      );
    }

    if (!voiceId) {
      return Response.json(
        {
          error:
            role === "narrator"
              ? "Narrator voice ID eksik. ELEVENLABS_NARRATOR_VOICE_ID veya ELEVENLABS_VOICE_ID tanımlayın."
              : "Joe/character voice ID eksik. ELEVENLABS_JOE_VOICE_ID, ELEVENLABS_CHARACTER_VOICE_ID veya ELEVENLABS_VOICE_ID tanımlayın.",
          role,
        },
        { status: 500 }
      );
    }

    const voiceSettings = mergeVoiceSettings(role, body?.voice_settings || body?.voiceSettings);

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
          model_id: modelId,
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!elevenRes.ok) {
      const errorText = await elevenRes.text();

      return Response.json(
        {
          error: "ElevenLabs ses üretimini reddetti.",
          details: errorText,
          role,
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
        "X-Voice-Role": role,
        "X-Voice-Id": voiceId,
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
