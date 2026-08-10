export const CREATOR_MUSIC_LIBRARY_VERSION = "creator-premium-music-v1" as const;

export function normalizeCreatorPremiumMusicTrackId(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length < 1 || value.length > 128) return undefined;
  if (value !== value.trim()) return undefined;
  return /^[A-Za-z0-9][A-Za-z0-9._~:-]{0,127}$/.test(value) ? value : undefined;
}

export function isCreatorPremiumMusicTrackId(value: unknown): value is string {
  return normalizeCreatorPremiumMusicTrackId(value) !== undefined;
}

export function buildCreatorPremiumMusicQuery(input: {
  contentType?: string;
  outcome?: string;
  topic?: string;
  visualStyle?: string;
  emotionalTone?: string;
  format?: string;
}): string {
  const text = Object.values(input).join(" ").toLowerCase();
  const direction = /documentary|story|reflect|emotional/.test(text)
    ? "cinematic emotional reflective"
    : /promotion|viral|launch|short|social/.test(text)
      ? "energetic upbeat confident"
      : /technology|innovation|business|corporate/.test(text)
        ? "professional modern inspiring"
        : "premium cinematic inspiring";
  const topic = String(input.topic || "").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return [direction, topic].filter(Boolean).join(" ");
}
