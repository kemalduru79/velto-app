import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createEditorialGroundingCandidateSpans,
  createValidatedEditorialAnalysisWithOneRepair,
  installCanonicalEditorialEvidenceSpans,
} from "../lib/research/editorialGroundingRepair.ts";
import { createValidatedEditorialAnalysis } from "../lib/research/editorialAnalysisContract.ts";
import {
  assertCreatorScriptHasHealthySectionStructure,
  assertCreatorScriptHasSafeSectionStructure,
  assertCreatorScriptHasDistinctEditorialSections,
  assertCreatorScriptNarrationIsProductionSafe,
  assertCreatorScriptSatisfiesSectionBudgets,
  createCreatorScriptNarrationAuthority,
  createCreatorScriptNarrationEditorialContext,
  CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT,
  CREATOR_SCRIPT_GENERATION_PRIORITY_HIERARCHY,
  createCreatorScript,
  countCreatorScriptWords,
  createCreatorScriptSectionBudgetPlan,
  createCreatorScriptRepairTargets,
  createCreatorScriptAdditiveExpansionPlan,
  createCreatorScriptInsertionAnchors,
  applyCreatorScriptAdditiveExpansion,
  creatorScriptRepairMateriallyImproved,
  creatorScriptHasGroundingBlocker,
  generateCreatorScriptSectionUnits,
  generateCreatorScriptWithDurationContract,
  getCreatorScriptDurationContract,
  getCreatorScriptDurationContractForScript,
  getCreatorScriptDurationRepairSections,
  getCreatorScriptRepairReplacementDiagnostics,
  getCreatorScriptEditorialDistinctivenessFailures,
  getCreatorScriptEditorialDistinctivenessDiagnostics,
  filterCreatorScriptDistinctiveRepairReplacements,
  filterCreatorScriptRepairReplacements,
  getCreatorScriptMaterialSectionFailures,
  getCreatorScriptNarrationSafetyViolations,
  getCreatorScriptOutputTokenBudget,
  getCreatorScriptSafeSingleCallTargetWords,
  getCreatorScriptSectionDiagnostics,
  isCreatorScriptResidualRepairEligible,
  isCreatorScriptCurrentForStrategy,
  mergeCreatorScriptSectionUnits,
  mergeCreatorScriptReplacementSections,
  shouldUseCreatorScriptSectionNativeGeneration,
} from "../lib/creator/creatorScript.ts";

const sources = ["work", "freedom"].map((name, index) => ({
  sourceId: `source-${name}`,
  adapterId: "web",
  mediaKind: "article",
  externalId: name,
  title: `${name} source`,
  url: `https://example.test/${name}`,
  publisher: "Example",
  author: null,
  publishedAt: null,
  language: "en",
  summary: `Canonical ${name} evidence explains the issue carefully. A second ${name} sentence preserves uncertainty and context.`,
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
}));
const spans = createEditorialGroundingCandidateSpans(sources);
const workSpan = spans.find((span) => span.sourceId === "source-work");
const freedomSpan = spans.find((span) => span.sourceId === "source-freedom");
assert.ok(workSpan && freedomSpan);
const proposal = (spanId = workSpan.spanId, sourceId = "source-work") => ({
  claims: [{ claimId: "claim-1", claimType: "FACT", text: "Work structures shape freedom." }],
  evidence: [{ evidenceId: "evidence-1", sourceId, spanId, excerpt: "model text is never authority", contextNote: "bounded" }],
  links: [{ claimId: "claim-1", evidenceId: "evidence-1", stance: "supports" }],
});

let editorialCalls = 1;
let exaCalls = 0;
const exactGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: proposal(),
  repair: async () => { editorialCalls += 1; return { repairs: [] }; },
});
assert.equal(editorialCalls, 1);
assert.equal(exactGraph.evidence[0].excerpt, workSpan.text);
assert.notEqual(exactGraph.evidence[0].excerpt, "model text is never authority");

editorialCalls = 1;
const repairedGraph = await createValidatedEditorialAnalysisWithOneRepair({
  sources,
  proposal: proposal("unknown-span"),
  repair: async ({ diagnosticCategory, candidateSpans }) => {
    editorialCalls += 1;
    assert.equal(diagnosticCategory, "EDITORIAL_EVIDENCE_SPAN_INVALID");
    assert.ok(candidateSpans.every((span) => span.sourceId === "source-work"));
    return { repairs: [{ evidenceId: "evidence-1", spanId: workSpan.spanId }] };
  },
});
assert.equal(editorialCalls, 2);
assert.equal(repairedGraph.evidence[0].excerpt, workSpan.text);
assert.equal(exaCalls, 0);

const callsBeforeUnknownSource = editorialCalls;
await assert.rejects(createValidatedEditorialAnalysisWithOneRepair({ sources, proposal: proposal(workSpan.spanId, "unknown-source"), repair: async () => { editorialCalls += 1; return { repairs: [] }; } }), /EDITORIAL_EVIDENCE_SOURCE_MISSING/);
assert.equal(editorialCalls, callsBeforeUnknownSource);
assert.throws(() => installCanonicalEditorialEvidenceSpans({ proposal: proposal(freedomSpan.spanId), candidateSpans: spans }), /EDITORIAL_EVIDENCE_SPAN_SOURCE_MISMATCH/);
await assert.rejects(createValidatedEditorialAnalysisWithOneRepair({ sources, proposal: proposal("unknown-span"), repair: async () => ({ repairs: [{ evidenceId: "evidence-1", spanId: "still-unknown" }] }) }), /EDITORIAL_GROUNDING_REPAIR_SPAN_MISSING/);

const duplicate = createValidatedEditorialAnalysis({
  sources,
  proposal: {
    ...proposal(),
    evidence: [{ evidenceId: "evidence-1", sourceId: "source-work", excerpt: workSpan.text }, { evidenceId: "evidence-1", sourceId: "source-work", excerpt: workSpan.text }],
    links: [proposal().links[0], proposal().links[0]],
  },
});
assert.equal(duplicate.evidence.length, 1);
assert.equal(duplicate.links.length, 1);
assert.throws(() => createValidatedEditorialAnalysis({ sources, proposal: { ...proposal(), evidence: [{ evidenceId: "evidence-1", sourceId: "source-work", excerpt: workSpan.text }, { evidenceId: "evidence-1", sourceId: "source-freedom", excerpt: freedomSpan.text }] } }), /EDITORIAL_EVIDENCE_CONFLICT/);

