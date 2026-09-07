import assert from "node:assert/strict";
import fs from "node:fs";
import {
  attachCreatorProjectState,
  buildCreatorProjectState,
  readCreatorProjectState,
} from "../lib/creator/projectState.ts";
import {
  advanceCreatorProjectSaveBinding,
  createCreatorProjectSaveBinding,
  creatorProjectStateRequestFields,
  isCreatorProjectOperationActive,
  isCreatorProjectSaveBindingActive,
} from "../lib/creator/projectSaveCoordinator.ts";
import {
  assertExistingProjectFlow,
  assertProjectUpdateMatched,
  projectPayload,
} from "../lib/persistence/projects/projectPatch.ts";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
const repository = fs.readFileSync(
  new URL("../lib/persistence/projects/supabaseProjectRepository.ts", import.meta.url),
  "utf8",
);

const mentor = {
  recommendedIdea: { title: "Durable direction", reason: "Evidence" },
  audienceInsight: ["Professional audience"],
  hookPatterns: ["Durable hook"],
  videoIdeas: [],
  productionPlan: ["Narrated production"],
  strategySelection: { directionId: "direction-2", hook: "Durable hook" },
  marketEvidence: { videos: [{ id: "evidence-1" }], patternSummary: { opportunityScore: 81 } },
};
const sceneA = {
  id: 2,
  creatorSceneId: "scene-b",
  text: "Applied edit",
  narration: "Narration",
  dialogue: "",
  visualSourceMethod: "upload",
  renderMode: "video",
  image: "https://assets.test/upload.jpg",
  audioUrl: "https://assets.test/audio.mp3",
  clipInSec: 1,
  clipOutSec: 7,
  assetHistory: [{ id: "asset-1", kind: "image", url: "https://assets.test/upload.jpg" }],
};
const sceneB = { id: 1, creatorSceneId: "scene-a", text: "Opening", narration: "Opening", dialogue: "" };
const productionPackage = {
  title: "Project",
  hook: "Durable hook",
  storyPremise: "Premise",
  characters: [],
  visualBible: {},
  scenes: [sceneA, sceneB],
  thumbnailIdea: "Idea",
  youtubeTitle: "Title",
  caption: "Caption",
  voicePreferences: { narratorProfileId: "velto_balanced" },
  visualContinuity: { projectMode: "consistent", sceneModes: { "scene-b": "independent" } },
  backgroundMusic: { enabled: true, trackId: "track-1", volume: 0.2 },
};
const snapshot = buildCreatorProjectState({
  brief: {
    topic: "Question",
    language: "en",
    country: "tr",
    ageGroup: "professional_18",
    contentType: "documentary_biography",
    outcome: "grow_audience",
    format: "youtube_video",
    durationPreset: "custom",
    durationSec: 960,
    customDurationSec: 960,
    qualityMode: "pro",
    targetPlatforms: ["youtube"],
  },
  strategy: { mentorResult: mentor, selectedDirectionId: "direction-2", selectedHook: "Durable hook" },
  production: {
    package: productionPackage,
    refinedScenes: [{ ...sceneA, text: "Refined" }],
    backgroundMusic: productionPackage.backgroundMusic,
    projectContinuityMode: "consistent",
    sceneContinuityModes: { "scene-b": "independent" },
    voicePreferences: productionPackage.voicePreferences,
  },
  createReview: { scenes: [sceneA, sceneB] },
  publish: {
    metadata: { recommendedTitle: "Published title" },
    thumbnail: { imageUrl: "https://assets.test/thumb.jpg" },
    thumbnailDesign: { headline: "Saved design", focalX: 44 },
    confirmations: { videoReviewed: true, claimsVerified: true, rightsConfirmed: true, thumbnailApproved: true },
    packageDownloaded: true,
    packageSignature: "package-v1",
    finalVideoUrl: "https://assets.test/final.mp4",
    finalVideoSignature: "final-v1",
  },
});

const persisted = {
  id: "project-1",
  flow_type: "creator_lab",
  input_prompt: "Question",
  language: "en",
  scenes: [sceneA, sceneB],
  refined_creator_scenes: [{ ...sceneA, text: "Refined" }],
  creator_mentor_result: mentor,
  creator_production_package: productionPackage,
  youtube_metadata: snapshot.publish.metadata,
  youtube_thumbnail: snapshot.publish.thumbnail,
  exported_movie_url: snapshot.publish.finalVideoUrl,
  export_signature: snapshot.publish.finalVideoSignature,
  exported_movie_result: attachCreatorProjectState({ projectLifecycle: { status: "production_ready" } }, snapshot),
};
const hydrated = readCreatorProjectState(persisted);

