import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

import * as creatorScript from "../lib/creator/creatorScript.ts";
import { createCreatorScriptSectionBudgetPlan } from "../lib/creator/creatorScript.ts";
import {
  createCreatorScriptBuildSectionEvidenceAuthorities,
  creatorScriptBuildSectionClaimsFitEvidenceAuthority,
} from "../lib/creator/creatorScriptBuildSectionEvidence.ts";
import {
  CREATOR_EVIDENCE_PROMPT_PACK_MAX_CHARACTERS,
  buildCreatorSectionEvidencePromptPack,
} from "../lib/research/creatorEvidencePack.ts";
import { CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION } from "../lib/creator/creatorScriptBuildRepairProviderPolicy.ts";

const require = createRequire(import.meta.url);
const providerExports = {};
const providerCode = ts.transpileModule(
  readFileSync("lib/creator/creatorScriptBuildProviders.server.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
vm.runInNewContext(providerCode, {
  exports: providerExports,
  process: { env: {} },
  require: (name) => {
    if (name === "node:crypto") return require(name);
    if (name === "./creatorScript.ts") return creatorScript;
    if (name === "./creatorScriptBuildRepairProviderPolicy.ts") {
      return { CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION };
    }
    return {};
  },
});
const {
  executeCreatorScriptBuildScriptGenerationProvider,
  executeCreatorScriptBuildScriptRepairProvider,
} = providerExports;

const locator = { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null };
const source = (sourceId, suffix = "") => ({
  sourceId,
  title: `Synthetic source ${sourceId}${suffix}`,
  url: `https://example.test/${sourceId}`,
  publisher: `Synthetic publisher ${suffix}`,
  author: suffix || null,
  publishedAt: "2026-01-01",
  directness: "primary",
  reviewStatus: "usable",
  searchLane: "academic",
  sourceKind: "paper",
});
const evidence = (evidenceId, sourceId, excerpt, contextNote = null) => ({
  evidenceId, sourceId, excerpt, contextNote, locator,
});
const claim = (claimId, claimType, supportingEvidenceIds, options = {}) => ({
  claimId,
  claimType,
  text: options.text || `Synthetic finding ${claimId}`,
  supportingEvidenceIds,
  counterEvidenceIds: options.counterEvidenceIds || [],
  contextualEvidenceIds: options.contextualEvidenceIds || [],
});
const concrete = (ordinal) => `Researchers measured ${100 + ordinal} participants in documented condition ${ordinal}, recorded the outcome for six weeks, and reported a bounded ${ordinal} percent difference.`;
const claims = [
  claim("claim-opening", "FACT", ["e-opening"]),
  claim("claim-explanation", "THEORY", ["e-explanation"]),
  ...Array.from({ length: 7 }, (_, index) => claim(`claim-empirical-${index + 1}`, "RESEARCH_FINDING", [`e-empirical-${index + 1}`])),
  claim("claim-tension", "HYPOTHESIS", ["e-tension"], { contextualEvidenceIds: ["e-tension-context"] }),
  claim("claim-conclusion", "EDITORIAL_INFERENCE", ["e-conclusion"]),
  claim("claim-missing", "FACT", ["e-missing"]),
];
const evidenceItems = [
  evidence("e-opening", "source-opening", concrete(1)),
  evidence("e-explanation", "source-explanation", "A bounded causal model explains the documented mechanism without extending beyond the observation."),
  ...Array.from({ length: 7 }, (_, index) => evidence(`e-empirical-${index + 1}`, `source-empirical-${index + 1}`, concrete(index + 2))),
  evidence("e-tension", "source-tension", "A competing bounded model interprets the same documented measurement differently."),
  evidence("e-tension-context", "source-tension", "The sampling method limits generalization beyond the documented population."),
  evidence("e-conclusion", "source-conclusion", "The supported findings leave one unresolved question within the stated boundary."),
  evidence("e-missing", "source-not-canonical", "This evidence has no canonical source record and must not enter a prompt."),
];
const sourceIds = evidenceItems
  .map((item) => item.sourceId)
  .filter((sourceId) => sourceId !== "source-not-canonical");
const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Synthetic evidence remains canonical and section-bound.",
  readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] },
  claims,
  evidence: evidenceItems,
  sources: [...new Set(sourceIds)].map((sourceId) => source(sourceId)),
};
const originalContextJson = JSON.stringify(context);
const sectionPlan = createCreatorScriptSectionBudgetPlan({
  targetDurationSec: 480,
  language: "en",
  narrativePolicy: "science_documentary_v1",
});
const empiricalClaimIds = Array.from({ length: 7 }, (_, index) => `claim-empirical-${index + 1}`);
const routing = [
  { sectionId: "opening", sectionKind: "opening", semanticRole: "opening", claimIds: ["claim-opening"], evidenceIds: ["e-opening"], usedFallback: false },
  { sectionId: "section-1", sectionKind: "body", semanticRole: "explanation", claimIds: ["claim-explanation"], evidenceIds: ["e-explanation"], usedFallback: false },
  { sectionId: "section-2", sectionKind: "body", semanticRole: "empirical_evidence", claimIds: empiricalClaimIds, evidenceIds: empiricalClaimIds.map((_, index) => `e-empirical-${index + 1}`), usedFallback: false },
  { sectionId: "section-3", sectionKind: "body", semanticRole: "scientific_tension", claimIds: ["claim-tension", "claim-missing"], evidenceIds: ["e-tension", "e-tension-context", "e-missing"], usedFallback: false },
  { sectionId: "conclusion", sectionKind: "conclusion", semanticRole: "conclusion", claimIds: ["claim-conclusion"], evidenceIds: ["e-conclusion"], usedFallback: false },
];
const authorities = createCreatorScriptBuildSectionEvidenceAuthorities({
  context,
  sectionPlan,
  sectionClaimRouting: routing,
});
assert.equal(authorities.length, 5);
assert.deepEqual(
  createCreatorScriptBuildSectionEvidenceAuthorities({ context, sectionPlan, sectionClaimRouting: routing }),
  authorities,
  "Section evidence selection must be deterministic",
);
assert.deepEqual(
  createCreatorScriptBuildSectionEvidenceAuthorities({
    context: {
      ...context,
      claims: [...context.claims].reverse(),
      evidence: [...context.evidence].reverse(),
      sources: [...context.sources].reverse(),
    },
    sectionPlan,
    sectionClaimRouting: routing,
  }),
  authorities,
  "Canonical graph array order must not change the route-ordered section packs",
);
for (const authority of authorities) {
  assert.ok(authority.selection.units.length <= 5);
  assert.ok(JSON.stringify(authority.selection.units).length <= CREATOR_EVIDENCE_PROMPT_PACK_MAX_CHARACTERS);
  assert.ok(authority.selection.units.every((unit) => authority.claimIds.includes(unit.claimId)));
}
const empiricalAuthority = authorities.find((item) => item.sectionId === "section-2");
assert.equal(empiricalAuthority.selection.units.length, 5);
assert.equal(empiricalAuthority.selection.metrics.omissionReasonCounts.unit_budget, 2);
assert.equal(empiricalAuthority.selection.metrics.omittedUnitCount, 2);
const tensionAuthority = authorities.find((item) => item.sectionId === "section-3");
assert.deepEqual(tensionAuthority.claimIds, ["claim-tension"]);
assert.equal(tensionAuthority.selection.metrics.omissionReasonCounts.no_source_bound_evidence, 1);
assert.equal(tensionAuthority.evidenceIds.includes("e-missing"), false);
const tensionUnit = tensionAuthority.selection.units[0];
assert.deepEqual(tensionUnit.supportingEvidence.map((item) => item.evidenceId), ["e-tension"]);
assert.deepEqual(tensionUnit.contextualEvidence.map((item) => item.evidenceId), ["e-tension-context"]);
const restrictedTensionAuthority = createCreatorScriptBuildSectionEvidenceAuthorities({
  context,
  sectionPlan: [sectionPlan[3]],
  sectionClaimRouting: [{
    ...routing[3],
    claimIds: ["claim-tension"],
    evidenceIds: ["e-tension"],
  }],
})[0];
assert.deepEqual(restrictedTensionAuthority.evidenceIds, ["e-tension"]);
assert.deepEqual(restrictedTensionAuthority.selection.units[0].contextualEvidence, []);
assert.equal(creatorScriptBuildSectionClaimsFitEvidenceAuthority({ authorities, sectionId: "section-2", claimIds: ["claim-empirical-1"] }), true);
assert.equal(creatorScriptBuildSectionClaimsFitEvidenceAuthority({ authorities, sectionId: "section-2", claimIds: ["claim-opening"] }), false);
assert.equal(creatorScriptBuildSectionClaimsFitEvidenceAuthority({ authorities, sectionId: "section-2", claimIds: ["claim-empirical-7"] }), false, "A unit omitted by budget is not silently permitted");
assert.equal(creatorScriptBuildSectionClaimsFitEvidenceAuthority({ authorities: undefined, sectionId: "section-2", claimIds: ["legacy-claim"] }), true, "Standard projects preserve legacy validation");

