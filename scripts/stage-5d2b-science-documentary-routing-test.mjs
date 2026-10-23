import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  createCreatorScriptSectionBudgetPlan,
} from "../lib/creator/creatorScript.ts";
import {
  createCreatorScriptBuildIdempotencyKey,
  createCreatorScriptBuildSnapshot,
} from "../lib/creator/creatorScriptBuild.ts";
import {
  buildCreatorProjectState,
  isValidCreatorProjectState,
  readCreatorProjectState,
} from "../lib/creator/projectState.ts";
import {
  createCreatorLongFormEvidenceReadiness,
  createCreatorScriptSectionClaimRouting,
} from "../lib/research/creatorLongFormEvidenceReadiness.ts";

const locator = { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null };
const evidence = (evidenceId, sourceId, excerpt) => ({ evidenceId, sourceId, excerpt, contextNote: null, locator });
const claim = (claimId, claimType, supportingEvidenceIds, options = {}) => ({
  claimId,
  claimType,
  text: `Synthetic ${claimId}`,
  supportingEvidenceIds,
  contextualEvidenceIds: options.contextualEvidenceIds || [],
  counterEvidenceIds: options.counterEvidenceIds || [],
});
const source = (sourceId) => ({
  sourceId,
  title: `Synthetic ${sourceId}`,
  url: `https://example.test/${sourceId}`,
  publisher: "Synthetic",
  author: null,
  publishedAt: null,
  directness: "primary",
  reviewStatus: "usable",
  searchLane: "academic",
  sourceKind: "paper",
});
const concreteA = "Researchers measured 120 workers in one documented workplace and observed a 14 percent difference after six weeks.";
const concreteB = "A second study followed 240 workers in another workplace and recorded a 9 percent change across three months.";
const mechanism = "The bounded model proposes a causal mechanism linking the measured intervention to the observed outcome.";
const limitation = "The estimate was limited to one sampling frame and cannot establish the same effect in every population.";
const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Synthetic evidence remains source-bound.",
  readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] },
  claims: [
    claim("claim-opening", "FACT", ["e-opening"]),
    claim("claim-workplace-a", "RESEARCH_FINDING", ["e-workplace-a"]),
    claim("claim-workplace-b", "RESEARCH_FINDING", ["e-workplace-b"]),
    claim("claim-model-a", "THEORY", ["e-model-a"]),
    claim("claim-model-b", "THEORY", ["e-model-a"]),
    claim("claim-model-independent", "THEORY", ["e-model-independent"]),
    claim("claim-limitation", "HYPOTHESIS", ["e-limitation"], { contextualEvidenceIds: ["e-limitation-context"] }),
    claim("claim-implication", "EDITORIAL_INFERENCE", ["e-implication"]),
  ],
  evidence: [
    evidence("e-opening", "source-observation", concreteA),
    evidence("e-workplace-a", "source-a", concreteA),
    evidence("e-workplace-b", "source-b", concreteB),
    evidence("e-model-a", "source-model", mechanism),
    evidence("e-model-independent", "source-model", "The publication separately reports a second experiment with a different measured outcome."),
    evidence("e-limitation", "source-limit", mechanism),
    evidence("e-limitation-context", "source-limit", limitation),
    evidence("e-implication", "source-implication", mechanism),
  ],
  sources: ["source-observation", "source-a", "source-b", "source-model", "source-limit", "source-implication"].map(source),
};

const standardPlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 480, language: "en" });
const documentaryPlan = createCreatorScriptSectionBudgetPlan({
  targetDurationSec: 480,
  language: "en",
  narrativePolicy: "science_documentary_v1",
});
assert.equal(documentaryPlan.length, 5);
assert.deepEqual(documentaryPlan.map((item) => item.kind), ["opening", "body", "body", "body", "conclusion"]);
assert.deepEqual(
  documentaryPlan.map(({ id, kind, minimumWords, targetWords, maximumWords }) => ({ id, kind, minimumWords, targetWords, maximumWords })),
  standardPlan.map(({ id, kind, minimumWords, targetWords, maximumWords }) => ({ id, kind, minimumWords, targetWords, maximumWords })),
  "The opt-in changes narrative responsibilities, not section identity or duration envelopes",
);
assert.deepEqual(documentaryPlan.map((item) => item.ownershipBoundary.owns[1]), [
  "science_opening", "science_explanation", "science_empirical_evidence", "science_tension", "science_conclusion",
]);
assert.throws(
  () => createCreatorScriptSectionBudgetPlan({ targetDurationSec: 600, language: "en", narrativePolicy: "science_documentary_v1" }),
  /CREATOR_NARRATIVE_POLICY_CONFIGURATION_UNSUPPORTED/,
);