assert.equal(hydrated.brief.format, "youtube_video");
assert.equal(hydrated.brief.durationSec, 16 * 60);
assert.equal(hydrated.brief.durationPreset, "custom");
assert.equal(hydrated.brief.country, "tr");
assert.equal(hydrated.brief.ageGroup, "professional_18");
assert.equal(hydrated.brief.qualityMode, "pro");
assert.equal(hydrated.brief.contentType, "documentary_biography");
assert.equal(hydrated.brief.outcome, "grow_audience");
assert.deepEqual(hydrated.brief.targetPlatforms, ["youtube"]);
assert.deepEqual(hydrated.strategy.mentorResult, mentor);
assert.equal(hydrated.strategy.selectedDirectionId, "direction-2");
assert.equal(hydrated.strategy.selectedHook, "Durable hook");
assert.equal(hydrated.strategy.mentorResult.marketEvidence.videos.length, 1);
assert.deepEqual(hydrated.production.voicePreferences, productionPackage.voicePreferences);
assert.deepEqual(hydrated.production.backgroundMusic, productionPackage.backgroundMusic);
assert.equal(hydrated.production.projectContinuityMode, "consistent");
assert.equal(hydrated.createReview.scenes[0].text, "Applied edit");
assert.equal(hydrated.createReview.scenes[0].visualSourceMethod, "upload");
assert.equal(hydrated.createReview.scenes[0].audioUrl, "https://assets.test/audio.mp3");
assert.equal(hydrated.createReview.scenes[0].clipOutSec, 7);
assert.equal(hydrated.production.refinedScenes[0].text, "Refined");
assert.equal(hydrated.publish.thumbnailDesign.headline, "Saved design");
assert.equal(hydrated.publish.confirmations.rightsConfirmed, true);
assert.equal(hydrated.publish.packageDownloaded, true);

const legacy = readCreatorProjectState({
  flow_type: "creator_lab",
  input_prompt: "Legacy",
  language: "tr",
  creator_production_package: { ...productionPackage, format: "youtube_video", durationSec: 600 },
  creator_mentor_result: mentor,
  scenes: [sceneB],
  refined_creator_scenes: [{ ...sceneB, text: "Legacy refined" }],
});
assert.equal(legacy.brief.format, "youtube_video");
assert.equal(legacy.brief.durationSec, 600);
assert.equal(legacy.createReview.scenes.length, 1);
assert.equal(legacy.production.refinedScenes[0].text, "Legacy refined");

const explicitNullSnapshot = structuredClone(snapshot);
explicitNullSnapshot.strategy.mentorResult = null;
explicitNullSnapshot.production.package = null;
explicitNullSnapshot.publish.metadata = null;
explicitNullSnapshot.publish.thumbnail = null;
const explicitNullHydration = readCreatorProjectState({
  ...persisted,
  creator_mentor_result: mentor,
  creator_production_package: productionPackage,
  youtube_metadata: { recommendedTitle: "stale" },
  youtube_thumbnail: { imageUrl: "stale" },
  exported_movie_result: attachCreatorProjectState({}, explicitNullSnapshot),
});
assert.equal(explicitNullHydration.strategy.mentorResult, null);
assert.equal(explicitNullHydration.production.package, null);
assert.equal(explicitNullHydration.publish.metadata, null);
assert.equal(explicitNullHydration.publish.thumbnail, null);

for (const invalidSnapshot of [
  { ...snapshot, version: 999 },
  { version: 1, brief: "malformed" },
  { ...structuredClone(snapshot), brief: { ...snapshot.brief, durationSec: "sixteen" } },
  { ...structuredClone(snapshot), createReview: { scenes: {} } },
  {
    ...structuredClone(snapshot),
    publish: { ...snapshot.publish, confirmations: { rightsConfirmed: "yes" } },
  },
]) {
  const fallback = readCreatorProjectState({
    ...persisted,
    creator_production_package: { ...productionPackage, format: "youtube_video", durationSec: 600 },
    exported_movie_result: { creatorProjectState: invalidSnapshot },
  });
  assert.equal(fallback.strategy.mentorResult, mentor);
  assert.equal(fallback.production.package.title, productionPackage.title);
  assert.equal(fallback.production.package.format, "youtube_video");
  assert.equal(fallback.brief.format, "youtube_video");
  assert.equal(fallback.brief.durationSec, 600);
}

