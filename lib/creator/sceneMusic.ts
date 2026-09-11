import {
  normalizeCreatorAudioTimeline,
  type CreatorAudioAssetReference,
  type CreatorAudioPlacement,
  type CreatorAudioTimeline,
} from "./audioTimeline.ts";

export type CreatorSceneMusicChoice =
  | { mode: "auto" }
  | { mode: "asset"; asset: CreatorAudioAssetReference };

const anchor = (sceneId: string, edge: "start" | "end") => ({ sceneId, edge, offsetMs: 0 });
const music = (timeline: CreatorAudioTimeline) => timeline.placements.filter((item) => item.kind === "music");

const isStartingPlacement = (item: CreatorAudioPlacement) => item.id.startsWith("project-music:");

function startingEnd(sceneIds: string[], placements: CreatorAudioPlacement[]) {
  const firstTransition = placements
    .filter((item) => !isStartingPlacement(item))
    .map((item) => ({ item, index: sceneIds.indexOf(item.range.start.sceneId) }))
    .filter((entry) => entry.index >= 0)
    .sort((left, right) => left.index - right.index)[0]?.item;
  return firstTransition?.range.start || anchor(sceneIds.at(-1)!, "end");
}

function materializeAutoDefault(timeline: CreatorAudioTimeline, sceneIds: string[]) {
  const placements = music(timeline);
  const hasStartingPlacement = placements.some(isStartingPlacement);
  if (timeline.musicIntent?.mode !== "auto" || hasStartingPlacement || sceneIds.length === 0) return placements;
  const automatic = placement({ sceneId: sceneIds[0], lastSceneId: sceneIds.at(-1)!, choice: { mode: "auto" } });
  return [{ ...automatic, id: "project-music:auto", range: { ...automatic.range, end: startingEnd(sceneIds, placements) } }, ...placements];
}

function placement(input: { sceneId: string; lastSceneId: string; choice: CreatorSceneMusicChoice }): CreatorAudioPlacement {
  const choiceKey = input.choice.mode === "asset" ? input.choice.asset.assetId : "auto";
  return {
    id: `primary-music:${input.sceneId}:${choiceKey}`,
    kind: "music",
    ...(input.choice.mode === "asset" ? { asset: input.choice.asset } : { musicSelection: { mode: "auto" as const } }),
    range: { start: anchor(input.sceneId, "start"), end: anchor(input.lastSceneId, "end") },
    sourceInMs: 0,
    gain: 1,
    status: input.choice.mode === "asset" && ["verified", "creator_attested"].includes(input.choice.asset.rights.status) ? "active" : "unresolved",
  };
}

export function getCreatorSceneMusicState(timeline: CreatorAudioTimeline | null | undefined, sceneIds: string[], sceneId: string) {
  if (!timeline) return { activeBefore: false, starts: false, changes: false, stops: false };
  const index = sceneIds.indexOf(sceneId);
  const placements = materializeAutoDefault(timeline, sceneIds);
  const startsHere = placements.filter((item) => item.range.start.sceneId === sceneId && item.range.start.edge === "start");
  const endsAtStart = placements.some((item) => item.range.end.sceneId === sceneId && item.range.end.edge === "start");
  const activeBefore = index >= 0 && placements.some((item) => {
    const start = sceneIds.indexOf(item.range.start.sceneId);
    const end = sceneIds.indexOf(item.range.end.sceneId);
    return start >= 0 && start < index && end >= index && !(end === index && item.range.end.edge === "start");
  });
  const effective = placements.find((item) => {
    const start = sceneIds.indexOf(item.range.start.sceneId);
    const end = sceneIds.indexOf(item.range.end.sceneId);
    return start >= 0 && start <= index && end >= index && !(end === index && item.range.end.edge === "start");
  });
  return {
    activeBefore,
    starts: startsHere.length > 0 && !endsAtStart,
    changes: startsHere.length > 0 && endsAtStart,
    stops: placements.some((item) => item.range.end.sceneId === sceneId && item.range.end.edge === "end"),
    effective,
  };
}

export function startOrChangeCreatorSceneMusic(input: {
  timeline: CreatorAudioTimeline;
  sceneIds: string[];
  sceneId: string;
  choice: CreatorSceneMusicChoice;
}) {
  const current = normalizeCreatorAudioTimeline(input.timeline);
  const sceneIndex = input.sceneIds.indexOf(input.sceneId);
  if (sceneIndex < 0 || input.sceneIds.length === 0) throw new Error("CREATOR_SCENE_MUSIC_SCENE_INVALID");
  const before = materializeAutoDefault(current, input.sceneIds).filter((item) => item.range.start.sceneId !== input.sceneId);
  const next = placement({ sceneId: input.sceneId, lastSceneId: input.sceneIds.at(-1)!, choice: input.choice });
  const closed = before.map((item) => {
    const startIndex = input.sceneIds.indexOf(item.range.start.sceneId);
    const endIndex = input.sceneIds.indexOf(item.range.end.sceneId);
    return startIndex < sceneIndex && endIndex >= sceneIndex
      ? { ...item, range: { ...item.range, end: anchor(input.sceneId, "start") } }
      : item;
  });
  return { ...current, placements: [...current.placements.filter((item) => item.kind !== "music"), ...closed, next] };
}

export function stopCreatorSceneMusicAfter(input: { timeline: CreatorAudioTimeline; sceneIds: string[]; sceneId: string }) {
  const current = normalizeCreatorAudioTimeline(input.timeline);
  const sceneIndex = input.sceneIds.indexOf(input.sceneId);
  return {
    ...current,
    placements: [
      ...current.placements.filter((item) => item.kind !== "music"),
      ...materializeAutoDefault(current, input.sceneIds),
    ].map((item) => {
      if (item.kind !== "music") return item;
      const startIndex = input.sceneIds.indexOf(item.range.start.sceneId);
      const endIndex = input.sceneIds.indexOf(item.range.end.sceneId);
      const activeThroughScene = endIndex > sceneIndex || (endIndex === sceneIndex && item.range.end.edge === "end");
      return startIndex <= sceneIndex && activeThroughScene
        ? { ...item, range: { ...item.range, end: anchor(input.sceneId, "end") } }
        : item;
    }),
  };
}
