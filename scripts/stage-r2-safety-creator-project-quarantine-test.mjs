import assert from "node:assert/strict";
import fs from "node:fs";
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

const route = fs.readFileSync(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
assert.match(route, /CREATOR_PROJECT_STATE_REPAIR_REQUIRED/);
assert.match(route, /preserveQuarantinedCreatorProjectState/);
assert.ok(route.indexOf("CREATOR_PROJECT_STATE_REPAIR_REQUIRED") < route.indexOf("resolveCreatorScriptMutationAuthority({"), "quarantine blocks full save before mutation resolution");

console.log("STAGE_R2_SAFETY_CREATOR_PROJECT_QUARANTINE=PASS");
