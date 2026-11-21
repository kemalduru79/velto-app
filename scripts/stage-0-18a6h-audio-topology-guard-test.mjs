import assert from "node:assert/strict";
import fs from "node:fs";
import {
  reconcileCreatorAudioTimeline,
  validateCreatorAudioTimelineTopology,
} from "../lib/creator/audioTimeline.ts";
import { startOrChangeCreatorSceneMusic } from "../lib/creator/sceneMusic.ts";

const sceneIds = [
  "7228898f-7970-486c-af83-0783842c01cb",
  "c6c7cd27-bff4-49b2-8279-5e19927745b5",
  "f113fc5c-cf57-41d0-b4f3-436c90ca97ba",
];
const staleStart = "6a4a7c11-7209-4d17-aea6-c17852c4b8b1";
const staleEnd = "d7997fdc-0000-4000-8000-000000000001";
const sharedAsset = {
  assetId: "catalog:584229b9-cb0c-4379-98dd-6e37ce719052",
  displayName: "Incident fixture",
  origin: "licensed_catalog",
  mediaKind: "music",
  rights: { status: "verified" },
};
const otherAsset = {
  ...sharedAsset,
  assetId: "catalog:other-track",
  displayName: "Other track",
};
const master = {
  version: 1,
  gains: { narration: 1, music: 1, ambience: 1, sfx: 1 },
  limiter: { enabled: true, ceiling: 0.95 },
};
const placement = ({ id, asset = sharedAsset, start, end, status = "active" }) => ({
  id,
  kind: "music",
  asset,
  range: {
    start: { sceneId: start.sceneId, edge: start.edge, offsetMs: 0 },
    end: { sceneId: end.sceneId, edge: end.edge, offsetMs: 0 },
  },
  sourceInMs: 0,
  gain: 1,
  status,
});
const timeline = (placements) => ({
  version: 1,
  timingBasis: "scene_anchored",
  placements,
  master,
});

const stalePlacement = placement({
  id: `primary-music:${staleStart}:${sharedAsset.assetId}`,
  start: { sceneId: staleStart, edge: "start" },
  end: { sceneId: staleEnd, edge: "end" },
});
const validPlacement = placement({
  id: `primary-music:${sceneIds[0]}:${sharedAsset.assetId}`,
  start: { sceneId: sceneIds[0], edge: "start" },
  end: { sceneId: sceneIds.at(-1), edge: "end" },
});

const incident = timeline([stalePlacement, validPlacement]);
const incidentReadiness = validateCreatorAudioTimelineTopology({
  timeline: incident,
  sceneIds,
});
assert.equal(incidentReadiness.status, "blocked");
assert.ok(
  incidentReadiness.issues.some((issue) =>
    issue.code === "anchor_missing" && issue.placementId === stalePlacement.id
  ),
  "incident orphan must be blocked before export",
);

const repairedBySameAssetSelection = startOrChangeCreatorSceneMusic({
  timeline: incident,
  sceneIds,
  sceneId: sceneIds[0],
  choice: { mode: "asset", asset: sharedAsset },
});
assert.equal(
  repairedBySameAssetSelection.placements.some((item) => item.id === stalePlacement.id),
  false,
  "strict same-asset replacement at the first current scene should retire the proven obsolete orphan",
);
assert.equal(
  validateCreatorAudioTimelineTopology({
    timeline: repairedBySameAssetSelection,
    sceneIds,
  }).status,
  "ready",
  "same-asset incident recovery should leave a renderable current topology",
);

const differentAssetOrphan = timeline([
  { ...stalePlacement, asset: otherAsset, id: `primary-music:${staleStart}:${otherAsset.assetId}` },
]);
const changedToSharedAsset = startOrChangeCreatorSceneMusic({
  timeline: differentAssetOrphan,
  sceneIds,
  sceneId: sceneIds[0],
  choice: { mode: "asset", asset: sharedAsset },
});
const retainedDifferentAsset = changedToSharedAsset.placements.find((item) => item.asset?.assetId === otherAsset.assetId);
assert.ok(retainedDifferentAsset, "different-asset orphan must not be silently deleted");
assert.equal(retainedDifferentAsset.status, "unresolved", "different-asset orphan must fail closed after reconciliation");
assert.equal(
  validateCreatorAudioTimelineTopology({ timeline: changedToSharedAsset, sceneIds }).status,
  "blocked",
  "unresolved different-asset history must still block final render until reviewed",
);

const sequential = timeline([
  placement({
    id: "primary-music:scene-1:a",
    start: { sceneId: sceneIds[0], edge: "start" },
    end: { sceneId: sceneIds[1], edge: "start" },
  }),
  placement({
    id: "primary-music:scene-2:b",
    asset: otherAsset,
    start: { sceneId: sceneIds[1], edge: "start" },
    end: { sceneId: sceneIds[2], edge: "end" },
  }),
]);
assert.equal(
  validateCreatorAudioTimelineTopology({ timeline: sequential, sceneIds }).status,
  "ready",
  "adjacent deliberate music transitions must remain valid",
);