const routing = createCreatorScriptSectionClaimRouting({ context, plan: documentaryPlan });
const reorderedRouting = createCreatorScriptSectionClaimRouting({
  context: { ...context, claims: [...context.claims].reverse() },
  plan: documentaryPlan,
});
assert.deepEqual(reorderedRouting, routing, "Semantic routing must be invariant to canonical claim array order");
assert.deepEqual(routing.map((item) => item.semanticRole), [
  "opening", "explanation", "empirical_evidence", "scientific_tension", "conclusion",
]);
const empiricalRoute = routing.find((item) => item.semanticRole === "empirical_evidence");
assert.deepEqual(empiricalRoute.claimIds, ["claim-workplace-a", "claim-workplace-b"]);
const tensionRoute = routing.find((item) => item.semanticRole === "scientific_tension");
assert.ok(tensionRoute.claimIds.includes("claim-model-b"), "An evidence-linked alternative model of the same dataset belongs in tension");
assert.equal(tensionRoute.claimIds.includes("claim-model-independent"), false, "A separate finding in the same publication is not inferred to be an alternative interpretation");
assert.ok(tensionRoute.claimIds.includes("claim-limitation"), "A supported methodological limitation belongs in tension");
assert.equal(tensionRoute.claimIds.includes("claim-workplace-a"), false);
assert.equal(tensionRoute.claimIds.includes("claim-workplace-b"), false, "Different findings are not invented contradictions");
assert.deepEqual(
  [...new Set(routing.flatMap((item) => item.claimIds))],
  routing.flatMap((item) => item.claimIds),
  "Primary claim authority is not repeated across documentary sections",
);
for (const route of routing) {
  const linked = route.claimIds.flatMap((claimId) => {
    const item = context.claims.find((candidate) => candidate.claimId === claimId);
    return [...item.supportingEvidenceIds, ...item.contextualEvidenceIds, ...item.counterEvidenceIds];
  });
  assert.ok(route.evidenceIds.every((evidenceId) => linked.includes(evidenceId)));
}
assert.equal(createCreatorLongFormEvidenceReadiness({ context, plan: documentaryPlan, sectionNative: true }).eligible, true);
const missingTensionContext = {
  ...context,
  claims: context.claims.filter((item) => !["claim-model-b", "claim-limitation"].includes(item.claimId)),
};
assert.ok(
  createCreatorLongFormEvidenceReadiness({ context: missingTensionContext, plan: documentaryPlan, sectionNative: true })
    .reasonCodes.includes("missing_scientific_tension_capability"),
  "Missing tension evidence fails closed instead of inventing a counterargument",
);

const projectState = buildCreatorProjectState({
  brief: { topic: "Synthetic science", language: "en", country: "global", ageGroup: "professional_18", contentType: "documentary", narrativePolicy: "science_documentary_v1", format: "youtube_video", durationPreset: "video_480", durationSec: 480, customDurationSec: 480, qualityMode: "standard", targetPlatforms: ["youtube"] },
  strategy: { mentorResult: null, selectedDirectionId: "direction", selectedHook: "hook", strategyFingerprint: "strategy", script: null },
  production: { package: null, refinedScenes: [], backgroundMusic: null, projectContinuityMode: "independent", sceneContinuityModes: {}, voicePreferences: null },
  createReview: { scenes: [] },
  publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
});
assert.equal(isValidCreatorProjectState(projectState), true);
assert.throws(() => buildCreatorProjectState({
  ...projectState,
  brief: { ...projectState.brief, durationSec: 600, customDurationSec: 600 },
}), /CREATOR_NARRATIVE_POLICY_CONFIGURATION_UNSUPPORTED/);
const hydrated = readCreatorProjectState({
  id: "project-stage-5d2b",
  flow_type: "creator_lab",
  input_prompt: "Synthetic science",
  language: "en",
  exported_movie_result: { creatorProjectState: JSON.parse(JSON.stringify(projectState)) },
});
assert.equal(hydrated.brief.narrativePolicy, "science_documentary_v1");
const invalidProjectState = JSON.parse(JSON.stringify(projectState));
invalidProjectState.brief.narrativePolicy = "inferred_science";
assert.equal(isValidCreatorProjectState(invalidProjectState), false);
assert.throws(() => readCreatorProjectState({
  id: "project-invalid-policy",
  flow_type: "creator_lab",
  exported_movie_result: { creatorProjectState: invalidProjectState },
}), /CREATOR_NARRATIVE_POLICY_INVALID/);

