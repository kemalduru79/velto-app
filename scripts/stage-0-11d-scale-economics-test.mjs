import assert from "node:assert/strict";
import {
  CREATOR_CAPACITY_EVIDENCE,
  CREATOR_NORMALIZED_WORKLOADS,
  CREATOR_P90_GROSS_MARGIN_WARNING_FLOOR,
  CREATOR_TARGET_GROSS_MARGIN,
  calculateCreatorScaleWorkload,
  calculateSmallBetaCohort,
  evaluateScaleUpgradePolicy,
} from "../lib/economics/scaleEnvelope.ts";

assert.equal(CREATOR_TARGET_GROSS_MARGIN, 0.65);
assert.equal(CREATOR_P90_GROSS_MARGIN_WARNING_FLOOR, 0.6);

const first = CREATOR_NORMALIZED_WORKLOADS.map(calculateCreatorScaleWorkload);
assert.deepEqual(first, CREATOR_NORMALIZED_WORKLOADS.map(calculateCreatorScaleWorkload), "workload economics are deterministic");
for (const workload of first) {
  assert.equal(workload.evidence, "modeled");
  assert.ok(workload.knownProviderCogs.totalUsd >= 0);
  assert.ok(workload.knownCogsPerProjectUsd >= 0);
  assert.ok(workload.knownCogsPerFinishedMinuteUsd >= 0);
  assert.equal(workload.infrastructureCostUsd, null, "unknown infrastructure cost is not fabricated as zero");
  assert.equal(workload.totalMonthlyCogsUsd, null, "total COGS remains unknown pending infrastructure verification");
  assert.equal(workload.grossMarginProvisional, true);
}
assert.throws(() => calculateCreatorScaleWorkload({ ...CREATOR_NORMALIZED_WORKLOADS[0], projects: -1 }), /INVALID_SCALE_INPUT/);
assert.throws(() => calculateCreatorScaleWorkload({ ...CREATOR_NORMALIZED_WORKLOADS[0], finishedMinutes: 0 }), /INVALID_SCALE_INPUT/);

const cohort = calculateSmallBetaCohort();
assert.equal(cohort.users, 5);
assert.equal(cohort.evidence, "modeled");
assert.equal(cohort.infrastructureCostUsd, null);
assert.equal(cohort.totalMonthlyCogsUsd, null);
assert.ok(cohort.knownProviderCogsUsd >= 0);

assert.equal(CREATOR_CAPACITY_EVIDENCE.syntheticConcurrency10.evidence, "measured");
assert.equal(CREATOR_CAPACITY_EVIDENCE.syntheticConcurrency10.productionClaim, false);
assert.equal(CREATOR_CAPACITY_EVIDENCE.privateUse.evidence, "modeled");
assert.equal(CREATOR_CAPACITY_EVIDENCE.future25.status, "RED");

assert.deepEqual(evaluateScaleUpgradePolicy(), { planUpgradeRequiredNow: false, reasons: [], azureDeferred: true });
assert.equal(evaluateScaleUpgradePolicy({ sustainedAmberNearRed: true }).planUpgradeRequiredNow, true);
assert.equal(evaluateScaleUpgradePolicy({ azureTrigger: true }).azureDeferred, false);
assert.equal(evaluateScaleUpgradePolicy({ betaOrRevenueRequirement: false }).planUpgradeRequiredNow, false, "upgrade requires affirmative evidence");

console.log("STAGE_0_11D_SCALE_ECONOMICS=PASS");
