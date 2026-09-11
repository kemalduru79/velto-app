import {
  EMPTY_CREATOR_AUDIO_TIMELINE,
  normalizeCreatorAudioTimeline,
  type CreatorAudioAssetReference,
  type CreatorAudioTimeline,
} from "./audioTimeline.ts";
import type { CreatorPremiumMusicTrack } from "../providers/music/types.ts";

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
    (placement) => placement.kind === "music" && placement.id.startsWith("project-music:") && placement.asset,
  )?.asset?.displayName?.trim();
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
      : current.placements.filter((placement) => !isCreatorStartingMusicPlacement(placement)),
  };
}

const isCreatorStartingMusicPlacement = (placement: CreatorAudioTimeline["placements"][number]) =>
  placement.kind === "music" && placement.id.startsWith("project-music:");

function getCreatorStartingMusicEnd(current: CreatorAudioTimeline, sceneIds: string[]) {
  const existingEnd = current.placements.find(isCreatorStartingMusicPlacement)?.range.end;
  const firstTransition = current.placements
    .filter((placement) => placement.kind === "music" && !isCreatorStartingMusicPlacement(placement))
    .map((placement) => ({ placement, index: sceneIds.indexOf(placement.range.start.sceneId) }))
    .filter((entry) => entry.index >= 0)
    .sort((left, right) => left.index - right.index)[0]?.placement;
  if (firstTransition) return firstTransition.range.start;
  if (existingEnd && sceneIds.includes(existingEnd.sceneId)) return existingEnd;
  return { sceneId: sceneIds.at(-1)!, edge: "end" as const, offsetMs: 0 };
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
      ...current.placements.filter((placement) => !isCreatorStartingMusicPlacement(placement)),
      {
        id: `project-music:${input.asset.assetId}`,
        kind: "music",
        asset: input.asset,
        range: {
          start: { sceneId: sceneIds[0], edge: "start", offsetMs: 0 },
          end: getCreatorStartingMusicEnd(current, sceneIds),
        },
        sourceInMs: 0,
        gain: 1,
        status: "active",
      },
    ],
  };
}

export function creatorCatalogTrackAsset(track: CreatorPremiumMusicTrack): CreatorAudioAssetReference {
  return {
    assetId: `catalog:${track.id}`,
    displayName: [track.title, track.artist].filter(Boolean).join(" · ").slice(0, 180),
    origin: "licensed_catalog",
    mediaKind: "music",
    ...(track.durationSec ? { durationMs: Math.round(track.durationSec * 1000) } : {}),
    rights: { status: "unknown" },
  };
}

export function selectCatalogCreatorMusic(input: { timeline: CreatorAudioTimeline | null | undefined; track: CreatorPremiumMusicTrack; sceneIds: string[] }) {
  const asset = creatorCatalogTrackAsset(input.track);
  const sceneIds = input.sceneIds.filter(Boolean);
  if (sceneIds.length === 0) throw new Error("CREATOR_MUSIC_SELECTION_INVALID");
  const current = setCreatorMusicSetupMode(input.timeline, "browse");
  return { ...current, musicIntent: { mode: "browse" as const }, placements: [
    ...current.placements.filter((item) => !isCreatorStartingMusicPlacement(item)),
    { id: `project-music:${asset.assetId}`, kind: "music" as const, asset, range: { start: { sceneId: sceneIds[0], edge: "start" as const, offsetMs: 0 }, end: getCreatorStartingMusicEnd(current, sceneIds) }, sourceInMs: 0, gain: 1, status: "unresolved" as const },
  ] };
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
