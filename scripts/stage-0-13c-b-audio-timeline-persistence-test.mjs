import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_CREATOR_AUDIO_MASTER_MIX,
} from "../lib/creator/audioTimeline.ts";
import {
  attachCreatorProjectState,
  buildCreatorProjectState,
  creatorAudioTimelineSnapshotFields,
  readCreatorAudioTimelineHydration,
  readCreatorProjectState,
} from "../lib/creator/projectState.ts";
import {
  createCreatorProjectSaveBinding,
  creatorProjectStateRequestFields,
  isCreatorProjectOperationActive,
  isCreatorProjectSaveBindingActive,
} from "../lib/creator/projectSaveCoordinator.ts";
import { assertProjectUpdateMatched } from "../lib/persistence/projects/projectPatch.ts";
import { buildCreatorFinalProductionSignature } from "../lib/creator/finalProductionSignature.ts";
import { createCreatorPublishArtifactSignature } from "../lib/creator/projectExportReadiness.ts";
import { createDefaultCreatorMusicTimeline, creatorAcquiredCatalogTrackAsset, selectAcquiredCatalogCreatorMusic } from "../lib/creator/musicSetup.ts";
import { startOrChangeCreatorSceneMusic } from "../lib/creator/sceneMusic.ts";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");

const audioTimeline = {
  version: 1,
  timingBasis: "scene_anchored",
  placements: [
    {
      id: "track-a",
      kind: "music",
      asset: {
        assetId: "asset-a",
        origin: "licensed_catalog",
        mediaKind: "music",
        durationMs: 90000,
        rights: { status: "verified", referenceId: "license-a", providerSecret: "discard" },
        storageKey: "discard",
      },
      range: {
        start: { sceneId: "scene-1", edge: "start", offsetMs: 0 },
        end: { sceneId: "scene-3", edge: "end", offsetMs: 0 },
      },
      sourceInMs: 0,
      gain: 0.2,
      fades: { inMs: 1000, outMs: 2000 },
      ducking: { mode: "under_speech" },
      status: "active",
      startMs: 0,
      renderer: "discard",
    },
    {
      id: "track-b",
      kind: "music",
      asset: {
        assetId: "asset-b",
        origin: "uploaded",
        mediaKind: "music",
        rights: { status: "creator_attested", creatorAttestedAt: "2026-09-08T00:00:00Z" },
      },
      range: {
        start: { sceneId: "scene-4", edge: "end", offsetMs: -250 },
        end: { sceneId: "scene-5", edge: "start", offsetMs: 500 },
      },
      sourceInMs: 500,
      sourceOutMs: 12500,
      gain: 0.35,
      status: "stale",
    },
    {
      id: "track-unresolved",
      kind: "ambience",
      asset: {
        assetId: "asset-c",
        origin: "generated",
        mediaKind: "ambience",
        rights: { status: "unknown" },
      },
      range: {
        start: { sceneId: "deleted-scene", edge: "start", offsetMs: 0 },
        end: { sceneId: "scene-5", edge: "end", offsetMs: 0 },
      },
      sourceInMs: 0,
      gain: 0.1,
      status: "unresolved",
    },
  ],
  master: {
    ...DEFAULT_CREATOR_AUDIO_MASTER_MIX,
    gains: { narration: 0.9, music: 0.8, ambience: 0.7, sfx: 0.6 },
  },
  absoluteDurationMs: 99999,
};

const baseInput = (production = {}) => ({
  brief: {
    topic: "Audio durability", language: "en", country: "global",
    ageGroup: "professional_18", contentType: "educational_explainer",
    format: "youtube_video", durationPreset: "short_60", durationSec: 60,
    customDurationSec: 60, qualityMode: "standard", targetPlatforms: ["youtube"],
  },
  strategy: { mentorResult: null, selectedDirectionId: "recommended", selectedHook: "", script: null },
  production: {
    package: null, refinedScenes: [], backgroundMusic: { mode: "none" },
    projectContinuityMode: "independent", sceneContinuityModes: {}, voicePreferences: null,
    ...production,
  },
  createReview: { scenes: [] },
  publish: {
    metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {},
    packageDownloaded: true, packageSignature: "package-old",
    finalVideoUrl: "https://assets.test/final.mp4", finalVideoSignature: "final-old",
  },
});
const projectWith = (snapshot, legacyBackgroundMusic) => ({
  flow_type: "creator_lab", input_prompt: "Audio durability", language: "en", scenes: [],
  creator_production_package: legacyBackgroundMusic ? { backgroundMusic: legacyBackgroundMusic } : null,
  exported_movie_result: attachCreatorProjectState({}, snapshot),
});

