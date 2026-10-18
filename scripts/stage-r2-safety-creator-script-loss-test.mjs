import assert from "node:assert/strict";
import fs from "node:fs";
import { createCreatorAutosaveSemanticKey, shouldPersistCreatorAutosaveIntent } from "../lib/creator/creatorHydrationPersistence.ts";
import { createCreatorProjectSaveBinding, isCreatorProjectSaveBindingActive } from "../lib/creator/projectSaveCoordinator.ts";
import { attachCreatorProjectState, buildCreatorProjectState, readCreatorProjectState } from "../lib/creator/projectState.ts";
import { resolveCreatorScriptMutationAuthority } from "../lib/creator/creatorScriptMutationAuthority.ts";
import { createCreatorScript } from "../lib/creator/creatorScript.ts";

const words = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
const grounding = {
  version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve verified evidence.",
  readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] },
  claims: [], evidence: [], sources: [],
};
const script = createCreatorScript({
  title: "The Double-Edged Sword of Rapid AI Growth",
  sections: [
    { id: "opening", kind: "opening", text: words("opening", 80), claimIds: [], evidenceReviewRequired: false },
    { id: "growth", kind: "body", text: words("growth", 180), claimIds: [], evidenceReviewRequired: false },
    { id: "benefit", kind: "body", text: words("benefit", 180), claimIds: [], evidenceReviewRequired: false },
    { id: "risk", kind: "body", text: words("risk", 180), claimIds: [], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", text: words("conclusion", 80), claimIds: [], evidenceReviewRequired: false },
  ], targetDurationSec: 300, strategyFingerprint: "rapid-ai-growth", grounding: { context: grounding }, generatedAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z",
});
const scenes = Array.from({ length: 36 }, (_, index) => ({ id: index + 1, creatorSceneId: `scene-${index + 1}`, narration: `Scene ${index + 1}` }));
const snapshot = buildCreatorProjectState({
  brief: { topic: script.title, language: "en", country: "global", ageGroup: "professional_18", contentType: "educational_explainer", format: "youtube_video", durationPreset: "custom", durationSec: 300, customDurationSec: 300, qualityMode: "standard", targetPlatforms: ["youtube"] },
  strategy: { mentorResult: null, selectedDirectionId: "recommended", selectedHook: "", strategyFingerprint: script.strategyFingerprint, script },
  production: { package: null, refinedScenes: [], backgroundMusic: null, projectContinuityMode: "independent", sceneContinuityModes: {}, voicePreferences: null },
  createReview: { scenes },
  publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
});

// Reproduce the loss: an unrelated malformed persisted field makes the whole
// snapshot fail structural validation while the nested canonical script remains valid.
const malformedSnapshot = structuredClone(snapshot);
malformedSnapshot.navigation = { workspaceStep: 99, productionSubstep: "create_review" };
const persistedProject = { id: "project-ai-growth", flow_type: "creator_lab", scenes, exported_movie_result: attachCreatorProjectState({}, malformedSnapshot) };
const refreshed = readCreatorProjectState(persistedProject);
assert.equal(refreshed.strategy.script?.title, script.title, "refresh must salvage valid persisted script authority independently of unrelated malformed state");
assert.equal(refreshed.strategy.script?.sections.length, 5);
assert.equal(refreshed.createReview.scenes.length, 36, "scene projection remains protected during fail-closed hydration");

const hydratedAutosave = buildCreatorProjectState({ ...refreshed, navigation: { workspaceStep: 3, productionSubstep: "create_review" } });
assert.equal(hydratedAutosave.strategy.script?.revision, script.revision, "hydration/autosave snapshot retains the recovered script");
assert.equal(shouldPersistCreatorAutosaveIntent({ baselineKey: createCreatorAutosaveSemanticKey(refreshed), currentKey: createCreatorAutosaveSemanticKey(hydratedAutosave) }), true);
assert.throws(() => resolveCreatorScriptMutationAuthority({ persistedScript: refreshed.strategy.script, candidateScript: null, commandValue: undefined }), /CREATOR_SCRIPT_MUTATION_AUTHORITY_REQUIRED/, "autosave may never clear a persisted script without explicit mutation authority");
assert.equal(resolveCreatorScriptMutationAuthority({ persistedScript: refreshed.strategy.script, candidateScript: refreshed.strategy.script, commandValue: undefined }), refreshed.strategy.script, "unchanged autosave preserves script identity");

const partialSaveReload = readCreatorProjectState({ ...persistedProject, title: "Metadata-only update" });
assert.equal(partialSaveReload.strategy.script?.sections.length, 5, "partial-state saves retain canonical script authority");
const projectB = { ...persistedProject, id: "project-b", exported_movie_result: attachCreatorProjectState({}, { ...snapshot, strategy: { ...snapshot.strategy, script: { ...script, title: "Project B", revision: 2 } } }) };
assert.equal(readCreatorProjectState(projectB).strategy.script?.title, "Project B", "project switching hydrates the selected project's own script");
const staleBinding = createCreatorProjectSaveBinding({ originProjectId: persistedProject.id, projectId: persistedProject.id, expectedUpdatedAt: "r1", generation: 1, creatorProjectState: snapshot });
assert.equal(isCreatorProjectSaveBindingActive(staleBinding, { projectId: projectB.id, generation: 2 }), false, "a prior project's delayed save cannot become active after project switching");

const route = fs.readFileSync(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(route, /resolveCreatorScriptMutationAuthority/);
assert.match(route, /persistedScript = readCreatorProjectState\(persistedProject\)\.strategy\.script/);
assert.match(page, /setCreatorScript\(canonicalCreatorState\?\.strategy\.script \|\| null\)/);
assert.match(page, /creatorProjectState: capturedCreatorProjectState/);

console.log("STAGE_R2_SAFETY_CREATOR_SCRIPT_LOSS=PASS");
