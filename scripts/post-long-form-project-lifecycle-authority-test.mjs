import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assessCreatorScriptGenerationAuthority,
  classifyCreatorProjectSaveError,
  getCreatorTopicAuthorityIdentity,
  normalizeCreatorTopicAuthority,
  shouldRestoreCreatorBriefDraft,
  startCreatorNewProjectLifecycle,
} from "../lib/creator/creatorWorkflowAuthority.ts";
import {
  createCreatorProjectSaveBinding,
  isCreatorProjectSaveBindingActive,
} from "../lib/creator/projectSaveCoordinator.ts";
import { getCreatorScriptDurationContract } from "../lib/creator/creatorScript.ts";
import {
  attachCreatorProjectState,
  buildCreatorProjectState,
  isValidCreatorProjectState,
  readCreatorProjectState,
} from "../lib/creator/projectState.ts";

const lifecycleEvents = [];
startCreatorNewProjectLifecycle({
  clearBriefDraft: () => lifecycleEvents.push("draft-cleared"),
  clearProjectUrl: () => lifecycleEvents.push("project-url-cleared"),
  remountWorkspace: () => lifecycleEvents.push("workspace-remounted"),
});
assert.deepEqual(lifecycleEvents, ["draft-cleared", "project-url-cleared", "workspace-remounted"]);
assert.equal(shouldRestoreCreatorBriefDraft({ isCreatorLabFlow: true, currentProjectId: "project-a", requestedProjectId: "" }), false);
assert.equal(shouldRestoreCreatorBriefDraft({ isCreatorLabFlow: true, currentProjectId: "", requestedProjectId: "project-b" }), false);

const pendingA = createCreatorProjectSaveBinding({
  originProjectId: "project-a",
  projectId: "project-a",
  expectedUpdatedAt: "2026-09-09T00:00:00.000Z",
  generation: 4,
  creatorProjectState: null,
});
assert.equal(isCreatorProjectSaveBindingActive(pendingA, { projectId: "project-a", generation: 4 }), true);
assert.equal(isCreatorProjectSaveBindingActive(pendingA, { projectId: "", generation: 5 }), false);
assert.equal(isCreatorProjectSaveBindingActive(pendingA, { projectId: "project-b", generation: 5 }), false);
assert.equal(classifyCreatorProjectSaveError(new Error("PROJECT_SAVE_CONFLICT")), "cas_conflict");
assert.equal(classifyCreatorProjectSaveError(new Error("Project was not found or is not owned")), "project_identity");

const fiveMinutes = getCreatorScriptDurationContract({ targetDurationSec: 300, language: "en", actualWordCount: 0 });
assert.deepEqual([
  fiveMinutes.targetDurationSec,
  fiveMinutes.targetWordCount,
  fiveMinutes.minimumAcceptableWordCount,
  fiveMinutes.maximumAcceptableWordCount,
], [300, 705, 635, 775]);
const sixteenMinutes = getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 0 });
assert.deepEqual([
  sixteenMinutes.targetDurationSec,
  sixteenMinutes.targetWordCount,
  sixteenMinutes.minimumAcceptableWordCount,
  sixteenMinutes.maximumAcceptableWordCount,
], [960, 2256, 2031, 2481]);

const authority = (projectId, durationSec) => ({
  projectId,
  expectedUpdatedAt: `${projectId}-revision`,
  topic: `${projectId}-topic`,
  language: "en",
  durationSec,
  strategyFingerprint: `${projectId}-fingerprint`,
  selectedDirectionId: `${projectId}-direction`,
  selectedHook: `${projectId}-hook`,
});
const projectA = authority("project-a", 960);
const projectB = authority("project-b", 300);
assert.equal(assessCreatorScriptGenerationAuthority({ submitted: projectB, persisted: { ...projectB, updatedAt: projectB.expectedUpdatedAt } }).current, true);
const staleBWithADuration = assessCreatorScriptGenerationAuthority({
  submitted: { ...projectB, durationSec: 960 },
  persisted: { ...projectB, updatedAt: projectB.expectedUpdatedAt },
});
assert.equal(staleBWithADuration.current, false);
assert.equal(staleBWithADuration.matches.duration, false);
assert.equal(assessCreatorScriptGenerationAuthority({ submitted: projectA, persisted: { ...projectA, updatedAt: projectA.expectedUpdatedAt } }).current, true);
const canonicalTopic = "If Work Becomes Optional, Will Freedom Follow?";
const representedTopic = "  If Work Becomes\r\n Optional,   Will Freedom Follow?  ";
assert.equal(normalizeCreatorTopicAuthority(representedTopic), canonicalTopic);
assert.deepEqual(
  getCreatorTopicAuthorityIdentity(representedTopic),
  getCreatorTopicAuthorityIdentity(canonicalTopic),
);
assert.equal(assessCreatorScriptGenerationAuthority({
  submitted: { ...projectA, topic: canonicalTopic },
  persisted: { ...projectA, topic: representedTopic, updatedAt: projectA.expectedUpdatedAt },
}).matches.topic, true);
assert.equal(assessCreatorScriptGenerationAuthority({
  submitted: { ...projectA, topic: canonicalTopic },
  persisted: {
    ...projectA,
    topic: `${canonicalTopic} This is an older full master brief.`,
    updatedAt: projectA.expectedUpdatedAt,
  },
}).matches.topic, false);
const sharedPrefix = "P".repeat(600);
assert.equal(assessCreatorScriptGenerationAuthority({
  submitted: { ...projectA, topic: `${sharedPrefix}-tail-a` },
  persisted: {
    ...projectA,
    topic: `${sharedPrefix}-tail-b`,
    updatedAt: projectA.expectedUpdatedAt,
  },
}).matches.topic, false);

