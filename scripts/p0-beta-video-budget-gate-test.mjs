import assert from "node:assert/strict";
import {
  checkBetaVideoBudgetDispatch as check,
} from "../lib/economics/betaVideoBudgetGate.ts";

const input = {
  ownerUserId: "00000000-0000-4000-8000-000000000002",
  projectId: "project-a",
  sceneId: "scene-1",
  provider: "runway",
  model: "gen4_turbo",
  billedSeconds: 5,
  idempotencyKey: "request-1",
  verifiedCostUpperBoundUsd: null,
};

let calls = 0;
const fakeRpc = async () => {
  calls++;
  return { data: "RESERVED", error: null };
};

const missingCeiling = await check(input, fakeRpc);
assert.equal(missingCeiling.dispatchAuthorized, false);
assert.equal(missingCeiling.reason, "COST_CEILING_UNVERIFIED");

const inactive = await check({
  ...input,
  verifiedCostUpperBoundUsd: 2,
}, fakeRpc);

assert.equal(inactive.dispatchAuthorized, false);
assert.equal(inactive.reason, "DISPATCH_PROTOCOL_NOT_ACTIVE");
assert.equal(calls, 0);

console.log("PASS: UNVERIFIED_COST_NO_RPC");
console.log("PASS: INACTIVE_DISPATCH_NO_BUDGET_HOLD");
console.log("P0_VIDEO_BUDGET_GATE=PASS");