const snapshotInput = {
  projectId: "project-stage-5d2b",
  expectedProjectRevision: "2026-10-23T00:00:00.000Z",
  strategyFingerprint: "strategy-stage-5d2b",
  language: "en",
  requestedDurationSeconds: 480,
  strategy: { topic: "Synthetic science", researchSubject: "Synthetic science", title: "Synthetic documentary", contentType: "documentary", format: "youtube_video", selectedDirectionId: "direction", selectedHook: "hook", approvedStrategy: { version: "synthetic" } },
  creatorProfile: { version: "synthetic" },
  contractVersions: { creatorScriptBuild: "0.19E1" },
};
const legacySnapshot = createCreatorScriptBuildSnapshot(snapshotInput);
const policySnapshot = createCreatorScriptBuildSnapshot({ ...snapshotInput, strategy: { ...snapshotInput.strategy, narrativePolicy: "science_documentary_v1" } });
const repeatedPolicySnapshot = createCreatorScriptBuildSnapshot({ ...snapshotInput, strategy: { ...snapshotInput.strategy, narrativePolicy: "science_documentary_v1" } });
assert.equal(Object.hasOwn(legacySnapshot.strategy, "narrativePolicy"), false);
assert.deepEqual(repeatedPolicySnapshot, policySnapshot);
assert.notEqual(
  createCreatorScriptBuildIdempotencyKey({ ownerId: "owner", snapshot: legacySnapshot }),
  createCreatorScriptBuildIdempotencyKey({ ownerId: "owner", snapshot: policySnapshot }),
  "Narrative policy participates in immutable snapshot identity",
);
assert.throws(() => createCreatorScriptBuildSnapshot({
  ...snapshotInput,
  strategy: { ...snapshotInput.strategy, format: "short_form", narrativePolicy: "science_documentary_v1" },
}), /CREATOR_NARRATIVE_POLICY_CONFIGURATION_UNSUPPORTED/);

const pageSource = readFileSync("app/create/page.tsx", "utf8");
assert.match(pageSource, /Evidence-driven Science Documentary/);
assert.match(pageSource, /disabled=\{Boolean\(creatorScript\)\}/, "An accepted script prevents silent policy replacement");
assert.match(pageSource, /expectedUpdatedAt: projectUpdatedAtRef\.current/, "Existing stale-project CAS authority remains wired");
const coordinatorSource = readFileSync("lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts", "utf8");
assert.match(coordinatorSource, /CREATOR_SCRIPT_BUILD_GENERATED_CLAIM_NOT_ROUTED/);
assert.match(coordinatorSource, /CREATOR_SCRIPT_BUILD_LONG_FORM_EVIDENCE_NOT_READY/);

console.log(JSON.stringify({
  documentaryRoles: routing.map((item) => item.semanticRole),
  routedClaims: routing.reduce((count, item) => count + item.claimIds.length, 0),
  empiricalFindingCount: empiricalRoute.claimIds.length,
  tensionClaimCount: tensionRoute.claimIds.length,
  claimOrderInvariant: true,
  projectReloadPolicy: hydrated.brief.narrativePolicy,
  legacyBehaviorOptOut: !Object.hasOwn(legacySnapshot.strategy, "narrativePolicy"),
}, null, 2));
