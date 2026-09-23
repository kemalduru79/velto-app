import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCreatorEditorialCandidateCapabilityDiagnostics,
  createCreatorLongFormEvidenceCapabilityEvaluation,
  createCreatorLongFormEvidenceReadiness,
} from "../lib/research/creatorLongFormEvidenceReadiness.ts";
import {
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptDurationContract,
  shouldUseCreatorScriptSectionNativeGeneration,
} from "../lib/creator/creatorScript.ts";
import {
  createEditorialGroundingCandidateSpans,
} from "../lib/research/editorialGroundingRepair.ts";

const source = (id, summary = "") => ({
  sourceId: id,
  adapterId: "web",
  mediaKind: "article",
  title: `Sensitive source prose ${id}`,
  url: `https://example.com/${id}`,
  publisher: "Sensitive publisher prose",
  author: null,
  publishedAt: null,
  summary,
});

const evidence = (id, sourceId, excerpt) => ({
  evidenceId: id,
  sourceId,
  excerpt,
  contextNote: null,
  locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
});

const claim = (id, claimType, supportingEvidenceIds, options = {}) => ({
  claimId: id,
  claimType,
  text: `Sensitive claim prose ${id}`,
  supportingEvidenceIds,
  counterEvidenceIds: options.counterEvidenceIds || [],
  contextualEvidenceIds: options.contextualEvidenceIds || [],
});

const context = ({ claims, evidence: evidenceItems, sources }) => ({
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Sensitive constitution prose",
  readiness: {
    status: "ready",
    editorialReadinessScore: 100,
    reviewReasons: [],
    primarySourceRequiredClaimIds: [],
    primarySourceCoveredClaimIds: [],
  },
  claims,
  evidence: evidenceItems,
  sources,
});

const abstract = "Memory is reconstructed through interacting cognitive processes.";
const concrete = "Researchers asked 120 adults to recall an event after exposure to conflicting details; later reports differed from the original record.";
const contextual = "The comparison applied only under the documented procedure and did not establish that every recollection changes.";

const concreteCandidateSpans = createEditorialGroundingCandidateSpans([
  source("candidate-source", `${abstract} ${concrete}`),
]);
const concreteCandidateDiagnostics = createCreatorEditorialCandidateCapabilityDiagnostics(
  concreteCandidateSpans,
);
assert.ok(concreteCandidateDiagnostics.concreteCandidateSpanCount > 0);
assert.ok(concreteCandidateDiagnostics.concreteCandidates.length <= 10);
assert.ok(concreteCandidateDiagnostics.concreteCandidates.every((item) =>
  item.specificityClassification === "concrete_observation"
));

const abstractCandidateDiagnostics = createCreatorEditorialCandidateCapabilityDiagnostics(
  createEditorialGroundingCandidateSpans([source("abstract-source", abstract)]),
);
assert.equal(abstractCandidateDiagnostics.concreteCandidateSpanCount, 0);
assert.deepEqual(abstractCandidateDiagnostics.concreteCandidates, []);

const manyConcreteCandidates = createCreatorEditorialCandidateCapabilityDiagnostics(
  Array.from({ length: 12 }, (_, index) => ({
    spanId: `bounded-span-${index + 1}`,
    sourceId: `bounded-source-${index + 1}`,
    text: `Sensitive candidate prose ${index + 1}`,
    evidenceSpecificity: "concrete_observation",
  })),
);
assert.equal(manyConcreteCandidates.concreteCandidates.length, 10);
assert.equal(manyConcreteCandidates.truncatedConcreteCandidateCount, 2);

const duration = getCreatorScriptDurationContract({
  targetDurationSec: 960,
  language: "en",
  actualWordCount: 0,
});
const plan = createCreatorScriptSectionBudgetPlan({
  targetDurationSec: 960,
  language: "en",
  hasMaterialCounterview: false,
});
const sectionNative = shouldUseCreatorScriptSectionNativeGeneration(duration.targetWordCount);