const canonicalSnapshot = buildCreatorProjectState(baseInput({ audioTimeline }));
canonicalSnapshot.production.backgroundMusic = {
  mode: "selected", selectedTrackId: "legacy-loses", volume: 0.9,
  fadeInSec: 4, fadeOutSec: 5, autoDucking: false,
};
const jsonRoundtrip = JSON.parse(JSON.stringify(canonicalSnapshot));
const restored = readCreatorProjectState(projectWith(jsonRoundtrip));
assert.deepEqual(restored.production.audioTimeline, canonicalSnapshot.production.audioTimeline);
assert.deepEqual(restored.production.audioTimeline.placements.map(({ id }) => id), ["track-a", "track-b", "track-unresolved"]);
assert.deepEqual(restored.production.audioTimeline.placements[1].range, {
  start: { sceneId: "scene-4", edge: "end", offsetMs: -250 },
  end: { sceneId: "scene-5", edge: "start", offsetMs: 500 },
});
assert.deepEqual(restored.production.audioTimeline.placements.map(({ status }) => status), ["active", "stale", "unresolved"]);
assert.deepEqual(restored.production.audioTimeline.placements[0].fades, { inMs: 1000, outMs: 2000 });
assert.deepEqual(restored.production.audioTimeline.placements[0].ducking, { mode: "under_speech" });
assert.deepEqual(restored.production.audioTimeline.placements[0].asset.rights, { status: "verified", referenceId: "license-a" });
assert.equal("storageKey" in restored.production.audioTimeline.placements[0].asset, false);
assert.equal("renderer" in restored.production.audioTimeline.placements[0], false);
assert.equal(JSON.stringify(restored.production.audioTimeline).includes("startMs"), false);
assert.equal(JSON.stringify(restored.production.audioTimeline).includes("absoluteDurationMs"), false);

const omittedSnapshot = buildCreatorProjectState(baseInput({
  backgroundMusic: { mode: "selected", selectedTrackId: "legacy-track", volume: 0.22, fadeInSec: 1, fadeOutSec: 3, autoDucking: false },
}));
assert.equal(Object.hasOwn(omittedSnapshot.production, "audioTimeline"), false);
const omittedRestored = readCreatorProjectState(projectWith(omittedSnapshot));
assert.equal(Object.hasOwn(omittedRestored.production, "audioTimeline"), false);
assert.deepEqual(readCreatorAudioTimelineHydration(omittedRestored.production), {
  state: "legacy",
  migration: {
    state: "pending", legacyTrackId: "legacy-track", gain: 0.22,
    fadeInMs: 1000, fadeOutMs: 3000, duckingMode: "none",
    reason: "asset_or_scene_anchors_required",
  },
});
const convertedLegacy = readCreatorAudioTimelineHydration(omittedRestored.production, {
  assetId: "asset-legacy", sceneIds: ["scene-1", "scene-5"],
});
assert.equal(convertedLegacy.migration.state, "converted");
assert.equal(convertedLegacy.migration.timeline.placements.length, 1);
assert.equal(convertedLegacy.migration.timeline.placements[0].gain, 0.22);
assert.deepEqual(convertedLegacy.migration.timeline.placements[0].fades, { inMs: 1000, outMs: 3000 });
assert.deepEqual(convertedLegacy.migration.timeline.placements[0].ducking, { mode: "none" });
const noMusicHydration = readCreatorAudioTimelineHydration({ backgroundMusic: { mode: "none" } });
assert.equal(noMusicHydration.migration.state, "none");
assert.deepEqual(noMusicHydration.migration.timeline.placements, []);