const topic = "If Work Becomes Optional, Will Freedom Follow?";
const context = { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve evidence and uncertainty.", readiness: { status: "ready", editorialReadinessScore: 90, reviewReasons: [] }, claims: [], evidence: [], sources: [] };
const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
const makePlannedScript = (plan, scale = 1) => createCreatorScript({
  title: topic,
  sections: plan.map((budget) => ({ id: budget.id, kind: budget.kind, heading: budget.role, text: words(Math.max(1, Math.round(budget.targetWords * scale))), claimIds: [], evidenceReviewRequired: false })),
  targetDurationSec: 960,
  strategyFingerprint: "work-freedom-960",
  grounding: { context },
  generatedAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:00.000Z",
});

for (const language of ["en", "tr"]) {
  for (const targetDurationSec of [60, 240, 480, 960]) {
    const plan = createCreatorScriptSectionBudgetPlan({ targetDurationSec, language });
    const duration = getCreatorScriptDurationContract({ targetDurationSec, language, actualWordCount: 0 });
    assert.equal(plan.reduce((sum, section) => sum + section.targetWords, 0), duration.targetWordCount);
    assert.ok(plan.length >= 3 && plan.length <= 12);
    assert.equal(plan[0].kind, "opening");
    assert.equal(plan.at(-1).kind, "conclusion");
    assert.ok(plan.every((section) => section.minimumWords <= section.targetWords && section.maximumWords >= section.targetWords));
  }
}
const plan960 = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 960, language: "en" });
const plan960WithCounterview = createCreatorScriptSectionBudgetPlan({
  targetDurationSec: 960,
  language: "en",
  hasMaterialCounterview: true,
});
const plan300 = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 300, language: "en" });
const duration300 = getCreatorScriptDurationContract({ targetDurationSec: 300, language: "en", actualWordCount: 705 });
assert.deepEqual([duration300.targetWordCount, duration300.minimumAcceptableWordCount, duration300.maximumAcceptableWordCount, duration300.status], [705, 635, 775, "compliant"]);
assert.equal(shouldUseCreatorScriptSectionNativeGeneration(duration300.targetWordCount), false);
const fiveMinuteScript = createCreatorScript({
  title: topic,
  sections: plan300.map((budget) => ({ id: budget.id, kind: budget.kind, heading: budget.role, text: words(budget.targetWords), claimIds: [], evidenceReviewRequired: false })),
  targetDurationSec: 300,
  strategyFingerprint: "work-freedom-300",
  grounding: { context },
  generatedAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:00.000Z",
});
let fiveMinuteCalls = 0;
const acceptedFiveMinute = await generateCreatorScriptWithDurationContract({
  durationSec: 300,
  language: "en",
  generateInitial: async () => { fiveMinuteCalls += 1; return fiveMinuteScript; },
  repair: async () => { fiveMinuteCalls += 1; return fiveMinuteScript; },
  validateFinal: (script) => { assertCreatorScriptSatisfiesSectionBudgets(script, plan300); },
});
assert.equal(fiveMinuteCalls, 1);
assert.equal(acceptedFiveMinute.diagnostics.status, "compliant");
assert.equal(plan300.length, 4);
assert.equal(plan960.length, 8, "the existing duration-derived section-count constraint remains explicit");
assert.deepEqual(plan960.map((section) => section.id), ["opening", "section-1", "section-2", "section-3", "section-4", "section-5", "section-6", "conclusion"]);
assert.equal(new Set(plan960.map((section) => section.role)).size, plan960.length);
assert.equal(new Set(plan960.map((section) => section.centralQuestion)).size, plan960.length);
assert.equal(new Set(plan960.map((section) => section.progression)).size, plan960.length);
assert.ok(plan960.every((section) => section.ownershipBoundary.usage === "control_only_never_narrate" && section.ownershipBoundary.owns.length > 0 && section.ownershipBoundary.excludes.length > 0), "every canonical section owns explicit non-narratable control metadata");
assert.doesNotMatch(JSON.stringify(plan960.map((section) => section.ownershipBoundary)), /this inquiry|does not seek|this section|later sections are reserved/i, "ownership controls are compact metadata rather than narration-ready editorial prose");
assert.deepEqual(plan960[0].ownershipBoundary.owns, ["human_stakes", "master_tension", "master_question"]);
assert.ok(plan960[0].ownershipBoundary.excludes.includes("mechanism") && plan960[0].ownershipBoundary.excludes.includes("evidence"), "opening reserves body explanation for later sections");
assert.match(plan960[1].role, /define and frame/i);
assert.ok(plan960[1].ownershipBoundary.excludes.includes("opening_thesis_restatement") && plan960[1].ownershipBoundary.excludes.includes("mechanism"));
assert.match(plan960[2].role, /mechanism|causal process/i);
assert.ok(plan960[2].ownershipBoundary.excludes.includes("evidence_catalog"));
assert.match(plan960[3].role, /evidence|case/i);
assert.ok(plan960[3].ownershipBoundary.excludes.includes("mechanism_reteaching") && plan960[3].ownershipBoundary.excludes.includes("limits"));
assert.match(plan960[4].role, /limits|counterview|alternative explanation/i);
assert.ok(plan960[4].ownershipBoundary.excludes.includes("social_formation"));
assert.match(plan960[5].role, /formation and influence/i);
assert.ok(plan960[5].ownershipBoundary.owns.includes("social_formation") && plan960[5].ownershipBoundary.excludes.includes("material_consequence"));
assert.match(plan960[6].role, /downstream consequences|second-order effects/i);
assert.ok(plan960[6].ownershipBoundary.owns.includes("material_consequence") && plan960[6].ownershipBoundary.excludes.includes("social_formation_reteaching"));
assert.match(plan960[7].role, /unresolved question/i);
assert.deepEqual(plan960[7].ownershipBoundary.owns, ["highest_order_implication", "synthesis_for_master_question", "unresolved_question"]);
assert.ok(["mechanism", "evidence_demonstration", "social_formation", "consequence_inventory", "section_by_section_recap"].every((item) => plan960[7].ownershipBoundary.excludes.includes(item)));
assert.match(plan960[7].progression, /moves forward|deepest implication/i);
assert.doesNotMatch(plan960[7].centralQuestion, /intervention|prevention|correct false/i);
assert.match(
  plan960WithCounterview.find((section) => section.role.includes("counterview"))?.centralQuestion || "",
  /strongest credible challenge/i,
);
assert.ok(plan300.filter((section) => section.kind === "body")
  .every((section, index) => section.role === `Develop grounded documentary argument ${index + 1}`));

const repetitiveMemoryHeadings = [
  "What if your memories are not what you think?",
  "The Reconstructive Nature of Memory",
  "The Impact of False Memories on Identity and Relationships",
  "The Science Behind False Memories and Their Influence on Identity",
  "The Social Construction of False Memories and Identity",
  "The Reconstructive Nature of Memory and Its Implications for Identity",
  "The Complex Impact of False Memories on Identity and Relationships",
  "The Fluidity of Memory and Identity",
];
const repetitiveMemoryScript = createCreatorScript({
  ...makePlannedScript(plan960),
  sections: plan960.map((budget, index) => ({
    id: budget.id,
    kind: budget.kind,
    heading: repetitiveMemoryHeadings[index],
    text: words(budget.targetWords),
    claimIds: [],
    evidenceReviewRequired: false,
  })),
});
const repetitiveFailures = getCreatorScriptEditorialDistinctivenessFailures(
  repetitiveMemoryScript,
  plan960,
);
assert.ok(repetitiveFailures.length >= 2, "obvious memory/identity heading paraphrases must fail");
const repetitiveDistinctivenessDiagnostics = getCreatorScriptEditorialDistinctivenessDiagnostics(repetitiveMemoryScript, plan960);
assert.ok(repetitiveDistinctivenessDiagnostics.some((failure) => failure.failureType === "heading_token_overlap" && failure.sectionId && failure.comparedSectionId), "diagnostics identify the exact section pair and deterministic heading-overlap rule");
assert.throws(
  () => assertCreatorScriptHasDistinctEditorialSections(repetitiveMemoryScript, plan960),
  /CREATOR_SCRIPT_EDITORIAL_DISTINCTIVENESS_UNSATISFIED/,
);

