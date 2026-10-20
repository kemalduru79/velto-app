import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  STAGE4B2_APPROVED_SOURCE_URL,
  STAGE4B2_CONSUMED_EXECUTION_IDS,
  STAGE4B2_CONTENTS_ENDPOINT,
  claimStage4b2Execution,
  classifyStage4b2ContentsResponse,
  createStage4b2ContentsRequest,
  normalizeStage4b2SourceIdentity,
  selectStage4b2AtomicPassageCandidates,
  validateStage4b2ClaimAssessment,
} from "../lib/creator/stage4b2ProviderAcceptance.ts";

const passage = "Generative agents wake up, cook breakfast, and head to work; artists paint, while authors write.";
const document = `Independent original document text. ${passage} More original document text.`;
const response = (overrides = {}) => ({
  results: [{ id: "exa-document-2304-03442", url: STAGE4B2_APPROVED_SOURCE_URL, highlights: [passage], ...overrides }],
});

assert.equal(STAGE4B2_CONTENTS_ENDPOINT, "https://api.exa.ai/contents");
assert.deepEqual(createStage4b2ContentsRequest(), {
  urls: [STAGE4B2_APPROVED_SOURCE_URL],
  highlights: { query: "agent behavior simulation evidence limitations", maxCharacters: 4000 },
});
assert.equal("ids" in createStage4b2ContentsRequest(), false);
assert.equal(normalizeStage4b2SourceIdentity(`${STAGE4B2_APPROVED_SOURCE_URL}/#paper`), STAGE4B2_APPROVED_SOURCE_URL);
assert.equal(normalizeStage4b2SourceIdentity("http://arxiv.org/abs/2304.03442"), null);
assert.equal(classifyStage4b2ContentsResponse({ response: null, independentlyRetrievedText: document }).reason, "PROVIDER_RESPONSE_MALFORMED");
assert.equal(classifyStage4b2ContentsResponse({ response: { results: [] }, independentlyRetrievedText: document }).reason, "SOURCE_NOT_DISCOVERED");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ id: "https://example.com/paper", url: "https://example.com/paper" }), independentlyRetrievedText: document }).reason, "SOURCE_IDENTITY_MISMATCH");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ id: "https://arxiv.org/pdf/2304.03442", url: "https://arxiv.org/pdf/2304.03442" }), independentlyRetrievedText: document }).reason, "SOURCE_IDENTITY_MISMATCH");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ id: STAGE4B2_APPROVED_SOURCE_URL, url: undefined }), independentlyRetrievedText: document }).reason, "SOURCE_IDENTITY_MISMATCH");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ id: STAGE4B2_APPROVED_SOURCE_URL, url: "https://example.com/substituted" }), independentlyRetrievedText: document }).reason, "SOURCE_IDENTITY_MISMATCH");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ id: "https://example.com/substituted" }), independentlyRetrievedText: document }).reason, "SOURCE_IDENTITY_MISMATCH");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ highlights: [] }), independentlyRetrievedText: document }).reason, "SOURCE_CONTENT_UNAVAILABLE");
assert.equal(classifyStage4b2ContentsResponse({ response: response({ highlights: ["A fabricated passage that the original source does not contain."] }), independentlyRetrievedText: document }).reason, "SOURCE_PASSAGE_NOT_VERIFIED");
const verified = classifyStage4b2ContentsResponse({ response: response(), independentlyRetrievedText: document });
assert.equal(verified.ok, true);
assert.equal(verified.sourceUrl, STAGE4B2_APPROVED_SOURCE_URL);
assert.equal(verified.passage, passage);
assert.match(verified.passageSha256, /^[a-f0-9]{64}$/u);
assert.equal(verified.matchMode, "compact_exact");
assert.equal(verified.evidencePassages.length, 1);
assert.equal(verified.evidencePassages[0].passage, passage);
assert.equal(classifyStage4b2ContentsResponse({ response: response({ id: STAGE4B2_APPROVED_SOURCE_URL }), independentlyRetrievedText: document }).ok, true);
const normalizedPassage = "The agents’ memories&nbsp;shape an “emergent” social world—without semantic approximation.";
const normalizedDocument = "The agents' memories shape an \"emergent\" social world-without semantic approximation.";
const normalizedResult = classifyStage4b2ContentsResponse({ response: response({ highlights: [normalizedPassage] }), independentlyRetrievedText: normalizedDocument });
assert.equal(normalizedResult.ok, true);
assert.equal(normalizedResult.matchMode, "normalized_verbatim");
assert.equal(normalizedResult.mismatchCategory, "text_normalization_mismatch_recovered");
assert.equal(normalizedResult.safeDiagnostics.matchingOutcomes[0].compactExactMatch, false);
assert.equal(normalizedResult.safeDiagnostics.matchingOutcomes[0].normalizedVerbatimMatch, true);
const scopeOnlyPassage = "This longer body passage exists in an official paper rendition but not on the approved abstract page.";
const scopeResult = classifyStage4b2ContentsResponse({
  response: response({ highlights: [scopeOnlyPassage] }),
  independentlyRetrievedText: "Approved abstract page does not contain the body passage.",
  diagnosticOfficialRepresentations: [`Official full paper body. ${scopeOnlyPassage}`],
});
assert.equal(scopeResult.ok, false);
assert.equal(scopeResult.reason, "DOCUMENT_SCOPE_MISMATCH");
assert.equal(scopeResult.mismatchCategory, "document_scope_mismatch");
assert.equal(scopeResult.safeDiagnostics.matchingOutcomes[0].diagnosticOfficialRepresentationMatch, true);
const unresolvedResult = classifyStage4b2ContentsResponse({ response: response({ highlights: [scopeOnlyPassage] }), independentlyRetrievedText: "Approved abstract only." });
assert.equal(unresolvedResult.reason, "SOURCE_PASSAGE_NOT_VERIFIED");
assert.equal(unresolvedResult.mismatchCategory, "unresolved_passage_mismatch");
assert.deepEqual(Object.keys(unresolvedResult.safeDiagnostics).sort(), ["atomicCandidateCounts", "highlightCount", "highlightLengths", "highlightSha256", "matchingOutcomes", "normalizedOriginalTextLength", "normalizedOriginalTextSha256", "originalTextLength", "originalTextSha256", "verifiedAtomicCandidateCounts"].sort());
assert.equal(JSON.stringify(unresolvedResult.safeDiagnostics).includes(scopeOnlyPassage), false);

