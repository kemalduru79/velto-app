import assert from "node:assert/strict";
import {
  buildBetaRunwayUsageQuery,
  betaRunwayUsageTagForAttempt,
  assessBetaRunwayTaggedUsage,
} from "../lib/economics/betaRunwayUsageTag.ts";

const attempt = "video:" + "a".repeat(64);
const tag = betaRunwayUsageTagForAttempt(attempt);

const from = "2026-11-18";
const before = "2026-11-21";

const query = buildBetaRunwayUsageQuery(
  attempt, from, before,
);

assert.equal(query.state, "READ_ONLY_QUERY");
assert.deepEqual(query.body, {
  startDate: from,
  beforeDate: before,
  tags: [tag],
  groupBy: "tag",
});
assert.equal(query.dispatchAuthorized, false);

console.log("PASS: OFFICIAL_READ_ONLY_USAGE_QUERY_SHAPE");

const row = (date, amount) => ({
  date,
  usedCredits: [{ tag, amount }],
});

const report = (...rows) => ({
  resultsByTag: rows,
});

function check(response, expectedState, expectedReason) {
  const result = assessBetaRunwayTaggedUsage(
    attempt, from, before, response,
  );

  assert.equal(result.state, expectedState);
  assert.equal(result.reason, expectedReason);

  assert.equal(result.dispatchAuthorized, false);
  assert.equal(result.settlementAuthorized, false);
  assert.equal(result.releaseAuthorized, false);

  return result;
}

const positive = check(
  report(row("2026-11-19", 60)),
  "REVIEW_REQUIRED",
  "AGGREGATE_USAGE_NOT_TASK_BILLING_PROOF",
);

assert.equal(positive.netCredits, 60);
console.log("PASS: POSITIVE_USAGE_REQUIRES_REVIEW");

check(
  report(),
  "HOLD",
  "TAG_USAGE_NOT_YET_VISIBLE",
);
console.log("PASS: DELAYED_USAGE_RETAINS_HOLD");

check(
  report(row("2026-11-19", 0)),
  "HOLD",
  "ZERO_NET_USAGE_NOT_PROOF",
);

check(
  report(
    row("2026-11-19", 50),
    row("2026-11-20", -50),
  ),
  "HOLD",
  "ZERO_NET_USAGE_NOT_PROOF",
);

console.log("PASS: ZERO_AND_REFUNDED_USAGE_NEVER_RELEASE");

const negative = check(
  report(row("2026-11-19", -20)),
  "REVIEW_REQUIRED",
  "REFUND_REQUIRES_BILLING_VERIFICATION",
);

assert.equal(negative.netCredits, -20);
console.log("PASS: NEGATIVE_USAGE_REQUIRES_REVIEW");

check(
  report(
    row("2026-11-19", 50),
    row("2026-11-19", 50),
  ),
  "HOLD",
  "DUPLICATE_TAG_DAY",
);

check(
  report(row("2026-11-22", 50)),
  "HOLD",
  "USAGE_OUTSIDE_QUERY_WINDOW",
);

check(
  report(row("2026-11-19", "50")),
  "HOLD",
  "INVALID_CREDIT_AMOUNT",
);

check(
  { resultsByTag: null },
  "HOLD",
  "INVALID_USAGE_REPORT",
);

console.log("PASS: MALFORMED_AND_DUPLICATE_REPORTS_DENIED");

const invalid = buildBetaRunwayUsageQuery(
  attempt, "2026-11-01", "2027-03-01",
);

assert.equal(invalid.state, "BLOCKED");
assert.equal(invalid.dispatchAuthorized, false);

console.log("PASS: QUERY_WINDOW_VALIDATION");

console.log("P0_RUNWAY_USAGE_RECONCILIATION=PASS");
console.log("AUTO_SETTLEMENT=DISABLED");
console.log("AUTO_RELEASE=DISABLED");
console.log("LIVE_RUNWAY_CALLS=0");
console.log("LIVE_SUPABASE_CALLS=0");