const distinctMemoryScript = createCreatorScript({
  ...makePlannedScript(plan960),
  sections: plan960.map((budget) => ({
    id: budget.id,
    kind: budget.kind,
    heading: budget.role,
    text: words(budget.targetWords),
    claimIds: [],
    evidenceReviewRequired: false,
  })),
});
assert.doesNotThrow(() => assertCreatorScriptHasDistinctEditorialSections(distinctMemoryScript, plan960));

const headingRegressingReplacement = {
  ...distinctMemoryScript.sections[4],
  heading: distinctMemoryScript.sections[3].heading,
  text: words(plan960[4].targetWords + 1),
};
const rejectedDistinctivenessRepair = filterCreatorScriptDistinctiveRepairReplacements({
  script: distinctMemoryScript,
  plan: plan960,
  replacements: [headingRegressingReplacement],
});
assert.deepEqual(rejectedDistinctivenessRepair.replacements, [], "a longer duration candidate cannot consume a neighboring section's deterministic heading identity");
assert.deepEqual(rejectedDistinctivenessRepair.rejectedSectionIds, [plan960[4].id]);
assert.equal(rejectedDistinctivenessRepair.failures[0].failureType, "heading_token_overlap");
const distinctiveDurationReplacement = {
  ...distinctMemoryScript.sections[4],
  heading: "Collective Retelling and Social Formation",
  text: words(plan960[4].targetWords + 1),
};
const acceptedDistinctivenessRepair = filterCreatorScriptDistinctiveRepairReplacements({
  script: distinctMemoryScript,
  plan: plan960,
  replacements: [distinctiveDurationReplacement],
});
assert.equal(acceptedDistinctivenessRepair.replacements.length, 1, "a longer candidate preserving deterministic distinctiveness remains eligible");

let distinctivenessRepairCalls = 0;
const distinctivenessRepaired = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => repetitiveMemoryScript,
  requiresRepair: (script) =>
    getCreatorScriptEditorialDistinctivenessFailures(script, plan960).length > 0,
  repair: async (script) => {
    distinctivenessRepairCalls += 1;
    const failures = getCreatorScriptEditorialDistinctivenessFailures(script, plan960);
    return mergeCreatorScriptReplacementSections({
      script,
      plan: plan960,
      replacements: failures.map((failure) => ({
        ...script.sections.find((section) => section.id === failure.id),
        id: failure.id,
        kind: failure.kind,
        heading: failure.role,
        text: words(failure.targetWords),
      })),
    });
  },
  validateFinal: (script) => {
    assertCreatorScriptHasHealthySectionStructure(script, plan960);
    assertCreatorScriptHasDistinctEditorialSections(script, plan960);
  },
});
assert.equal(distinctivenessRepairCalls, 1);
assert.equal(distinctivenessRepaired.repaired, true);
assert.deepEqual(distinctivenessRepaired.creatorScript.grounding, repetitiveMemoryScript.grounding);

const primaryReviewScript = createCreatorScript({
  ...fiveMinuteScript,
  grounding: {
    context: {
      ...context,
      readiness: {
        status: "review",
        editorialReadinessScore: 85,
        reviewReasons: ["PRIMARY_SOURCE_COVERAGE_REQUIRED"],
        primarySourceRequiredClaimIds: ["claim-primary"],
        primarySourceCoveredClaimIds: [],
      },
      claims: [{
        claimId: "claim-primary",
        claimType: "PRIMARY_SOURCE_CLAIM",
        text: "Original evidence remains required for full readiness.",
        supportingEvidenceIds: ["evidence-secondary"],
        counterEvidenceIds: [],
        contextualEvidenceIds: [],
      }],
      evidence: [{
        evidenceId: "evidence-secondary",
        sourceId: "source-secondary",
        excerpt: "Traceable secondary evidence.",
        contextNote: null,
        locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
      }],
      sources: [{
        sourceId: "source-secondary",
        title: "Secondary evidence",
        url: "https://example.test/secondary",
        publisher: "Example",
        author: null,
        publishedAt: null,
        directness: "secondary",
        reviewStatus: "usable",
        searchLane: "web",
        sourceKind: "article",
      }],
    },
  },
  sections: fiveMinuteScript.sections.map((section, index) => ({
    ...section,
    claimIds: index === 1 ? ["claim-primary"] : [],
  })),
});
assert.equal(primaryReviewScript.grounding.context.readiness.status, "review");
assert.equal(primaryReviewScript.sections[1].evidenceReviewRequired, true);

const mildlyUnevenFiveMinuteScript = createCreatorScript({
  ...fiveMinuteScript,
  sections: fiveMinuteScript.sections.map((section, index) => ({
    ...section,
    text: index === 0
      ? words(plan300[0].minimumWords - 1)
      : index === 1
        ? words(plan300[1].targetWords + (plan300[0].targetWords - (plan300[0].minimumWords - 1)))
        : section.text,
  })),
});
assert.equal(getCreatorScriptDurationContractForScript(mildlyUnevenFiveMinuteScript, "en").status, "compliant");
assert.throws(() => assertCreatorScriptSatisfiesSectionBudgets(mildlyUnevenFiveMinuteScript, plan300), /SECTION_BUDGET_UNSATISFIED/);
assert.equal(getCreatorScriptMaterialSectionFailures(mildlyUnevenFiveMinuteScript, plan300).length, 0);
assert.doesNotThrow(() => assertCreatorScriptHasHealthySectionStructure(mildlyUnevenFiveMinuteScript, plan300));
let mildlyUnevenCalls = 0;
const acceptedMildVariance = await generateCreatorScriptWithDurationContract({
  durationSec: 300,
  language: "en",
  generateInitial: async () => { mildlyUnevenCalls += 1; return mildlyUnevenFiveMinuteScript; },
  repair: async () => { mildlyUnevenCalls += 1; return fiveMinuteScript; },
  requiresRepair: (script) => getCreatorScriptMaterialSectionFailures(script, plan300).length > 0,
  validateFinal: (script) => assertCreatorScriptHasHealthySectionStructure(script, plan300),
});
assert.equal(acceptedMildVariance.repaired, false);
assert.equal(mildlyUnevenCalls, 1);

