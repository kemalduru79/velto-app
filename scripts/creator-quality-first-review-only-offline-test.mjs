import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createCreatorScript,
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptDurationContractForScript,
} from "../lib/creator/creatorScript.ts";
import {
  evaluateCreatorScriptAcceptance,
  getCreatorScriptDurationReviewOnlyDraft,
} from "../lib/creator/creatorScriptAcceptance.ts";

const words = (n, part) => Array.from({ length: n }, (_, i) => `${part}${i}`).join(" ");
const context = {
  version: "0.10H-2H", sourceVersion: "0.10H-2E",
  editorialConstitution: "Preserve source authority.",
  readiness: { status: "ready", editorialReadinessScore: 100,
    reviewReasons: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] },
  claims: [], evidence: [], sources: [],
};
const plan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 180, language: "en" });
const make = (counts, opts = {}) => createCreatorScript({
  title: "Offline review-only draft",
  sections: plan.map((p, i) => ({
    id: p.id, kind: p.kind,
    heading: ["Opening Stakes", "Definition Limits", "Causal Mechanism", "Open Implication"][i],
    text: words(counts[i], `s${i}w`),
    claimIds: [],
    evidenceReviewRequired: opts.blocked === true && i === 1,
  })),
  targetDurationSec: 180, strategyFingerprint: "review-only-test",
  grounding: { context },
  generatedAt: "2026-11-21T18:30:00Z", updatedAt: "2026-11-21T18:30:00Z",
});
const report = script => evaluateCreatorScriptAcceptance({
  script, sectionPlan: plan, language: "en", narrationAuthority: "",
  qualityFirstDurationRepair: true,
});
const candidate = make([47, 102, 114, 57]);
const candidateReport = report(candidate);
assert.equal(candidateReport.duration.actualWordCount, 320);
assert.equal(candidateReport.accepted, false);
const review = getCreatorScriptDurationReviewOnlyDraft({ script: candidate, report: candidateReport });
assert.ok(review, "bounded, safely grounded duration mismatch should be reviewable");
assert.equal(review.duration.estimatedDurationSec,
  getCreatorScriptDurationContractForScript(candidate, "en").estimatedDurationSec);
assert.equal(review.script, candidate);
assert.equal(review.duration.status, "too_short");
const compliant = make(plan.map(p => p.targetWords));
assert.equal(report(compliant).accepted, true);
assert.equal(getCreatorScriptDurationReviewOnlyDraft({ script: compliant, report: report(compliant) }), null);
const unsafe = make([47, 102, 114, 57], { blocked: true });
assert.equal(getCreatorScriptDurationReviewOnlyDraft({ script: unsafe, report: report(unsafe) }), null);
const extreme = make([5, 10, 10, 5]);
assert.equal(getCreatorScriptDurationReviewOnlyDraft({ script: extreme, report: report(extreme) }), null);
const route = readFileSync("app/api/creator-script-plan/route.ts", "utf8");
const pipeline = readFileSync("lib/research/creatorEditorialPipeline.client.ts", "utf8");
const page = readFileSync("app/create/page.tsx", "utf8");
const production = readFileSync("lib/creator/creatorProductionAuthority.ts", "utf8");
assert.match(route, /getCreatorScriptDurationReviewOnlyDraft/);
assert.match(route, /reviewOnly:\s*true/);
assert.match(pipeline, /reviewOnlyDraft/);
assert.match(page, /data-creator-duration-review-only/);
assert.match(page, /This preview is not saved or approved/);
assert.match(page, /creatorDurationReview\.projectId === currentProjectId/);
assert.match(page, /creatorDurationReview\.strategyFingerprint === creatorStrategyFingerprint/);
assert.match(page, /getCreatorScriptDurationContractForScript\(creatorScript, language\)\.status !== "compliant"/);
assert.match(production, /diagnostics\.status !== "compliant"/);
console.log("QUALITY_FIRST_REVIEW_ONLY_PHASE2_OFFLINE=PASS");
