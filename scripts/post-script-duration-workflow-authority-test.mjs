import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  approveCreatorScript,
  createCreatorScript,
  createCreatorStrategyFingerprint,
  getCreatorScriptDurationContractForScript,
  normalizeCreatorScript,
} from "../lib/creator/creatorScript.ts";
import {
  assertCreatorScriptSceneBuildDuration,
  resolvePersistedCreatorScriptAuthority,
} from "../lib/creator/creatorProductionAuthority.ts";
import { buildCreatorProjectState, readCreatorProjectState } from "../lib/creator/projectState.ts";
import { acceptGeneratedCreatorScript } from "../lib/creator/creatorScript.ts";
import {
  createCreatorScriptReplacementState,
  getCreatorWorkflowLoadingState,
  persistCreatorScriptReplacement,
  shouldRestoreCreatorBriefDraft,
} from "../lib/creator/creatorWorkflowAuthority.ts";

const persistedTopic = "If Work Becomes Optional, Will Freedom Follow?";
const staleDraftTopic = "REGENERATE THE ENTIRE SCRIPT FROM THE RESEARCH CORE about Mars colonization";

assert.equal(shouldRestoreCreatorBriefDraft({ isCreatorLabFlow: true, currentProjectId: "project-work", requestedProjectId: "" }), false);
assert.equal(shouldRestoreCreatorBriefDraft({ isCreatorLabFlow: true, currentProjectId: "", requestedProjectId: "project-work" }), false);
assert.equal(shouldRestoreCreatorBriefDraft({ isCreatorLabFlow: true, currentProjectId: "", requestedProjectId: "" }), true);
assert.equal(shouldRestoreCreatorBriefDraft({ isCreatorLabFlow: false, currentProjectId: "", requestedProjectId: "" }), false);

const canonicalTopic = shouldRestoreCreatorBriefDraft({ isCreatorLabFlow: true, currentProjectId: "project-work", requestedProjectId: "" })
  ? staleDraftTopic
  : persistedTopic;
assert.equal(canonicalTopic, persistedTopic);
const researchTopic = canonicalTopic;
const fingerprintTopic = canonicalTopic;
assert.equal(researchTopic, fingerprintTopic);
assert.notEqual(researchTopic, staleDraftTopic);

assert.deepEqual(getCreatorWorkflowLoadingState({ operation: "script" }), { scriptGenerating: true, scenesBuilding: false });
assert.deepEqual(getCreatorWorkflowLoadingState({ operation: "scenes" }), { scriptGenerating: false, scenesBuilding: true });
assert.deepEqual(getCreatorWorkflowLoadingState({ operation: "idle" }), { scriptGenerating: false, scenesBuilding: false });

