import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  acceptGeneratedCreatorScript,
  assembleCreatorScriptScenes,
  approveCreatorScript,
  canBuildScenesFromCreatorScript,
  createCreatorScript,
  createCreatorScriptSceneSegments,
  createCreatorStrategyFingerprint,
  creatorScriptHasGroundingBlocker,
  editCreatorScriptSection,
  getCreatorScriptMetrics,
  getCreatorScriptStatus,
  normalizeCreatorScript,
  regenerateCreatorScriptSection,
  shouldSurfaceCreatorScriptOperationFailure,
} from "../lib/creator/creatorScript.ts";
import { resolvePersistedCreatorScriptAuthority } from "../lib/creator/creatorProductionAuthority.ts";
import { buildCreatorProjectState, readCreatorProjectState } from "../lib/creator/projectState.ts";
import { advanceCreatorProjectOperationOrigin, creatorProjectStateRequestFields, isCreatorProjectOperationActive } from "../lib/creator/projectSaveCoordinator.ts";
import { resolveCreatorStageVisibility } from "../lib/creator/stageNavigation.ts";

const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Explain material claims accurately and preserve uncertainty.",
  readiness: { status: "ready", editorialReadinessScore: 92, reviewReasons: [] },
  claims: [{
    claimId: "claim-1",
    claimType: "FACT",
    text: "The verified claim used by the script.",
    supportingEvidenceIds: ["evidence-1"],
    counterEvidenceIds: [],
    contextualEvidenceIds: [],
  }],
  evidence: [{
    evidenceId: "evidence-1",
    sourceId: "source-1",
    excerpt: "Verified excerpt",
    contextNote: null,
    locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
  }],
  sources: [{
    sourceId: "source-1",
    title: "Primary source",
    url: "https://example.test/source",
    publisher: "Example",
    author: null,
    publishedAt: null,
    directness: "primary",
    reviewStatus: "usable",
  }],
};

const fingerprint = createCreatorStrategyFingerprint({ topic: "Question", direction: "documentary", durationSec: 960 });
assert.equal(fingerprint, createCreatorStrategyFingerprint({ durationSec: 960, direction: "documentary", topic: "Question" }));
assert.notEqual(fingerprint, createCreatorStrategyFingerprint({ topic: "Changed question", direction: "documentary", durationSec: 960 }));

