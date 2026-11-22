import assert from "node:assert/strict";
import {
  createCreatorScript,
  createCreatorScriptSectionBudgetPlan,
  acceptCreatorScriptWithAcceptanceRepair,
} from "../lib/creator/creatorScript.ts";
import {
  evaluateCreatorScriptAcceptance,
} from "../lib/creator/creatorScriptAcceptance.ts";

const words = (n, label) => Array.from({ length: n }, (_, i) => `${label}${i}`).join(" ");
const context = {
  version: "0.10H-2H", sourceVersion: "0.10H-2E",
  editorialConstitution: "Do not invent evidence.",
  readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [],
    primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] },
  claims: [], evidence: [], sources: [],
};
function build(plan, counts, targetDurationSec, blocked = false) {
  assert.equal(plan.length, counts.length);
  return createCreatorScript({
    title: "Bounded quality-first repair test",
    sections: plan.map((section, i) => ({
      id: section.id, kind: section.kind,
      heading: ["Opening Stakes", "Framing Scope", "Mechanism Detail", "Evidence Case", "Nuanced Limits", "Open Implication"][i],
      text: words(counts[i], `n${i}w`), claimIds: [],
      evidenceReviewRequired: blocked && i === 1,
    })),
    targetDurationSec,
    strategyFingerprint: "quality-first-offline-only",
    grounding: { context },
    generatedAt: "2026-11-21T18:30:00Z", updatedAt: "2026-11-21T18:30:00Z",
  });
}
function report(script, plan, optIn) {
  return evaluateCreatorScriptAcceptance({
    script, sectionPlan: plan, language: "en", narrationAuthority: "",
    ...(optIn ? { qualityFirstDurationRepair: true } : {}),
  });
}
const compact = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 180, language: "en" });
assert.deepEqual(compact.map(x => x.id), ["opening", "section-1", "section-2", "conclusion"]);

const observed320 = build(compact, [47, 102, 114, 57], 180);
const legacy = report(observed320, compact, false);
assert.equal(legacy.repairRequired, false, "historical acceptance must remain unchanged");
assert.ok(legacy.blockingViolations.some(x => x.code === "GLOBAL_DURATION_TOO_SHORT"));
const live = report(observed320, compact, true);
assert.equal(live.repairRequired, true, "320-word script should permit bounded repair");
assert.equal(live.blockingViolations.length, 0);
assert.ok(live.repairableViolations.some(x => x.code === "GLOBAL_DURATION_TOO_SHORT"));
assert.deepEqual(live.repairSectionIds, compact.map(x => x.id), "mixed repair must cover body and oversize ends");

const corrected = build(compact, compact.map(x => x.targetWords), 180);
assert.equal(report(corrected, compact, true).accepted, true);
let calls = 0;
const accepted = await acceptCreatorScriptWithAcceptanceRepair({
  firstScript: observed320,
  evaluate: script => report(script, compact, true),
  repair: async () => { calls += 1; return corrected; },
  maxRepairAttempts: 1,
});
assert.equal(calls, 1);
assert.equal(accepted.report.accepted, true);
assert.equal(accepted.repaired, true);

// Repair eligibility must never mean automatic acceptance of an unchanged draft.
await assert.rejects(() => acceptCreatorScriptWithAcceptanceRepair({
  firstScript: observed320,
  evaluate: script => report(script, compact, true),
  repair: async (_, script) => script,
  maxRepairAttempts: 1,
}));

const prior354 = build(compact, [54, 113, 113, 74], 180);
assert.equal(report(prior354, compact, true).repairRequired, true);
assert.ok(report(prior354, compact, true).repairSectionIds.includes("section-1"));

const extremePlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 600, language: "en" });
const extreme = build(extremePlan, extremePlan.map(x => Math.max(1, Math.round(x.targetWords * 0.2))), 600);
const extremeReport = report(extreme, extremePlan, true);
assert.equal(extremeReport.repairRequired, false, "2 min equivalent must not be repaired into 10 min");
assert.ok(extremeReport.blockingViolations.some(x => x.code === "GLOBAL_DURATION_TOO_SHORT"));

const unsafe = build(compact, [47, 102, 114, 57], 180, true);
const unsafeReport = report(unsafe, compact, true);
assert.equal(unsafeReport.repairRequired, false, "grounding block must override duration repair");
assert.ok(unsafeReport.blockingViolations.some(x => x.code === "GROUNDING_BLOCKED"));

console.log("QUALITY_FIRST_REPAIR_PHASE1_OFFLINE=PASS");
