import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  STAGE4B2_APPROVED_SOURCE_URL,
  STAGE4B2_CONTENTS_ENDPOINT,
  claimStage4b2Execution,
  classifyStage4b2ContentsResponse,
  normalizeStage4b2SourceIdentity,
  validateStage4b2ClaimAssessment,
} from "../lib/creator/stage4b2ProviderAcceptance.ts";

const passage = "Generative agents wake up, cook breakfast, and head to work; artists paint, while authors write.";
const document = `Independent original document text. ${passage} More original document text.`;
const response = (overrides = {}) => ({
  results: [{ id: STAGE4B2_APPROVED_SOURCE_URL, url: STAGE4B2_APPROVED_SOURCE_URL, highlights: [passage], ...overrides }],
});

assert.equal(STAGE4B2_CONTENTS_ENDPOINT, "https://api.exa.ai/contents");
assert.equal(normalizeStage4b2SourceIdentity(`${STAGE4B2_APPROVED_SOURCE_URL}/#paper`), STAGE4B2_APPROVED_SOURCE_URL);
assert.equal(normalizeStage4b2SourceIdentity("http://arxiv.org/abs/2304.03442"), null);
assert.equal(classifyStage4b2ContentsResponse({ response: null, independentlyRetrievedText: document }).reason, "PROVIDER_RESPONSE_MALFORMED");
assert.equal(classifyStage4b2ContentsResponse({ response: { results: [] }, independentlyRetrievedText: document }).reason, "SOURCE_NOT_DISCOVERED");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ id: "https://example.com/paper", url: "https://example.com/paper" }), independentlyRetrievedText: document }).reason, "SOURCE_IDENTITY_MISMATCH");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ id: "https://arxiv.org/pdf/2304.03442", url: "https://arxiv.org/pdf/2304.03442" }), independentlyRetrievedText: document }).reason, "SOURCE_IDENTITY_MISMATCH");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ url: "https://example.com/substituted" }), independentlyRetrievedText: document }).reason, "SOURCE_IDENTITY_MISMATCH");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ highlights: [] }), independentlyRetrievedText: document }).reason, "SOURCE_CONTENT_UNAVAILABLE");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ highlights: ["A fabricated passage that the original source does not contain."] }), independentlyRetrievedText: document }).reason, "SOURCE_PASSAGE_NOT_VERIFIED");
const verified = classifyStage4b2ContentsResponse({ response: response(), independentlyRetrievedText: document });
assert.equal(verified.ok, true);
assert.equal(verified.sourceUrl, STAGE4B2_APPROVED_SOURCE_URL);
assert.equal(verified.passage, passage);
assert.match(verified.passageSha256, /^[a-f0-9]{64}$/u);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: ["e-approved"] }, evidenceId: "e-approved" }), true);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: [] }, evidenceId: "e-approved" }), false);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: ["e-substituted"] }, evidenceId: "e-approved" }), false);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "unsupported", evidenceIds: ["e-approved"] }, evidenceId: "e-approved" }), false);

const directory = await mkdtemp(path.join(os.tmpdir(), "stage4b2-receipts-"));
try {
  await assert.rejects(() => claimStage4b2Execution({ executionId: "stage4b2-20261019-search-1", approvedExecutionId: "stage4b2-20261019-search-1", consent: "confirmed:stage4b2-20261019-search-1", receiptDirectory: directory }), /EXECUTION_ALREADY_CONSUMED/u);
  await assert.rejects(() => claimStage4b2Execution({ executionId: "stage4b2-future-trial-1", approvedExecutionId: "stage4b2-other-trial-1", consent: "confirmed:stage4b2-future-trial-1", receiptDirectory: directory }), /EXECUTION_AUTHORIZATION_REQUIRED/u);
  const input = { executionId: "stage4b2-future-trial-1", approvedExecutionId: "stage4b2-future-trial-1", consent: "confirmed:stage4b2-future-trial-1", receiptDirectory: directory, now: () => "2026-10-19T00:00:00.000Z" };
  const claims = await Promise.allSettled([claimStage4b2Execution(input), claimStage4b2Execution(input)]);
  assert.equal(claims.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(claims.filter((result) => result.status === "rejected" && /EXECUTION_ALREADY_CONSUMED/u.test(String(result.reason))).length, 1);
  const authority = claims.find((result) => result.status === "fulfilled").value;
  await authority.complete({ state: "blocked", providerUsage: { exaCalls: 1, openAiCalls: 0, reportedCostUsd: 0.007 }, result: "SOURCE_NOT_DISCOVERED" });
  const stored = JSON.parse(await readFile(authority.receiptPath, "utf8"));
  assert.equal(stored.state, "blocked");
  assert.deepEqual(stored.providerUsage, { exaCalls: 1, openAiCalls: 0, reportedCostUsd: 0.007 });
  await assert.rejects(() => claimStage4b2Execution(input), /EXECUTION_ALREADY_CONSUMED/u);
} finally {
  await rm(directory, { recursive: true, force: true });
}

const probe = await readFile("scripts/stage-4b2-local-live-probe.mjs", "utf8");
assert.match(probe, /ids: \[SOURCE_URL\]/u);
assert.doesNotMatch(probe, /api\.exa\.ai\/search|numResults|includeDomains/u);
assert.match(probe, /claimStage4b2Execution/u);
assert.match(probe, /exa_exact_source_contents/u);
assert.match(probe, /independent_original_source/u);
assert.match(probe, /CLAIM_UNSUPPORTED/u);
assert.doesNotMatch(probe, /automatic retry|fallback provider/iu);

console.log("STAGE_4B2_EXACT_SOURCE_RECOVERY=PASS");