const explicitNull = buildCreatorProjectState(baseInput({
  audioTimeline: null,
  backgroundMusic: { mode: "selected", selectedTrackId: "must-not-return", volume: 0.2 },
}));
const nullRestored = readCreatorProjectState(projectWith(explicitNull, explicitNull.production.backgroundMusic));
assert.equal(nullRestored.production.audioTimeline, null);
assert.deepEqual(readCreatorAudioTimelineHydration(nullRestored.production), { state: "null", timeline: null });
assert.equal(readCreatorAudioTimelineHydration(restored.production).state, "value");
assert.equal(
  readCreatorAudioTimelineHydration(restored.production).timeline.placements[0].asset.assetId,
  "asset-a",
  "canonical value wins over conflicting legacy music",
);

for (const malformed of [
  { ...audioTimeline, version: 99 },
  { ...audioTimeline, placements: [{ ...audioTimeline.placements[0], gain: "0.2" }] },
]) {
  const raw = structuredClone(omittedSnapshot);
  raw.production.audioTimeline = malformed;
  assert.throws(() => readCreatorProjectState(projectWith(raw, omittedSnapshot.production.backgroundMusic)));
}

const manualBinding = createCreatorProjectSaveBinding({
  originProjectId: "project-a", projectId: "project-a", expectedUpdatedAt: "revision-a",
  generation: 1, creatorProjectState: canonicalSnapshot,
});
const autosaveBinding = createCreatorProjectSaveBinding({ ...manualBinding, expectedUpdatedAt: "revision-b" });
assert.deepEqual(manualBinding.creatorProjectState.production.audioTimeline, canonicalSnapshot.production.audioTimeline);
assert.deepEqual(autosaveBinding.creatorProjectState.production.audioTimeline, canonicalSnapshot.production.audioTimeline);
assert.throws(() => assertProjectUpdateMatched(null, manualBinding.expectedUpdatedAt), /PROJECT_SAVE_CONFLICT/);
const manualAudioPayload = creatorAudioTimelineSnapshotFields(canonicalSnapshot.production.audioTimeline);
const autosaveAudioPayload = creatorAudioTimelineSnapshotFields(canonicalSnapshot.production.audioTimeline);
assert.deepEqual(manualAudioPayload, autosaveAudioPayload);
assert.deepEqual(manualAudioPayload.audioTimeline, canonicalSnapshot.production.audioTimeline);
assert.equal(JSON.stringify(manualAudioPayload).includes("startMs"), false);
assert.equal(manualAudioPayload.audioTimeline.placements[1].status, "stale");
assert.equal(manualAudioPayload.audioTimeline.placements[2].status, "unresolved");
assert.deepEqual(manualAudioPayload.audioTimeline.placements[1].range, canonicalSnapshot.production.audioTimeline.placements[1].range);
assert.deepEqual(manualAudioPayload.audioTimeline.placements[0].fades, { inMs: 1000, outMs: 2000 });
assert.deepEqual(manualAudioPayload.audioTimeline.placements[0].ducking, { mode: "under_speech" });
assert.deepEqual(manualAudioPayload.audioTimeline.placements[0].asset.rights, { status: "verified", referenceId: "license-a" });
assert.deepEqual(creatorAudioTimelineSnapshotFields(null), { audioTimeline: null });
assert.deepEqual(creatorAudioTimelineSnapshotFields(undefined), {});

