import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { EMPTY_CREATOR_AUDIO_TIMELINE } from "../lib/creator/audioTimeline.ts";
import { createCreatorScript } from "../lib/creator/creatorScript.ts";
import { resolveCreatorScriptMutationAuthority } from "../lib/creator/creatorScriptMutationAuthority.ts";
import { attachCreatorProjectState, buildCreatorProjectState, inspectCreatorProjectStatePersistenceAuthority, preserveQuarantinedCreatorProjectState, readCreatorProjectState } from "../lib/creator/projectState.ts";

const words = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
const context = { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve authority.", readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] }, claims: [], evidence: [], sources: [] };
const script = createCreatorScript({ title: "The Double-Edged Sword of Rapid AI Growth", sections: [
  { id: "opening", kind: "opening", text: words("open", 80), claimIds: [], evidenceReviewRequired: false },
  { id: "growth", kind: "body", text: words("growth", 180), claimIds: [], evidenceReviewRequired: false },
  { id: "benefit", kind: "body", text: words("benefit", 180), claimIds: [], evidenceReviewRequired: false },
  { id: "risk", kind: "body", text: words("risk", 180), claimIds: [], evidenceReviewRequired: false },
  { id: "ending", kind: "conclusion", text: words("ending", 80), claimIds: [], evidenceReviewRequired: false },
], targetDurationSec: 300, strategyFingerprint: "rapid-ai-growth-fingerprint", grounding: { context }, generatedAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z" });
const scenes = Array.from({ length: 36 }, (_, index) => ({ id: index + 1, creatorSceneId: `scene-${index + 1}`, narration: `Scene ${index + 1}` }));
const pending = { proposalId: "proposal-1", baseRevision: script.revision, scope: "opening", instruction: "Improve opening", createdAt: "2026-10-18T00:01:00.000Z", changes: [{ sectionId: "opening", sectionHeading: "opening", beforeText: script.sections[0].text, afterText: `${script.sections[0].text} revised` }] };
const history = [{ id: "history-1", fromRevision: 1, toRevision: 2, createdAt: "2026-10-18T00:00:30.000Z", origin: "manual", changes: [{ sectionId: "opening", sectionHeading: "opening", beforeText: "before", afterText: "after" }] }];
const snapshot = buildCreatorProjectState({
  navigation: { workspaceStep: 3, productionSubstep: "create_review" },
  brief: { topic: script.title, language: "en", country: "global", ageGroup: "professional_18", contentType: "educational_explainer", format: "youtube_video", durationPreset: "custom", durationSec: 300, customDurationSec: 300, qualityMode: "premium", targetPlatforms: ["youtube"] },
  strategy: { mentorResult: { analysis: "keep" }, selectedDirectionId: "direction-1", selectedHook: "hook", strategyFingerprint: script.strategyFingerprint, profileSnapshot: { tone: "documentary" }, script, pendingRefinement: pending, revisionHistory: history },
  production: { package: { sourceScriptRevision: script.revision }, refinedScenes: [{ id: "refined" }], backgroundMusic: null, audioTimeline: EMPTY_CREATOR_AUDIO_TIMELINE, projectContinuityMode: "continuous", sceneContinuityModes: { "scene-1": "continuous" }, voicePreferences: { narratorProfileId: "voice-1" } },
  createReview: { scenes },
  publish: { metadata: { title: "Published title" }, thumbnail: { url: "https://assets.test/thumb.jpg" }, thumbnailDesign: { layout: "focus" }, confirmations: { rights: true }, packageDownloaded: true, packageSignature: "package-signature", finalVideoUrl: "https://assets.test/final.mp4", finalVideoSignature: "final-signature" },
});
const malformed = structuredClone(snapshot);
malformed.navigation.workspaceStep = 99;
const project = { id: "project-ai-growth", exported_movie_result: attachCreatorProjectState({ retainedEnvelope: true }, malformed), scenes };
const authority = inspectCreatorProjectStatePersistenceAuthority(project);
assert.equal(authority.status, "malformed_valid_script");
assert.equal(authority.script.sections.length, 5);
assert.equal(readCreatorProjectState(project).strategy.script?.title, script.title, "hydration retains independently valid script authority");
assert.throws(() => resolveCreatorScriptMutationAuthority({ persistedScript: authority.script, candidateScript: null, commandValue: undefined }), /AUTHORITY_REQUIRED/);

// Full autosave is quarantined before repository mutation. The fake repository
// proves complete canonical JSON remains byte-for-byte equivalent.
let storedProject = structuredClone(project); let saveCalls = 0;
const fakeRepository = { save: async (patch) => { saveCalls += 1; storedProject = { ...storedProject, ...patch }; } };
const beforeFullSave = JSON.stringify(storedProject.exported_movie_result.creatorProjectState);
const fullSaveBlocked = authority.status.startsWith("malformed_");
if (!fullSaveBlocked) await fakeRepository.save({ exported_movie_result: attachCreatorProjectState({}, snapshot) });
assert.equal(saveCalls, 0);
assert.equal(JSON.stringify(storedProject.exported_movie_result.creatorProjectState), beforeFullSave);

// A metadata-only/partial save may proceed, but even when it supplies a new
// result envelope it must retain the quarantined canonical snapshot exactly.
const partialResult = preserveQuarantinedCreatorProjectState({ authority, exportedMovieResult: { metadataOnly: "new" } });
await fakeRepository.save({ title: "Renamed safely", exported_movie_result: partialResult });
assert.equal(saveCalls, 1);
assert.deepEqual(storedProject.exported_movie_result.creatorProjectState, malformed);
assert.equal(storedProject.exported_movie_result.metadataOnly, "new");

// Valid canonical compatibility states distinguish an omitted script from an
// explicit null and a present script without throwing during hydration.
for (const scriptVariant of ["missing", "null", "valid"]) {
  const compatible = structuredClone(snapshot);
  if (scriptVariant === "missing") delete compatible.strategy.script;
  if (scriptVariant === "null") compatible.strategy.script = null;
  const compatibleProject = { exported_movie_result: attachCreatorProjectState({}, compatible) };
  assert.equal(inspectCreatorProjectStatePersistenceAuthority(compatibleProject).status, "valid");
  assert.equal(readCreatorProjectState(compatibleProject).strategy.script?.title ?? null, scriptVariant === "valid" ? script.title : null);
}

const invalidScriptSnapshot = structuredClone(malformed);
invalidScriptSnapshot.strategy.script = { version: 1, title: "broken" };
const invalidProject = { exported_movie_result: attachCreatorProjectState({}, invalidScriptSnapshot) };
assert.equal(inspectCreatorProjectStatePersistenceAuthority(invalidProject).status, "malformed_invalid_script");
assert.throws(() => readCreatorProjectState(invalidProject), /CREATOR_PROJECT_STATE_SCRIPT_INVALID/, "invalid non-null script is never treated as absent");

const legitimateNull = structuredClone(snapshot);
legitimateNull.strategy.script = null; legitimateNull.strategy.pendingRefinement = null; legitimateNull.strategy.revisionHistory = [];
assert.equal(inspectCreatorProjectStatePersistenceAuthority({ exported_movie_result: attachCreatorProjectState({}, legitimateNull) }).status, "valid");
assert.equal(readCreatorProjectState({ exported_movie_result: attachCreatorProjectState({}, legitimateNull) }).strategy.script, null);
assert.equal(inspectCreatorProjectStatePersistenceAuthority({ exported_movie_result: {} }).status, "legacy_absent");

for (const unexpected of [null, [], { ...structuredClone(snapshot), version: 2 }]) {
  const unexpectedProject = { exported_movie_result: { retainedEnvelope: true, creatorProjectState: unexpected } };
  assert.equal(inspectCreatorProjectStatePersistenceAuthority(unexpectedProject).status, "malformed_snapshot");
}

// Exercise the actual HTTP handler with injected authentication and persistence
// adapters. This covers request parsing, quarantine decisions, repository
// writes, and response status rather than asserting source order.
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  alias: { "@": new URL("..", import.meta.url).pathname.replace(/\/$/, ""), "server-only": new URL("../lib/creator/projectState.ts", import.meta.url).pathname },
});
const { POST } = await jiti.import("../app/api/save-project/route.ts");
const handleSaveProjectRequest = POST.handleForTest;
const owner = { id: "owner-1", email: "owner@test.invalid", providerUser: { id: "owner-1" } };
const request = (body) => new Request("http://localhost/api/save-project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const execute = async (persisted, body) => {
  let saved = structuredClone(persisted); const patches = [];
  const projectRepository = {
    getForOwner: async () => structuredClone(saved),
    saveForOwner: async (patch) => {
      patches.push(structuredClone(patch));
      saved = {
        ...saved,
        ...(Object.hasOwn(patch, "title") ? { title: patch.title } : {}),
        ...(Object.hasOwn(patch, "scenes") ? { scenes: patch.scenes } : {}),
        ...(Object.hasOwn(patch, "exportedMovieUrl") ? { exported_movie_url: patch.exportedMovieUrl } : {}),
        ...(Object.hasOwn(patch, "exportSignature") ? { export_signature: patch.exportSignature } : {}),
        ...(Object.hasOwn(patch, "exportedMovieResult") ? { exported_movie_result: patch.exportedMovieResult } : {}),
      };
      return { project: structuredClone(saved), created: false };
    },
  };
  const services = { projectRepository, mediaAssetRepository: {
    findByPublicUrl: async () => null,
    replaceProjectReferences: async () => undefined,
    listFinalVideosForProject: async () => saved.exported_movie_url ? [{ id: "current-final", ownerUserId: owner.id, mediaKind: "final_video", lifecycleState: "active", publicUrl: saved.exported_movie_url, metadata: { projectId: saved.id } }] : [],
  } };
  const response = await handleSaveProjectRequest(request(body), { authenticate: async () => owner, persistence: () => services });
  return { response, payload: await response.json(), patches, saved };
};
const baseBody = { projectId: project.id, flowType: "creator_lab", expectedUpdatedAt: "revision-1" };

for (const scriptVariant of ["missing", "null", "valid"]) {
  const compatible = structuredClone(snapshot);
  if (scriptVariant === "missing") delete compatible.strategy.script;
  if (scriptVariant === "null") compatible.strategy.script = null;
  const compatibleProject = { ...project, exported_movie_result: attachCreatorProjectState({ sibling: "preserved" }, compatible) };
  const full = await execute(compatibleProject, { ...baseBody, creatorProjectState: compatible });
  assert.equal(full.response.status, 200, `valid ${scriptVariant} script full save succeeds`);
  assert.equal(full.patches.length, 1);
  const partial = await execute(compatibleProject, { ...baseBody, title: `Compatible ${scriptVariant}` });
  assert.equal(partial.response.status, 200, `valid ${scriptVariant} script partial save succeeds`);
  assert.equal(partial.patches.length, 1);
}

const wrongVersion = structuredClone(snapshot); wrongVersion.version = 2;
const quarantinedProject = {
  ...project, title: "Original", exported_movie_url: "https://assets.test/previous.mp4", export_signature: "previous-signature",
  exported_movie_result: attachCreatorProjectState({ projectLifecycle: { status: "production_ready" }, projectPerformanceHistory: [{ id: "history" }] }, wrongVersion),
};
const beforeQuarantine = structuredClone(quarantinedProject);
const blocked = await execute(quarantinedProject, { ...baseBody, creatorProjectState: snapshot });
assert.equal(blocked.response.status, 409);
assert.equal(blocked.payload.code, "CREATOR_PROJECT_STATE_REPAIR_REQUIRED");
assert.equal(blocked.patches.length, 0, "wrong-version full save performs no repository mutation");

const partialHttp = await execute(quarantinedProject, { ...baseBody, title: "Safe rename", exportedMovieResult: { metadataOnly: "changed" } });
assert.equal(partialHttp.response.status, 200);
assert.equal(partialHttp.patches.length, 1);
assert.deepEqual(partialHttp.saved.exported_movie_result.creatorProjectState, beforeQuarantine.exported_movie_result.creatorProjectState);
assert.deepEqual(partialHttp.saved.exported_movie_result.projectLifecycle, beforeQuarantine.exported_movie_result.projectLifecycle);
assert.deepEqual(partialHttp.saved.exported_movie_result.projectPerformanceHistory, beforeQuarantine.exported_movie_result.projectPerformanceHistory);
assert.deepEqual(partialHttp.saved.scenes, beforeQuarantine.scenes);
assert.equal(partialHttp.saved.exported_movie_url, beforeQuarantine.exported_movie_url);
assert.equal(partialHttp.saved.export_signature, beforeQuarantine.export_signature);
assert.equal(Object.hasOwn(partialHttp.patches[0], "scenes"), false);
assert.equal(Object.hasOwn(partialHttp.patches[0], "exportedMovieUrl"), false);
assert.equal(Object.hasOwn(partialHttp.patches[0], "exportSignature"), false);

const invalidPartial = await execute({ ...project, exported_movie_result: attachCreatorProjectState({}, invalidScriptSnapshot) }, { ...baseBody, title: "Must block" });
assert.equal(invalidPartial.response.status, 409);
assert.equal(invalidPartial.payload.code, "CREATOR_PROJECT_STATE_REPAIR_REQUIRED");
assert.equal(invalidPartial.patches.length, 0);

console.log("STAGE_R2_SAFETY_CREATOR_PROJECT_QUARANTINE=PASS");
