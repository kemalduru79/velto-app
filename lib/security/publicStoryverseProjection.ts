export const PUBLIC_STORYVERSE_LIMITS = {
  maxTitleLength: 500,
  maxPremiseLength: 20_000,
  maxCharacterCount: 100,
  maxSceneCount: 500,
  maxSceneTextLength: 50_000,
  maxCharacterDisplayFieldLength: 2_000,
  maxMediaUrlLength: 8_192,
  maxSerializedDtoBytes: 4 * 1024 * 1024,
} as const;

export type PublicStoryverseProjectSourceRecord = {
  title: unknown;
  story_premise: unknown;
  language: unknown;
  flow_type: unknown;
  characters: unknown;
  scenes: unknown;
  published_at: unknown;
  exported_movie_url: unknown;
};

export type PublicStoryverseCharacterDto = {
  name?: string;
  age?: string;
  personality?: string;
  outfit?: string;
  referenceImage?: string;
};

export type PublicStoryverseSceneDto = {
  id?: number | string;
  text?: string;
  narration?: string;
  dialogue?: string;
  emotion?: string;
  cameraDirection?: string;
  motionHint?: string;
  image?: string;
  videoUrl?: string;
};

export type PublicStoryverseEpisodeDto = {
  title: string;
  language: "tr" | "en";
  story_premise?: string;
  published_at?: string;
  exported_movie_url?: string;
  characters: PublicStoryverseCharacterDto[];
  scenes: PublicStoryverseSceneDto[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedString(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    return undefined;
  }
  return value;
}

function safeMediaUrl(value: unknown): string | undefined {
  const candidate = boundedString(
    value,
    PUBLIC_STORYVERSE_LIMITS.maxMediaUrlLength,
  );
  if (!candidate || candidate !== candidate.trim()) return undefined;
  if (candidate.startsWith("//") || candidate.includes("\\")) return undefined;

  if (candidate.startsWith("/")) {
    return /[\u0000-\u001f\u007f]/.test(candidate) ? undefined : candidate;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return undefined;
    }
    return candidate;
  } catch {
    return undefined;
  }
}

function optionalField(
  target: object,
  key: string,
  value: string | number | undefined,
) {
  if (value !== undefined) (target as Record<string, unknown>)[key] = value;
}

function mapCharacter(value: unknown): PublicStoryverseCharacterDto | null {
  const source = record(value);
  if (!source) return null;

  const target: PublicStoryverseCharacterDto = {};
  optionalField(target, "name", boundedString(source.name, PUBLIC_STORYVERSE_LIMITS.maxCharacterDisplayFieldLength));
  optionalField(target, "age", boundedString(source.age, PUBLIC_STORYVERSE_LIMITS.maxCharacterDisplayFieldLength));
  optionalField(target, "personality", boundedString(source.personality, PUBLIC_STORYVERSE_LIMITS.maxCharacterDisplayFieldLength));
  optionalField(target, "outfit", boundedString(source.outfit, PUBLIC_STORYVERSE_LIMITS.maxCharacterDisplayFieldLength));
  optionalField(target, "referenceImage", safeMediaUrl(source.referenceImage));
  return target;
}

function sceneId(value: unknown): number | string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return boundedString(value, 128);
}

function mapScene(value: unknown): PublicStoryverseSceneDto | null {
  const source = record(value);
  if (!source) return null;

  const target: PublicStoryverseSceneDto = {};
  optionalField(target, "id", sceneId(source.id));
  optionalField(target, "text", boundedString(source.text, PUBLIC_STORYVERSE_LIMITS.maxSceneTextLength));
  optionalField(target, "narration", boundedString(source.narration, PUBLIC_STORYVERSE_LIMITS.maxSceneTextLength));
  optionalField(target, "dialogue", boundedString(source.dialogue, PUBLIC_STORYVERSE_LIMITS.maxSceneTextLength));
  optionalField(target, "emotion", boundedString(source.emotion, PUBLIC_STORYVERSE_LIMITS.maxCharacterDisplayFieldLength));
  optionalField(target, "cameraDirection", boundedString(source.cameraDirection, PUBLIC_STORYVERSE_LIMITS.maxSceneTextLength));
  optionalField(target, "motionHint", boundedString(source.motionHint, PUBLIC_STORYVERSE_LIMITS.maxSceneTextLength));
  optionalField(target, "image", safeMediaUrl(source.image));
  optionalField(target, "videoUrl", safeMediaUrl(source.videoUrl));
  return target;
}

export function mapPublicStoryverseEpisode(
  source: PublicStoryverseProjectSourceRecord,
): PublicStoryverseEpisodeDto | null {
  if (source.flow_type !== "storyverse") return null;
  if (source.language !== "tr" && source.language !== "en") return null;

  const title = boundedString(source.title, PUBLIC_STORYVERSE_LIMITS.maxTitleLength);
  if (!title) return null;

  const characters = (Array.isArray(source.characters) ? source.characters : [])
    .slice(0, PUBLIC_STORYVERSE_LIMITS.maxCharacterCount)
    .map(mapCharacter)
    .filter((value): value is PublicStoryverseCharacterDto => value !== null);
  const scenes = (Array.isArray(source.scenes) ? source.scenes : [])
    .slice(0, PUBLIC_STORYVERSE_LIMITS.maxSceneCount)
    .map(mapScene)
    .filter((value): value is PublicStoryverseSceneDto => value !== null);

  const dto: PublicStoryverseEpisodeDto = {
    title,
    language: source.language,
    characters,
    scenes,
  };
  optionalField(dto, "story_premise", boundedString(source.story_premise, PUBLIC_STORYVERSE_LIMITS.maxPremiseLength));
  optionalField(dto, "published_at", boundedString(source.published_at, 64));
  optionalField(dto, "exported_movie_url", safeMediaUrl(source.exported_movie_url));

  if (
    new TextEncoder().encode(JSON.stringify(dto)).byteLength >
    PUBLIC_STORYVERSE_LIMITS.maxSerializedDtoBytes
  ) {
    return null;
  }

  return dto;
}
