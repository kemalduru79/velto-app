import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CreatorScriptBuildPrimarySelectionNormalizationError,
  normalizePrimarySelection,
} from "../lib/creator/creatorScriptBuildAuthorityCoordinator.ts";

const input = {
  version: "0.19E2B-primary-selection-request-v1",
  targetClaims: [
    { claimId: "claim-a", claimType: "FACT", text: "claim a" },
    { claimId: "claim-b", claimType: "FACT", text: "claim b" },
    { claimId: "claim-c", claimType: "FACT", text: "claim c" },
  ],
  primarySources: [],
  candidateSpans: [
    { spanId: "span-a", sourceId: "source-a", text: "span a", evidenceSpecificity: "concrete_observation" },
    { spanId: "span-b", sourceId: "source-b", text: "span b", evidenceSpecificity: "concrete_observation" },
    { spanId: "span-c", sourceId: "source-c", text: "span c", evidenceSpecificity: "concrete_observation" },
  ],
};

const normalized = normalizePrimarySelection({
  repairs: [
    { claimId: "claim-a", spanId: "span-a" },
    { claimId: "claim-a", spanId: "span-b" },
    { claimId: "claim-a", spanId: "span-c" },
  ],
}, input);

assert.deepEqual(normalized, {
  repairs: [{ claimId: "claim-a", spanId: "span-a" }],
});

assert.throws(
  () => normalizePrimarySelection({
    repairs: [
      { claimId: "claim-a", spanId: "span-a" },
      { claimId: "claim-a", spanId: "span-not-allowed" },
    ],
  }, input),
  (error) => {
    assert.ok(error instanceof CreatorScriptBuildPrimarySelectionNormalizationError);
    assert.equal(error.diagnostics.normalizationReason, "SPAN_ID_INVALID");
    return true;
  },
);

assert.throws(
  () => normalizePrimarySelection({
    repairs: [{ claimId: "claim-not-allowed", spanId: "span-a" }],
  }, input),
  (error) => {
    assert.ok(error instanceof CreatorScriptBuildPrimarySelectionNormalizationError);
    assert.equal(error.diagnostics.normalizationReason, "CLAIM_ID_INVALID");
    return true;
  },
);

const coordinator = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildAuthorityCoordinator.ts", import.meta.url),
  "utf8",
);
const providers = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);

assert.match(coordinator, /selectedClaimIds\.has\(claimId\)[\s\S]*?return;/u);
assert.match(coordinator, /normalizedRepairs\.push\(\{ claimId, spanId \}\)/u);
assert.doesNotMatch(
  coordinator,
  /reject\("DUPLICATE_CLAIM_ID"/u,
);
assert.match(
  providers,
  /Return at most one repair per claimId\. Never repeat a claimId/u,
);

const schema = providers.slice(
  providers.indexOf("function primarySelectionSchema"),
  providers.indexOf("function generationSchema"),
);
assert.match(schema, /maxItems: input\.targetClaims\.length/u);
assert.match(schema, /required: \["claimId", "spanId"\]/u);
assert.doesNotMatch(schema, /uniqueItems/u);

await import("./stage-0-19e2b-authority-coordinator-test.mjs");

console.log("stage-0-19f-d4-primary-selection-duplicate-alignment-test: PASS");
