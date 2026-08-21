import {
  ProviderError,
  classifyProviderError,
} from "@/lib/providers/core/providerError";
import type {
  AddSharedVoiceInput,
  VoiceLanguage,
  VoiceLibraryQuery,
  VoiceLibraryResult,
  VoiceProvider,
  VoiceProviderResult,
  VoiceProviderSynthesisInput,
  VoiceRole,
} from "./types";
import type { CreatorVoiceLibraryVoice } from "@/lib/creator/voiceLibrary";
import {
  isProviderConfigured,
  resolveProviderEnvironmentValue,
} from "@/lib/runtime/providerEnvironment.mjs";

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

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeLabels(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const labels = Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item === "string" && item.trim())
      .map(([key, item]) => [key, String(item).trim()]),
  );

  return Object.keys(labels).length ? labels : undefined;
}

function normalizeAvailableVoice(value: unknown): CreatorVoiceLibraryVoice | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const voiceId = asText(item.voice_id);
  const name = asText(item.name);
  if (!voiceId || !name) return null;

  const labels = normalizeLabels(item.labels);
  const verifiedLanguages = Array.isArray(item.verified_languages)
    ? item.verified_languages
    : [];
  const firstVerifiedLanguage = verifiedLanguages.find(
    (language) => language && typeof language === "object",
  ) as Record<string, unknown> | undefined;

  return {
    voiceId,
    name,
    source: "available",
    description: asText(item.description),
    previewUrl: asText(item.preview_url),
    category: asText(item.category),
    language:
      asText(firstVerifiedLanguage?.language) ||
      asText(labels?.language) ||
      asText(labels?.locale),
    locale: asText(firstVerifiedLanguage?.locale) || asText(labels?.locale),
    accent: asText(labels?.accent),
    gender: asText(labels?.gender),
    age: asText(labels?.age),
    useCase: asText(labels?.use_case) || asText(labels?.usecase),
    descriptive: asText(labels?.description) || asText(labels?.descriptive),
    labels,
  };
}

function normalizeSharedVoice(value: unknown): CreatorVoiceLibraryVoice | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const voiceId = asText(item.voice_id);
  const name = asText(item.name);
  const publicOwnerId = asText(item.public_owner_id);
  if (!voiceId || !name || !publicOwnerId) return null;

  const labels = normalizeLabels(item.labels);

  return {
    voiceId,
    publicOwnerId,
    name,
    source: "shared",
    description: asText(item.description),
    previewUrl: asText(item.preview_url),
    category: asText(item.category),
    language: asText(item.language) || asText(labels?.language),
    locale: asText(item.locale) || asText(labels?.locale),
    accent: asText(item.accent) || asText(labels?.accent),
    gender: asText(item.gender) || asText(labels?.gender),
    age: asText(item.age) || asText(labels?.age),
    useCase: asText(item.use_case) || asText(labels?.use_case),
    descriptive: asText(item.descriptive) || asText(labels?.descriptive),
    labels,
  };
}

function appendQuery(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (value?.trim()) params.set(key, value.trim());
}

export class ElevenLabsVoiceAdapter implements VoiceProvider {
  readonly key = "elevenlabs" as const;
  readonly tier = "primary" as const;

  isAvailable() {
    return isProviderConfigured("elevenlabs");
  }

  getDefaultModelId() {
    return "eleven_multilingual_v2";
  }

  getDefaultVoiceId(language: VoiceLanguage, role: VoiceRole) {
    if (role === "narrator") {
      return resolveProviderEnvironmentValue(
        "elevenlabs",
        language === "en" ? "enNarratorVoiceId" : "trNarratorVoiceId",
      ) || null;
    }

    return resolveProviderEnvironmentValue(
      "elevenlabs",
      language === "en" ? "enCharacterVoiceId" : "trCharacterVoiceId",
    ) || null;
  }

  private getApiKey() {
    const apiKey = resolveProviderEnvironmentValue("elevenlabs", "apiKey");
    if (!apiKey) {
      throw new ProviderError("Voice provider is not configured.", {
        code: "not_configured",
        retryable: false,
      });
    }
    return apiKey;
  }