const basePatch = {
  projectId: "project-1", ownerUserId: "owner-1", childId: null,
  title: "Project", flowType: "creator_lab", expectedUpdatedAt: "revision-1",
};
for (const [inputKey, column] of [
  ["refinedCreatorScenes", "refined_creator_scenes"],
  ["creatorMentorResult", "creator_mentor_result"],
  ["creatorProductionPackage", "creator_production_package"],
  ["youtubeMetadataResult", "youtube_metadata"],
  ["youtubeThumbnailResult", "youtube_thumbnail"],
  ["exportedMovieResult", "exported_movie_result"],
]) {
  assert.equal(Object.hasOwn(projectPayload(basePatch), column), false);
  assert.equal(projectPayload({ ...basePatch, [inputKey]: null })[column], null);
  assert.deepEqual(projectPayload({ ...basePatch, [inputKey]: { replacement: true } })[column], { replacement: true });
}

assert.throws(() => assertExistingProjectFlow("creator_lab", "storyverse", null), /PROJECT_FLOW_TYPE_MISMATCH/);
assert.throws(() => assertExistingProjectFlow("storyverse", "creator_lab", "revision-1"), /PROJECT_FLOW_TYPE_MISMATCH/);
assert.throws(() => assertExistingProjectFlow("creator_lab", "creator_lab", null), /PROJECT_REVISION_REQUIRED/);
assert.doesNotThrow(() => assertExistingProjectFlow("creator_lab", "creator_lab", "revision-1"));
assert.doesNotThrow(() => assertExistingProjectFlow("storyverse", "storyverse", null));
assert.equal(projectPayload({ ...basePatch, projectId: null }).flow_type, "creator_lab");
assert.equal(projectPayload({ ...basePatch, projectId: null, flowType: "storyverse" }).flow_type, "storyverse");
assert.equal(Object.hasOwn(projectPayload(basePatch, false), "flow_type"), false);
assert.throws(() => assertProjectUpdateMatched(null, "revision-1"), /PROJECT_SAVE_CONFLICT/);
assert.doesNotThrow(() => assertProjectUpdateMatched({ id: "project-1" }, "revision-1"));

assert.equal(Object.hasOwn(creatorProjectStateRequestFields("storyverse", null), "creatorProjectState"), false);
assert.equal(creatorProjectStateRequestFields("creator_lab", snapshot).creatorProjectState, snapshot);

const bindingA = createCreatorProjectSaveBinding({
  originProjectId: "project-a", projectId: "project-a", expectedUpdatedAt: "a-1", generation: 1, creatorProjectState: snapshot,
});
assert.equal(isCreatorProjectSaveBindingActive(bindingA, { projectId: "project-b", generation: 2 }), false);
assert.equal(isCreatorProjectSaveBindingActive(bindingA, { projectId: "project-a", generation: 1 }), true);
const serializedNextBinding = advanceCreatorProjectSaveBinding(bindingA, {
  projectId: "project-a", expectedUpdatedAt: "a-2", generation: 1,
});
assert.equal(serializedNextBinding.expectedUpdatedAt, "a-2");
assert.equal(serializedNextBinding.creatorProjectState, snapshot);
assert.equal(advanceCreatorProjectSaveBinding(bindingA, {
  projectId: "project-b", expectedUpdatedAt: "b-1", generation: 2,
}), null);
let activeProject = { projectId: "project-a", generation: 1, revision: "a-1", message: "Saved" };
let projectBWriteCount = 0;
const queuedA = Promise.resolve().then(() => {
  activeProject = { projectId: "project-b", generation: 2, revision: "b-1", message: "" };
  if (!isCreatorProjectSaveBindingActive(bindingA, activeProject)) return;
  projectBWriteCount += 1;
});
await queuedA;
assert.equal(projectBWriteCount, 0);
const lateAResponse = { project: { id: "project-a", updated_at: "a-2" } };
if (isCreatorProjectSaveBindingActive(bindingA, activeProject)) {
  activeProject = { ...activeProject, projectId: lateAResponse.project.id, revision: lateAResponse.project.updated_at, message: "Saved" };
}
assert.deepEqual(activeProject, { projectId: "project-b", generation: 2, revision: "b-1", message: "" });