const globallySafeRealUseCounts = [170, 290, 285, 274, 286, 237, 290, 240];
const globallySafeRealUseScript = createCreatorScript({
  ...makePlannedScript(plan960),
  sections: plan960.map((budget, index) => ({
    id: budget.id,
    kind: budget.kind,
    heading: `Distinct real use heading ${index}`,
    text: words(globallySafeRealUseCounts[index]),
    claimIds: [],
    evidenceReviewRequired: false,
  })),
});
assert.equal(getCreatorScriptDurationContractForScript(globallySafeRealUseScript, "en").actualWordCount, 2072);
assert.equal(getCreatorScriptDurationContractForScript(globallySafeRealUseScript, "en").status, "compliant");
assert.ok(getCreatorScriptSectionDiagnostics(globallySafeRealUseScript, plan960).find((section) => section.id === "section-3").deficitWords > 0);
assert.doesNotThrow(() => assertCreatorScriptHasSafeSectionStructure(globallySafeRealUseScript, plan960), "soft local minima do not override globally safe duration");
assert.deepEqual(getCreatorScriptMaterialSectionFailures(globallySafeRealUseScript, plan960).map((section) => section.id), ["section-5"], "material local miss remains bounded repair guidance");
const wrongDirectionReplacement = [{
  id: "section-5",
  kind: "body",
  role: plan960.find((section) => section.id === "section-5").role,
  heading: "Distinct repaired heading",
  text: words(233),
  claimIds: [],
}];
assert.deepEqual(filterCreatorScriptRepairReplacements({ script: globallySafeRealUseScript, plan: plan960, replacements: wrongDirectionReplacement }), [], "wrong-direction expansion is ignored");
let wrongDirectionRepairCalls = 0;
const acceptedWrongDirectionRepair = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => { wrongDirectionRepairCalls += 1; return globallySafeRealUseScript; },
  repair: async (script) => {
    wrongDirectionRepairCalls += 1;
    const replacements = filterCreatorScriptRepairReplacements({ script, plan: plan960, replacements: wrongDirectionReplacement });
    return replacements.length ? mergeCreatorScriptReplacementSections({ script, plan: plan960, replacements }) : script;
  },
  requiresRepair: (script) => getCreatorScriptMaterialSectionFailures(script, plan960).length > 0,
  validateFinal: (script) => assertCreatorScriptHasSafeSectionStructure(script, plan960),
});
assert.equal(wrongDirectionRepairCalls, 2, "material local under-generation receives one bounded repair attempt");
assert.equal(acceptedWrongDirectionRepair.creatorScript.sections.find((section) => section.id === "section-5").text, globallySafeRealUseScript.sections.find((section) => section.id === "section-5").text, "wrong-direction repair cannot replace canonical section text");
const overMaximumReplacement = [{ ...wrongDirectionReplacement[0], text: words(plan960.find((section) => section.id === "section-5").maximumWords + 1) }];
assert.deepEqual(filterCreatorScriptRepairReplacements({ script: globallySafeRealUseScript, plan: plan960, replacements: overMaximumReplacement }), [], "section maximum remains hard during repair");
const overMaximumScript = createCreatorScript({ ...globallySafeRealUseScript, sections: globallySafeRealUseScript.sections.map((section) => section.id === "section-5" ? { ...section, text: words(plan960.find((budget) => budget.id === "section-5").maximumWords + 1) } : section) });
assert.throws(() => assertCreatorScriptHasSafeSectionStructure(overMaximumScript, plan960), /SECTION_BUDGET_UNSATISFIED/, "section maximum remains a final hard gate");

const catastrophicallyUnevenFiveMinuteScript = createCreatorScript({
  ...fiveMinuteScript,
  sections: fiveMinuteScript.sections.map((section, index) => ({
    ...section,
    text: index === 0
      ? words(Math.floor(plan300[0].targetWords * 0.5))
      : index === 1
        ? words(plan300[1].targetWords + (plan300[0].targetWords - Math.floor(plan300[0].targetWords * 0.5)))
        : section.text,
  })),
});
assert.equal(getCreatorScriptDurationContractForScript(catastrophicallyUnevenFiveMinuteScript, "en").status, "compliant");
assert.deepEqual(getCreatorScriptMaterialSectionFailures(catastrophicallyUnevenFiveMinuteScript, plan300).map((section) => section.id), ["opening"]);
assert.throws(() => assertCreatorScriptHasHealthySectionStructure(catastrophicallyUnevenFiveMinuteScript, plan300), /SECTION_BUDGET_UNSATISFIED/);
let fiveMinuteStructureRepairCalls = 0;
const repairedFiveMinuteStructure = await generateCreatorScriptWithDurationContract({
  durationSec: 300,
  language: "en",
  generateInitial: async () => { fiveMinuteStructureRepairCalls += 1; return catastrophicallyUnevenFiveMinuteScript; },
  repair: async (_script, diagnostics) => {
    fiveMinuteStructureRepairCalls += 1;
    assert.equal(diagnostics.status, "compliant");
    return fiveMinuteScript;
  },
  requiresRepair: (script) => getCreatorScriptMaterialSectionFailures(script, plan300).length > 0,
  validateFinal: (script) => assertCreatorScriptHasHealthySectionStructure(script, plan300),
});
assert.equal(repairedFiveMinuteStructure.repaired, true);
assert.equal(repairedFiveMinuteStructure.diagnostics.status, "compliant");
assert.equal(fiveMinuteStructureRepairCalls, 2);
const duration960 = getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 549 });
assert.deepEqual([duration960.targetWordCount, duration960.minimumAcceptableWordCount, duration960.maximumAcceptableWordCount], [2256, 2031, 2481]);
assert.equal(plan960.length, 8);
assert.ok(getCreatorScriptOutputTokenBudget(2256) >= 5000);
assert.equal(shouldUseCreatorScriptSectionNativeGeneration(2256), true);
assert.equal(shouldUseCreatorScriptSectionNativeGeneration(705), false);
assert.equal(getCreatorScriptSafeSingleCallTargetWords(), 800);
const sectionUnits960 = plan960.map((budget) => ({ id: budget.id, kind: budget.kind, role: budget.role, heading: budget.role, text: words(budget.targetWords), claimIds: [] }));
const mergedSectionUnits = mergeCreatorScriptSectionUnits({ sections: sectionUnits960, plan: plan960 });
assert.deepEqual(mergedSectionUnits.map((section) => section.id), plan960.map((section) => section.id));
assert.throws(() => mergeCreatorScriptSectionUnits({ sections: sectionUnits960.filter((section) => section.id !== plan960[1].id), plan: plan960 }), /SECTION_UNITS_INCOMPLETE/);
assert.throws(() => mergeCreatorScriptSectionUnits({ sections: [...sectionUnits960, { ...sectionUnits960[1], id: "invented" }], plan: plan960 }), /SECTION_UNIT_INVALID/);
assert.throws(() => mergeCreatorScriptSectionUnits({ sections: [...sectionUnits960, sectionUnits960[1]], plan: plan960 }), /SECTION_UNIT_INVALID/);

let sectionNativeCalls = 0;
const generated960 = await generateCreatorScriptSectionUnits({
  plan: plan960,
  generateSection: async (budget) => {
    sectionNativeCalls += 1;
    return { id: budget.id, kind: budget.kind, role: budget.role, heading: budget.role, text: words(budget.targetWords), claimIds: [] };
  },
});
assert.equal(sectionNativeCalls, plan960.length);
assert.equal(generated960.reduce((sum, section) => sum + String(section.text).split(/\s+/u).length, 0), 2256);

const plan1800 = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 1800, language: "en" });
let sectionNativeCalls1800 = 0;
const generated1800 = await generateCreatorScriptSectionUnits({
  plan: plan1800,
  generateSection: async (budget) => {
    sectionNativeCalls1800 += 1;
    return { id: budget.id, kind: budget.kind, role: budget.role, heading: budget.role, text: words(budget.targetWords), claimIds: [] };
  },
});
assert.equal(plan1800.length, 12);
assert.equal(sectionNativeCalls1800, plan1800.length);
assert.equal(generated1800.reduce((sum, section) => sum + String(section.text).split(/\s+/u).length, 0), 4230);

