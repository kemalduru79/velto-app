import assert from "node:assert/strict";
import {
  reconcileCreatorAudioTimeline,
  reconcileSupersededCreatorPrimaryMusicPlacements,
  validateCreatorAudioTimelineTopology,
} from "../lib/creator/audioTimeline.ts";

const currentSceneIds = ["current-a", "current-b", "current-c"];
const oldSceneIds = ["old-a", "old-c"];
const asset = {
  assetId: "catalog:track-a",
  origin: "licensed_catalog",
  mediaKind: "music",
  rights: { status: "verified" },
};
const unrelatedAsset = { ...asset, assetId: "catalog:track-b" };
const placement = ({ id, selectedAsset = asset, start, end, status = "active" }) => ({
  id,
  kind: "music",
  asset: selectedAsset,
  range: {
    start: { sceneId: start, edge: "start", offsetMs: 0 },
    end: { sceneId: end, edge: "end", offsetMs: 0 },
  },
  sourceInMs: 0,
  gain: 1,
  status,
});
const oldPrimary = placement({
  id: `primary-music:${oldSceneIds[0]}:${asset.assetId}`,
  start: oldSceneIds[0],
  end: oldSceneIds[1],
});
const currentPrimary = placement({
  id: `primary-music:${currentSceneIds[0]}:${asset.assetId}`,
  start: currentSceneIds[0],
  end: currentSceneIds.at(-1),
});
const ambience = {
  ...placement({
    id: "ambience:current-a",
    selectedAsset: { ...unrelatedAsset, mediaKind: "ambience" },
    start: currentSceneIds[0],
    end: currentSceneIds.at(-1),
  }),
  kind: "ambience",
};
const timeline = (placements) => ({
  version: 1,
  timingBasis: "scene_anchored",
  musicIntent: { mode: "browse" },
  placements,
  master: {
    version: 1,
    gains: { narration: 1, music: 1, ambience: 1, sfx: 1 },
    limiter: { enabled: true, ceiling: 0.95 },
  },
});

const incident = timeline([oldPrimary, currentPrimary, ambience]);
const strictBefore = validateCreatorAudioTimelineTopology({
  timeline: incident,
  sceneIds: currentSceneIds,
});
assert.equal(strictBefore.status, "blocked");
assert.ok(strictBefore.issues.some((issue) => issue.code === "anchor_missing"));

const repaired = reconcileSupersededCreatorPrimaryMusicPlacements({
  timeline: incident,
  sceneIds: currentSceneIds,
});
assert.deepEqual(
  repaired.placements.map(({ id }) => id),
  [currentPrimary.id, ambience.id],
  "only the proven superseded same-asset primary placement leaves current authority",
);
assert.equal(
  validateCreatorAudioTimelineTopology({
    timeline: { ...repaired, placements: repaired.placements.filter((item) => item.kind === "music") },
    sceneIds: currentSceneIds,
  }).status,
  "ready",
);

const repairedTwice = reconcileSupersededCreatorPrimaryMusicPlacements({
  timeline: repaired,
  sceneIds: currentSceneIds,
});
assert.deepEqual(repairedTwice, repaired, "reconciliation is idempotent");

const differentAssetOrphan = placement({
  id: `primary-music:${oldSceneIds[0]}:${unrelatedAsset.assetId}`,
  selectedAsset: unrelatedAsset,
  start: oldSceneIds[0],
  end: oldSceneIds[1],
});
const preservedUnrelated = reconcileSupersededCreatorPrimaryMusicPlacements({
  timeline: timeline([differentAssetOrphan, currentPrimary]),
  sceneIds: currentSceneIds,
});
assert.ok(
  preservedUnrelated.placements.some(({ id }) => id === differentAssetOrphan.id),
  "unrelated music authority remains fail-closed rather than being guessed or deleted",
);

const deliberateSameAssetTransition = placement({
  id: `primary-music:${currentSceneIds[1]}:${asset.assetId}`,
  start: currentSceneIds[1],
  end: currentSceneIds.at(-1),
});
const deliberate = reconcileSupersededCreatorPrimaryMusicPlacements({
  timeline: timeline([
    { ...currentPrimary, range: { ...currentPrimary.range, end: { sceneId: currentSceneIds[1], edge: "start", offsetMs: 0 } } },
    deliberateSameAssetTransition,
  ]),
  sceneIds: currentSceneIds,
});
assert.equal(deliberate.placements.length, 2, "valid current same-asset transitions are preserved");

const topologyReconciled = reconcileCreatorAudioTimeline({
  timeline: incident,
  previousScenes: oldSceneIds.map((creatorSceneId) => ({ creatorSceneId })),
  nextScenes: currentSceneIds.map((creatorSceneId) => ({ creatorSceneId })),
});
assert.equal(
  topologyReconciled.timeline.placements.some(({ id }) => id === oldPrimary.id),
  false,
  "scene identity replacement retires the superseded primary without ordinal remapping",
);
assert.deepEqual(currentPrimary.asset, asset, "the selected music asset and provenance remain intact");
assert.deepEqual(
  topologyReconciled.timeline.placements.find(({ id }) => id === ambience.id),
  ambience,
  "unrelated audio remains byte-for-byte unchanged",
);

console.log("STAGE_0_18A6K2_PRIMARY_MUSIC_RECONCILIATION=PASS");