const generatedAt = "2026-09-07T10:00:00.000Z";
const script = createCreatorScript({
  title: "Canonical full script",
  sections: [
    { id: "opening", kind: "opening", text: "A strong opening promise.", claimIds: [], evidenceReviewRequired: false },
    { id: "section-1", kind: "body", heading: "Evidence", text: "The verified claim used by the script.", claimIds: ["claim-1"], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", text: "A concise conclusion that answers the question.", claimIds: [], evidenceReviewRequired: false },
  ],
  targetDurationSec: 960,
  strategyFingerprint: fingerprint,
  grounding: { context },
  generatedAt,
  updatedAt: generatedAt,
});
const existingScenes = Object.freeze([]);
const firstCtaTransition = acceptGeneratedCreatorScript({
  generatedScript: script,
  origin: { projectId: "project-a", generation: 1 },
  active: { projectId: "project-a", generation: 1 },
  workspaceStep: 2,
  scenes: existingScenes,
});
assert.equal(firstCtaTransition?.script.title, script.title);
assert.equal(firstCtaTransition?.workspaceStep, 2);
assert.equal(firstCtaTransition?.scenes, existingScenes);
assert.equal(firstCtaTransition?.scenes.length, 0);
assert.equal(acceptGeneratedCreatorScript({
  generatedScript: script,
  origin: { projectId: "project-a", generation: 1 },
  active: { projectId: "project-b", generation: 2 },
  workspaceStep: 2,
  scenes: existingScenes,
}), null);
assert.equal(script.revision, 1);
assert.equal(getCreatorScriptStatus(script, fingerprint), "draft");
assert.equal(canBuildScenesFromCreatorScript(script, fingerprint), false);
assert.equal(getCreatorScriptStatus(script, "changed"), "stale");
assert.equal(canBuildScenesFromCreatorScript(script, "changed"), false);
assert.ok(getCreatorScriptMetrics(script, "en").wordCount > 0);
assert.equal(getCreatorScriptMetrics(script, "en").targetDurationSec, 960);

const approved = approveCreatorScript(script, fingerprint, "2026-09-07T10:01:00.000Z");
assert.equal(getCreatorScriptStatus(approved, fingerprint), "approved");
assert.equal(canBuildScenesFromCreatorScript(approved, fingerprint), true);
assert.equal(approved.approval?.approvedRevision, approved.revision);
assert.throws(() => approveCreatorScript(script, "changed"), /CREATOR_SCRIPT_STALE/);

const projectWithScript = (value) => ({
  id: "project-a",
  flow_type: "creator_lab",
  exported_movie_result: { creatorProjectState: buildCreatorProjectState({
    brief: { topic: "Question", language: "en", country: "global", ageGroup: "broad_18", contentType: "educational", format: "youtube_video", durationPreset: "custom", durationSec: 960, customDurationSec: 960, qualityMode: "standard", targetPlatforms: ["youtube"] },
    strategy: { mentorResult: {}, selectedDirectionId: "documentary", selectedHook: "direct", script: value },
    production: { package: null, refinedScenes: [], backgroundMusic: null, projectContinuityMode: "independent", sceneContinuityModes: {}, voicePreferences: null },
    createReview: { scenes: [] },
    publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
  }) },
});
const forgedApproval = normalizeCreatorScript({ ...script, approval: { approvedRevision: 1, approvedStrategyFingerprint: fingerprint, approvedAt: generatedAt } });
assert.throws(() => resolvePersistedCreatorScriptAuthority({ persistedProject: projectWithScript(script), submittedScript: forgedApproval, submittedStrategyFingerprint: fingerprint }), /CREATOR_SCRIPT_APPROVAL_REQUIRED/);
const approvedRevision4 = normalizeCreatorScript({ ...approved, revision: 4, approval: { ...approved.approval, approvedRevision: 4 } });
const forgedRevision5 = normalizeCreatorScript({ ...approvedRevision4, revision: 5, approval: { ...approvedRevision4.approval, approvedRevision: 5 } });
assert.throws(() => resolvePersistedCreatorScriptAuthority({ persistedProject: projectWithScript(approvedRevision4), submittedScript: forgedRevision5, submittedStrategyFingerprint: fingerprint }), /CREATOR_SCRIPT_PERSISTED_MISMATCH/);
const changedSubmittedText = normalizeCreatorScript({ ...approved, sections: approved.sections.map((section, index) => index === 0 ? { ...section, text: "Changed submitted text." } : section) });
assert.throws(() => resolvePersistedCreatorScriptAuthority({ persistedProject: projectWithScript(approved), submittedScript: changedSubmittedText, submittedStrategyFingerprint: fingerprint }), /CREATOR_SCRIPT_PERSISTED_MISMATCH/);
assert.throws(() => resolvePersistedCreatorScriptAuthority({ persistedProject: projectWithScript(approved), submittedScript: approved, submittedStrategyFingerprint: "different" }), /CREATOR_SCRIPT_APPROVAL_REQUIRED/);
assert.equal(resolvePersistedCreatorScriptAuthority({ persistedProject: projectWithScript(approved), submittedScript: approved, submittedStrategyFingerprint: fingerprint }).revision, approved.revision);
assert.throws(() => resolvePersistedCreatorScriptAuthority({ persistedProject: null, submittedScript: approved, submittedStrategyFingerprint: fingerprint }), /CREATOR_SCRIPT_PROJECT_NOT_FOUND/);

const editedOpening = editCreatorScriptSection(approved, "opening", "A stronger creator-written opening.", "2026-09-07T10:02:00.000Z");
assert.equal(editedOpening.revision, 2);
assert.equal(editedOpening.approval, null);
assert.equal(editedOpening.sections[1].text, approved.sections[1].text);
assert.equal(creatorScriptHasGroundingBlocker(editedOpening), false);

const editedGrounded = editCreatorScriptSection(approved, "section-1", "A creator changed this factual wording.");
assert.equal(editedGrounded.sections[1].evidenceReviewRequired, true);
assert.equal(creatorScriptHasGroundingBlocker(editedGrounded), true);
assert.throws(() => approveCreatorScript(editedGrounded, fingerprint), /CREATOR_SCRIPT_GROUNDING_BLOCKED/);

const beforeUnchanged = JSON.stringify(approved.sections.filter((section) => section.id !== "section-1"));
const regenerated = regenerateCreatorScriptSection(approved, "section-1", {
  id: "section-1",
  kind: "body",
  heading: "Evidence",
  text: "The verified claim is explained with clearer progression.",
  claimIds: ["claim-1"],
  evidenceReviewRequired: false,
}, "2026-09-07T10:03:00.000Z");
assert.equal(regenerated.revision, approved.revision + 1);
assert.equal(regenerated.approval, null);
assert.equal(JSON.stringify(regenerated.sections.filter((section) => section.id !== "section-1")), beforeUnchanged);
assert.throws(() => regenerateCreatorScriptSection(approved, "section-1", {
  id: "section-1", kind: "body", text: "Unsupported", claimIds: ["invented-claim"], evidenceReviewRequired: false,
}), /CREATOR_SCRIPT_CLAIM_UNKNOWN/);

const tracedScenes = createCreatorScriptSceneSegments(approved, 6);
assert.ok(tracedScenes.length >= approved.sections.length);
assert.ok(tracedScenes.every((scene) => scene.scriptRevision === approved.revision && scene.scriptSectionId && Number.isInteger(scene.scriptSegmentIndex)));
assert.equal(tracedScenes.filter((scene) => scene.scriptSectionId === "section-1").flatMap((scene) => scene.editorialClaimIds).includes("claim-1"), true);

const overflowScript = approveCreatorScript(createCreatorScript({
  ...script,
  sections: [
    script.sections[0],
    { id: "body-a", kind: "body", text: "First body section remains complete.", claimIds: [], evidenceReviewRequired: false },
    { id: "body-b", kind: "body", text: "Second body section remains complete.", claimIds: [], evidenceReviewRequired: false },
    { id: "body-c", kind: "body", text: "Third body section remains complete.", claimIds: [], evidenceReviewRequired: false },
    script.sections[2],
  ],
}), fingerprint);
const overflowSegments = createCreatorScriptSceneSegments(overflowScript, 2);
const overflowScenes = assembleCreatorScriptScenes({
  segments: overflowSegments,
  sceneShells: [{ id: 1 }, { id: 2 }],
  createSceneShell: (index) => ({ id: index + 1 }),
});
const normalizeWords = (value) => value.replace(/\s+/g, " ").trim();
assert.equal(overflowScenes.length, overflowSegments.length);
assert.ok(overflowScenes.length > 2);
assert.equal(normalizeWords(overflowScenes.map((scene) => scene.narration).join(" ")), normalizeWords(overflowScript.sections.map((section) => section.text).join(" ")));
assert.equal(overflowScenes.some((scene) => scene.scriptSectionId === "conclusion"), true);
assert.ok(overflowScenes.every((scene, index) => scene.scriptSegmentIndex === index && scene.scriptRevision === overflowScript.revision));

assert.throws(() => normalizeCreatorScript({ ...script, sections: [{ ...script.sections[0], claimIds: ["unknown"] }, ...script.sections.slice(1)] }), /CREATOR_SCRIPT_CLAIM_UNKNOWN/);
const unresolved = normalizeCreatorScript({
  ...script,
  grounding: {
    context: {
      ...context,
      claims: [{ ...context.claims[0], supportingEvidenceIds: [] }],
    },
  },
});
assert.equal(unresolved.sections[1].evidenceReviewRequired, true);
assert.equal(canBuildScenesFromCreatorScript(unresolved, fingerprint), false);
const sanitized = normalizeCreatorScript({
  ...script,
  grounding: { context: { ...context, providerSecret: "drop-me", sources: context.sources.map((source) => ({ ...source, rawProviderPayload: "drop-me" })) } },
});
assert.equal("providerSecret" in sanitized.grounding.context, false);
assert.equal("rawProviderPayload" in sanitized.grounding.context.sources[0], false);
assert.throws(() => normalizeCreatorScript({ ...script, grounding: { context: { ...context, claims: [{ ...context.claims[0], claimType: "UNKNOWN" }] } } }), /CREATOR_SCRIPT_INVALID/);

const snapshot = buildCreatorProjectState({
  brief: { topic: "Question", language: "en", country: "global", ageGroup: "broad_18", contentType: "educational", format: "youtube_video", durationPreset: "custom", durationSec: 960, customDurationSec: 960, qualityMode: "standard", targetPlatforms: ["youtube"] },
  strategy: { mentorResult: {}, selectedDirectionId: "documentary", selectedHook: "direct", script: approved },
  production: { package: null, refinedScenes: [], backgroundMusic: null, projectContinuityMode: "independent", sceneContinuityModes: {}, voicePreferences: null },
  createReview: { scenes: [] },
  publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
});
const reopened = readCreatorProjectState({ exported_movie_result: { creatorProjectState: snapshot } });
assert.deepEqual(reopened.strategy.script, approved);
const legacy = readCreatorProjectState({ scenes: [{ id: 1, narration: "Legacy scene" }], creator_production_package: { scenes: [{ id: 1 }] } });
assert.equal(legacy.strategy.script, null);
assert.equal(legacy.createReview.scenes.length, 1);
assert.deepEqual(creatorProjectStateRequestFields("storyverse", snapshot), {});

const operationA = { projectId: "project-a", generation: 4 };
assert.equal(isCreatorProjectOperationActive(operationA, { projectId: "project-b", generation: 5 }), false);
assert.equal(isCreatorProjectOperationActive(operationA, operationA), true);
assert.deepEqual(advanceCreatorProjectOperationOrigin({ projectId: "", generation: 4 }, operationA), operationA);
assert.equal(advanceCreatorProjectOperationOrigin({ projectId: "", generation: 3 }, operationA), null);
for (const workflow of ["full-script", "regeneration", "scene-build"]) {
  assert.equal(isCreatorProjectOperationActive(operationA, { projectId: `project-b-${workflow}`, generation: 5 }), false);
}
assert.equal(shouldSurfaceCreatorScriptOperationFailure({ origin: operationA, active: operationA, sourceRevision: 1, installedRevision: 2, currentRevision: 2 }), true);
assert.equal(shouldSurfaceCreatorScriptOperationFailure({ origin: operationA, active: { projectId: "project-b", generation: 5 }, sourceRevision: 1, installedRevision: 2, currentRevision: 2 }), false);

assert.deepEqual(Object.keys(resolveCreatorStageVisibility({ workspaceStep: 2, productionSubstep: "setup" })), ["brief", "strategy", "production_setup", "create_review", "publish"]);
assert.equal(resolveCreatorStageVisibility({ workspaceStep: 2, productionSubstep: "setup" }).strategy, true);

const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/creator-script-plan/route.ts", import.meta.url), "utf8");
const production = await readFile(new URL("../lib/creator/services/creatorProduction.server.ts", import.meta.url), "utf8");
const component = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
const firstHandler = page.slice(page.indexOf("const handleCreatorProductionPackage = async"), page.indexOf("const handleApproveCreatorScriptAndBuildScenes = async"));
assert.match(firstHandler, /operation: "generate_full_script"/);
assert.doesNotMatch(firstHandler, /fetch\("\/api\/creator-production"/);
assert.doesNotMatch(firstHandler, /creatorStageAfterSuccess/);
assert.match(page, /Approve Strategy & Build Script/);
assert.match(component, /Approve Script & Build Scenes/);
assert.match(component, /Strengthen Opening/);
assert.match(route, /generate_full_script/);
assert.match(route, /regenerate_section/);
assert.match(production, /approvedScript/);
assert.match(production, /createCreatorScriptSceneSegments/);
assert.match(production, /projectRepository\.getForOwner\(projectId, user\.id\)/);
assert.match(production, /resolvePersistedCreatorScriptAuthority/);
assert.ok(production.indexOf("approvedScript = resolvePersistedCreatorScriptAuthority") < production.indexOf("const client = getOpenAIClient()"));
assert.match(production, /const sceneCount = approvedSceneSegments\.length/);
assert.match(production, /assembleCreatorScriptScenes/);
assert.match(page, /persistProject\(false, \{ creatorScript: approvedScript \}\)/);
assert.match(page, /projectId: operationOrigin\.projectId/);
assert.equal((page.match(/fetch\("\/api\/save-project"/g) || []).length, 1);

console.log("Stage 0.13B Full Script Review behavioral tests passed.");
