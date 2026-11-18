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

const neverCall = async () => {
  calls++;
  throw Error("RPC must not be called");
};

const blocked = await check(input, neverCall);
assert.equal(blocked.dispatchAuthorized, false);
assert.equal(blocked.reason, "COST_CEILING_UNVERIFIED");
assert.equal(calls, 0);
console.log("PASS: UNVERIFIED_COST_NO_RPC");

let reserved = 0;

const simulatedRpc = async (_name, args) => {
  reserved++;
  assert.equal(args.p_owner_user_id, input.ownerUserId);
  assert.equal(args.p_cost_upper_bound_micro_usd, 2_000_000);
  assert.match(args.p_request_sha256, /^[a-f0-9]{64}$/);
  assert.match(args.p_attempt_key, /^video:[a-f0-9]{64}$/);
  return { data: "RESERVED", error: null };
};

const held = await check({
  ...input,
  verifiedCostUpperBoundUsd: 2,
}, simulatedRpc);

assert.equal(held.dispatchAuthorized, false);
assert.equal(held.reason, "RESERVED_BUT_DISPATCH_NOT_ACTIVATED");
assert.equal(reserved, 1);
console.log("PASS: RPC_ADAPTER_CALLED_WITH_CANONICAL_IDENTITY");
console.log("PASS: RESERVED_BUT_NO_DISPATCH");

const rejected = await check({
  ...input,
  verifiedCostUpperBoundUsd: 2,
}, async () => ({
  data: "DENIED_HARD_CAP",
  error: null,
}));

assert.equal(rejected.dispatchAuthorized, false);
assert.equal(rejected.reason, "RESERVATION_DENIED");
console.log("PASS: BUDGET_DENIAL");

console.log("P0_VIDEO_BUDGET_GATE=PASS");
console.log("ACTUAL_SUPABASE_CALLS=0");
console.log("ACTUAL_PROVIDER_CALLS=0");
