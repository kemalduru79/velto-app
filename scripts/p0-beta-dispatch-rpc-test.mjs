import assert from "node:assert/strict";
import {
  beginBetaVideoDispatch,
  acceptBetaVideoDispatch,
} from "../lib/economics/betaVideoDispatchRpc.ts";

const identity = {
  ownerUserId: "00000000-0000-4000-8000-000000000002",
  attemptKey: "video:" + "a".repeat(64),
  requestSha256: "b".repeat(64),
};

let calls = [];

const rpc = async (name, args) => {
  calls.push({ name, args });

  if (name === "velto_beta_budget_begin_dispatch_v1") {
    return { data: "DISPATCH_STARTED", error: null };
  }

  if (name === "velto_beta_budget_accept_dispatch_v1") {
    return { data: "PROVIDER_ACCEPTED", error: null };
  }

  throw Error("Unexpected RPC");
};

const started = await beginBetaVideoDispatch(rpc, {
  ...identity,
  providerKey: "runway",
});

assert.equal(started.state, "RECORDED_REVIEW_ONLY");
assert.equal(started.dispatchAuthorized, false);
assert.equal(calls[0].args.p_attempt_key, identity.attemptKey);
console.log("PASS: DISPATCH_INTENT_RPC_CONTRACT");

const accepted = await acceptBetaVideoDispatch(rpc, {
  ...identity,
  nativeTaskId: "runway-task-1",
});

assert.equal(accepted.state, "RECORDED_REVIEW_ONLY");
assert.equal(accepted.dispatchAuthorized, false);
assert.equal(
  calls[1].args.p_native_task_id,
  "runway-task-1",
);
console.log("PASS: PROVIDER_ACCEPTANCE_RPC_CONTRACT");

const beforeInvalid = calls.length;

const invalid = await beginBetaVideoDispatch(rpc, {
  ...identity,
  providerKey: "veo",
});

assert.equal(invalid.state, "BLOCKED");

const invalidTask = await acceptBetaVideoDispatch(rpc, {
  ...identity,
  nativeTaskId: "",
});

assert.equal(invalidTask.state, "BLOCKED");
assert.equal(calls.length, beforeInvalid);
console.log("PASS: INVALID_INPUT_REJECTED_BEFORE_RPC");

const duplicate = await beginBetaVideoDispatch(
  async () => ({
    data: "DENIED_DUPLICATE_DISPATCH",
    error: null,
  }),
  { ...identity, providerKey: "runway" },
);

assert.equal(duplicate.state, "BLOCKED");
console.log("PASS: DUPLICATE_DISPATCH_DENIED");

const uncertain = await beginBetaVideoDispatch(
  async () => { throw Error("network timeout"); },
  { ...identity, providerKey: "runway" },
);

assert.equal(uncertain.state, "UNCERTAIN");
assert.equal(uncertain.dispatchAuthorized, false);
console.log("PASS: UNCERTAIN_RPC_FAIL_CLOSED");

const acceptUncertain = await acceptBetaVideoDispatch(
  async () => ({
    data: null,
    error: { message: "network timeout" },
  }),
  {
    ...identity,
    nativeTaskId: "runway-task-2",
  },
);

assert.equal(acceptUncertain.state, "UNCERTAIN");
console.log("PASS: UNCERTAIN_ACCEPTANCE_REQUIRES_RECONCILIATION");

console.log("P0_DISPATCH_RPC_ADAPTER=PASS");
console.log("LIVE_DATABASE_CALLS=0");
console.log("PROVIDER_CALLS=0");