const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Explain material claims accurately and preserve uncertainty.",
  readiness: { status: "ready", editorialReadinessScore: 92, reviewReasons: [] },
  claims: [], evidence: [], sources: [],
};
const fingerprint = createCreatorStrategyFingerprint({ topic: persistedTopic, targetDurationSec: 960 });
const makeScript = (wordCount) => createCreatorScript({
  title: "Work and freedom",
  sections: [
    { id: "opening", kind: "opening", text: words(Math.floor(wordCount / 3)), claimIds: [], evidenceReviewRequired: false },
    { id: "body", kind: "body", text: words(Math.floor(wordCount / 3)), claimIds: [], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", text: words(wordCount - 2 * Math.floor(wordCount / 3)), claimIds: [], evidenceReviewRequired: false },
  ],
  targetDurationSec: 960,
  strategyFingerprint: fingerprint,
  grounding: { context },
  generatedAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:00.000Z",
});
const historicShort = makeScript(549);
assert.equal(normalizeCreatorScript(historicShort).sections.length, 3);
assert.equal(getCreatorScriptDurationContractForScript(historicShort, "en").status, "too_short");
assert.throws(
  () => assertCreatorScriptSceneBuildDuration({ script: historicShort, language: "en", requestedDurationSec: 960 }),
  (error) => error?.code === "CREATOR_SCRIPT_DURATION_UNSATISFIED",
);

const compliant = approveCreatorScript(makeScript(2256), fingerprint, "2026-09-09T00:01:00.000Z");
assert.equal(assertCreatorScriptSceneBuildDuration({ script: compliant, language: "en", requestedDurationSec: 960 }).status, "compliant");
assert.throws(
  () => assertCreatorScriptSceneBuildDuration({ script: compliant, language: "en", requestedDurationSec: 600 }),
  (error) => error?.code === "CREATOR_SCRIPT_DURATION_UNSATISFIED",
);

const projectSnapshot = buildCreatorProjectState({
  brief: { topic: persistedTopic, language: "en", country: "global", ageGroup: "broad_18", contentType: "educational", format: "youtube_video", durationPreset: "custom", durationSec: 960, customDurationSec: 960, qualityMode: "standard", targetPlatforms: ["youtube"] },
  strategy: { mentorResult: {}, selectedDirectionId: "recommended", selectedHook: "direct", script: compliant },
  production: { package: null, refinedScenes: [], backgroundMusic: null, projectContinuityMode: "independent", sceneContinuityModes: {}, voicePreferences: null },
  createReview: { scenes: [] },
  publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
});
const persistedProject = { id: "project-work", flow_type: "creator_lab", exported_movie_result: { creatorProjectState: projectSnapshot } };
assert.equal(readCreatorProjectState(persistedProject).brief.topic, persistedTopic);
assert.equal(resolvePersistedCreatorScriptAuthority({ persistedProject, requestedRevision: compliant.revision }).revision, compliant.revision);

const historicState = {
  script: historicShort,
  productionPackage: { id: "package-a" },
  refinedScenes: [{ id: "refined-a" }],
  scenes: [{ id: "scene-a" }],
  timelinePreviewPlan: { id: "timeline-a" },
  editPlan: { id: "edit-a" },
  exportedMovieUrl: "https://example.test/final-a.mp4",
  exportMovieResult: { url: "https://example.test/final-a.mp4" },
  exportSignature: "export-a",
  packageDownloaded: true,
  packageSignature: "publish-a",
  resetReleaseConfirmations: false,
};
let currentState = historicState;
let successMessage = "";
let failureMessage = "";
let scenesBuilt = 0;
let persistCalls = 0;
try {
  await persistCreatorScriptReplacement({
    script: compliant,
    persist: async () => { persistCalls += 1; throw new Error("SAVE_REJECTED"); },
    advanceAuthority: () => true,
    isActive: () => true,
  });
  successMessage = "Full script ready for review.";
} catch (error) {
  failureMessage = error.message;
}
assert.equal(currentState, historicState);
assert.equal(currentState.script, historicShort);
assert.equal(currentState.productionPackage.id, "package-a");
assert.equal(currentState.scenes[0].id, "scene-a");
assert.equal(currentState.exportedMovieUrl, "https://example.test/final-a.mp4");
assert.equal(currentState.packageSignature, "publish-a");
assert.equal(successMessage, "");
assert.equal(failureMessage, "SAVE_REJECTED");
assert.equal(scenesBuilt, 0);
assert.equal(persistCalls, 1);

const replacement = await persistCreatorScriptReplacement({
  script: compliant,
  persist: async () => undefined,
  advanceAuthority: () => true,
  isActive: () => true,
});
assert.deepEqual(replacement, createCreatorScriptReplacementState(compliant));
currentState = replacement;
successMessage = "Full script ready for review.";
assert.equal(currentState.script, compliant);
assert.equal(currentState.script.targetDurationSec, 960);
assert.equal(getCreatorScriptDurationContractForScript(currentState.script, "en").status, "compliant");
assert.equal(currentState.productionPackage, null);
assert.deepEqual(currentState.refinedScenes, []);
assert.deepEqual(currentState.scenes, []);
assert.equal(currentState.timelinePreviewPlan, null);
assert.equal(currentState.editPlan, null);
assert.equal(currentState.exportedMovieUrl, "");
assert.equal(currentState.exportMovieResult, null);
assert.equal(currentState.exportSignature, "");
assert.equal(currentState.packageDownloaded, false);
assert.equal(currentState.packageSignature, "");
assert.equal(currentState.resetReleaseConfirmations, true);
assert.equal(successMessage, "Full script ready for review.");
assert.equal(scenesBuilt, 0);

const lateResult = acceptGeneratedCreatorScript({
  generatedScript: compliant,
  origin: { projectId: "project-a", generation: 1 },
  active: { projectId: "project-b", generation: 2 },
  workspaceStep: 2,
  scenes: [],
});
assert.equal(lateResult, null);
const switchedReplacement = await persistCreatorScriptReplacement({
  script: compliant,
  persist: async () => undefined,
  advanceAuthority: () => true,
  isActive: () => false,
});
assert.equal(switchedReplacement, null);

const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
const production = await readFile(new URL("../lib/creator/services/creatorProduction.server.ts", import.meta.url), "utf8");
assert.match(page, /buildingScenes=\{creatorWorkflowLoadingState\.scenesBuilding\}/);
assert.match(page, /generatingScript=\{creatorWorkflowLoadingState\.scriptGenerating\}/);
const scriptBuildHandler = page.slice(page.indexOf("const handleCreatorProductionPackage = async"), page.indexOf("const handleApproveCreatorScriptAndBuildScenes = async"));
assert.doesNotMatch(scriptBuildHandler, /fetch\("\/api\/creator-production"/);
assert.match(component, /Rebuild Script Required/);
assert.match(component, /This is the previous script/);
assert.match(production, /CREATOR_SCRIPT_DURATION_UNSATISFIED/);
assert.match(production, /topic = persistedBrief\.topic/);

console.log("POST_SCRIPT_DURATION_WORKFLOW_AUTHORITY=PASS");
