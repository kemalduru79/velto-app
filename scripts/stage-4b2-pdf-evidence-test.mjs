import assert from "node:assert/strict";
import {
  STAGE4B2_APPROVED_PDF_URL,
  STAGE4B2_APPROVED_REPRESENTATIONS,
  STAGE4B2_PDF_MAX_BYTES,
  STAGE4B2_SOURCE_IDENTITY,
  acquireStage4b2ApprovedPdf,
  parseStage4b2PdfLayout,
  verifyStage4b2PdfPassage,
} from "../lib/creator/stage4b2PdfEvidence.server.ts";
import { STAGE4B2_APPROVED_SOURCE_URL, STAGE4B2_CONSUMED_EXECUTION_IDS, classifyStage4b2ContentsResponse } from "../lib/creator/stage4b2ProviderAcceptance.ts";

const pdfBytes = Buffer.from("%PDF-1.7\nfixture objects\n%%EOF\n");
const passage = "One hundred human evaluators compared the agents in a controlled evaluation.";
const pages = (overrides = {}) => Array.from({ length: 22 }, (_unused, index) => ({
  page: index + 1,
  blocks: index === 0
    ? ["Generative Agents: Interactive Simulacra of Human Behavior", "Joon Sung Park and coauthors", "arXiv:2304.03442v2"]
    : index === 12 ? [passage] : [`Bounded fixture content for page ${index + 1}.`],
  ...overrides[index + 1],
}));
const response = (overrides = {}) => ({ status: 200, url: STAGE4B2_APPROVED_PDF_URL, contentType: "application/pdf", contentLength: pdfBytes.length, body: pdfBytes, ...overrides });
const acquire = (responseOverrides = {}, pageOverrides = {}) => acquireStage4b2ApprovedPdf({
  request: async (url) => { assert.equal(url, STAGE4B2_APPROVED_PDF_URL); return response(responseOverrides); },
  extractPages: async () => pages(pageOverrides),
});
const rejectsCode = async (operation, code) => assert.rejects(operation, (error) => error?.code === code);

assert.deepEqual(STAGE4B2_APPROVED_REPRESENTATIONS, {
  abstract: { sourceIdentity: "arxiv:2304.03442v2", representation: "abstract", representationUrl: "https://arxiv.org/abs/2304.03442" },
  pdf_v2: { sourceIdentity: "arxiv:2304.03442v2", representation: "pdf_v2", representationUrl: "https://arxiv.org/pdf/2304.03442v2", expectedPageCount: 22 },
});

const parsed = parseStage4b2PdfLayout("<doc><page><flow><block><line><word>left</word><word>column</word></line></block><block><line><word>right</word><word>column</word></line></block></flow></page></doc>");
assert.deepEqual(parsed, [{ page: 1, blocks: ["left column", "right column"] }]);

const artifact = await acquire();
assert.equal(artifact.sourceIdentity, STAGE4B2_SOURCE_IDENTITY);
assert.equal(artifact.representation, "pdf_v2");
assert.equal(artifact.representationUrl, STAGE4B2_APPROVED_PDF_URL);
assert.equal(artifact.pages.length, 22);
assert.match(artifact.documentSha256, /^[a-f0-9]{64}$/u);
const verified = verifyStage4b2PdfPassage({ artifact, passage });
assert.equal(verified.ok, true);
assert.deepEqual(verified.locator, { page: 13, block: 1 });
assert.equal(verified.representationUrl, STAGE4B2_APPROVED_PDF_URL);
assert.match(verified.pageSha256, /^[a-f0-9]{64}$/u);
assert.match(verified.blockSha256, /^[a-f0-9]{64}$/u);

const providerResponse = { results: [{ id: "opaque-exa-id", url: STAGE4B2_APPROVED_SOURCE_URL, highlights: [passage] }] };
const pdfBacked = classifyStage4b2ContentsResponse({ response: providerResponse, independentlyRetrievedText: "Approved abstract does not contain the evaluation result.", approvedPdfArtifact: artifact });
assert.equal(pdfBacked.ok, true);
assert.equal(pdfBacked.sourceUrl, STAGE4B2_APPROVED_SOURCE_URL, "provider source identity remains the abstract URL");
assert.equal(pdfBacked.sourceIdentity, STAGE4B2_SOURCE_IDENTITY);
assert.equal(pdfBacked.evidenceRepresentation, "pdf_v2");
assert.equal(pdfBacked.representationUrl, STAGE4B2_APPROVED_PDF_URL);
assert.deepEqual(pdfBacked.evidenceLocator, { page: 13, block: 1 });

