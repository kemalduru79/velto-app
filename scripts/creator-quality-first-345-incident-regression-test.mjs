
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  acceptCreatorScriptWithAcceptanceRepair,
  createCreatorScript,
  createCreatorScriptRepairTargets,
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptRepairReplacementDiagnostics,
  getCreatorScriptSectionDiagnostics,
  mergeCreatorScriptReplacementSections,
} from "../lib/creator/creatorScript.ts";
import {
  evaluateCreatorScriptAcceptance,
  getCreatorScriptDurationReviewOnlyDraft,
  shouldRetryCreatorScriptAcceptanceRepair,
  planCreatorScriptSectionRebalance,
} from "../lib/creator/creatorScriptAcceptance.ts";

const duration = 180;
const plan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: duration, language: "en" });
assert.deepEqual(plan.map(item => item.id), ["opening", "section-1", "section-2", "conclusion"]);
const words = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");
const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Never fabricate claims or evidence.",
  readiness: {
    status: "ready", editorialReadinessScore: 100, reviewReasons: [],
    primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [],
  },
  claims: [], evidence: [], sources: [],
};

const make = (counts, blocked = false) => createCreatorScript({
  title: "345-word incident: deterministic geometry only",
  targetDurationSec: duration,
  strategyFingerprint: "quality-first-345-offline",
  sections: plan.map((p, i) => ({
    id: p.id, kind: p.kind,
    heading: ["The Human Stakes", "Defining the Boundary", "The Causal Mechanism", "What Remains Open"][i],
    text: words(counts[i], `part${i}word`),
    claimIds: [],
    evidenceReviewRequired: blocked && i === 1,
  })),
  grounding: { context },
  generatedAt: "2026-11-21T21:12:59.000Z",
  updatedAt: "2026-11-21T21:12:59.000Z",
});

const evaluate = (script, qualityFirstDurationRepair = true) =>
  evaluateCreatorScriptAcceptance({
    script, sectionPlan: plan, language: "en", narrationAuthority: "",
    ...(qualityFirstDurationRepair ? { qualityFirstDurationRepair: true } : {}),
  });

// Exact section counts observed in Vercel logs. Synthetic words are *not*
// evidence of editorial quality and must never become production fixtures.
const failed = make([32, 138, 124, 51]);
const report = evaluate(failed);
assert.equal(report.duration.targetWordCount, 423);
assert.equal(report.duration.minimumAcceptableWordCount, 381);
assert.equal(report.duration.actualWordCount, 345);
assert.equal(report.duration.status, "too_short");
assert.equal(report.accepted, false);
assert.equal(report.repairRequired, true);
assert.equal(report.blockingViolations.length, 0);
assert.deepEqual(report.repairSectionIds, ["section-1", "section-2", "conclusion"]);

// The exact model repair counts are still invalid: incremental but insufficient
// expansion does not satisfy per-section safety, and the ending expanded when
// compression was required.
const sections = getCreatorScriptSectionDiagnostics(failed, plan)
  .filter(s => report.repairSectionIds.includes(s.id));
const targets = createCreatorScriptRepairTargets({
  sections, direction: "rebalance_sections",
});
assert.deepEqual(targets.map(t => t.direction), ["expand", "expand", "compress"]);
const offered = [
  { id: "section-1", kind: "body", heading: "Defining the Boundary", text: words(149, "repairedFrame"), claimIds: [] },
  { id: "section-2", kind: "body", heading: "The Causal Mechanism", text: words(140, "repairedMechanism"), claimIds: [] },
  { id: "conclusion", kind: "conclusion", heading: "What Remains Open", text: words(58, "repairedClosing"), claimIds: [] },
];
const diagnostics = getCreatorScriptRepairReplacementDiagnostics({
  script: failed, plan, replacements: offered, targets,
});
assert.deepEqual(
  diagnostics.map(d => ({ id: d.sectionId, accepted: d.accepted, reason: d.reason })),
  [
    { id: "section-1", accepted: false, reason: "insufficient_minimum_gain" },
    { id: "section-2", accepted: false, reason: "insufficient_minimum_gain" },
    { id: "conclusion", accepted: false, reason: "wrong_direction_compress" },
  ],
);