const readyClaims = [
  claim("c1", "FACT", ["e1"]),
  claim("c2", "FACT", ["e2"]),
  claim("c3", "RESEARCH_FINDING", ["e3"]),
  claim("c4", "THEORY", ["e4"], { contextualEvidenceIds: ["e5"] }),
  claim("c5", "FACT", ["e6"]),
  claim("c6", "FACT", ["e7"]),
];
const readyContext = context({
  claims: readyClaims,
  evidence: [
    evidence("e1", "s1", abstract),
    evidence("e2", "s2", abstract),
    evidence("e3", "s3", concrete),
    evidence("e4", "s4", abstract),
    evidence("e5", "s5", contextual),
    evidence("e6", "s6", abstract),
    evidence("e7", "s7", abstract),
  ],
  sources: Array.from({ length: 7 }, (_, index) => source(`s${index + 1}`)),
});

const readyBeforeDiagnostics = createCreatorLongFormEvidenceReadiness({
  context: readyContext,
  plan,
  sectionNative,
});
const readyDiagnostics = createCreatorLongFormEvidenceCapabilityEvaluation({
  context: readyContext,
  plan,
});
const readyAfterDiagnostics = createCreatorLongFormEvidenceReadiness({
  context: readyContext,
  plan,
  sectionNative,
});
assert.deepEqual(readyAfterDiagnostics, readyBeforeDiagnostics);
assert.equal(readyBeforeDiagnostics.eligible, true);
assert.equal(readyDiagnostics.hasGroundedDemonstrationCapability, true);
assert.equal(readyDiagnostics.hasUncertaintyCapability, true);
assert.ok(readyDiagnostics.inventory.some((item) =>
  item.hasConcreteDemonstrationCapability && item.evidenceId === "e3"
));
assert.ok(readyDiagnostics.inventory.some((item) =>
  item.hasUncertaintyCapability && item.evidenceId === "e5"
));

const blockedContext = context({
  claims: readyClaims.map((item, index) => ({
    ...item,
    claimType: index === 3 ? "FACT" : item.claimType,
    contextualEvidenceIds: [],
  })),
  evidence: readyContext.evidence.map((item) =>
    item.evidenceId === "e3" ? evidence("e3", "s3", abstract) : item
  ),
  sources: readyContext.sources,
});
const blockedBeforeDiagnostics = createCreatorLongFormEvidenceReadiness({
  context: blockedContext,
  plan,
  sectionNative,
});
const blockedDiagnostics = createCreatorLongFormEvidenceCapabilityEvaluation({
  context: blockedContext,
  plan,
});
const blockedAfterDiagnostics = createCreatorLongFormEvidenceReadiness({
  context: blockedContext,
  plan,
  sectionNative,
});
assert.deepEqual(blockedAfterDiagnostics, blockedBeforeDiagnostics);
assert.deepEqual(blockedBeforeDiagnostics.reasonCodes, [
  "missing_grounded_demonstration_capability",
  "missing_uncertainty_capability",
]);
assert.equal(blockedDiagnostics.hasGroundedDemonstrationCapability, false);
assert.equal(blockedDiagnostics.hasUncertaintyCapability, false);
assert.ok(blockedDiagnostics.inventory.every((item) =>
  !item.hasConcreteDemonstrationCapability && !item.hasUncertaintyCapability
));

const diagnosticText = JSON.stringify({
  candidate: concreteCandidateDiagnostics,
  canonical: readyDiagnostics,
});
assert.doesNotMatch(diagnosticText, /Sensitive source prose|Sensitive publisher prose|Sensitive claim prose/);
assert.doesNotMatch(diagnosticText, /Researchers asked|Memory is reconstructed|comparison applied only/);

const editorialRoute = fs.readFileSync(
  new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url),
  "utf8",
);
const scriptRoute = fs.readFileSync(
  new URL("../app/api/creator-script-plan/route.ts", import.meta.url),
  "utf8",
);
assert.match(editorialRoute, /CREATOR_EDITORIAL_CANDIDATE_CAPABILITY_DIAGNOSTICS/);
assert.match(scriptRoute, /CREATOR_LONG_FORM_EVIDENCE_CAPABILITY_DIAGNOSTICS/);
assert.ok(
  scriptRoute.indexOf("CREATOR_LONG_FORM_EVIDENCE_CAPABILITY_DIAGNOSTICS") <
    scriptRoute.indexOf("if (!longFormEvidenceReadiness.eligible)"),
);

console.log("Stage 0.15B.6D evidence readiness observability regression passed.");