let failedSectionCalls = 0;
await assert.rejects(generateCreatorScriptSectionUnits({
  plan: plan960,
  generateSection: async (budget, index) => {
    failedSectionCalls += 1;
    if (index === 3) throw new Error("SYNTHETIC_SECTION_PROVIDER_FAILURE");
    return { id: budget.id, kind: budget.kind, role: budget.role, text: words(budget.targetWords), claimIds: [] };
  },
}), /SYNTHETIC_SECTION_PROVIDER_FAILURE/);
assert.equal(failedSectionCalls, 4);
const shortScript = makePlannedScript(plan960, 549 / 2256);
const diagnostics = getCreatorScriptSectionDiagnostics(shortScript, plan960);
assert.ok(diagnostics.every((section) => section.deficitWords > 0));

let scriptCalls = 0;
const accepted = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => { scriptCalls += 1; return shortScript; },
  repair: async (script) => {
    scriptCalls += 1;
    return mergeCreatorScriptReplacementSections({
      script,
      plan: plan960,
      replacements: plan960.map((budget) => ({ id: budget.id, kind: budget.kind, heading: budget.role, text: words(budget.targetWords), claimIds: [], evidenceReviewRequired: false })),
    });
  },
  requiresRepair: (script) => getCreatorScriptSectionDiagnostics(script, plan960).some((section) => section.missing),
  validateFinal: (script) => { assertCreatorScriptSatisfiesSectionBudgets(script, plan960); },
});
assert.equal(scriptCalls, 2);
assert.equal(accepted.repaired, true);
assert.equal(accepted.creatorScript.targetDurationSec, 960);
assert.equal(getCreatorScriptDurationContractForScript(accepted.creatorScript, "en").status, "compliant");
assert.equal(exaCalls, 0);
const scenes = [];
assert.equal(scenes.length, 0);

assert.equal(isCreatorScriptCurrentForStrategy({ script: shortScript, strategyFingerprint: "work-freedom-960", targetDurationSec: 960, language: "en" }), true);
assert.equal(isCreatorScriptCurrentForStrategy({ script: makePlannedScript(plan960), strategyFingerprint: "refreshed-strategy", targetDurationSec: 960, language: "en" }), false);
assert.equal(isCreatorScriptCurrentForStrategy({ script: makePlannedScript(plan960), strategyFingerprint: "work-freedom-960", targetDurationSec: 960, language: "en" }), true);

scriptCalls = 0;
const sectionNativeFirstPass = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => {
    for (const section of sectionUnits960) scriptCalls += 1;
    return makePlannedScript(plan960);
  },
  repair: async () => { scriptCalls += 1; return makePlannedScript(plan960); },
  validateFinal: (script) => { assertCreatorScriptSatisfiesSectionBudgets(script, plan960); },
});
assert.equal(sectionNativeFirstPass.repaired, false);
assert.equal(scriptCalls, plan960.length);

const modestShortScript = makePlannedScript(plan960, 0.85);
const modestDiagnostics = getCreatorScriptDurationContractForScript(modestShortScript, "en");
assert.equal(modestDiagnostics.status, "too_short");
assert.equal(isCreatorScriptResidualRepairEligible(modestDiagnostics), true);
assert.equal(isCreatorScriptResidualRepairEligible(getCreatorScriptDurationContractForScript(shortScript, "en")), false);

const realUseCounts = [170, 250, 250, 250, 250, 250, 250, 164];
const realUseShortScript = createCreatorScript({
  ...makePlannedScript(plan960),
  sections: plan960.map((budget, index) => ({
    id: budget.id,
    kind: budget.kind,
    heading: budget.role,
    text: words(realUseCounts[index]),
    claimIds: [],
    evidenceReviewRequired: false,
  })),
});
const realUseDuration = getCreatorScriptDurationContractForScript(realUseShortScript, "en");
assert.equal(realUseDuration.actualWordCount, 1834);
assert.equal(realUseDuration.status, "too_short");
const realUseRepairSections = getCreatorScriptDurationRepairSections({
  script: realUseShortScript,
  plan: plan960,
  duration: realUseDuration,
});
assert.deepEqual(
  realUseRepairSections.map((section) => section.id),
  plan960.slice(1).map((section) => section.id),
  "every locally under-minimum section is repaired instead of two aggregate-capacity winners",
);
assert.ok(realUseRepairSections.every((section) => section.targetWords <= section.maximumWords));

let boundedRepairCalls = 0;
const boundedRepair = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => realUseShortScript,
  maxRepairAttempts: 2,
  shouldRetryRepair: ({ previous, current }) =>
    creatorScriptRepairMateriallyImproved({ previous, current }),
  repair: async (script, _duration, attempt) => {
    boundedRepairCalls += 1;
    const counts = attempt === 1
      ? [170, 261, 261, 261, 261, 261, 261, 172]
      : plan960.map((budget) => budget.targetWords);
    return mergeCreatorScriptReplacementSections({
      script,
      plan: plan960,
      replacements: plan960.slice(1).map((budget, index) => ({
        ...script.sections[index + 1],
        id: budget.id,
        kind: budget.kind,
        heading: budget.role,
        text: words(counts[index + 1]),
      })),
    });
  },
  validateFinal: (script) => assertCreatorScriptHasHealthySectionStructure(script, plan960),
});
assert.equal(boundedRepairCalls, 2);
assert.equal(boundedRepair.diagnostics.status, "compliant");
assert.equal(boundedRepair.repairAttempts, 2);
assert.equal(boundedRepair.creatorScript.revision, realUseShortScript.revision + 2);
assert.deepEqual(boundedRepair.creatorScript.grounding, realUseShortScript.grounding);
assert.ok(getCreatorScriptSectionDiagnostics(boundedRepair.creatorScript, plan960)
  .every((section) => section.actualWords <= section.maximumWords));

let unrecoverableCalls = 0;
await assert.rejects(
  generateCreatorScriptWithDurationContract({
    durationSec: 960,
    language: "en",
    generateInitial: async () => realUseShortScript,
    maxRepairAttempts: 2,
    shouldRetryRepair: ({ previous, current }) =>
      creatorScriptRepairMateriallyImproved({ previous, current }),
    repair: async (script) => {
      unrecoverableCalls += 1;
      return mergeCreatorScriptReplacementSections({
        script,
        plan: plan960,
        replacements: [{
          ...script.sections[1],
          text: `${script.sections[1].text} one two three four five`,
        }],
      });
    },
  }),
  /requested duration/,
);
assert.equal(unrecoverableCalls, 2, "strict directional progress may use the one remaining bounded attempt but can never loop beyond it");

const partialReplacementDiagnostics = getCreatorScriptRepairReplacementDiagnostics({
  script: realUseShortScript,
  plan: plan960,
  replacements: [{ ...realUseShortScript.sections[1], text: words(260) }],
});
assert.deepEqual(partialReplacementDiagnostics.map(({ sectionId, beforeWords, candidateWords, accepted, reason }) => ({ sectionId, beforeWords, candidateWords, accepted, reason })), [{ sectionId: "section-1", beforeWords: 250, candidateWords: 260, accepted: true, reason: "partial_progress_requires_retry" }]);
const arithmeticRepairTargets = createCreatorScriptRepairTargets({
  sections: getCreatorScriptSectionDiagnostics(realUseShortScript, plan960).filter((section) => section.id === "section-1"),
  direction: "expand",
});
assert.deepEqual(arithmeticRepairTargets, [{ sectionId: "section-1", direction: "expand", beforeWords: 250, requiredFinalMinWords: 277, requiredFinalTargetWords: 308, requiredFinalMaxWords: 339, minimumRequiredGain: 27, minimumRequiredReduction: 0 }]);
assert.equal(creatorScriptRepairMateriallyImproved({
  previous: getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 1981 }),
  current: getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 1990 }),
}), true, "a nine-word directional gain remains eligible for the single bounded retry rather than terminating recovery");

