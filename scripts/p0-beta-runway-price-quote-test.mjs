import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  quoteBetaRunwayVideo as quote,
} from "../lib/economics/betaRunwayPriceQuote.ts";

const input = {
  provider: "runway",
  model: "gen4_turbo",
  billedSeconds: 5,
};

const turbo = quote(input);
assert.equal(turbo.state, "LIST_PRICE_QUOTE");
assert.equal(turbo.credits, 25);
assert.equal(turbo.quotedMicroUsd, 250_000);
assert.equal(turbo.dispatchAuthorized, false);
console.log("PASS: GEN4_TURBO_5S_QUOTE");

const quality = quote({
  ...input,
  model: "gen4.5",
  billedSeconds: 10,
});
assert.equal(quality.state, "LIST_PRICE_QUOTE");
assert.equal(quality.credits, 120);
assert.equal(quality.quotedMicroUsd, 1_200_000);
console.log("PASS: GEN45_10S_QUOTE");

const sevenSeconds = quote({
  ...input,
  billedSeconds: 7,
});
assert.equal(sevenSeconds.quotedMicroUsd, 350_000);
console.log("PASS: BILLABLE_DURATION");

for (const invalid of [
  { ...input, model: "seedance2" },
  { ...input, provider: "veo" },
  { ...input, billedSeconds: 0 },
  { ...input, billedSeconds: 11 },
  { ...input, billedSeconds: 5.5 },
  { ...input, billedSeconds: Number.NaN },
]) {
  const result = quote(invalid);
  assert.equal(result.state, "UNAVAILABLE");
  assert.equal(result.dispatchAuthorized, false);
}
console.log("PASS: UNKNOWN_MODELS_AND_DURATION_DENIED");

const route = readFileSync(
  "app/api/creator-video/route.ts",
  "utf8",
);

assert.match(route, /quoteBetaRunwayVideo\(\{/);
assert.match(route, /priceQuoteStatus: betaPriceQuote.state/);
assert.match(
  route,
  /verifiedCostUpperBoundUsd:\s*null/,
);

console.log("PASS: API_QUOTE_CONNECTED_WITHOUT_ACTIVATION");
console.log("P0_RUNWAY_PRICE_QUOTE=PASS");
console.log("REAL_PROVIDER_CALLS=0");
console.log("REAL_SUPABASE_CALLS=0");