const overlap = timeline([
  placement({
    id: "primary-music:overlap-a",
    start: { sceneId: sceneIds[0], edge: "start" },
    end: { sceneId: sceneIds[1], edge: "end" },
  }),
  placement({
    id: "primary-music:overlap-b",
    asset: otherAsset,
    start: { sceneId: sceneIds[1], edge: "start" },
    end: { sceneId: sceneIds[2], edge: "end" },
  }),
]);
const overlapReadiness = validateCreatorAudioTimelineTopology({ timeline: overlap, sceneIds });
assert.equal(overlapReadiness.status, "blocked");
assert.ok(overlapReadiness.issues.some((issue) => issue.code === "music_overlap"));

const nestedOverlap = timeline([
  placement({
    id: "primary-music:nested-long",
    start: { sceneId: sceneIds[0], edge: "start" },
    end: { sceneId: sceneIds[2], edge: "end" },
  }),
  placement({
    id: "primary-music:nested-short",
    asset: otherAsset,
    start: { sceneId: sceneIds[1], edge: "start" },
    end: { sceneId: sceneIds[1], edge: "end" },
  }),
  placement({
    id: "primary-music:nested-tail",
    asset: otherAsset,
    start: { sceneId: sceneIds[2], edge: "start" },
    end: { sceneId: sceneIds[2], edge: "end" },
  }),
]);
const nestedReadiness = validateCreatorAudioTimelineTopology({ timeline: nestedOverlap, sceneIds });
assert.ok(
  nestedReadiness.issues.some((issue) =>
    issue.code === "music_overlap" &&
    issue.placementId === "primary-music:nested-tail" &&
    issue.relatedPlacementId === "primary-music:nested-long"
  ),
  "nested long-range overlap must remain visible even when an intermediate short range ends earlier",
);

const reconciledIncident = reconcileCreatorAudioTimeline({
  timeline: timeline([stalePlacement]),
  previousScenes: [{ creatorSceneId: staleStart }],
  nextScenes: sceneIds.map((creatorSceneId) => ({ creatorSceneId })),
});
assert.equal(reconciledIncident.timeline.placements[0].status, "unresolved");
assert.ok(reconciledIncident.issues.some((issue) => issue.code === "anchor_missing"));

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const gate = fs.readFileSync(new URL("../lib/creator/finalProductionGate.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/creator-export/route.ts", import.meta.url), "utf8");
const renderer = fs.readFileSync(new URL("../export-service/src/creatorAudioMixPlan.js", import.meta.url), "utf8");

assert.match(page, /validateCreatorAudioTimelineTopology\(\{[\s\S]{0,260}creatorAudioTimeline/);
assert.match(page, /audioTopologyReady: audioTopologyReadiness\.status === "ready"/);
assert.match(page, /audioTopologyReady: creatorAudioTopologyReadiness\?\.status === "ready"/);

const buildStart = page.indexOf("const buildStory = async () =>");
const installIndex = page.indexOf("setScenes(packageScenes)", buildStart);
const reconcileIndex = page.indexOf("reconcileCreatorAudioTimeline({", buildStart);
assert.ok(reconcileIndex > buildStart && reconcileIndex < installIndex, "wholesale topology replacement must reconcile audio before installing scenes");
assert.ok(
  page.slice(buildStart, installIndex).includes("scriptSectionId: scene.scriptSectionId") &&
  page.slice(buildStart, installIndex).includes("scriptSegmentIndex: scene.scriptSegmentIndex"),
  "rebuilt scenes must retain script identity hints for deterministic audio anchor remapping",
);

assert.match(gate, /audio: CreatorFinalProductionGateCheckStatus/);
assert.match(gate, /audioTopologyReady \? "ready" : "blocked"/);
assert.match(gate, /readiness\.canStartFinalVideo && audioTopologyReady && exportReady/);

const routeTopology = route.indexOf("validateCreatorAudioTimelineTopology({");
const routeStorage = route.indexOf("checkStorageGenerationAllowance(");
const routeReserve = route.indexOf("reserveMeteredOperation(");
const routeDispatch = route.indexOf('fetch(`${exportApiBase}/export-movie`');
assert.ok(routeTopology >= 0, "server topology validation must exist");
assert.ok(routeTopology < routeStorage, "server topology validation must precede storage admission");
assert.ok(routeTopology < routeReserve, "server topology validation must precede credit reservation");
assert.ok(routeTopology < routeDispatch, "server topology validation must precede renderer dispatch");
assert.match(route, /code: "creator_audio_topology_invalid"/);
assert.match(route, /creditReserved: false/);

assert.match(renderer, /AUDIO_ANCHOR_UNRESOLVED/, "renderer must remain fail-closed as defense in depth");

console.log("Stage 0.18A6H audio topology guard regression passed.");