const legacyMentorResult = {
  recommendedIdea: { title: "Legacy direction" },
  marketEvidence: {
    videos: { legacyVideoMap: true },
    patternSummary: "legacy summary",
  },
};
const legacyProject = {
  id: "project-a",
  flow_type: "creator_lab",
  input_prompt: `${projectA.topic} This is the old full master brief authority T1.`,
  language: "en",
  creator_mentor_result: legacyMentorResult,
  exported_movie_result: null,
};
const legacyHydration = readCreatorProjectState(legacyProject);
assert.equal(legacyHydration.strategy.strategyFingerprint, undefined);
assert.notEqual(legacyHydration.brief.durationSec, 960);
assert.notEqual(legacyHydration.brief.topic, projectA.topic);

const upgradedSnapshot = buildCreatorProjectState({
  brief: {
    topic: projectA.topic,
    language: "en",
    country: "global",
    ageGroup: "professional_18",
    contentType: "educational_explainer",
    format: "youtube_video",
    durationPreset: "custom",
    durationSec: 960,
    customDurationSec: 960,
    qualityMode: "standard",
    targetPlatforms: ["youtube"],
  },
  strategy: {
    mentorResult: legacyMentorResult,
    selectedDirectionId: projectA.selectedDirectionId,
    selectedHook: projectA.selectedHook,
    strategyFingerprint: projectA.strategyFingerprint,
    script: null,
  },
  production: {
    package: null,
    refinedScenes: [],
    backgroundMusic: null,
    projectContinuityMode: "independent",
    sceneContinuityModes: {},
    voicePreferences: null,
  },
  createReview: { scenes: [] },
  publish: {
    metadata: null,
    thumbnail: null,
    thumbnailDesign: null,
    confirmations: {},
    packageDownloaded: false,
    packageSignature: "",
    finalVideoUrl: "",
    finalVideoSignature: "",
  },
});
assert.equal(isValidCreatorProjectState(upgradedSnapshot), true);
assert.equal(upgradedSnapshot.brief.topic, projectA.topic);
const upgradedProject = {
  ...legacyProject,
  updated_at: projectA.expectedUpdatedAt,
  exported_movie_result: attachCreatorProjectState({}, upgradedSnapshot),
};
const reloadedUpgrade = readCreatorProjectState(upgradedProject);
assert.equal(reloadedUpgrade.brief.durationSec, 960);
assert.equal(reloadedUpgrade.brief.topic, projectA.topic);
assert.equal(reloadedUpgrade.strategy.strategyFingerprint, projectA.strategyFingerprint);
assert.equal(reloadedUpgrade.strategy.script, null);
assert.equal(assessCreatorScriptGenerationAuthority({
  submitted: projectA,
  persisted: {
    projectId: upgradedProject.id,
    updatedAt: upgradedProject.updated_at,
    topic: reloadedUpgrade.brief.topic,
    language: reloadedUpgrade.brief.language,
    durationSec: reloadedUpgrade.brief.durationSec,
    strategyFingerprint: reloadedUpgrade.strategy.strategyFingerprint || "",
    selectedDirectionId: reloadedUpgrade.strategy.selectedDirectionId,
    selectedHook: reloadedUpgrade.strategy.selectedHook,
  },
}).current, true);

const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(page, /startCreatorNewProjectLifecycle\(\{/);
assert.match(page, /clearBriefDraft: \(\) => window\.localStorage\.removeItem\(CREATOR_BRIEF_DRAFT_STORAGE_KEY\)/);
assert.match(page, /persist: \(\) => persistProject\(false, \{ creatorMentorResult: persistedStrategyResult \}\)/);
assert.match(page, /CREATOR_SCRIPT_REQUEST_AUTHORITY/);
assert.match(page, /expectedProjectUpdatedAt: projectUpdatedAtRef\.current/);
assert.match(page, /topic: normalizeCreatorTopicAuthority\(input\)/);
assert.match(page, /inputPrompt: isCreatorLabFlow\s*\? normalizeCreatorTopicAuthority/);
assert.match(page, /CREATOR_PROJECT_AUTOSAVE_FAILED/);
assert.match(page, /setCreatorScriptGenerationLoading\(true\);\s*suspendAutosaveRef\.current = true;/);

const pipeline = await readFile(new URL("../lib/research/creatorEditorialPipeline.client.ts", import.meta.url), "utf8");
const authorityIndex = pipeline.indexOf('operation: "validate_generation_authority"');
const researchIndex = pipeline.indexOf('url: "/api/creator-research"', authorityIndex);
assert.ok(authorityIndex >= 0 && researchIndex > authorityIndex);

const route = await readFile(new URL("../app/api/creator-script-plan/route.ts", import.meta.url), "utf8");
assert.match(route, /CREATOR_SCRIPT_AUTHORITY_STALE/);
assert.match(route, /CREATOR_SCRIPT_AUTHORITY_CHECK/);
assert.match(route, /assessCreatorScriptGenerationAuthority/);
assert.match(route, /persistedDurationSec: persistedAuthority\?\.brief\.durationSec \?\? null/);
assert.match(route, /submittedTopicSource: "request\.topicAuthority"/);

const saveRoute = await readFile(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
assert.match(saveRoute, /!isValidCreatorProjectState\(body\.creatorProjectState\)/);
assert.match(saveRoute, /CREATOR_PROJECT_STATE_INVALID/);

console.log("PROJECT_LIFECYCLE_AUTHORITY=PASS");
