
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  acceptCreatorScriptWithAcceptanceRepair,
  createCreatorScript,
  createCreatorScriptRepairTargets,
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptRepairReplacementDiagnostics,
  getCreatorScriptSectionDiagnostics,
} from "../lib/creator/creatorScript.ts";
import {
  evaluateCreatorScriptAcceptance,
  getCreatorScriptDurationReviewOnlyDraft,
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