let attempts = 0;
await assert.rejects(
  () => acceptCreatorScriptWithAcceptanceRepair({
    firstScript: failed,
    evaluate,
    maxRepairAttempts: 1,
    repair: async (_report, currentScript) => {
      attempts += 1;
      // Faithful to the failed live outcome: none of the suggested changes
      // passes the section gate, so no canonical script replacement occurs.
      return currentScript;
    },
  }),
  error => error?.code === "CREATOR_SCRIPT_POLICY_UNSATISFIED",
);
assert.equal(attempts, 1, "failed repair must not trigger uncontrolled provider retries");

// The 319-word mixed repair retains both valid body replacements and retries
// only the overlong conclusion, without dispatching any real provider call.
const incident = make([33, 119, 111, 56]);
const firstReport = evaluate(incident);
assert.equal(firstReport.duration.actualWordCount, 319);
const firstTargets = createCreatorScriptRepairTargets({ sections: getCreatorScriptSectionDiagnostics(incident, plan).filter(s => firstReport.repairSectionIds.includes(s.id)), direction: "rebalance_sections" });
const firstReplacements = [
  { id: "section-1", kind: "body", heading: "Defining the Boundary", text: words(162, "newBody1"), claimIds: [] },
  { id: "section-2", kind: "body", heading: "The Causal Mechanism", text: words(158, "newBody2"), claimIds: [] },
  { id: "conclusion", kind: "conclusion", heading: "What Remains Open", text: words(65, "badEnding"), claimIds: [] },
];
const firstChecks = getCreatorScriptRepairReplacementDiagnostics({ script: incident, plan, replacements: firstReplacements, targets: firstTargets });
assert.deepEqual(firstChecks.map(x => [x.sectionId, x.accepted]), [["section-1", true], ["section-2", true], ["conclusion", false]]);
assert.equal(firstChecks[2].reason, "wrong_direction_compress");
const firstCandidate = mergeCreatorScriptReplacementSections({ script: incident, plan, replacements: firstChecks.filter(x => x.accepted).map(x => x.replacement) });
const residual = evaluate(firstCandidate);
assert.equal(residual.duration.actualWordCount, 409);
assert.deepEqual(residual.repairSectionIds, ["conclusion"]);
assert.equal(shouldRetryCreatorScriptAcceptanceRepair({ previous: firstReport, current: residual, sectionNative: false, mixedRepairDispatched: true }), true);
const residualTargets = createCreatorScriptRepairTargets({ sections: residual.sections.filter(s => residual.repairSectionIds.includes(s.id)), direction: "rebalance_sections" });
assert.deepEqual(residualTargets.map(t => [t.sectionId, t.direction, t.requiredFinalMinWords, t.requiredFinalTargetWords, t.requiredFinalMaxWords]), [["conclusion", "compress", 39, 44, 49]]);
const runIncident = async endingWords => {
  const calls = [];
  const result = acceptCreatorScriptWithAcceptanceRepair({
    firstScript: incident, evaluate, maxRepairAttempts: 2,
    shouldRetryRepair: ({ previous, current }) => shouldRetryCreatorScriptAcceptanceRepair({ previous, current, sectionNative: false, mixedRepairDispatched: true }),
    repair: async (currentReport, currentScript, attempt) => {
      calls.push([...currentReport.repairSectionIds]);
      if (attempt === 1) return firstCandidate;
      const candidate = { id: "conclusion", kind: "conclusion", heading: "What Remains Open", text: words(endingWords, "finalEnding"), claimIds: [] };
      const checks = getCreatorScriptRepairReplacementDiagnostics({ script: currentScript, plan, replacements: [candidate], targets: residualTargets });
      const replacements = checks.filter(x => x.accepted).map(x => x.replacement);
      return replacements.length ? mergeCreatorScriptReplacementSections({ script: currentScript, plan, replacements }) : currentScript;
    },
  });
  return { result, calls };
};
const successful = await runIncident(44);
const accepted319 = await successful.result;
assert.equal(accepted319.report.accepted, true);
assert.deepEqual(successful.calls, [["section-1", "section-2", "conclusion"], ["conclusion"]]);
assert.deepEqual(accepted319.creatorScript.sections.slice(0, 3), firstCandidate.sections.slice(0, 3));
for (const endingWords of [65, 50, 38]) {
  const invalid = await runIncident(endingWords);
  await assert.rejects(invalid.result, error => error?.code === "CREATOR_SCRIPT_POLICY_UNSATISFIED");
  assert.equal(invalid.calls.length, 2);
}