const queuedNewDraft = createCreatorProjectSaveBinding({
  originProjectId: "",
  projectId: "",
  expectedUpdatedAt: "",
  generation: 3,
  creatorProjectState: snapshot,
});
const advancedNewDraft = advanceCreatorProjectSaveBinding(queuedNewDraft, {
  projectId: "project-created",
  expectedUpdatedAt: "created-1",
  generation: 3,
});
assert.deepEqual(
  {
    originProjectId: advancedNewDraft?.originProjectId,
    projectId: advancedNewDraft?.projectId,
    expectedUpdatedAt: advancedNewDraft?.expectedUpdatedAt,
  },
  {
    originProjectId: "project-created",
    projectId: "project-created",
    expectedUpdatedAt: "created-1",
  },
);
assert.equal(isCreatorProjectSaveBindingActive(advancedNewDraft, {
  projectId: "project-created",
  generation: 3,
}), true);

const fullPackageOrigin = Object.freeze({ projectId: "project-a", generation: 7 });
let fullPackageActive = { projectId: "project-a", generation: 7 };
assert.equal(isCreatorProjectOperationActive(fullPackageOrigin, fullPackageActive), true);
fullPackageActive = { projectId: "project-b", generation: 8 };
assert.equal(isCreatorProjectOperationActive(fullPackageOrigin, fullPackageActive), false);
let fullPackageSaveCount = 0;
if (isCreatorProjectOperationActive(fullPackageOrigin, fullPackageActive)) fullPackageSaveCount += 1;
assert.equal(fullPackageSaveCount, 0);
let lateFullPackageUi = { ...fullPackageActive, revision: "b-1", message: "" };
if (isCreatorProjectOperationActive(fullPackageOrigin, fullPackageActive)) {
  lateFullPackageUi = { projectId: "project-a", generation: 7, revision: "a-2", message: "Saved" };
}
assert.deepEqual(lateFullPackageUi, { projectId: "project-b", generation: 8, revision: "b-1", message: "" });

const resetOrigin = Object.freeze({ projectId: "project-a", generation: 11 });
const afterReset = { projectId: "", generation: 12 };
assert.equal(isCreatorProjectOperationActive(resetOrigin, afterReset), false);

assert.match(page, /creatorProjectState:\s*capturedCreatorProjectState/);
assert.match(page, /creatorProjectStateRequestFields\(/);
assert.match(page, /projectSaveQueueRef\.current[\s\S]*executePersistProject/);
assert.match(page, /createCreatorProjectSaveBinding\(\{/);
assert.match(page, /setCreatorCountry\(canonicalCreatorState\.brief\.country\)/);
assert.match(page, /setCreatorReleaseConfirmations\(\{/);
assert.match(route, /has\("refinedCreatorScenes"\)/);
assert.match(route, /status: 409/);
assert.match(repository, /if \(input\.expectedUpdatedAt\)[\s\S]*\.eq\("updated_at", input\.expectedUpdatedAt\)/);
assert.match(repository, /assertExistingProjectFlow\(persistedFlowType, input\.flowType, input\.expectedUpdatedAt\)/);
assert.match(repository, /\.eq\("flow_type", persistedFlowType\)/);
assert.match(page, /isCreatorLabFlow\s*\? buildCreatorProjectState/);
const fullPackageHandler = page.slice(
  page.indexOf("const handleGenerateFullYoutubePackage = async"),
  page.indexOf("const handleCreatorMentorAnalysis = async"),
);
assert.match(fullPackageHandler, /await persistProject\(false,/);
assert.doesNotMatch(fullPackageHandler, /fetch\("\/api\/save-project"/);
assert.match(fullPackageHandler, /fullPackageOperationIsActive\(\)/);
const resetHandler = page.slice(page.indexOf("const resetStoryFlow = () =>"), page.indexOf("const getProjectKey = () =>"));
assert.match(resetHandler, /invalidateProjectPersistence\(\)/);

// Deterministic model of the client queue: a delayed older autosave must finish
// before the newer manual save, so the final persisted revision is the manual one.
let queue = Promise.resolve();
let storedRevision = "initial";
const enqueue = (revision, delay) => {
  const run = queue.then(() => new Promise((resolve) => setTimeout(resolve, delay))).then(() => {
    storedRevision = revision;
  });
  queue = run.catch(() => undefined);
  return run;
};
const oldAutosave = enqueue("old-autosave", 15);
const newManualSave = enqueue("new-manual", 0);
await Promise.all([oldAutosave, newManualSave]);
assert.equal(storedRevision, "new-manual");

console.log("Stage 0.13A CreatorLab project state persistence tests passed (expanded behavioral coverage).");
