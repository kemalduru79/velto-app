import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  SCIENTIFIC_EVIDENCE_METADATA_VERSION,
  computeScientificEvidenceManifestIdentity,
  importScientificEvidenceMetadata,
  locatorAuthorityForImportedBundle,
  scientificSha256,
  stableScientificJson,
} from "../lib/creator/scientificReview/index.ts";

let passed = 0;
let observedFetches = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { observedFetches += 1; throw new Error("NETWORK_FORBIDDEN"); };

async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
const hash = (value) => scientificSha256(value);
function buildManifest(claimCount = 3) {
  const sources = Array.from({ length: Math.max(1, Math.ceil(claimCount / 5)) }, (_, index) => {
    const canonicalUrl = `https://publisher.example/paper-${index + 1}/v1`;
    return {
      sourceId: `source-${index + 1}`, canonicalUrl, canonicalUrlSha256: hash(canonicalUrl),
      titleSha256: hash(`title-${index + 1}`), publisherSha256: hash(`publisher-${index + 1}`),
      sourceVersion: "v1", mediaType: index % 2 ? "application/pdf" : "text/html",
      documentSha256: hash(`document-${index + 1}`),
      acquisitionAuthority: { kind: index % 2 ? "publisher_receipt_reference" : "owner_supplied_reference", receiptSha256: hash(`receipt-${index + 1}`) },
    };
  });
  const claims = Array.from({ length: claimCount }, (_, index) => ({
    claimId: `claim-${index + 1}`, claimTextSha256: hash(`private-claim-${index + 1}`),
    claimType: index % 2 ? "quantitative" : "observational", propositionKind: "scientific_assertion",
  }));
  const evidence = claims.map((_, index) => ({
    evidenceId: `evidence-${index + 1}`, sourceId: sources[index % sources.length].sourceId,
    passageSha256: hash(`private-passage-${index + 1}`), locatorId: `locator-${index + 1}`,
  }));
  const links = claims.map((claim, index) => ({ claimId: claim.claimId, evidenceId: evidence[index].evidenceId, stance: index % 3 === 0 ? "contextualizes" : "supports" }));
  const locators = evidence.map((item, index) => ({
    locatorId: item.locatorId, evidenceId: item.evidenceId, sourceId: item.sourceId,
    kind: sources[index % sources.length].mediaType === "application/pdf" ? "pdf_page_block" : "html_dom_range",
    originalLocatorSha256: hash(`original-locator-${index + 1}`), normalizedLocatorSha256: hash(`normalized-locator-${index + 1}`),
    matchCardinality: "unique",
    verificationAuthority: index === 0
      ? { kind: "independently_verified_locator_receipt_reference", receiptSha256: hash("locator-receipt"), verifierIdentitySha256: hash("verifier"), methodVersion: "fixture-v1" }
      : { kind: "unverified_metadata" },
  }));
  const sectionRouting = [{ sectionId: "section-1", claimIds: claims.map((claim) => claim.claimId), evidenceIds: evidence.map((item) => item.evidenceId) }];
  const identityInput = { version: SCIENTIFIC_EVIDENCE_METADATA_VERSION, packageId: "synthetic-package", packageRevision: "revision-1", sources, claims, evidence, links, locators, sectionRouting };
  return { ...identityInput, manifestIdentitySha256: computeScientificEvidenceManifestIdentity(identityInput) };
}
async function privateWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "stage-5e1g-a-"));
  await mkdir(path.join(root, "inputs"), { mode: 0o700 });
  await mkdir(path.join(root, "runs"), { mode: 0o700 });
  return root;
}
async function writeManifest(root, manifest, name = "metadata.json") {
  const manifestPath = path.join(root, "inputs", name);
  const bytes = Buffer.from(`${stableScientificJson(manifest)}\n`);
  await writeFile(manifestPath, bytes, { mode: 0o600, flag: "wx" });
  return { manifestPath, manifestSha256: hash(bytes) };
}
async function expectFailure(mutator, reason) {
  const root = await privateWorkspace();
  const manifest = structuredClone(buildManifest());
  mutator(manifest);
  // Recompute only when testing structural semantics rather than identity tampering.
  if (reason !== "MANIFEST_IDENTITY_MISMATCH") {
    const { manifestIdentitySha256: _ignored, ...identityInput } = manifest;
    manifest.manifestIdentitySha256 = computeScientificEvidenceManifestIdentity(identityInput);
  }
  const written = await writeManifest(root, manifest);
  await assert.rejects(
    importScientificEvidenceMetadata({ ...written, expectedManifestSha256: written.manifestSha256, runDirectory: path.join(root, "runs", "run") }),
    new RegExp(`STAGE_5E1G_A_${reason}`),
  );
}