const narrowRecoveryCounts = [169, 278, 264, 254, 292, 267, 268, 189];
const narrowRecoveryScript = createCreatorScript({
  ...makePlannedScript(plan960),
  sections: plan960.map((budget, index) => ({ ...makePlannedScript(plan960).sections[index], text: words(narrowRecoveryCounts[index]) })),
});
assert.equal(getCreatorScriptDurationContractForScript(narrowRecoveryScript, "en").actualWordCount, 1981);
assert.equal(getCreatorScriptSectionDiagnostics(narrowRecoveryScript, plan960).reduce((sum, section) => sum + section.actualWords, 0), getCreatorScriptDurationContractForScript(narrowRecoveryScript, "en").actualWordCount, "canonical section counts and global duration use the same representation and counter");
const narrowRecoveryTargets = getCreatorScriptDurationRepairSections({ script: narrowRecoveryScript, plan: plan960, duration: getCreatorScriptDurationContractForScript(narrowRecoveryScript, "en") });
const allWrongDirectionCandidates = narrowRecoveryTargets.map((budget) => {
  const index = plan960.findIndex((section) => section.id === budget.id);
  return { ...narrowRecoveryScript.sections[index], text: words(Math.max(1, narrowRecoveryCounts[index] - 1)) };
});
assert.equal(filterCreatorScriptRepairReplacements({ script: narrowRecoveryScript, plan: plan960, replacements: allWrongDirectionCandidates }).length, 0);
assert.equal(getCreatorScriptDurationContractForScript(narrowRecoveryScript, "en").actualWordCount, 1981, "zero accepted replacements cannot change canonical duration");
let narrowRecoveryCalls = 0;
const narrowRecovery = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => narrowRecoveryScript,
  maxRepairAttempts: 2,
  shouldRetryRepair: ({ previous, current }) => creatorScriptRepairMateriallyImproved({ previous, current }),
  repair: async (script, _duration, attempt) => {
    narrowRecoveryCalls += 1;
    const nextCounts = attempt === 1
      ? [169, 278, 266, 256, 292, 269, 270, 190]
      : plan960.map((budget) => budget.targetWords);
    return mergeCreatorScriptReplacementSections({
      script,
      plan: plan960,
      replacements: plan960.map((budget, index) => ({ ...script.sections[index], text: words(nextCounts[index]) })),
    });
  },
  validateFinal: (script) => assertCreatorScriptHasSafeSectionStructure(script, plan960),
});
assert.equal(narrowRecoveryCalls, 2, "a 1981 to 1990 partial repair uses exactly one bounded retry");
assert.equal(narrowRecovery.diagnostics.status, "compliant");
assert.ok(plan960.every((section) => section.ownershipBoundary.usage === "control_only_never_narrate"), "duration recovery does not alter narrative ownership authority");

const sentenceText = (count, terminal = "The final question remains open?") => {
  const suffix = `Added context stays grounded. ${terminal}`;
  return `${words(Math.max(1, count - countCreatorScriptWords(suffix)))}. ${suffix}`;
};
const additiveHistoricalCounts = [166, 273, 257, 236, 300, 252, 257, 153];
const additiveHistoricalScript = createCreatorScript({
  ...makePlannedScript(plan960),
  sections: plan960.map((budget, index) => ({
    ...makePlannedScript(plan960).sections[index],
    text: sentenceText(additiveHistoricalCounts[index], budget.kind === "conclusion" ? "What remains when certainty is gone?" : "The next question remains open?"),
  })),
});
const additiveHistoricalDuration = getCreatorScriptDurationContractForScript(additiveHistoricalScript, "en");
assert.equal(additiveHistoricalDuration.actualWordCount, 1894);
const additiveTargets = createCreatorScriptAdditiveExpansionPlan({
  script: additiveHistoricalScript,
  plan: plan960,
  globalDeficitWords: additiveHistoricalDuration.minimumAcceptableWordCount - additiveHistoricalDuration.actualWordCount,
});
assert.equal(additiveTargets.reduce((sum, target) => sum + target.requestedGainWords, 0), 137, "allocator requests only the exact global deficit");
assert.ok(additiveTargets.every((target) => target.sectionId.startsWith("section-")), "body capacity is preferred before opening or conclusion");
assert.ok(additiveTargets.every((target) => target.requestedGainWords <= target.maxAdditionalWords));
const remainingTargets = createCreatorScriptAdditiveExpansionPlan({ script: additiveHistoricalScript, plan: plan960, globalDeficitWords: 41 });
assert.equal(remainingTargets.reduce((sum, target) => sum + target.requestedGainWords, 0), 41, "attempt two recomputes and allocates only the remaining deficit");
const conclusionSection = additiveHistoricalScript.sections.at(-1);
assert.deepEqual(createCreatorScriptInsertionAnchors(conclusionSection).map(({ id, placementMode }) => ({ id, placementMode })), [{ id: "before_terminal_sentence", placementMode: "server_exact_offset" }]);
const additiveApplied = applyCreatorScriptAdditiveExpansion({ section: conclusionSection, placementAnchorId: "before_terminal_sentence", additionalText: "Identity remains a grounded interpretation of remembered experience." });
assert.ok(additiveApplied.text.endsWith("What remains when certainty is gone?"), "conclusion's unresolved final question remains terminal");
assert.equal(`${additiveApplied.text.slice(0, additiveApplied.insertion.start)}${additiveApplied.text.slice(additiveApplied.insertion.end)}`, conclusionSection.text, "removing the inserted addition reconstructs the exact immutable section");
assert.throws(() => applyCreatorScriptAdditiveExpansion({ section: conclusionSection, placementAnchorId: "invented-anchor", additionalText: "Grounded addition." }), /CREATOR_SCRIPT_EXPANSION_ANCHOR_INVALID/);
assert.throws(() => applyCreatorScriptAdditiveExpansion({ section: { ...conclusionSection, text: "One sentence only" }, placementAnchorId: "before_terminal_sentence", additionalText: "Grounded addition." }), /CREATOR_SCRIPT_EXPANSION_ANCHOR_INVALID/);
const unsafeAdditiveApplied = applyCreatorScriptAdditiveExpansion({ section: additiveHistoricalScript.sections[1], placementAnchorId: "before_terminal_sentence", additionalText: "The working inquiry practice behind this exploration supports careful claims analysis." });
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-1", text: unsafeAdditiveApplied.text }], authoritativeText: "memory evidence recall identity" }), /NARRATION_EDITORIAL_LEAKAGE/, "unsafe additional narration is rejected after deterministic insertion");
const groundingBlockedAdditiveBase = createCreatorScript({
  ...additiveHistoricalScript,
  sections: additiveHistoricalScript.sections.map((section, index) => index === 1 ? { ...section, evidenceReviewRequired: true } : section),
});
assert.equal(creatorScriptHasGroundingBlocker(groundingBlockedAdditiveBase), true, "grounding failure blocks an additive base");

