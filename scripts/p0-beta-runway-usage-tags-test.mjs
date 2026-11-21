import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { deriveBetaVideoAttemptKey }
  from "../lib/economics/betaVideoBudgetGate.ts";
import {
  betaRunwayUsageTagForAttempt,
  runwayTaggedRequestOptions,
} from "../lib/economics/betaRunwayUsageTag.ts";

const owner = "00000000-0000-4000-8000-000000000002";
const key = "p0-runway-tag-test";
const hash = createHash("sha256")
  .update(`${owner}:${key}`).digest("hex");

const attempt = deriveBetaVideoAttemptKey(owner, key);
assert.equal(attempt, `video:${hash}`);

const tag = betaRunwayUsageTagForAttempt(attempt);
assert.equal(tag, `attempt:${hash.slice(0, 56)}`);
assert.equal(tag.length, 64);
assert.ok(!tag.includes(owner));
assert.ok(!tag.includes(key));

assert.equal(
  betaRunwayUsageTagForAttempt(
    deriveBetaVideoAttemptKey(owner, key)
  ),
  tag
);
assert.notEqual(
  betaRunwayUsageTagForAttempt(
    deriveBetaVideoAttemptKey(owner, key + "-different")
  ),
  tag
);
console.log("PASS: STABLE_PSEUDONYMOUS_BUDGET_TAG");

assert.equal(
  deriveBetaVideoAttemptKey(owner, "invalid key"),
  null
);
assert.equal(
  betaRunwayUsageTagForAttempt("video:not-a-hash"),
  undefined
);
console.log("PASS: INVALID_ATTEMPT_TAG_DENIED");

assert.deepEqual(runwayTaggedRequestOptions(tag), {
  maxRetries: 0,
  headers: { "X-Runway-Tags": tag },
});
assert.deepEqual(
  runwayTaggedRequestOptions(undefined),
  { maxRetries: 0 }
);
assert.throws(
  () => runwayTaggedRequestOptions("attempt:invalid\nheader"),
  /INVALID_RUNWAY_USAGE_TAG/
);
console.log("PASS: RUNWAY_SDK_HEADER_AND_ZERO_RETRIES");

const adapter = readFileSync(
  new URL("../lib/video/providers/runwayAdapter.ts", import.meta.url),
  "utf8"
);

assert.equal(
  adapter.split("runwayTaggedRequestOptions(input.runwayUsageTag)").length - 1,
  2
);
console.log("PASS: BOTH_RUNWAY_MODEL_PATHS_TAGGED");

const route = readFileSync(
  new URL("../app/api/creator-video/route.ts", import.meta.url),
  "utf8"
);

assert.ok(route.includes("runwayUsageTag: betaRunwayUsageTag"));
assert.ok(route.includes("deriveBetaVideoAttemptKey("));
assert.ok(route.includes("verifiedCostUpperBoundUsd: null"));
assert.ok(route.includes("BETA_VIDEO_BUDGET_DISPATCH_NOT_ACTIVATED"));

console.log("PASS: ROUTE_CORRELATION_WITHOUT_ACTIVATION");
console.log("P0_RUNWAY_USAGE_TAG_CONTRACT=PASS");
console.log("LIVE_SUPABASE_CALLS=0");
console.log("PAID_PROVIDER_CALLS=0");