await test("imports a generic 23-claim metadata package without a hardcoded claim limit", async () => {
  const root = await privateWorkspace();
  const manifest = buildManifest(23);
  const written = await writeManifest(root, manifest);
  const result = await importScientificEvidenceMetadata({ manifestPath: written.manifestPath, expectedManifestSha256: written.manifestSha256, runDirectory: path.join(root, "runs", "run-1") });
  assert.equal(result.audit.counts.claims, 23);
  assert.equal(result.audit.counts.evidence, 23);
  assert.equal(result.report.status, "REVIEW_REQUIRED");
  assert.equal(result.report.liveDisposition, "NO_GO");
  assert.equal(result.bundle.authority.establishes, "IDENTITY_AND_RELATIONSHIPS_ONLY");
  assert.equal((await stat(result.runDirectory)).mode & 0o077, 0);
  for (const file of ["metadata-bundle.json", "audit.json", "acceptance-report.json"]) {
    assert.equal((await stat(path.join(result.runDirectory, file))).mode & 0o077, 0);
  }
});

await test("produces deterministic privacy-safe audit and acceptance reports", async () => {
  const root = await privateWorkspace();
  const manifest = buildManifest(5);
  const written = await writeManifest(root, manifest);
  const first = await importScientificEvidenceMetadata({ manifestPath: written.manifestPath, expectedManifestSha256: written.manifestSha256, runDirectory: path.join(root, "runs", "a") });
  const second = await importScientificEvidenceMetadata({ manifestPath: written.manifestPath, expectedManifestSha256: written.manifestSha256, runDirectory: path.join(root, "runs", "b") });
  assert.deepEqual(first.audit, second.audit);
  assert.deepEqual(first.report, second.report);
  assert.equal(first.report.deterministicAuditSha256, hash(stableScientificJson(first.audit)));
  const safeOutputs = `${await readFile(path.join(first.runDirectory, "audit.json"), "utf8")}\n${await readFile(path.join(first.runDirectory, "acceptance-report.json"), "utf8")}`;
  assert.equal(safeOutputs.includes("publisher.example"), false);
  assert.equal(safeOutputs.includes("claim-1"), false);
  assert.equal(safeOutputs.includes("private-claim"), false);
});

await test("keeps independent locator receipts reference-only", async () => {
  const authority = locatorAuthorityForImportedBundle(buildManifest().locators[0]);
  assert.equal(authority.kind, "independently_verified_locator_receipt_reference");
  assert.equal(authority.importerStatus, "REFERENCE_ONLY_NOT_AUTHENTICATED");
});

await test("rejects invalid manifest and provenance hashes", async () => {
  await expectFailure((manifest) => { manifest.sources[0].documentSha256 = "0".repeat(63); }, "DOCUMENT_SHA256_INVALID");
  await expectFailure((manifest) => { manifest.sources[0].canonicalUrlSha256 = hash("wrong"); }, "CANONICAL_URL_HASH_MISMATCH");
  await expectFailure((manifest) => { manifest.manifestIdentitySha256 = hash("wrong identity"); }, "MANIFEST_IDENTITY_MISMATCH");
});