const secondPassage = "The information-spread simulation retained a separately verified atomic observation.";
const multiPassageArtifact = await acquire({}, { 15: { blocks: [secondPassage] } });
const compositeProviderResponse = { results: [{ id: "opaque-exa-id", url: STAGE4B2_APPROVED_SOURCE_URL, highlights: [`${passage} ${"Composite provider material that is not present in the original document. ".repeat(45)}${secondPassage}`] }] };
const atomicPdfBacked = classifyStage4b2ContentsResponse({ response: compositeProviderResponse, independentlyRetrievedText: "Approved abstract contains neither full-text observation.", approvedPdfArtifact: multiPassageArtifact });
assert.equal(atomicPdfBacked.ok, true);
assert.deepEqual(atomicPdfBacked.evidencePassages.map((item) => item.evidenceLocator), [{ page: 13, block: 1 }, { page: 15, block: 1 }]);
assert.deepEqual(atomicPdfBacked.evidencePassages.map((item) => item.passage), [passage, secondPassage]);
assert.equal(atomicPdfBacked.evidencePassages.every((item) => item.evidenceRepresentation === "pdf_v2" && /^[a-f0-9]{64}$/u.test(item.evidenceBlockFingerprint)), true);

await rejectsCode(() => acquire({ url: "https://example.com/substituted.pdf" }), "PDF_IDENTITY_MISMATCH");
await rejectsCode(() => acquire({ contentType: "text/html" }), "PDF_CONTENT_TYPE_INVALID");
await rejectsCode(() => acquire({ body: Buffer.from("not a pdf"), contentLength: 9 }), "PDF_STRUCTURE_INVALID");
await rejectsCode(() => acquire({ contentLength: STAGE4B2_PDF_MAX_BYTES + 1 }), "PDF_TOO_LARGE");
await rejectsCode(() => acquire({ contentLength: pdfBytes.length + 1 }), "PDF_LENGTH_MISMATCH");
await rejectsCode(() => acquire({ status: 302, location: "https://example.com/substituted.pdf", body: Buffer.alloc(0), contentLength: 0 }), "PDF_REDIRECT_REJECTED");
await rejectsCode(() => acquire({}, { 1: { blocks: ["Generative Agents: Interactive Simulacra of Human Behavior", "Joon Sung Park and coauthors", "arXiv:2304.03442v1"] } }), "PDF_VERSION_IDENTITY_INVALID");
await rejectsCode(() => acquire({}, { 1: { blocks: ["A substituted paper with unrelated authors", "arXiv:2304.03442v2"] } }), "PDF_VERSION_IDENTITY_INVALID");
await rejectsCode(() => acquire({}, { 22: { page: 23 } }), "PDF_PAGE_STRUCTURE_INVALID");

const pageBoundaryArtifact = await acquire({}, {
  13: { blocks: ["A verified passage begins but does not finish"] },
  14: { blocks: ["until the following page supplies the remaining words."] },
});
assert.equal(verifyStage4b2PdfPassage({ artifact: pageBoundaryArtifact, passage: "A verified passage begins but does not finish until the following page supplies the remaining words." }).reason, "PDF_PASSAGE_NOT_VERIFIED");
const columnArtifact = await acquire({}, { 13: { blocks: ["A left-column sentence cannot be joined", "to an unrelated right-column continuation for evidence."] } });
assert.equal(verifyStage4b2PdfPassage({ artifact: columnArtifact, passage: "A left-column sentence cannot be joined to an unrelated right-column continuation for evidence." }).reason, "PDF_PASSAGE_NOT_VERIFIED");
assert.equal(verifyStage4b2PdfPassage({ artifact, passage: "A fabricated result that does not occur anywhere in the approved paper." }).reason, "PDF_PASSAGE_NOT_VERIFIED");

for (const [source, corrupted] of [
  ["The experiment used 10⁶ agents in a controlled evaluation.", "The experiment used 106 agents in a controlled evaluation."],
  ["The score ranged from 20—30 in the controlled evaluation.", "The score ranged from 20-30 in the controlled evaluation."],
]) {
  const quantitativeArtifact = await acquire({}, { 13: { blocks: [source] } });
  assert.equal(verifyStage4b2PdfPassage({ artifact: quantitativeArtifact, passage: corrupted }).reason, "PDF_PASSAGE_NOT_VERIFIED");
}

const duplicateArtifact = await acquire({}, { 14: { blocks: [passage] } });
assert.equal(verifyStage4b2PdfPassage({ artifact: duplicateArtifact, passage }).reason, "PDF_PASSAGE_AMBIGUOUS");
assert.equal(STAGE4B2_CONSUMED_EXECUTION_IDS.has("stage4b2-20261019-search-1"), true);
assert.equal(STAGE4B2_CONSUMED_EXECUTION_IDS.has("stage4b2-20261019-contents-2"), true);
assert.equal(STAGE4B2_CONSUMED_EXECUTION_IDS.has("stage4b2-20261020-pdfv2-3"), true);

console.log("STAGE_4B2_PDF_EVIDENCE=PASS");
