import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "app/api/creator-video/route.ts",
  "utf8"
);

const positions = [
  "// P0 Beta USD budget boundary.",
  "reserveMeteredOperation(req, {",
  "selection.provider.createTask({",
].map(value => source.indexOf(value));

assert.ok(positions.every(position => position >= 0));
assert.ok(
  positions[0] < positions[1] &&
  positions[1] < positions[2],
  "Budget barrier must precede credits and provider dispatch"
);

assert.match(
  source,
  /BETA_VIDEO_BUDGET_DISPATCH_NOT_ACTIVATED/
);

assert.match(
  source,
  /status: 503/
);

assert.match(
  source,
  /body\.productProfile === "creatorlab"/
);

console.log("P0_VIDEO_API_BUDGET_BARRIER=PASS");
console.log("BARRIER_BEFORE_CREDIT_AND_PROVIDER=PASS");
console.log("BUDGET_DISPATCH_ACTIVATION=NOT_GRANTED");
console.log("PROVIDER_CALLS=0");

assert.doesNotMatch(
  source,
  /VELTO_BETA_VIDEO_BUDGET_MODE/
);

const legacyGuard = source.indexOf(
  "if (isLegacyPaidVideoRequest(body.productProfile))"
);
const budgetGate = source.indexOf(
  "executeBetaVideoBudgetedStart("
);
const providerDispatch = source.indexOf(
  "selection.provider.createTask({"
);

assert.ok(legacyGuard >= 0);
assert.ok(legacyGuard < budgetGate);
assert.ok(budgetGate < providerDispatch);

const legacyBlock = source.slice(
  legacyGuard,
  source.indexOf("const qualityMode =", legacyGuard)
);

assert.match(legacyBlock, /status:\s*503/);
assert.match(legacyBlock, /return NextResponse\.json\(/);

assert.match(
  source,
  /function isLegacyPaidVideoRequest\(productProfile: unknown\): boolean\s*\{\s*return productProfile !== "creatorlab";/,
);

console.log("LEGACY_VIDEO_BUDGET_BYPASS=BLOCKED");

console.log("DEFAULT_CREATORLAB_PAID_VIDEO=BLOCKED");