const atomicVerified = "The controlled simulation increased informed agents from one (4%) to eight (32%).";
const fabricatedAtomic = "A fabricated follow-up claimed that every simulated agent changed its behavior immediately.";
const fillerSentence = (index, length) => `Synthetic composite segment ${index} ${"x".repeat(length - String(index).length - 30)}.`;
const compositeParts = [atomicVerified, fabricatedAtomic, ...Array.from({ length: 6 }, (_unused, index) => fillerSentence(index + 1, 560))];
const prefix = compositeParts.join(" ");
const finalLength = 3988 - prefix.length - 1;
assert.ok(finalLength >= 24 && finalLength <= 700);
const compositeHighlight = `${prefix} ${fillerSentence(7, finalLength)}`;
assert.equal(compositeHighlight.length, 3988);
assert.ok(selectStage4b2AtomicPassageCandidates(compositeHighlight).length > 1);
const compositeResult = classifyStage4b2ContentsResponse({ response: response({ highlights: [compositeHighlight] }), independentlyRetrievedText: `Original source block. ${atomicVerified}` });
assert.equal(compositeResult.ok, true);
assert.equal(compositeResult.passage, atomicVerified);
assert.deepEqual(compositeResult.evidencePassages.map((item) => item.passage), [atomicVerified], "unverified composite material must never become evidence");
assert.equal(compositeResult.safeDiagnostics.highlightLengths[0], 3988);
assert.equal(compositeResult.safeDiagnostics.verifiedAtomicCandidateCounts[0], 1);
assert.equal(JSON.stringify(compositeResult.safeDiagnostics).includes(fabricatedAtomic), false);

const unverifiedComposite = `${fabricatedAtomic} ${fillerSentence(1, 720)}`;
const unverifiedCompositeResult = classifyStage4b2ContentsResponse({ response: response({ highlights: [unverifiedComposite] }), independentlyRetrievedText: "The approved source contains no supplied composite claims." });
assert.equal(unverifiedCompositeResult.ok, false);
assert.equal(unverifiedCompositeResult.reason, "PROVIDER_HIGHLIGHT_NOT_ATOMIC");
assert.equal(unverifiedCompositeResult.mismatchCategory, "excerpt_granularity_mismatch");

const alteredFigure = "The controlled simulation increased informed agents from one (4%) to eight (33%).";
const alteredFigureResult = classifyStage4b2ContentsResponse({ response: response({ highlights: [alteredFigure] }), independentlyRetrievedText: atomicVerified });
assert.equal(alteredFigureResult.ok, false);
assert.equal(alteredFigureResult.reason, "SOURCE_PASSAGE_NOT_VERIFIED");