// Case B: plan compensation before compression, preserving the opening.
const incident384 = make([36, 152, 124, 72]);
const report384 = evaluate(incident384);
assert.equal(report384.duration.actualWordCount, 384);
assert.deepEqual(report384.repairSectionIds, ["conclusion"]);
const rebalance384 = planCreatorScriptSectionRebalance(report384);
assert.deepEqual(rebalance384, { compensationSectionIds: ["section-2"], shortfallWords: 25, feasible: true });
const ids384 = new Set([...report384.repairSectionIds, ...rebalance384.compensationSectionIds]);
const targets384 = createCreatorScriptRepairTargets({ sections: report384.sections.filter(s => ids384.has(s.id)), direction: "rebalance_sections" });
assert.deepEqual(targets384.map(t => [t.sectionId, t.direction]), [["section-2", "expand"], ["conclusion", "compress"]]);
assert.deepEqual(targets384.filter(t => t.sectionId === "conclusion").map(t => [t.requiredFinalMinWords, t.requiredFinalTargetWords, t.requiredFinalMaxWords]), [[39, 44, 49]]);
const compress = n => ({ id: "conclusion", kind: "conclusion", heading: "What Remains Open", text: words(n, "compact"), claimIds: [] });
const partial = getCreatorScriptRepairReplacementDiagnostics({ script: incident384, plan, replacements: [compress(62)], targets: targets384 });
assert.equal(partial[0].reason, "insufficient_minimum_reduction");
assert.equal(partial[0].accepted, false);
assert.equal(shouldRetryCreatorScriptAcceptanceRepair({ previous: report384, current: report384, sectionNative: false, mixedRepairDispatched: false, incompleteCompressionSectionIds: ["conclusion"] }), true);
assert.equal(shouldRetryCreatorScriptAcceptanceRepair({ previous: report384, current: report384, sectionNative: false, mixedRepairDispatched: false }), false);
const expand384 = { id: "section-2", kind: "body", heading: "The Causal Mechanism", text: words(155, "groundedExpansion"), claimIds: [] };
const coordinated = getCreatorScriptRepairReplacementDiagnostics({ script: incident384, plan, replacements: [expand384, compress(44)], targets: targets384 });
assert(coordinated.every(x => x.accepted));
const balanced = mergeCreatorScriptReplacementSections({ script: incident384, plan, replacements: coordinated.map(x => x.replacement) });
assert.equal(evaluate(balanced).duration.actualWordCount, 387);
assert.equal(evaluate(balanced).accepted, true);
assert.deepEqual(balanced.sections.slice(0, 2), incident384.sections.slice(0, 2));
const shortCandidate = mergeCreatorScriptReplacementSections({ script: incident384, plan, replacements: [compress(44)] });
assert.equal(evaluate(shortCandidate).accepted, false);
assert.equal(evaluate(shortCandidate).duration.status, "too_short");
const test384 = async (endingWords, expansionAllowed = true) => {
  const calls = [];
  let evaluations = 0;
  let incompleteCompressionSectionIds = [];
  const promise = acceptCreatorScriptWithAcceptanceRepair({
    firstScript: incident384, maxRepairAttempts: 2,
    evaluate: script => { evaluations++; return evaluate(script); },
    shouldRetryRepair: ({ previous, current }) => shouldRetryCreatorScriptAcceptanceRepair({ previous, current, sectionNative: false, mixedRepairDispatched: false, incompleteCompressionSectionIds }),
    repair: async (report, current, attempt) => {
      const reservation = planCreatorScriptSectionRebalance(report);
      const selectedIds = new Set([...report.repairSectionIds, ...reservation.compensationSectionIds]);
      calls.push(plan.filter(s => selectedIds.has(s.id)).map(s => s.id));
      assert.equal(current.sections[3].text, incident384.sections[3].text, "unaccepted conclusion must never replace canonical text");
      const activeTargets = createCreatorScriptRepairTargets({ sections: report.sections.filter(s => selectedIds.has(s.id)), direction: "rebalance_sections" });
      const proposed = attempt === 1 && expansionAllowed ? [expand384, compress(62)] : [compress(attempt === 1 ? 62 : endingWords)];
      const checks = getCreatorScriptRepairReplacementDiagnostics({ script: current, plan, replacements: proposed, targets: activeTargets });
      incompleteCompressionSectionIds = checks.filter(x => x.reason === "insufficient_minimum_reduction" && x.candidateWords < x.beforeWords).map(x => x.sectionId);
      const valid = checks.filter(x => x.accepted).map(x => x.replacement);
      return valid.length ? mergeCreatorScriptReplacementSections({ script: current, plan, replacements: valid }) : current;
    },
  });
  return { promise, calls, evaluationCount: () => evaluations };
};
const fixed384 = await test384(44);
const result384 = await fixed384.promise;
assert.equal(result384.report.accepted, true);
assert.equal(result384.report.duration.actualWordCount, 387);
assert.deepEqual(fixed384.calls, [["section-2", "conclusion"], ["conclusion"]]);
assert.equal(fixed384.evaluationCount(), 3);
const failed384 = await test384(55);
await assert.rejects(failed384.promise, error => error?.code === "CREATOR_SCRIPT_POLICY_UNSATISFIED");
assert.equal(failed384.calls.length, 2);
const insufficient = await test384(44, false);
await assert.rejects(insufficient.promise, error => error?.code === "CREATOR_SCRIPT_POLICY_UNSATISFIED");
assert.equal(insufficient.calls.length, 2);
const noBodyCapacity = planCreatorScriptSectionRebalance(evaluate(make([21, 155, 155, 72])));
assert.equal(noBodyCapacity.feasible, false);
assert.equal(noBodyCapacity.shortfallWords, 6);
const unsafe384 = evaluate(make([36, 152, 124, 72], true));
assert.equal(unsafe384.repairRequired, false, "grounding blockers must still veto repair");
let compliantRepairCalls = 0;
const firstPassCompliant = await acceptCreatorScriptWithAcceptanceRepair({ firstScript: make(plan.map(s => s.targetWords)), evaluate, maxRepairAttempts: 2, repair: async (_report, current) => { compliantRepairCalls++; return current; } });
assert.equal(firstPassCompliant.report.accepted, true);
assert.equal(compliantRepairCalls, 0);