const longText = "x".repeat(2_000);
const characterContext = {
  ...context,
  claims: Array.from({ length: 5 }, (_, index) => claim(`claim-large-${index}`, "RESEARCH_FINDING", [`e-large-support-${index}`], {
    counterEvidenceIds: [`e-large-counter-${index}`],
    contextualEvidenceIds: [`e-large-context-${index}`],
    text: longText,
  })),
  evidence: Array.from({ length: 5 }, (_, index) => [
    evidence(`e-large-support-${index}`, `source-large-support-${index}`, longText, longText),
    evidence(`e-large-counter-${index}`, `source-large-counter-${index}`, longText, longText),
    evidence(`e-large-context-${index}`, `source-large-context-${index}`, longText, longText),
  ]).flat(),
  sources: Array.from({ length: 5 }, (_, index) => [
    source(`source-large-support-${index}`, longText),
    source(`source-large-counter-${index}`, longText),
    source(`source-large-context-${index}`, longText),
  ]).flat(),
};
const characterBounded = buildCreatorSectionEvidencePromptPack({
  context: characterContext,
  section: sectionPlan[2],
  eligibleClaimIds: characterContext.claims.map((item) => item.claimId),
});
assert.ok(JSON.stringify(characterBounded.units).length <= CREATOR_EVIDENCE_PROMPT_PACK_MAX_CHARACTERS);
assert.ok(characterBounded.metrics.omissionReasonCounts.character_budget > 0);

