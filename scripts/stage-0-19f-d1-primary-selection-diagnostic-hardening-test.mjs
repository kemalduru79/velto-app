import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CreatorScriptBuildPrimarySelectionNormalizationError,
  normalizePrimarySelection,
} from "../lib/creator/creatorScriptBuildAuthorityCoordinator.ts";

const input = {
  version: "0.19E2B-primary-selection-request-v1",
  targetClaims: [
    { claimId: "claim-a", claimType: "FACT", text: "private claim prose" },
    { claimId: "claim-b", claimType: "FACT", text: "other private claim prose" },
  ],
  primarySources: [],
  candidateSpans: [
    { spanId: "span-a", sourceId: "source-a", text: "private evidence prose", evidenceSpecificity: "high" },
    { spanId: "span-b", sourceId: "source-b", text: "other private evidence prose", evidenceSpecificity: "high" },
  ],
};

function rejected(value, reason) {
  try {
    normalizePrimarySelection(value, input);
    assert.fail(`Expected ${reason}`);
  } catch (error) {
    assert.ok(error instanceof CreatorScriptBuildPrimarySelectionNormalizationError);
    assert.equal(error.message, "CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_RESULT_INVALID");
    assert.equal(error.diagnostics.normalizationReason, reason);
    return error.diagnostics;
  }
}

const duplicate = rejected({ repairs: [
  { claimId: "claim-a", spanId: "span-a" },
  { claimId: "claim-a", spanId: "span-b" },
] }, "DUPLICATE_CLAIM_ID");
assert.equal(duplicate.normalizationItemIndex, 1);
assert.equal(duplicate.normalizationPreviousItemIndex, 0);
assert.equal(duplicate.normalizationDuplicateClaimIndexes, "0:1");

const unknownClaim = rejected({ repairs: [
  { claimId: "claim-unknown", spanId: "span-a" },
] }, "CLAIM_ID_INVALID");
assert.equal(unknownClaim.normalizationClaimIdMatch, false);
assert.equal(unknownClaim.normalizationPath, "$.repairs[0].claimId");

const unknownSpan = rejected({ repairs: [
  { claimId: "claim-a", spanId: "span-unknown" },
] }, "SPAN_ID_INVALID");
assert.equal(unknownSpan.normalizationSpanIdMatch, false);
assert.equal(unknownSpan.normalizationPath, "$.repairs[0].spanId");

assert.equal(rejected(null, "ROOT_INVALID").normalizationRootType, "null");
assert.equal(rejected({ repairs: "not-an-array" }, "REPAIRS_NOT_ARRAY").normalizationValueType, "string");
assert.equal(rejected({ repairs: ["not-an-item"] }, "ITEM_INVALID").normalizationItemIndex, 0);
const malformed = rejected({ repairs: [{
  claimId: "claim-a",
  spanId: "span-a",
  evidenceText: "RAW EVIDENCE MUST NOT LEAK",
  sourceBody: "RAW SOURCE BODY MUST NOT LEAK",
}] }, "ITEM_KEYS_INVALID");
assert.equal(malformed.normalizationUnexpectedKeys, "evidenceText,sourceBody");
const proseAsIdentifier = rejected({ repairs: [{
  claimId: "RAW EVIDENCE MUST NOT LEAK",
  spanId: "span-a",
}] }, "CLAIM_ID_INVALID");
assert.match(proseAsIdentifier.normalizationIdentifier, /^sha256:[0-9a-f]{16}$/u);

for (const diagnostics of [duplicate, unknownClaim, unknownSpan, malformed, proseAsIdentifier]) {
  const serialized = JSON.stringify(diagnostics);
  assert.doesNotMatch(serialized, /private claim prose|private evidence prose|RAW EVIDENCE MUST NOT LEAK|RAW SOURCE BODY MUST NOT LEAK/u);
  assert.ok(serialized.length < 4_000);
}

const coordinator = fs.readFileSync(new URL("../lib/creator/creatorScriptBuildAuthorityCoordinator.ts", import.meta.url), "utf8");
const providers = fs.readFileSync(new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url), "utf8");

assert.match(coordinator, /code: input\.kind === "acquisition"[\s\S]*"CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_RESULT_INVALID"/u);
assert.match(coordinator, /transitionOperation\([\s\S]*nextState: "FAILED",[\s\S]*failure/u);
assert.match(coordinator, /failAuthorityBuild\([\s\S]*failure/u);
assert.match(coordinator, /operationId: operation\.operationId/u);
assert.match(coordinator, /primarySelectionProviderDiagnostics\(rawResult\)/u);
assert.match(providers, /requestId: typeof response\._request_id === "string"/u);
assert.match(providers, /responseId: typeof response\.id === "string"/u);
assert.match(providers, /enumerable: false/u);

const schema = providers.slice(
  providers.indexOf("function primarySelectionSchema"),
  providers.indexOf("function generationSchema"),
);
assert.match(schema, /maxItems: input\.targetClaims\.length/u);
assert.match(schema, /enum: input\.targetClaims\.map\(\(claim\) => claim\.claimId\)/u);
assert.match(schema, /enum: input\.candidateSpans\.map\(\(span\) => span\.spanId\)/u);
assert.match(schema, /required: \["claimId", "spanId"\]/u);
assert.doesNotMatch(schema, /uniqueItems/u);

// Re-run the established authority suite: its rejection cases assert the same
// public failure code and FAILED build transition through the full coordinator.
await import("./stage-0-19e2b-authority-coordinator-test.mjs");

console.log("stage-0-19f-d1-primary-selection-diagnostic-hardening-test: ok");
