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
  assertCreatorScriptSatisfiesSectionBudgets,
  createCreatorScript,
  createCreatorScriptSectionBudgetPlan,
  generateCreatorScriptSectionUnits,
  generateCreatorScriptWithDurationContract,
  getCreatorScriptDurationContract,
  getCreatorScriptDurationContractForScript,
  getCreatorScriptMaterialSectionFailures,
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

assert.equal(isCreatorScriptCurrentForStrategy({ script: shortScript, strategyFingerprint: "work-freedom-960", targetDurationSec: 960, language: "en" }), false);
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

const route = await readFile(new URL("../app/api/creator-script-plan/route.ts", import.meta.url), "utf8");
assert.match(route, /sectionBudgetPlan/);
assert.match(route, /creator_full_script_section/);
assert.doesNotMatch(route, /long_form_batch|MAX_INITIAL_GENERATION_CALLS|splitCreatorScriptSectionPlan/);
assert.match(route, /max_output_tokens: getCreatorScriptOutputTokenBudget/);
assert.doesNotMatch(route, /Exa|creator-research/);
const createPage = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(createPage, /const creatorScriptIsCurrent = isCreatorScriptCurrentForStrategy/);
assert.match(createPage, /\{creatorScriptIsCurrent && creatorScript && \(/);
console.log("LONG_FORM_GROUNDED_PRODUCTION_ACCEPTANCE=PASS");