const acquiredTrack = { id: "acquired-track", title: "Acquired", artist: "Artist", durationSec: 120, moods: [], genres: [], previewAvailable: true };
const acquiredStartingTimeline = selectAcquiredCatalogCreatorMusic({
  timeline: createDefaultCreatorMusicTimeline(), track: acquiredTrack, sceneIds: ["scene-1", "scene-2", "scene-3"],
});
const acquiredStartingSnapshot = buildCreatorProjectState(baseInput({ audioTimeline: acquiredStartingTimeline }));
assert.equal(acquiredStartingSnapshot.production.audioTimeline.placements[0].status, "active");
assert.equal(acquiredStartingSnapshot.production.audioTimeline.placements[0].asset.rights.status, "verified");
const acquiredSceneTimeline = startOrChangeCreatorSceneMusic({
  timeline: acquiredStartingTimeline, sceneIds: ["scene-1", "scene-2", "scene-3"], sceneId: "scene-2",
  choice: { mode: "asset", asset: creatorAcquiredCatalogTrackAsset({ ...acquiredTrack, id: "scene-track" }) },
});
const acquiredSceneSnapshot = buildCreatorProjectState(baseInput({ audioTimeline: acquiredSceneTimeline }));
assert.equal(acquiredSceneSnapshot.production.audioTimeline.placements.find((placement) => placement.id.startsWith("primary-music:"))?.status, "active");
assert.equal(acquiredSceneSnapshot.production.audioTimeline.placements.find((placement) => placement.id.startsWith("primary-music:"))?.asset?.rights.status, "verified");
const replacedStarting = selectAcquiredCatalogCreatorMusic({ timeline: acquiredSceneTimeline, track: { ...acquiredTrack, id: "replacement" }, sceneIds: ["scene-1", "scene-2", "scene-3"] });
assert.equal(replacedStarting.placements.some((placement) => placement.id.includes("scene-track") && placement.range.start.sceneId === "scene-2"), true, "default replacement preserves the later explicit transition");