scriptCalls = 0;
const residualRepaired = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => { scriptCalls += plan960.length; return modestShortScript; },
  repair: async (script, currentDuration) => {
    assert.equal(isCreatorScriptResidualRepairEligible(currentDuration), true);
    scriptCalls += 1;
    return mergeCreatorScriptReplacementSections({
      script,
      plan: plan960,
      replacements: plan960.map((budget) => ({ id: budget.id, kind: budget.kind, heading: budget.role, text: words(budget.targetWords), claimIds: [], evidenceReviewRequired: false })),
    });
  },
  validateFinal: (script) => { assertCreatorScriptSatisfiesSectionBudgets(script, plan960); },
});
assert.equal(residualRepaired.repaired, true);
assert.equal(scriptCalls, plan960.length + 1);

scriptCalls = 0;
const firstPass = await generateCreatorScriptWithDurationContract({ durationSec: 960, language: "en", generateInitial: async () => { scriptCalls += 1; return makePlannedScript(plan960); }, repair: async () => { scriptCalls += 1; return makePlannedScript(plan960); }, requiresRepair: (script) => { try { assertCreatorScriptSatisfiesSectionBudgets(script, plan960); return false; } catch { return true; } }, validateFinal: (script) => { assertCreatorScriptSatisfiesSectionBudgets(script, plan960); } });
assert.equal(firstPass.repaired, false);
assert.equal(scriptCalls, 1);

scriptCalls = 0;
const compressed = await generateCreatorScriptWithDurationContract({ durationSec: 960, language: "en", generateInitial: async () => { scriptCalls += 1; return makePlannedScript(plan960, 1.2); }, repair: async (script) => { scriptCalls += 1; return mergeCreatorScriptReplacementSections({ script, plan: plan960, replacements: plan960.map((budget) => ({ id: budget.id, kind: budget.kind, heading: budget.role, text: words(budget.targetWords), claimIds: [], evidenceReviewRequired: false })) }); }, validateFinal: (script) => { assertCreatorScriptSatisfiesSectionBudgets(script, plan960); } });
assert.equal(compressed.repaired, true);
assert.equal(scriptCalls, 2);

