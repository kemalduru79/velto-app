import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  STAGE4B2_APPROVED_PDF_URL,
  STAGE4B2_PDF_PAGE_COUNT,
  STAGE4B2_SOURCE_IDENTITY,
  acquireStage4b2ApprovedPdf,
  verifyStage4b2PdfPassage,
} from "../lib/creator/stage4b2PdfEvidence.server.ts";

const OPT_IN = "confirmed-local-pdf-only";
const EXPECTED_DOCUMENT_SHA256 = "1b31e77fb24d25d7598f2c49e955d12a28b95a6dabad34acdac40f44bfb7a139";
const EXPECTED_EXTRACTION_SHA256 = "d3dfbb7003bafb1b4eb39e9fa9ff5dc020f6c41bbc3fbaab8449c4426133f4f2";
const EXPECTED_EVIDENCE = Object.freeze([
  Object.freeze({ page: 14, block: 3, blockSha256: "cebf958ad99da103b8c39e1d157989a4a8e8837d5acab1867b0d5f5cffa28b41" }),
  Object.freeze({ page: 16, block: 4, blockSha256: "a05a2ce6b9bd4c041a0da5c84ff948fffca8d3163dff8d270789685e86357c3f" }),
]);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function report(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (process.env.STAGE4B2_REAL_PDF_ACCEPTANCE !== OPT_IN) {
  report({
    status: "BLOCKED",
    reason: "LOCAL_OPT_IN_REQUIRED",
    requiredOptIn: `STAGE4B2_REAL_PDF_ACCEPTANCE=${OPT_IN}`,
    networkRequests: 0,
    stage4b2Status: "REVIEW_REQUIRED",
  });
  process.exit(0);
}

const pdfPath = process.env.STAGE4B2_REAL_PDF_PATH || join(homedir(), "Downloads", "arxiv-2304.03442.pdf");
const bundledPoppler = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "native", "poppler", "poppler", "bin", "pdftotext");
const popplerBinary = process.env.STAGE4B2_PDFTOTEXT_BIN || bundledPoppler;

try {
  await access(pdfPath, fsConstants.R_OK);
  await access(popplerBinary, fsConstants.X_OK);
} catch {
  report({ status: "BLOCKED", reason: "LOCAL_PDF_OR_POPPLER_UNAVAILABLE", networkRequests: 0, stage4b2Status: "REVIEW_REQUIRED" });
  process.exit(1);
}

const versionProbe = spawnSync(popplerBinary, ["-v"], { encoding: "utf8", timeout: 5_000, maxBuffer: 16 * 1024 });
const versionOutput = `${versionProbe.stdout || ""}\n${versionProbe.stderr || ""}`;
const versionMatch = versionOutput.match(/pdftotext version (\d+)\.(\d+)\.(\d+)/u);
if (versionProbe.status !== 0 || !versionMatch || Number(versionMatch[1]) < 22) {
  report({ status: "BLOCKED", reason: "POPPLER_VERSION_UNSUPPORTED", networkRequests: 0, stage4b2Status: "REVIEW_REQUIRED" });
  process.exit(1);
}
const popplerVersion = `${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}`;
process.env.STAGE4B2_PDFTOTEXT_BIN = popplerBinary;

const pdfBytes = await readFile(pdfPath);
assert.equal(sha256(pdfBytes), EXPECTED_DOCUMENT_SHA256, "local PDF identity changed");
let injectedReads = 0;
const artifact = await acquireStage4b2ApprovedPdf({
  request: async (url) => {
    injectedReads += 1;
    assert.equal(url, STAGE4B2_APPROVED_PDF_URL);
    return { status: 200, url, contentType: "application/pdf", contentLength: pdfBytes.byteLength, body: pdfBytes };
  },
});

assert.equal(injectedReads, 1);
assert.equal(artifact.sourceIdentity, STAGE4B2_SOURCE_IDENTITY);
assert.equal(artifact.representation, "pdf_v2");
assert.equal(artifact.representationUrl, STAGE4B2_APPROVED_PDF_URL);
assert.equal(artifact.documentSha256, EXPECTED_DOCUMENT_SHA256);
assert.equal(artifact.extractionSha256, EXPECTED_EXTRACTION_SHA256);
assert.equal(artifact.pages.length, STAGE4B2_PDF_PAGE_COUNT);

const evidence = EXPECTED_EVIDENCE.map((expected) => {
  const page = artifact.pages[expected.page - 1];
  const block = page?.blocks[expected.block - 1];
  assert.ok(block, `expected page/block locator is unavailable: ${expected.page}/${expected.block}`);
  assert.equal(sha256(block), expected.blockSha256, `page/block fingerprint changed: ${expected.page}/${expected.block}`);
  const result = verifyStage4b2PdfPassage({ artifact, passage: block });
  assert.equal(result.ok, true, `one-block evidence did not verify: ${expected.page}/${expected.block}`);
  assert.deepEqual(result.locator, { page: expected.page, block: expected.block });
  assert.equal(result.blockSha256, expected.blockSha256);
  return {
    locator: result.locator,
    matchMode: result.matchMode,
    passageSha256: result.passageSha256,
    pageSha256: result.pageSha256,
    blockSha256: result.blockSha256,
  };
});

const fabricated = verifyStage4b2PdfPassage({
  artifact,
  passage: "Fabricated acceptance evidence that is absent from the approved version-pinned document.",
});
assert.deepEqual(fabricated, { ok: false, reason: "PDF_PASSAGE_NOT_VERIFIED" });

for (const expected of EXPECTED_EVIDENCE) {
  const original = artifact.pages[expected.page - 1].blocks[expected.block - 1];
  const numericMatch = original.match(/[0-9]/u);
  assert.ok(numericMatch?.index !== undefined, `numeric evidence fixture missing: ${expected.page}/${expected.block}`);
  const replacement = numericMatch[0] === "9" ? "8" : String(Number(numericMatch[0]) + 1);
  const altered = `${original.slice(0, numericMatch.index)}${replacement}${original.slice(numericMatch.index + 1)}`;
  assert.deepEqual(verifyStage4b2PdfPassage({ artifact, passage: altered }), { ok: false, reason: "PDF_PASSAGE_NOT_VERIFIED" });
}

report({
  status: "PASS",
  sourceIdentity: artifact.sourceIdentity,
  representation: artifact.representation,
  documentSha256: artifact.documentSha256,
  extractionSha256: artifact.extractionSha256,
  pageCount: artifact.pages.length,
  popplerVersion,
  evidence,
  fabricatedPassageRejected: true,
  alteredNumericValuesRejected: true,
  networkRequests: 0,
  stage4b2Status: "REVIEW_REQUIRED",
});
