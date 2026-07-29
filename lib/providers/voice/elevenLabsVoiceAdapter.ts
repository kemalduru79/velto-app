import {
  ProviderError,
  classifyProviderError,
} from "@/lib/providers/core/providerError";
import type {
  VoiceLanguage,
  VoiceProvider,
  VoiceProviderResult,
  VoiceProviderSynthesisInput,
  VoiceRole,
} from "./types";

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
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

export class ElevenLabsVoiceAdapter implements VoiceProvider {
  readonly key = "elevenlabs" as const;
  readonly tier = "primary" as const;

  isAvailable() {
    return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
  }

  getDefaultModelId() {
    return "eleven_multilingual_v2";
  }

  getDefaultVoiceId(language: VoiceLanguage, role: VoiceRole) {
    if (role === "narrator") {
      return (
        (language === "en"
          ? process.env.ELEVENLABS_EN_NARRATOR_VOICE_ID
          : process.env.ELEVENLABS_TR_NARRATOR_VOICE_ID
        )?.trim() || null
      );
    }

    return (
      (language === "en"
        ? process.env.ELEVENLABS_EN_CHARACTER_VOICE_ID
        : process.env.ELEVENLABS_TR_CHARACTER_VOICE_ID
      )?.trim() ||
      process.env.ELEVENLABS_VOICE_ID?.trim() ||
      null
    );
  }

  async synthesize(
    input: VoiceProviderSynthesisInput,
  ): Promise<VoiceProviderResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();

    if (!apiKey) {
      throw new ProviderError("Voice provider is not configured.", {
        code: "not_configured",
        retryable: false,
      });
    }

    try {
      const outputFormat = input.outputFormat || "mp3_44100_128";
      const response = await fetchWithTimeout(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}?output_format=${outputFormat}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: input.text,
            model_id: input.modelId,
            voice_settings: {
              stability: input.settings.stability,
              similarity_boost: input.settings.similarityBoost,
              style: input.settings.style,
              speed: input.settings.speed,
              use_speaker_boost: true,
            },
          }),
        },
        input.timeoutMs || 30_000,
      );

      const requestId =
        response.headers.get("request-id") ||
        response.headers.get("x-request-id") ||
        undefined;

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        const code =
          response.status === 401 || response.status === 403
            ? "authentication"
            : response.status === 402
              ? "quota"
              : response.status === 429
                ? "rate_limit"
                : response.status >= 500
                  ? "upstream"
                  : "invalid_request";

        throw new ProviderError(
          `Voice provider rejected synthesis (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
          {
            code,
            retryable: code === "rate_limit" || code === "upstream",
            status: response.status,
            requestId,
          },
        );
      }

      const audio = Buffer.from(await response.arrayBuffer());

      if (!audio.length) {
        throw new ProviderError("Voice provider returned empty audio.", {
          code: "upstream",
          retryable: true,
          requestId,
        });
      }

      return {
        audio,
        contentType: response.headers.get("content-type") || "audio/mpeg",
        requestId,
      };
    } catch (error) {
      throw classifyProviderError(
        error,
        "Voice generation could not be completed.",
      );
    }
  }
}
