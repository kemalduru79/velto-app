import type { CreatorMusicTrack } from "./backgroundMusic";

export const CREATOR_MUSIC_LIBRARY_VERSION = "creator-music-v1" as const;

// No licensable background-music asset currently exists in this repository.
// Populate only when a real preview and matching export-service asset are added.
export const CREATOR_MUSIC_LIBRARY: readonly CreatorMusicTrack[] = [];

export const CREATOR_MUSIC_TRACK_IDS = CREATOR_MUSIC_LIBRARY.map((track) => track.id);

export function getCreatorMusicTrack(trackId: unknown) {
  if (typeof trackId !== "string") return undefined;
  return CREATOR_MUSIC_LIBRARY.find((track) => track.id === trackId);
}

export function autoMatchCreatorMusic(input: {
  contentType?: string;
  outcome?: string;
  topic?: string;
  visualStyle?: string;
  emotionalTone?: string;
  format?: string;
}): CreatorMusicTrack | undefined {
  const text = Object.values(input).join(" ").toLowerCase();
  const desiredEnergy = /launch|action|bold|exciting|viral|short/.test(text)
    ? "high"
    : /calm|reflect|story|documentary|emotional/.test(text)
      ? "low"
      : "medium";
  const tokens = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));

  return [...CREATOR_MUSIC_LIBRARY]
    .map((track) => ({
      track,
      score:
        (track.energy === desiredEnergy ? 3 : 0) +
        [...(track.mood || []), ...(track.genre || [])]
          .reduce((score, tag) => score + (tokens.has(tag.toLowerCase()) ? 1 : 0), 0),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.track.id.localeCompare(right.track.id))[0]
    ?.track;
}