const generationValue = {
  version: "0.19E3A-script-generation-request-v1",
  topic: "Synthetic science",
  researchSubject: "Synthetic science",
  title: "Synthetic documentary",
  contentType: "documentary",
  narrativePolicy: "science_documentary_v1",
  format: "youtube_video",
  language: "en",
  requestedDurationSeconds: 480,
  strategyFingerprint: "fingerprint-stage-5d2c",
  approvedStrategy: { version: "synthetic" },
  creatorProfile: { version: "synthetic" },
  sectionPlan,
  sectionNative: true,
  longFormEvidenceReadiness: { applicable: true, eligible: true, reasonCodes: [], fallbackBodySectionIds: [], collapsedBodySectionIds: [], evidenceDependentBodySectionIds: ["section-1", "section-2", "section-3"] },
  sectionClaimRouting: routing,
  sectionEvidenceAuthorities: authorities,
  editorialContext: context,
  permittedClaimIds: claims.map((item) => item.claimId),
};
const generationCalls = [];
await executeCreatorScriptBuildScriptGenerationProvider({
  ownerId: "owner-stage-5d2c",
  projectId: "project-stage-5d2c",
  value: generationValue,
  runJson: async (request) => {
    generationCalls.push(JSON.parse(JSON.stringify(request)));
    return { heading: null, text: "Synthetic narration remains evidence-bound.", claimIds: [] };
  },
});
assert.equal(generationCalls.length, 5);
for (const [index, call] of generationCalls.entries()) {
  const authority = authorities[index];
  assert.equal(Object.hasOwn(call.user.generationAuthority, "editorialContext"), false);
  assert.equal(Object.hasOwn(call.user.generationAuthority, "sectionEvidenceAuthorities"), false);
  assert.deepEqual(call.user.generationAuthority.permittedClaimIds, authority.claimIds);
  assert.deepEqual(call.user.activeSectionEvidenceSelection, authority.selection);
  assert.deepEqual(call.user.activeSectionClaimAuthority.evidenceIds, authority.evidenceIds);
  assert.equal(JSON.stringify(call.user).includes('"grounding"'), false);
  assert.equal(JSON.stringify(call.user).includes('"editorialContext"'), false);
  const otherEvidenceIds = authorities.filter((item) => item.sectionId !== authority.sectionId).flatMap((item) => item.evidenceIds);
  assert.ok(otherEvidenceIds.every((evidenceId) => !JSON.stringify(call.user).includes(`\"${evidenceId}\"`)));
}
assert.equal(JSON.stringify(generationCalls[2].user).includes('"claim-empirical-7"'), false);
assert.equal(JSON.stringify(context), originalContextJson, "Evidence projection must not mutate canonical authority");