const namedAuthorityContext = {
  ...context,
  editorialConstitution: "THYNEL's internal editorial method preserves evidence and uncertainty.",
  claims: [{ claimId: "claim-authority", claimType: "THEORY", text: "Reconstructive Memory Theory describes recall as reconstructive.", supportingEvidenceIds: ["evidence-authority"], counterEvidenceIds: [], contextualEvidenceIds: [] }],
  evidence: [{ evidenceId: "evidence-authority", sourceId: "source-authority", excerpt: "Reconstructive Memory Theory is discussed in the source.", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }],
  sources: [{ sourceId: "source-authority", title: "Reconstructive Memory Theory", url: "https://example.test/authority", publisher: "Evidence Press", author: "A. Researcher", publishedAt: null, directness: "secondary", reviewStatus: "usable", searchLane: "supporting_evidence", sourceKind: "article" }],
};
const narrationAuthority = createCreatorScriptNarrationAuthority({ editorialContext: namedAuthorityContext, creatorProvidedText: ["Use the Narrative Identity Framework supplied by the creator."] });
assert.equal(narrationAuthority.includes("internal editorial method"), false, "internal editorial constitution is control context, not narration authority");
const controlOnlySourceContext = {
  ...namedAuthorityContext,
  editorialConstitution: "Use the practical inquiry approach to examine claims before drawing conclusions.",
  claims: [
    ...namedAuthorityContext.claims,
    { claimId: "claim-control-only", claimType: "EDITORIAL_INFERENCE", text: "Inquiry should not transfer judgment to new authorities.", supportingEvidenceIds: ["evidence-control-only"], counterEvidenceIds: [], contextualEvidenceIds: [] },
  ],
  evidence: [
    ...namedAuthorityContext.evidence,
    { evidenceId: "evidence-control-only", sourceId: "source-control-only", excerpt: "A working inquiry practice examines claims and evidence before drawing conclusions.", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } },
  ],
  sources: [
    namedAuthorityContext.sources[0],
    { ...namedAuthorityContext.sources[0], sourceId: "source-control-only", url: "https://thnkfirst.com/applied-inquiry", title: "THNK Research Applied Inquiry Approach", publisher: "THNK First", author: "Editorial Methods Team" },
  ],
};
const projectedNarrationContext = createCreatorScriptNarrationEditorialContext(controlOnlySourceContext);
assert.equal(projectedNarrationContext.editorialConstitution.includes("practical inquiry"), false, "control-only editorial methodology prose is absent from the narration-facing context");
assert.deepEqual(projectedNarrationContext.sources, [{ sourceId: "source-authority", title: "Grounding source", url: "", publisher: "", author: null, publishedAt: null, directness: "secondary", reviewStatus: "usable", searchLane: "supporting_evidence", sourceKind: "article" }], "source identity remains provenance-only and cannot seed editorial-methodology narration");
assert.deepEqual(projectedNarrationContext.claims.map((claim) => claim.claimId), ["claim-authority"], "control-only methodology claims are excluded from narration authority");
assert.deepEqual(projectedNarrationContext.evidence.map((item) => item.evidenceId), ["evidence-authority"], "control-only methodology evidence is excluded from narration authority");
const controlOnlyAuthority = createCreatorScriptNarrationAuthority({ editorialContext: controlOnlySourceContext });
assert.equal(controlOnlyAuthority.includes("applied inquiry"), false, "control-only source identity is not promoted into speakable authority");
assert.equal(controlOnlyAuthority.includes("transfer judgment"), false, "control-only claim prose is not promoted into speakable authority");
assert.equal(controlOnlyAuthority.includes("working inquiry practice"), false, "control-only evidence prose is not promoted into speakable authority");
assert.equal(controlOnlyAuthority.includes("reconstructive memory theory"), true, "a subject-matter methodology grounded in claims and evidence remains speakable");
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "opening", text: "THYNEL's mission invites viewers to reflect." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-1", text: "THNK Research establishes a proprietary explanation." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-1", text: "THNK Research establishes a proprietary explanation." }], authoritativeText: `${narrationAuthority} thnk research` }), /NARRATION_EDITORIAL_LEAKAGE/, "known invalid internal artifacts cannot become speakable merely by appearing in broad authority text");
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "opening", text: "This inquiry does not seek to provide simple answers but to explore the evidence." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-1", text: "The working inquiry practice behind this exploration supports careful examination of claims, evidence, and uncertainty before drawing conclusions about what memory truly represents." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-2", text: "This understanding aligns with the principle that inquiry should not transfer judgment to new authorities but allow individuals to inspect the basis of claims about memory and truth." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "opening", text: "This inquiry asks us to reconsider what memory means." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "opening", text: "This investigation reveals a tension between certainty and evidence." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.doesNotThrow(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-3", text: "A historical inquiry into the archive documented conflicting accounts. The investigation by prosecutors remained open for years, while later analysis of the records identified missing testimony." }], authoritativeText: narrationAuthority }), "inquiry, investigation, and analysis remain available as substantive subject nouns");
assert.doesNotThrow(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-3", text: "The evidence supports the claim that repeated suggestion can alter later recall, while the analysis leaves the mechanism's limits unresolved." }], authoritativeText: narrationAuthority }), "ordinary subject-matter evidence and claim language remains available");
assert.doesNotThrow(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "opening", text: "A memory can feel certain even when its details have changed. What happens to identity when certainty is not accuracy?" }], authoritativeText: narrationAuthority }), "direct audience-facing opening tension remains allowed");
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "conclusion", text: "Our exploration reveals that memory remains uncertain." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "opening", text: "We will investigate how memory changes over time." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-1", text: "In this section, we examine how memory changes over time." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "opening", text: "This documentary explores how memory changes over time." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "opening", text: "In this video, we will investigate how memory changes over time." }], authoritativeText: narrationAuthority }), /NARRATION_EDITORIAL_LEAKAGE/);
assert.doesNotThrow(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-1", text: "The documentary The Memory Illusion examines testimony through archival interviews. A legal document can preserve a claim without proving that memory is exact." }], authoritativeText: narrationAuthority }), "documentaries, videos, and documents that are the subject are legitimate narration nouns");
const selfReferenceDiagnostic = getCreatorScriptNarrationSafetyViolations({ sections: [{ id: "opening", text: "Memory changes. This documentary explores why." }], authoritativeText: narrationAuthority });
assert.deepEqual(selfReferenceDiagnostic.map(({ marker, matchText, matchStart, matchEnd }) => ({ marker, matchText, matchStart, matchEnd })), [{ marker: "production_self_reference", matchText: "This documentary explores", matchStart: 16, matchEnd: 41 }], "narration diagnostics identify the short exact matching span without logging the full script");
assert.throws(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-1", text: "The Quantum Recall Methodology explains the effect." }], authoritativeText: narrationAuthority }), /UNSUPPORTED_NAMED_AUTHORITY/);
assert.doesNotThrow(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-1", text: "Reconstructive Memory Theory describes recall as reconstructive." }, { id: "section-2", text: "The Narrative Identity Framework connects memory and identity." }], authoritativeText: narrationAuthority }), "grounded and creator-provided named concepts remain allowed");
assert.deepEqual(getCreatorScriptNarrationSafetyViolations({ sections: [{ id: "section-1", text: "Ordinary memory research examines recall without naming a proprietary system." }], authoritativeText: narrationAuthority }), [], "generic explanatory language is not treated as named authority");
assert.doesNotThrow(() => assertCreatorScriptNarrationIsProductionSafe({
  sections: [{
    id: "section-1",
    text: "This approach focuses on how recall changes over time. The method compares what people remember across repeated interviews. The purpose is to understand how reconstruction affects autobiographical memory.",
  }],
  authoritativeText: narrationAuthority,
}), "ordinary audience-facing narration using approach, method, or purpose must not be misclassified as editorial leakage");
assert.doesNotThrow(() => assertCreatorScriptNarrationIsProductionSafe({ sections: [{ id: "section-1", text: "This perspective treats evidence carefully while leaving the inquiry open to revision." }], authoritativeText: narrationAuthority }), "ordinary substantive uses of perspective, evidence, and inquiry remain available");
assert.deepEqual(CREATOR_SCRIPT_GENERATION_PRIORITY_HIERARCHY.slice(0, 3), ["Immutable creator constraints", "Grounding, source, and evidence authority", "Audience-facing narration contract"]);
assert.ok(CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT.some((rule) => /editorial method|production process/u.test(rule)));
assert.ok(
  CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT.some((rule) =>
    /we will explore|we will investigate|content plan|production intent/u.test(rule)
  ),
  "audience narrator contract must explicitly forbid announcing the content plan",
);

const route = await readFile(new URL("../app/api/creator-script-plan/route.ts", import.meta.url), "utf8");
assert.match(route, /sectionBudgetPlan/);
assert.match(route, /editorialSectionPlan/);
assert.match(route, /centralQuestion/);
assert.match(route, /progressionFromPrevious/);
assert.match(route, /ownershipBoundary/);
assert.match(route, /ownershipBoundary is control-only metadata/);
assert.match(route, /getCreatorScriptEditorialDistinctivenessFailures/);
assert.match(route, /differentiate_sections/);
assert.match(route, /The same thesis with different wording is invalid/);
assert.match(route, /counterview section must seriously test the master thesis/);
assert.match(route, /creator_full_script_section/);
assert.doesNotMatch(route, /long_form_batch|MAX_INITIAL_GENERATION_CALLS|splitCreatorScriptSectionPlan/);
assert.match(route, /max_output_tokens: getCreatorScriptOutputTokenBudget/);
assert.match(route, /sectionWordBudget: sectionNative \? \{\s*minWords: requestedSections\[0\]\.minimumWords,\s*targetWords: requestedSections\[0\]\.targetWords,\s*maxWords: requestedSections\[0\]\.maximumWords/);
assert.match(route, /Write this complete section between \$\{requestedSections\[0\]\.minimumWords\} and \$\{requestedSections\[0\]\.maximumWords\} words, aiming near \$\{requestedSections\[0\]\.targetWords\} words/);
assert.match(route, /This call returns one section only\. Do not try to fit the complete script's global word count into this section/);
assert.match(route, /requiresRepair: \(script\) =>[\s\S]*getCreatorScriptMaterialSectionFailures/);
assert.match(route, /maxRepairAttempts: sectionNative \? 2 : 1/);
assert.match(route, /creatorScriptRepairMateriallyImproved/);
assert.match(route, /repairTargets/);
assert.match(route, /requiredDirection === "expand"[\s\S]*creatorScriptHasGroundingBlocker\(currentScript\)[\s\S]*CREATOR_SCRIPT_DURATION_EXPANSION_PLAN/);
assert.match(route, /task: "Return only new grounded narration additions for the supplied immutable safe sections\."/);
assert.match(route, /applyCreatorScriptAdditiveExpansion/);
assert.match(route, /Do not rewrite, summarize, paraphrase, delete, or return existing prose/);
assert.match(route, /acceptedReplacements\.length === 0[\s\S]*repairedSectionIds = Array\.from\(new Set\(\[[\s\S]*acceptedReplacements\.map/);
assert.doesNotMatch(route, /repairedSectionIds = Array\.from\(new Set\(\[[\s\S]{0,160}sectionsToRepair\.map/);
assert.match(route, /requiredFinalMinWords/);
assert.match(route, /Do not pad with repetition, filler, invented examples, unsupported claims, or fabricated evidence/);
assert.match(route, /generationPriorityHierarchy/); assert.match(route, /audienceFacingNarratorContract/); assert.match(route, /internalEditorialGuidance/);
assert.match(route, /assertCreatorScriptNarrationIsProductionSafe/); assert.match(route, /named methodology, framework, study, institution, theory, system, practice/);
assert.match(route, /rebalance_sections/);
assert.match(route, /Rebalance only the supplied failing sections toward their individual target, minimum, and maximum word ranges while preserving the overall script duration envelope\. Do not globally compress or expand\./);
assert.doesNotMatch(route, /Exa|creator-research/);
const createPage = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(createPage, /const creatorScriptIsCurrent = isCreatorScriptCurrentForStrategy/);
assert.match(createPage, /\{creatorScriptIsCurrent && creatorScript && \(/);
console.log("LONG_FORM_GROUNDED_PRODUCTION_ACCEPTANCE=PASS");
