import assert from "node:assert/strict";
import {
  executeBetaVideoBudgetedStart as execute,
} from "../lib/economics/betaVideoBudgetDispatch.ts";

const input = {
  ownerUserId: "00000000-0000-4000-8000-000000000002",
  projectId: "project-a",
  sceneId: "scene-1",
  provider: "runway",
  model: "gen4_turbo",
  billedSeconds: 5,
  idempotencyKey: "request-1",
  verifiedCostUpperBoundUsd: 2,
};

let rpcCalls = 0;
let providerCalls = 0;

const rpc = async () => {
  rpcCalls++;
  return { data: "RESERVED", error: null };
};

const provider = async () => {
  providerCalls++;
  return { nativeTaskId: "fake-task-1" };
};

const inactive = await execute(input, rpc, provider);

assert.equal(inactive.state, "BLOCKED");
assert.equal(inactive.reason, "DISPATCH_PROTOCOL_NOT_ACTIVE");
assert.equal(rpcCalls, 0);
assert.equal(providerCalls, 0);
console.log("PASS: INACTIVE_PROTOCOL_NO_HOLD_NO_DISPATCH");

const unknownCost = await execute(
  { ...input, verifiedCostUpperBoundUsd: null },
  rpc,
  provider,
);

assert.equal(unknownCost.state, "BLOCKED");
assert.equal(unknownCost.reason, "COST_CEILING_UNVERIFIED");
console.log("PASS: UNKNOWN_COST_FAIL_CLOSED");

const badIdentity = await execute(
  { ...input, idempotencyKey: null },
  rpc,
  provider,
);

assert.equal(badIdentity.state, "BLOCKED");
assert.equal(badIdentity.reason, "INVALID_DISPATCH_IDENTITY");
console.log("PASS: INVALID_IDENTITY_FAIL_CLOSED");

assert.equal(rpcCalls, 0);
assert.equal(providerCalls, 0);

console.log("P0_BUDGETED_DISPATCH_LIFECYCLE=PASS");
console.log("ACTUAL_AND_MOCK_RPC_CALLS=0");
console.log("ACTUAL_AND_MOCK_PROVIDER_CALLS=0");