const semanticScriptAuthority = {
  version: 1,
  title: "Synthetic documentary",
  sections: sectionPlan.map((section) => ({ id: section.id, kind: section.kind, text: "Current section.", claimIds: [], evidenceReviewRequired: false })),
  targetDurationSec: 480,
  strategyFingerprint: "fingerprint-stage-5d2c",
  revision: 1,
  grounding: { context },
  approval: null,
};
const repairBase = {
  version: "0.19E3B-script-repair-request-v2",
  attempt: 1,
  currentScriptAuthority: semanticScriptAuthority,
  sectionPlan,
  repairStrategies: ["expand"],
  repairableViolations: [],
  permittedClaimIds: claims.map((item) => item.claimId),
  sectionClaimRouting: routing,
  sectionEvidenceAuthorities: authorities,
  creatorAuthority: { topic: "Synthetic science", title: "Synthetic documentary", approvedStrategy: { version: "synthetic" } },
};
const replacementCalls = [];
await executeCreatorScriptBuildScriptRepairProvider({
  ownerId: "owner-stage-5d2c",
  projectId: "project-stage-5d2c",
  value: {
    ...repairBase,
    candidate: { buildId: "build-stage-5d2c", sectionId: "section-2", ordinal: 1, rejectionFeedback: null },
    mode: "replacement",
    repairSectionIds: ["section-2"],
    replacementTargets: [{ sectionId: "section-2", beforeWords: 100, requiredFinalMinWords: 285, requiredFinalTargetWords: 317, requiredFinalMaxWords: 349, minimumRequiredGain: 185, minimumRequiredReduction: 0, direction: "expand", strategy: "expand" }],
    expansionTargets: [],
  },
  runJson: async (request) => { replacementCalls.push(JSON.parse(JSON.stringify(request))); return {}; },
});
assert.equal(Object.hasOwn(replacementCalls[0].user.authorityContext.currentScriptAuthority, "grounding"), false);
assert.deepEqual(replacementCalls[0].user.permittedClaimIds, empiricalAuthority.claimIds);
assert.deepEqual(replacementCalls[0].user.authorityContext.sectionEvidenceAuthorities, [empiricalAuthority]);
assert.equal(JSON.stringify(replacementCalls[0].user).includes('"claim-empirical-7"'), false);

