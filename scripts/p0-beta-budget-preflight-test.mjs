import assert from "node:assert/strict";
import {
  evaluateBetaProviderBudgetPreflight as assess,
} from "../lib/economics/betaProviderBudgetPreflight.ts";

const base = {
  hardCapUsd: 10,
  committedExposureUsd: 4,
  estimatedDispatchCostUsd: 2,
  aggregationComplete: true,
  unknownCostOperations: 0,
};

let checks = 0;
function check(name, override, expected) {
  const outcome = assess({ ...base, ...override });
  assert.equal(outcome.state, expected, name);
  checks++;
  console.log("PASS:", name);
  return outcome;
}

check("Within budget", {},
  "ELIGIBLE_FOR_ATOMIC_RESERVATION");
check("Exact budget boundary",
  { estimatedDispatchCostUsd: 6 },
  "ELIGIBLE_FOR_ATOMIC_RESERVATION");
check("Budget exceeded",
  { estimatedDispatchCostUsd: 6.01 }, "BLOCKED");
check("Missing cap", { hardCapUsd: null }, "BLOCKED");
check("Zero cap", { hardCapUsd: 0 }, "BLOCKED");
check("Unknown estimated cost",
  { estimatedDispatchCostUsd: null }, "BLOCKED");
check("Invalid negative cost",
  { estimatedDispatchCostUsd: -1 }, "BLOCKED");
check("Incomplete aggregation",
  { aggregationComplete: false }, "BLOCKED");
check("Unknown historical cost",
  { unknownCostOperations: 1 }, "BLOCKED");
check("Unknown existing exposure",
  { committedExposureUsd: null }, "BLOCKED");
check("Non-finite estimate",
  { estimatedDispatchCostUsd: Infinity }, "BLOCKED");
check("Overlarge cap",
  { hardCapUsd: Number.MAX_VALUE }, "BLOCKED");

const eligible = assess(base);
assert.equal(
  eligible.state,
  "ELIGIBLE_FOR_ATOMIC_RESERVATION"
);
assert.equal(eligible.requestedMicroUsd, 2_000_000);
assert.equal(eligible.remainingMicroUsd, 4_000_000);
assert.equal(Object.hasOwn(eligible, "allowed"), false);
checks++;

console.log(`P0_BETA_BUDGET_PREFLIGHT=${checks}/${checks} PASS`);
console.log("ATOMIC_RESERVATION=NOT_IMPLEMENTED");
console.log("PROVIDER_DISPATCH_AUTHORIZATION=NOT_GRANTED");
