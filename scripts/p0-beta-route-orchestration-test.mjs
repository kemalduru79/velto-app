import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executeBetaVideoBudgetedStart }
  from "../lib/economics/betaVideoBudgetDispatch.ts";

const input = {
  ownerUserId: "00000000-0000-4000-8000-000000000002",
  projectId: null,
  sceneId: "1",
  provider: "runway",
  model: "gen4_turbo",
  billedSeconds: 5,
  idempotencyKey: "p0-beta-test",
  verifiedCostUpperBoundUsd: null,
};

let databaseCalls = 0;
let providerCalls = 0;

const rpc = async () => {
  databaseCalls++;
  throw new Error("UNEXPECTED_DATABASE_CALL");
};

const provider = async () => {
  providerCalls++;
  throw new Error("UNEXPECTED_PROVIDER_CALL");
};

const blocked = await executeBetaVideoBudgetedStart(
  input, rpc, provider
);

assert.equal(blocked.state, "BLOCKED");
assert.equal(blocked.reason, "COST_CEILING_UNVERIFIED");
assert.equal(databaseCalls, 0);
assert.equal(providerCalls, 0);

console.log("PASS: UNVERIFIED_CEILING_FAIL_CLOSED");

const review = await executeBetaVideoBudgetedStart(
  { ...input, verifiedCostUpperBoundUsd: 1 },
  rpc,
  provider
);

assert.equal(review.state, "BLOCKED");
assert.equal(review.reason, "DISPATCH_PROTOCOL_NOT_ACTIVE");
assert.equal(databaseCalls, 0);
assert.equal(providerCalls, 0);

console.log("PASS: REVIEW_ONLY_DISPATCH_NOT_AUTHORIZED");

const route = readFileSync(
  new URL("../app/api/creator-video/route.ts", import.meta.url),
  "utf8"
);

const boundary = route.indexOf(
  "// P0 Beta USD budget boundary."
);

const credit = route.indexOf(
  "reservation = await reserveMeteredOperation(",
  boundary
);

const providerStart = route.indexOf(
  "const task = await selection.provider.createTask(",
  boundary
);

assert.ok(boundary >= 0 && credit > boundary);
assert.ok(providerStart > credit);

const gate = route.slice(boundary, credit);

assert.ok(gate.includes("executeBetaVideoBudgetedStart("));
assert.ok(gate.includes("verifiedCostUpperBoundUsd: null"));
assert.ok(gate.includes("P0_DATABASE_DISPATCH_DISABLED"));
assert.ok(gate.includes("P0_PAID_VIDEO_DISPATCH_DISABLED"));
assert.ok(gate.includes("BETA_VIDEO_BUDGET_DISPATCH_NOT_ACTIVATED"));
assert.match(gate, /status:\s*503/);

console.log("PASS: API_GATE_PRECEDES_CREDIT_AND_PROVIDER");
console.log("PASS: CONTROLLED_503_PRESERVED");
console.log("P0_ROUTE_ORCHESTRATION=PASS");
console.log("DATABASE_CALLS=0");
console.log("PROVIDER_CALLS=0");