const preview = getCreatorScriptDurationReviewOnlyDraft({ script: failed, report });
assert.ok(preview, "grounded moderate mismatch remains available for review");
assert.equal(preview.script, failed, "review-only must preserve the original script");
assert.equal(preview.duration.actualWordCount, 345);
assert.equal(report.accepted, false, "review-only is not acceptance");

// Unsafe and extreme underduration never obtain the preview escape hatch.
const unsafe = make([32, 138, 124, 51], true);
assert.equal(
  getCreatorScriptDurationReviewOnlyDraft({ script: unsafe, report: evaluate(unsafe) }),
  null,
);
const extreme = make([4, 8, 8, 4]);
assert.equal(
  getCreatorScriptDurationReviewOnlyDraft({ script: extreme, report: evaluate(extreme) }),
  null,
);
const corrected = make(plan.map(s => s.targetWords));
const correctedReport = evaluate(corrected);
assert.equal(correctedReport.accepted, true);
assert.equal(
  getCreatorScriptDurationReviewOnlyDraft({ script: corrected, report: correctedReport }),
  null,
);

// End-to-end runtime is not claimed; assert static guards remain in place.
const route = readFileSync("app/api/creator-script-plan/route.ts", "utf8");
const page = readFileSync("app/create/page.tsx", "utf8");
const production = readFileSync("lib/creator/creatorProductionAuthority.ts", "utf8");
assert.match(route, /qualityFirstDurationRepair:\s*true/);
assert.match(route, /getCreatorScriptDurationReviewOnlyDraft/);
assert.match(route, /repairCallCount/);
assert.match(page, /data-creator-duration-review-only/);
assert.match(page, /This preview is not saved or approved/);
assert.match(production, /diagnostics\.status !== "compliant"/);

console.log("QUALITY_FIRST_345_REAL_INCIDENT_REGRESSION=PASS");
console.log("PRODUCTION_ACCEPTANCE_STILL_BLOCKED=YES");
console.log("REVIEW_ONLY_PRESERVED=YES");
console.log("PAID_PROVIDER_CALLS=0");
