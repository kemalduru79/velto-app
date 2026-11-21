// VELTO_VOICE_P1B — shared client/server contracts for the embedded voice library.

export type CreatorVoiceLibrarySource = "available" | "shared";

export type CreatorVoiceLibraryVoice = {
  voiceId: string;
  publicOwnerId?: string;
  name: string;
  description?: string;
  previewUrl?: string;
  source: CreatorVoiceLibrarySource;
  category?: string;
  language?: string;
  locale?: string;
  accent?: string;
  gender?: string;
  age?: string;
  useCase?: string;
  descriptive?: string;
  labels?: Record<string, string>;
};

export type CreatorVoiceLibrarySelection = CreatorVoiceLibraryVoice & {
  selectedAt: string;
};

export const CREATOR_VOICE_FAVORITES_STORAGE_KEY =
  "velto:creator-voice-library:favorites";
export const CREATOR_VOICE_RECENTS_STORAGE_KEY =
  "velto:creator-voice-library:recents";

export function normalizeVoiceLibrarySelection(
  value: unknown,
): CreatorVoiceLibrarySelection | undefined {
  if (!value || typeof value !== "object") return undefined;

  const candidate = value as Record<string, unknown>;
  const voiceId = typeof candidate.voiceId === "string" ? candidate.voiceId.trim() : "";
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const source = candidate.source === "shared" ? "shared" : "available";

  if (!voiceId || !name) return undefined;

  const optionalText = (key: string) =>
    typeof candidate[key] === "string" && candidate[key]
      ? String(candidate[key]).trim()
      : undefined;

  const labels =
    candidate.labels && typeof candidate.labels === "object" && !Array.isArray(candidate.labels)
      ? Object.fromEntries(
          Object.entries(candidate.labels as Record<string, unknown>)
            .filter(([, item]) => typeof item === "string")
            .map(([key, item]) => [key, String(item)]),
        )
      : undefined;

  return {
    voiceId,
    name,
    source,
    publicOwnerId: optionalText("publicOwnerId"),
    description: optionalText("description"),
    previewUrl: optionalText("previewUrl"),
    category: optionalText("category"),
    language: optionalText("language"),
    locale: optionalText("locale"),
    accent: optionalText("accent"),
    gender: optionalText("gender"),
    age: optionalText("age"),
    useCase: optionalText("useCase"),
    descriptive: optionalText("descriptive"),
    labels,
    selectedAt: optionalText("selectedAt") || new Date().toISOString(),
  };
}

export function toVoiceLibrarySelection(
  voice: CreatorVoiceLibraryVoice,
): CreatorVoiceLibrarySelection {
  return {
    ...voice,
    selectedAt: new Date().toISOString(),
  };
}

export function getVoiceLibraryDisplayMeta(
  voice?: CreatorVoiceLibraryVoice | CreatorVoiceLibrarySelection,
) {
  if (!voice) return "";

  return [
    voice.language || voice.locale,
    voice.accent,
    voice.gender,
    voice.age,
    voice.useCase,
    voice.descriptive,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function uniqueVoiceLibraryItems<T extends CreatorVoiceLibraryVoice>(
  items: T[],
  limit = 50,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (!item?.voiceId || seen.has(item.voiceId)) continue;
    seen.add(item.voiceId);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}
