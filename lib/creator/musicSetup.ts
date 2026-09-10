import {
  EMPTY_CREATOR_AUDIO_TIMELINE,
  normalizeCreatorAudioTimeline,
  type CreatorAudioAssetReference,
  type CreatorAudioTimeline,
} from "./audioTimeline.ts";

export type CreatorMusicSetupMode = "none" | "auto" | "browse";

export function createDefaultCreatorMusicTimeline(): CreatorAudioTimeline {
  return {
    ...EMPTY_CREATOR_AUDIO_TIMELINE,
    musicIntent: { mode: "auto" },
  };
}

export function getCreatorMusicSetupMode(
  timeline: CreatorAudioTimeline | null | undefined,
): CreatorMusicSetupMode {
  if (!timeline) return timeline === null ? "none" : "auto";
  if (timeline.musicIntent) return timeline.musicIntent.mode;
  return timeline.placements.some((placement) => placement.kind === "music" && placement.status === "active")
    ? "browse"
    : "none";
}

export function getSelectedCreatorMusicDisplayName(
  timeline: CreatorAudioTimeline | null | undefined,
): string | undefined {
  const displayName = timeline?.placements.find(
    (placement) => placement.kind === "music" && placement.status === "active",
  )?.asset.displayName?.trim();
  return displayName ? displayName.slice(0, 180) : undefined;
}

export function setCreatorMusicSetupMode(
  timeline: CreatorAudioTimeline | null | undefined,
  mode: CreatorMusicSetupMode,
): CreatorAudioTimeline {
  const current = timeline ? normalizeCreatorAudioTimeline(timeline) : createDefaultCreatorMusicTimeline();
  return {
    ...current,
    musicIntent: { mode },
    placements: mode === "browse"
      ? current.placements
      : current.placements.filter((placement) => placement.kind !== "music"),
  };
}

export function selectUploadedCreatorMusic(input: {
  timeline: CreatorAudioTimeline | null | undefined;
  asset: CreatorAudioAssetReference;
  sceneIds: string[];
}): CreatorAudioTimeline {
  const sceneIds = input.sceneIds.filter(Boolean);
  if (input.asset.mediaKind !== "music" || input.asset.origin !== "uploaded" || sceneIds.length === 0) {
    throw new Error("CREATOR_MUSIC_SELECTION_INVALID");
  }
  const current = setCreatorMusicSetupMode(input.timeline, "browse");
  return {
    ...current,
    musicIntent: { mode: "browse" },
    placements: [
      ...current.placements.filter((placement) => placement.kind !== "music"),
      {
        id: `project-music:${input.asset.assetId}`,
        kind: "music",
        asset: input.asset,
        range: {
          start: { sceneId: sceneIds[0], edge: "start", offsetMs: 0 },
          end: { sceneId: sceneIds.at(-1)!, edge: "end", offsetMs: 0 },
        },
        sourceInMs: 0,
        gain: 1,
        status: "active",
      },
    ],
  };
}

export function hydrateCreatorMusicTimeline(input: {
  timeline: CreatorAudioTimeline | null | undefined;
  legacyMode?: unknown;
}): CreatorAudioTimeline {
  if (input.timeline) return normalizeCreatorAudioTimeline(input.timeline);
  if (input.timeline === null || input.legacyMode === "none") {
    return setCreatorMusicSetupMode(null, "none");
  }
  if (input.legacyMode === "selected") return setCreatorMusicSetupMode(null, "browse");
  return createDefaultCreatorMusicTimeline();
}