const runtimeSave = page.slice(page.indexOf("const persistProject = async"), page.indexOf("const loadProject = async"));
const manualSave = page.slice(page.indexOf("const saveProject = async"), page.indexOf("const loadProject = async"));
const autosave = page.slice(page.indexOf("useEffect(() => {\n    if (skipAutosaveRef.current)"), page.indexOf("useEffect(() => {\n    return () =>", page.indexOf("useEffect(() => {\n    if (skipAutosaveRef.current)")));
assert.match(runtimeSave, /audioTimeline: nextTimeline[\s\S]*storedPublishPackageSignature: ""/);
assert.doesNotMatch(runtimeSave, /forceInvalidateFinalVideo: true/);
assert.match(runtimeSave, /hasOwnProperty\.call\(lifecycleOverrides, "audioTimeline"\)/);
assert.match(page.slice(page.indexOf("const handleExportMovie"), page.indexOf("const applyCreatorProfessionalScriptPlan")), /await projectSaveQueueRef\.current/);
assert.match(runtimeSave, /creatorAudioTimelineSnapshotFields\([\s\S]*lifecycleOverrides\.audioTimeline[\s\S]*creatorAudioTimeline/);
assert.match(manualSave, /await persistProject\(true\)/);
assert.match(autosave, /await persistProject\(false\)/);

let active = { projectId: "project-b", generation: 2, audioTimeline: null, message: "" };
assert.equal(isCreatorProjectSaveBindingActive(manualBinding, active), false);
if (isCreatorProjectSaveBindingActive(manualBinding, active)) active.audioTimeline = manualBinding.creatorProjectState.production.audioTimeline;
assert.equal(active.audioTimeline, null, "late Project A save cannot mutate Project B audio");
const hydrationOrigin = Object.freeze({ projectId: "project-a", generation: 1 });
assert.equal(isCreatorProjectOperationActive(hydrationOrigin, active), false);
if (isCreatorProjectOperationActive(hydrationOrigin, active)) active.audioTimeline = restored.production.audioTimeline;
assert.equal(active.audioTimeline, null, "late Project A hydration cannot mutate Project B audio");

const legacyMusic = { version: 1, mode: "none", volume: 0.16, autoDucking: true, fadeInSec: 1.5, fadeOutSec: 2 };
const scenes = [{ id: 1, creatorSceneId: "scene-1", exportSource: "image", image: "image-a" }];
const withoutCanonical = buildCreatorFinalProductionSignature({ scenes, backgroundMusic: legacyMusic });
const withCanonical = buildCreatorFinalProductionSignature({ scenes, backgroundMusic: legacyMusic, audioTimeline: canonicalSnapshot.production.audioTimeline });
const changedCanonical = buildCreatorFinalProductionSignature({
  scenes, backgroundMusic: legacyMusic,
  audioTimeline: { ...canonicalSnapshot.production.audioTimeline, master: { ...canonicalSnapshot.production.audioTimeline.master, gains: { ...canonicalSnapshot.production.audioTimeline.master.gains, music: 0.5 } } },
});
assert.notEqual(withCanonical, withoutCanonical);
assert.notEqual(changedCanonical, withCanonical, "canonical audio changes invalidate final-output identity");
const selectedLegacyMusic = { ...legacyMusic, mode: "selected", selectedTrackId: "legacy-track", volume: 0.9 };
assert.equal(
  buildCreatorFinalProductionSignature({ scenes, backgroundMusic: selectedLegacyMusic, audioTimeline: canonicalSnapshot.production.audioTimeline }),
  withCanonical,
  "canonical audio value ignores legacy music",
);
assert.equal(
  buildCreatorFinalProductionSignature({ scenes, backgroundMusic: legacyMusic, audioTimeline: null }),
  buildCreatorFinalProductionSignature({ scenes, backgroundMusic: selectedLegacyMusic, audioTimeline: null }),
  "canonical null ignores legacy music",
);
assert.notEqual(
  buildCreatorFinalProductionSignature({ scenes, backgroundMusic: legacyMusic }),
  buildCreatorFinalProductionSignature({ scenes, backgroundMusic: selectedLegacyMusic }),
  "omitted canonical audio retains legacy compatibility",
);
assert.throws(() => buildCreatorFinalProductionSignature({
  scenes, backgroundMusic: selectedLegacyMusic, audioTimeline: { ...audioTimeline, version: 99 },
}));
const reverseTimeline = {
  ...canonicalSnapshot.production.audioTimeline,
  placements: [...canonicalSnapshot.production.audioTimeline.placements].reverse(),
};
assert.equal(
  buildCreatorFinalProductionSignature({ scenes, backgroundMusic: legacyMusic, audioTimeline: reverseTimeline }),
  withCanonical,
  "incidental placement order is non-material",
);
const signatureWith = (mutate) => {
  const candidate = structuredClone(canonicalSnapshot.production.audioTimeline);
  mutate(candidate);
  return buildCreatorFinalProductionSignature({ scenes, backgroundMusic: legacyMusic, audioTimeline: candidate });
};
assert.notEqual(signatureWith((candidate) => { candidate.placements[0].asset.assetId = "asset-changed"; }), withCanonical);
assert.notEqual(signatureWith((candidate) => { candidate.placements[0].range.end.offsetMs = 25; }), withCanonical);
assert.notEqual(signatureWith((candidate) => { candidate.placements[0].sourceInMs = 25; }), withCanonical);
assert.notEqual(signatureWith((candidate) => { candidate.placements[0].sourceOutMs = 8000; }), withCanonical);
assert.notEqual(signatureWith((candidate) => { candidate.placements[0].gain = 0.25; }), withCanonical);
assert.notEqual(signatureWith((candidate) => { candidate.placements[0].fades.inMs = 1250; }), withCanonical);
assert.notEqual(signatureWith((candidate) => { candidate.placements[0].ducking.mode = "none"; }), withCanonical);
assert.notEqual(signatureWith((candidate) => { candidate.master.gains.music = 0.55; }), withCanonical);
assert.notEqual(signatureWith((candidate) => {
  candidate.placements.push({ ...structuredClone(candidate.placements[0]), id: "track-a-copy" });
}), withCanonical, "placement multiplicity is material");
assert.equal(signatureWith((candidate) => {
  candidate.placements[0].renderer = "ignored";
  candidate.placements[0].startMs = 123;
  candidate.placements[0].asset.providerSecret = "ignored";
}), withCanonical, "non-canonical metadata and derived timing are non-material");
assert.notEqual(
  createCreatorPublishArtifactSignature({ finalVideoSignature: changedCanonical }),
  createCreatorPublishArtifactSignature({ finalVideoSignature: withCanonical }),
  "canonical audio changes invalidate publish-package identity",
);
assert.deepEqual(creatorProjectStateRequestFields("creator_lab", canonicalSnapshot), { creatorProjectState: canonicalSnapshot });
assert.deepEqual(creatorProjectStateRequestFields("storyverse", canonicalSnapshot), {});

console.log("STAGE_0_13C_B_AUDIO_TIMELINE_PERSISTENCE=PASS");
