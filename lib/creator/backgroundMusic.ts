export const CREATOR_BACKGROUND_MUSIC_VERSION = 1 as const;

export type CreatorBackgroundMusicMode = "none" | "auto" | "selected";

export type CreatorBackgroundMusicConfig = {
  version: typeof CREATOR_BACKGROUND_MUSIC_VERSION;
  mode: CreatorBackgroundMusicMode;
  selectedTrackId?: string;
  confirmedTrackId?: string;
  volume: number;
  autoDucking: boolean;
  fadeInSec: number;
  fadeOutSec: number;
};

export const DEFAULT_CREATOR_BACKGROUND_MUSIC: CreatorBackgroundMusicConfig = {
  version: CREATOR_BACKGROUND_MUSIC_VERSION,
  mode: "none",
  volume: 0.16,
  autoDucking: true,
  fadeInSec: 1.5,
  fadeOutSec: 2,
};

const MODES = new Set<CreatorBackgroundMusicMode>(["none", "auto", "selected"]);

function clamp(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}

export function normalizeCreatorBackgroundMusicConfig(
  value: unknown,
  allowedTrackIds: Iterable<string> = [],
  isAllowedTrackId?: (trackId: string) => boolean,
): CreatorBackgroundMusicConfig {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const allowed = new Set(allowedTrackIds);
  let mode = MODES.has(source.mode as CreatorBackgroundMusicMode)
    ? source.mode as CreatorBackgroundMusicMode
    : "none";
  const requestedTrackId = typeof source.selectedTrackId === "string"
    ? source.selectedTrackId
    : "";
  const selectedTrackId = requestedTrackId && (allowed.has(requestedTrackId) || isAllowedTrackId?.(requestedTrackId))
    ? requestedTrackId
    : undefined;
  const confirmedTrackId = typeof source.confirmedTrackId === "string" && source.confirmedTrackId === selectedTrackId
    ? source.confirmedTrackId
    : undefined;

  if (mode === "selected" && !selectedTrackId) mode = "none";

  return {
    version: CREATOR_BACKGROUND_MUSIC_VERSION,
    mode,
    ...(mode === "selected" && selectedTrackId ? { selectedTrackId } : {}),
    ...(mode === "selected" && confirmedTrackId ? { confirmedTrackId } : {}),
    volume: clamp(source.volume, 0.04, 0.3, DEFAULT_CREATOR_BACKGROUND_MUSIC.volume),
    autoDucking: source.autoDucking !== false,
    fadeInSec: clamp(source.fadeInSec, 0, 5, DEFAULT_CREATOR_BACKGROUND_MUSIC.fadeInSec),
    fadeOutSec: clamp(source.fadeOutSec, 0, 8, DEFAULT_CREATOR_BACKGROUND_MUSIC.fadeOutSec),
  };
}

export function getCreatorMusicLevel(volume: number): "low" | "balanced" | "strong" {
  if (volume <= 0.11) return "low";
  if (volume >= 0.22) return "strong";
  return "balanced";
}

export const CREATOR_MUSIC_LEVEL_VOLUME = {
  low: 0.09,
  balanced: 0.16,
  strong: 0.24,
} as const;
