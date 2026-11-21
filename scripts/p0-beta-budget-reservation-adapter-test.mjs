import assert from "node:assert/strict";
import {
  BETA_BUDGET_RPC,
  requestBetaBudgetReservation as reserve,
} from "../lib/economics/betaBudgetReservationAdapter.ts";

const base = {
  ownerUserId: "00000000-0000-4000-8000-000000000002",
  attemptKey: "op:1",
  requestSha256: "a".repeat(64),
  upperBoundCostUsd: 2,
};

let rpcCalls = 0;
const rpc = async (name, args) => {
  rpcCalls++;
  assert.equal(name, BETA_BUDGET_RPC);
  assert.deepEqual(args, {
    p_owner_user_id: base.ownerUserId,
    p_attempt_key: "op:1",
    p_request_sha256: base.requestSha256,
    p_cost_upper_bound_micro_usd: 2_000_000,
  });
  return { data: "RESERVED", error: null };
};

const ok = await reserve(rpc, base);
assert.deepEqual(ok, {
  state: "HELD_REVIEW_ONLY",
  attemptKey: "op:1",
  upperBoundMicroUsd: 2_000_000,
  dispatchAuthorized: false,
});

for (const override of [
  { ownerUserId: "wrong" },
  { attemptKey: " bad " },
  { requestSha256: "z".repeat(64) },
  { upperBoundCostUsd: null },
  { upperBoundCostUsd: -1 },
  { upperBoundCostUsd: Infinity },
  { upperBoundCostUsd: Number.MAX_VALUE },
]) {
  const previous = rpcCalls;
  assert.equal(
    (await reserve(rpc, { ...base, ...override })).state,
    "BLOCKED"
  );
  assert.equal(rpcCalls, previous);
}

for (const data of [
  "DENIED_HARD_CAP",
  "DENIED_DUPLICATE_ATTEMPT",
  "DENIED_NO_AUTHORIZED_BUDGET",
  "DENIED_INVALID_REQUEST",
  "UNEXPECTED",
  null,
]) {
  const result = await reserve(
    async () => ({ data, error: null }),
    base
  );
  assert.equal(result.state, "BLOCKED");
  assert.equal(result.dispatchAuthorized, false);
}

assert.equal(
  (await reserve(
    async () => ({ data: "RESERVED", error: { code: "XX" } }),
    base
  )).state,
  "BLOCKED"
);

assert.equal(
  (await reserve(async () => { throw Error("offline"); }, base)).state,
  "BLOCKED"
);

// Simulated serialized DB transaction; no real Postgres connection.
let remaining = 3_000_000;
let queue = Promise.resolve();

const lockedFakeRpc = async (_name, args) => {
  const previous = queue;
  let unlock;
  queue = new Promise(resolve => { unlock = resolve; });
  await previous;

  try {
    if (remaining < args.p_cost_upper_bound_micro_usd) {
      return { data: "DENIED_HARD_CAP", error: null };
    }
    remaining -= args.p_cost_upper_bound_micro_usd;
    return { data: "RESERVED", error: null };
  } finally {
    unlock();
  }
};

const outcomes = await Promise.all([
  reserve(lockedFakeRpc, { ...base, attemptKey: "op:a" }),
  reserve(lockedFakeRpc, { ...base, attemptKey: "op:b" }),
]);

assert.deepEqual(
  outcomes.map(x => x.state).sort(),
  ["BLOCKED", "HELD_REVIEW_ONLY"]
);
assert.equal(remaining, 1_000_000);

console.log("BETA_BUDGET_RESERVATION_ADAPTER=PASS");
console.log("SIMULATED_TWO_REQUEST_RACE=PASS (NOT POSTGRES EVIDENCE)");
console.log("LIVE_DATABASE=NOT_ACCESSED; PROVIDER_DISPATCH=NOT_WIRED");