const ambiguousAtomicResult = classifyStage4b2ContentsResponse({ response: response({ highlights: [atomicVerified] }), independentlyRetrievedText: `${atomicVerified} Repeated record. ${atomicVerified}` });
assert.equal(ambiguousAtomicResult.ok, false);
assert.equal(ambiguousAtomicResult.reason, "SOURCE_PASSAGE_NOT_VERIFIED");
for (const [providerPassage, sourcePassage] of [
  ["The study used 10⁶ cells in each independently measured sample.", "The study used 106 cells in each independently measured sample."],
  ["The experiment used 2⁵ agents in the controlled simulation.", "The experiment used 25 agents in the controlled simulation."],
  ["The reported threshold was 3² units for the measured response.", "The reported threshold was 32 units for the measured response."],
  ["One half of the cohort received a ½ dose during treatment.", "One half of the cohort received a 1/2 dose during treatment."],
  ["The concentration was measured as 10−3 molar in the sample.", "The concentration was measured as 10-3 molar in the sample."],
  ["The specimen measured 5 μm across under calibrated microscopy.", "The specimen measured 5 um across under calibrated microscopy."],
  ["The matrix contained 10 × 10 independently observed entries.", "The matrix contained 10 x 10 independently observed entries."],
  ["The reported population included 1,000 independently enrolled people.", "The reported population included 1000 independently enrolled people."],
  ["The measured ratio was 10–3 in the calibrated assay.", "The measured ratio was 10-3 in the calibrated assay."],
  ["The observed interval was 20—30 units across repeated trials.", "The observed interval was 20-30 units across repeated trials."],
]) {
  const quantitativeResult = classifyStage4b2ContentsResponse({ response: response({ highlights: [providerPassage] }), independentlyRetrievedText: sourcePassage });
  assert.equal(quantitativeResult.ok, false, `${providerPassage} must not equal ${sourcePassage}`);
  assert.equal(quantitativeResult.reason, "SOURCE_PASSAGE_NOT_VERIFIED");
  assert.equal(quantitativeResult.safeDiagnostics.matchingOutcomes[0].normalizedVerbatimMatch, false);
}
const proseDashResult = classifyStage4b2ContentsResponse({
  response: response({ highlights: ["The agents coordinate—without replacing human judgment in the workflow."] }),
  independentlyRetrievedText: "The agents coordinate-without replacing human judgment in the workflow.",
});
assert.equal(proseDashResult.ok, true);
assert.equal(proseDashResult.matchMode, "normalized_verbatim");
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: ["e-approved"] }, evidenceId: "e-approved" }), true);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: [] }, evidenceId: "e-approved" }), false);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: ["e-substituted"] }, evidenceId: "e-approved" }), false);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "unsupported", evidenceIds: ["e-approved"] }, evidenceId: "e-approved" }), false);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: ["e-approved-1", "e-approved-2"] }, evidenceIds: ["e-approved-1", "e-approved-2"] }), true);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: ["e-approved-1", "e-fabricated"] }, evidenceIds: ["e-approved-1", "e-approved-2"] }), false);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: ["e-approved-1", "e-approved-1"] }, evidenceIds: ["e-approved-1"] }), false);
assert.equal(validateStage4b2ClaimAssessment({ assessment: { status: "supported", evidenceIds: [] }, evidenceIds: ["e-approved-1"] }), false);
assert.equal(STAGE4B2_CONSUMED_EXECUTION_IDS.has("stage4b2-20261020-pdfv2-3"), true);

const historicalTrial3Receipt = JSON.parse(await readFile("docs/creatorlab/receipts/STAGE4B2_20261020_PDFV2_3.json", "utf8"));
assert.equal(historicalTrial3Receipt.executionId, "stage4b2-20261020-pdfv2-3");
assert.equal(historicalTrial3Receipt.state, "blocked");
assert.equal(historicalTrial3Receipt.providerUsage.exaCalls, 1);
assert.equal(historicalTrial3Receipt.providerUsage.openAiCalls, 0);
assert.equal(historicalTrial3Receipt.redactedEvidence.highlightLength, 3988);
assert.match(historicalTrial3Receipt.redactedEvidence.highlightSha256, /^[a-f0-9]{64}$/u);
assert.equal(JSON.stringify(historicalTrial3Receipt).includes("passage"), false);

const directory = await mkdtemp(path.join(os.tmpdir(), "stage4b2-receipts-"));
try {
  await assert.rejects(() => claimStage4b2Execution({ executionId: "stage4b2-20261019-search-1", approvedExecutionId: "stage4b2-20261019-search-1", consent: "confirmed:stage4b2-20261019-search-1", receiptDirectory: directory }), /EXECUTION_ALREADY_CONSUMED/u);
  await assert.rejects(() => claimStage4b2Execution({ executionId: "stage4b2-20261019-contents-2", approvedExecutionId: "stage4b2-20261019-contents-2", consent: "confirmed:stage4b2-20261019-contents-2", receiptDirectory: directory }), /EXECUTION_ALREADY_CONSUMED/u);
  await assert.rejects(() => claimStage4b2Execution({ executionId: "stage4b2-20261020-pdfv2-3", approvedExecutionId: "stage4b2-20261020-pdfv2-3", consent: "confirmed:stage4b2-20261020-pdfv2-3", receiptDirectory: directory }), /EXECUTION_ALREADY_CONSUMED/u);
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
assert.match(probe, /createStage4b2ContentsRequest/u);
assert.doesNotMatch(probe, /api\.exa\.ai\/search|numResults|includeDomains/u);
assert.match(probe, /openAiInputTokens/u);
assert.match(probe, /reservationIsActualBilledCost: false/u);
assert.match(probe, /claimStage4b2Execution/u);
assert.match(probe, /exa_exact_source_contents/u);
assert.match(probe, /independent_original_source/u);
assert.match(probe, /CLAIM_UNSUPPORTED/u);
assert.doesNotMatch(probe, /automatic retry|fallback provider/iu);

console.log("STAGE_4B2_EXACT_SOURCE_RECOVERY=PASS");