const additiveCalls = [];
await executeCreatorScriptBuildScriptRepairProvider({
  ownerId: "owner-stage-5d2c",
  projectId: "project-stage-5d2c",
  value: {
    ...repairBase,
    candidate: null,
    mode: "additive",
    repairSectionIds: ["section-3"],
    replacementTargets: [],
    expansionTargets: [{ sectionId: "section-3", currentWords: 100, requestedGainWords: 20, maxAdditionalWords: 30, availablePlacementAnchors: [{ id: "anchor-1" }] }],
  },
  runJson: async (request) => { additiveCalls.push(JSON.parse(JSON.stringify(request))); return {}; },
});
assert.equal(Object.hasOwn(additiveCalls[0].user.authorityContext.currentScriptAuthority, "grounding"), false);
assert.deepEqual(additiveCalls[0].user.permittedClaimIds, tensionAuthority.claimIds);
assert.deepEqual(additiveCalls[0].user.authorityContext.sectionEvidenceAuthorities, [tensionAuthority]);

const standardCalls = [];
await executeCreatorScriptBuildScriptGenerationProvider({
  ownerId: "owner-stage-5d2c",
  projectId: "project-stage-5d2c",
  value: {
    ...generationValue,
    narrativePolicy: undefined,
    sectionPlan: [sectionPlan[0]],
    sectionClaimRouting: undefined,
    sectionEvidenceAuthorities: undefined,
  },
  runJson: async (request) => { standardCalls.push(JSON.parse(JSON.stringify(request))); return { heading: null, text: "Legacy section.", claimIds: [] }; },
});
assert.equal(Object.hasOwn(standardCalls[0].user.generationAuthority, "editorialContext"), true);
await assert.rejects(
  executeCreatorScriptBuildScriptGenerationProvider({
    ownerId: "owner-stage-5d2c",
    projectId: "project-stage-5d2c",
    value: { ...generationValue, sectionEvidenceAuthorities: undefined },
    runJson: async () => { throw new Error("provider must not be reached"); },
  }),
  /CREATOR_SCRIPT_BUILD_SECTION_EVIDENCE_AUTHORITY_MISSING/,
);
await assert.rejects(
  executeCreatorScriptBuildScriptRepairProvider({
    ownerId: "owner-stage-5d2c",
    projectId: "project-stage-5d2c",
    value: { ...repairBase, sectionEvidenceAuthorities: undefined },
    runJson: async () => { throw new Error("provider must not be reached"); },
  }),
  /CREATOR_SCRIPT_BUILD_SECTION_EVIDENCE_AUTHORITY_MISSING/,
);

const providerSource = readFileSync("lib/creator/creatorScriptBuildProviders.server.ts", "utf8");
const generationSource = readFileSync("lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts", "utf8");
const repairSource = readFileSync("lib/creator/creatorScriptBuildScriptRepairCoordinator.ts", "utf8");
assert.doesNotMatch(providerSource, /creatorEvidenceNarrativeBeatPlan/);
assert.match(generationSource, /CREATOR_SCRIPT_BUILD_GENERATED_CLAIM_OUTSIDE_EVIDENCE_PACK/);
assert.match(repairSource, /CREATOR_SCRIPT_BUILD_GENERATED_CLAIM_OUTSIDE_EVIDENCE_PACK/);

console.log(JSON.stringify({
  sectionPackCount: authorities.length,
  empiricalIncludedUnits: empiricalAuthority.selection.metrics.includedUnitCount,
  empiricalOmittedUnits: empiricalAuthority.selection.metrics.omittedUnitCount,
  characterBudgetOmissions: characterBounded.metrics.omissionReasonCounts.character_budget,
  generationCalls: generationCalls.length,
  replacementRepairBounded: true,
  additiveRepairBounded: true,
  legacyOptOutPreserved: true,
}, null, 2));
