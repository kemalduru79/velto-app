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

let reservations = 0;
let dispatches = 0;

const acceptRpc = async (_name, args) => {
  reservations++;
  assert.equal(args.p_cost_upper_bound_micro_usd, 2_000_000);
  return { data: "RESERVED", error: null };
};

const provider = async () => {
  dispatches++;
  return { nativeTaskId: "fake-task-1" };
};

const accepted = await execute(input, acceptRpc, provider);

assert.equal(accepted.state, "ACCEPTED_HELD");
assert.equal(accepted.task.nativeTaskId, "fake-task-1");
assert.match(accepted.attemptKey, /^video:[a-f0-9]{64}$/);
assert.equal(reservations, 1);
assert.equal(dispatches, 1);
console.log("PASS: RESERVE_BEFORE_SINGLE_PROVIDER_DISPATCH");

const denied = await execute(
  input,
  async () => ({ data: "DENIED_HARD_CAP", error: null }),
  provider,
);

assert.equal(denied.state, "BLOCKED");
assert.equal(dispatches, 1);
console.log("PASS: DENIED_BUDGET_PREVENTS_DISPATCH");

const uncertain = await execute(
  input,
  acceptRpc,
  async () => { throw Error("provider timeout"); },
);

assert.equal(uncertain.state, "HELD_UNCERTAIN");
assert.match(uncertain.attemptKey, /^video:[a-f0-9]{64}$/);
console.log("PASS: PROVIDER_TIMEOUT_RETAINS_HOLD");

const noTaskId = await execute(
  input,
  acceptRpc,
  async () => ({ nativeTaskId: "" }),
);

assert.equal(noTaskId.state, "HELD_UNCERTAIN");
console.log("PASS: MISSING_TASK_ID_RETAINS_HOLD");

const before = reservations;
const noCeiling = await execute(
  { ...input, verifiedCostUpperBoundUsd: null },
  acceptRpc,
  provider,
);

assert.equal(noCeiling.state, "BLOCKED");
assert.equal(reservations, before);
assert.equal(dispatches, 1);
console.log("PASS: NO_VERIFIED_CEILING_NO_SIDE_EFFECTS");

console.log("P0_BUDGETED_DISPATCH_LIFECYCLE=PASS");
console.log("REAL_PROVIDER_CALLS=0");
console.log("REAL_SUPABASE_CALLS=0");