await test("rejects missing evidence, unresolved links, and unlinked evidence", async () => {
  await expectFailure((manifest) => { manifest.links = manifest.links.filter((link) => link.claimId !== "claim-1"); }, "CLAIM_MISSING_EVIDENCE");
  await expectFailure((manifest) => { manifest.links[0].evidenceId = "evidence-absent"; }, "LINK_UNRESOLVED");
  await expectFailure((manifest) => { manifest.links = manifest.links.filter((link) => link.evidenceId !== "evidence-2"); }, "CLAIM_MISSING_EVIDENCE");
});

await test("rejects conflicting versions for one canonical source identity", async () => {
  await expectFailure((manifest) => {
    const second = structuredClone(manifest.sources[0]);
    second.sourceId = "source-conflict";
    second.sourceVersion = "v2";
    second.documentSha256 = hash("different-document");
    manifest.sources.push(second);
  }, "CONFLICTING_SOURCE_VERSION");
  await expectFailure((manifest) => {
    const duplicate = structuredClone(manifest.sources[0]);
    duplicate.sourceId = "source-duplicate";
    manifest.sources.push(duplicate);
  }, "DUPLICATE_CANONICAL_SOURCE_IDENTITY");
});

await test("rejects raw text, approval smuggling, and malformed records", async () => {
  await expectFailure((manifest) => { manifest.claims[0].claimText = "must remain private"; }, "CLAIM_SCHEMA_INVALID");
  await expectFailure((manifest) => { manifest.humanApproval = true; }, "MANIFEST_SCHEMA_INVALID");
  await expectFailure((manifest) => { manifest.links[0].stance = "proves"; }, "LINK_INVALID");
});

await test("rejects missing or ambiguous locators and mismatched locator identity", async () => {
  await expectFailure((manifest) => { manifest.locators[0].matchCardinality = "ambiguous"; }, "LOCATOR_AMBIGUOUS_OR_INVALID");
  await expectFailure((manifest) => { manifest.locators[0].sourceId = "source-absent"; }, "EVIDENCE_AUTHORITY_UNRESOLVED");
  await expectFailure((manifest) => { manifest.locators.pop(); }, "EVIDENCE_AUTHORITY_UNRESOLVED");
});

await test("rejects symlinked manifests and replayed output directories", async () => {
  const root = await privateWorkspace();
  const written = await writeManifest(root, buildManifest(), "real.json");
  const linked = path.join(root, "inputs", "linked.json");
  await symlink(written.manifestPath, linked);
  await assert.rejects(importScientificEvidenceMetadata({ manifestPath: linked, expectedManifestSha256: written.manifestSha256, runDirectory: path.join(root, "runs", "linked-run") }), /STAGE_5E1G_A_PRIVATE_MANIFEST_INVALID/);
  const runDirectory = path.join(root, "runs", "once");
  await importScientificEvidenceMetadata({ manifestPath: written.manifestPath, expectedManifestSha256: written.manifestSha256, runDirectory });
  await assert.rejects(importScientificEvidenceMetadata({ manifestPath: written.manifestPath, expectedManifestSha256: written.manifestSha256, runDirectory }), /STAGE_5E1G_A_RUN_DIRECTORY_ALREADY_EXISTS_OR_UNAVAILABLE/);
});

await test("rejects section routes outside canonical claim/evidence authority", async () => {
  await expectFailure((manifest) => { manifest.sectionRouting[0].claimIds.push("claim-absent"); }, "SECTION_ROUTING_UNRESOLVED");
  await expectFailure((manifest) => { manifest.sectionRouting[0].evidenceIds = ["evidence-2"]; manifest.sectionRouting[0].claimIds = ["claim-1"]; }, "SECTION_ROUTING_LINK_MISSING");
});

assert.equal(observedFetches, 0);
globalThis.fetch = originalFetch;
console.log(`STAGE_5E1G_A_METADATA_IMPORTER=PASS (${passed}/10)`);
console.log("LIVE_NO_GO=true");
console.log("MOCK_ONLY=true");
console.log("OBSERVED_FETCH_REQUESTS=0");