  async listVoices(input: VoiceLibraryQuery): Promise<VoiceLibraryResult> {
    const apiKey = this.getApiKey();
    const pageSize = Math.min(50, Math.max(1, input.pageSize || 24));

    try {
      if (input.source === "available") {
        const params = new URLSearchParams({ page_size: String(pageSize) });
        appendQuery(params, "search", input.search);
        appendQuery(params, "next_page_token", input.pageToken);

        const response = await fetchWithTimeout(
          `https://api.elevenlabs.io/v2/voices?${params.toString()}`,
          {
            method: "GET",
            headers: { "xi-api-key": apiKey },
            cache: "no-store",
          },
          20_000,
        );

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new ProviderError(
            `Voice library request failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
            {
              code:
                response.status === 401 || response.status === 403
                  ? "authentication"
                  : response.status === 429
                    ? "rate_limit"
                    : response.status >= 500
                      ? "upstream"
                      : "invalid_request",
              retryable: response.status === 429 || response.status >= 500,
              status: response.status,
            },
          );
        }

        const payload = (await response.json()) as Record<string, unknown>;
        const voices = (Array.isArray(payload.voices) ? payload.voices : [])
          .map(normalizeAvailableVoice)
          .filter((voice): voice is CreatorVoiceLibraryVoice => Boolean(voice));

        const filterValue = (actual: string | undefined, expected: string | undefined) =>
          !expected?.trim() || !actual || actual.toLowerCase().includes(expected.toLowerCase());

        return {
          voices: voices.filter(
            (voice) =>
              filterValue(voice.language || voice.locale, input.language) &&
              filterValue(voice.gender, input.gender) &&
              filterValue(voice.age, input.age) &&
              filterValue(voice.accent, input.accent) &&
              filterValue(voice.useCase, input.useCase),
          ),
          hasMore: payload.has_more === true,
          nextPageToken: asText(payload.next_page_token),
        };
      }

      const params = new URLSearchParams({ page_size: String(pageSize) });
      appendQuery(params, "search", input.search);
      appendQuery(params, "language", input.language);
      appendQuery(params, "gender", input.gender);
      appendQuery(params, "age", input.age);
      appendQuery(params, "accent", input.accent);
      appendQuery(params, "use_cases", input.useCase);
      if (input.pageToken) appendQuery(params, "page", input.pageToken);

      const response = await fetchWithTimeout(
        `https://api.elevenlabs.io/v1/shared-voices?${params.toString()}`,
        {
          method: "GET",
          headers: { "xi-api-key": apiKey },
          cache: "no-store",
        },
        20_000,
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new ProviderError(
          `Shared voice library request failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
          {
            code:
              response.status === 401 || response.status === 403
                ? "authentication"
                : response.status === 429
                  ? "rate_limit"
                  : response.status >= 500
                    ? "upstream"
                    : "invalid_request",
            retryable: response.status === 429 || response.status >= 500,
            status: response.status,
          },
        );
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const voices = (Array.isArray(payload.voices) ? payload.voices : [])
        .map(normalizeSharedVoice)
        .filter((voice): voice is CreatorVoiceLibraryVoice => Boolean(voice));

      const currentPage = Number.parseInt(input.pageToken || "0", 10);
      return {
        voices,
        hasMore: payload.has_more === true,
        nextPageToken:
          payload.has_more === true
            ? String(Number.isFinite(currentPage) ? currentPage + 1 : 1)
            : undefined,
      };
    } catch (error) {
      throw classifyProviderError(error, "Voice library could not be loaded.");
    }
  }

  async addSharedVoice(input: AddSharedVoiceInput) {
    const apiKey = this.getApiKey();

    try {
      const response = await fetchWithTimeout(
        `https://api.elevenlabs.io/v1/voices/add/${encodeURIComponent(input.publicOwnerId)}/${encodeURIComponent(input.voiceId)}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ new_name: input.name.slice(0, 100) }),
        },
        20_000,
      );

      if (response.status === 409) {
        // The voice may already exist in the workspace. Reusing the public ID is safe.
        return { voiceId: input.voiceId };
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new ProviderError(
          `Shared voice could not be added (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`,
          {
            code:
              response.status === 401 || response.status === 403
                ? "authentication"
                : response.status === 429
                  ? "rate_limit"
                  : response.status >= 500
                    ? "upstream"
                    : "invalid_request",
            retryable: response.status === 429 || response.status >= 500,
            status: response.status,
          },
        );
      }

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      return { voiceId: asText(payload.voice_id) || input.voiceId };
    } catch (error) {
      throw classifyProviderError(error, "Shared voice could not be added.");
    }
  }

  async synthesize(
    input: VoiceProviderSynthesisInput,
  ): Promise<VoiceProviderResult> {
    const apiKey = this.getApiKey();

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
