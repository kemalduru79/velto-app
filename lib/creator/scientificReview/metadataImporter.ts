import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import {
  EVIDENCE_STANCES,
  LOCATOR_KINDS,
  SCIENTIFIC_EVIDENCE_IMPORT_VERSION,
  SCIENTIFIC_EVIDENCE_METADATA_VERSION,
  computeScientificEvidenceManifestIdentity,
  scientificSha256,
  stableScientificJson,
  stage5e1gFail,
} from "./authorityContracts.ts";
import type {
  EvidenceStance,
  IndependentlyVerifiedLocatorAuthority,
  LocatorKind,
  ScientificEvidenceMetadataManifest,
  ScientificMetadataLocator,
} from "./authorityContracts.ts";

const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value: unknown, keys: readonly string[], label: string) {
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) {
    stage5e1gFail(`${label}_SCHEMA_INVALID`);
  }
}
function string(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) stage5e1gFail(`${label}_INVALID`);
  return value;
}
function id(value: unknown, label: string): string {
  const result = string(value, label, 200);
  if (!ID_PATTERN.test(result)) stage5e1gFail(`${label}_INVALID`);
  return result;
}
function sha(value: unknown, label: string): string {
  const result = string(value, label, 64);
  if (!SHA256_PATTERN.test(result)) stage5e1gFail(`${label}_INVALID`);
  return result;
}
function array(value: unknown, label: string, max = 10_000): unknown[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) stage5e1gFail(`${label}_INVALID`);
  return value;
}
function unique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) stage5e1gFail(`DUPLICATE_${label}`);
}
function canonicalHttpsUrl(value: unknown): string {
  const raw = string(value, "CANONICAL_URL", 2000);
  let parsed: URL;
  try { parsed = new URL(raw); } catch { stage5e1gFail("CANONICAL_URL_INVALID"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash || parsed.toString() !== raw) {
    stage5e1gFail("CANONICAL_URL_INVALID");
  }
  return raw;
}
function isApprovedDarwinSystemAlias(parent: string, resolvedParent: string): boolean {
  if (process.platform !== "darwin") return false;
  const systemAlias = parent === "/var" || parent.startsWith("/var/") || parent === "/tmp" || parent.startsWith("/tmp/");
  return systemAlias && resolvedParent === `/private${parent}`;
}
async function privateCanonicalParent(inputPath: string): Promise<string> {
  if (!path.isAbsolute(inputPath)) stage5e1gFail("ABSOLUTE_PATH_REQUIRED");
  const parent = path.dirname(path.resolve(inputPath));
  const parentStat = await lstat(parent).catch(() => stage5e1gFail("PARENT_UNAVAILABLE"));
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || (parentStat.mode & 0o077) !== 0) {
    stage5e1gFail("PRIVATE_PARENT_REQUIRED");
  }
  const resolvedParent = await realpath(parent);
  if (resolvedParent !== parent && !isApprovedDarwinSystemAlias(parent, resolvedParent)) stage5e1gFail("PARENT_REALPATH_MISMATCH");
  return resolvedParent;
}
async function readPrivateManifest(manifestPath: string, expectedSha256: string): Promise<{ bytes: Buffer; canonicalPath: string }> {
  sha(expectedSha256, "EXPECTED_MANIFEST_SHA256");
  const resolvedParent = await privateCanonicalParent(manifestPath);
  const canonicalPath = path.join(resolvedParent, path.basename(manifestPath));
  const stat = await lstat(canonicalPath).catch(() => stage5e1gFail("MANIFEST_UNAVAILABLE"));
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0 || stat.size < 2 || stat.size > MAX_MANIFEST_BYTES) {
    stage5e1gFail("PRIVATE_MANIFEST_INVALID");
  }
  const handle = await open(canonicalPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  let bytes: Buffer;
  try { bytes = await handle.readFile(); } finally { await handle.close(); }
  if (bytes.byteLength !== stat.size || scientificSha256(bytes) !== expectedSha256) stage5e1gFail("MANIFEST_HASH_MISMATCH");
  return { bytes, canonicalPath };
}

function validateManifest(value: unknown): ScientificEvidenceMetadataManifest {
  exactKeys(value, ["version", "packageId", "packageRevision", "manifestIdentitySha256", "sources", "claims", "evidence", "links", "locators", "sectionRouting"], "MANIFEST");
  if (!record(value) || value.version !== SCIENTIFIC_EVIDENCE_METADATA_VERSION) stage5e1gFail("MANIFEST_VERSION_UNSUPPORTED");
  const packageId = id(value.packageId, "PACKAGE_ID");
  const packageRevision = string(value.packageRevision, "PACKAGE_REVISION", 200);
  const manifestIdentitySha256 = sha(value.manifestIdentitySha256, "MANIFEST_IDENTITY_SHA256");

  const sources = array(value.sources, "SOURCES", 2000).map((entry) => {
    exactKeys(entry, ["sourceId", "canonicalUrl", "canonicalUrlSha256", "titleSha256", "publisherSha256", "sourceVersion", "mediaType", "documentSha256", "acquisitionAuthority"], "SOURCE");
    if (!record(entry)) stage5e1gFail("SOURCE_SCHEMA_INVALID");
    const canonicalUrl = canonicalHttpsUrl(entry.canonicalUrl);
    exactKeys(entry.acquisitionAuthority, ["kind", "receiptSha256"], "ACQUISITION_AUTHORITY");
    if (!record(entry.acquisitionAuthority) ||
      !["owner_supplied_reference", "publisher_receipt_reference"].includes(String(entry.acquisitionAuthority.kind))) {
      stage5e1gFail("ACQUISITION_AUTHORITY_INVALID");
    }
    if (!["text/plain", "text/html", "application/pdf"].includes(String(entry.mediaType))) stage5e1gFail("SOURCE_MEDIA_TYPE_INVALID");
    const mediaType = entry.mediaType as "text/plain" | "text/html" | "application/pdf";
    const canonicalUrlSha256 = sha(entry.canonicalUrlSha256, "CANONICAL_URL_SHA256");
    if (canonicalUrlSha256 !== scientificSha256(canonicalUrl)) stage5e1gFail("CANONICAL_URL_HASH_MISMATCH");
    return {
      sourceId: id(entry.sourceId, "SOURCE_ID"), canonicalUrl, canonicalUrlSha256,
      titleSha256: sha(entry.titleSha256, "TITLE_SHA256"), publisherSha256: sha(entry.publisherSha256, "PUBLISHER_SHA256"),
      sourceVersion: string(entry.sourceVersion, "SOURCE_VERSION", 200), mediaType,
      documentSha256: sha(entry.documentSha256, "DOCUMENT_SHA256"),
      acquisitionAuthority: {
        kind: entry.acquisitionAuthority.kind,
        receiptSha256: sha(entry.acquisitionAuthority.receiptSha256, "ACQUISITION_RECEIPT_SHA256"),
      },
    };
  });
  unique(sources.map((source) => source.sourceId), "SOURCE_ID");
  const versionByUrl = new Map<string, string>();
  for (const source of sources) {
    const fingerprint = `${source.sourceVersion}:${source.documentSha256}`;
    const previous = versionByUrl.get(source.canonicalUrl);
    if (previous && previous !== fingerprint) stage5e1gFail("CONFLICTING_SOURCE_VERSION");
    if (previous === fingerprint) stage5e1gFail("DUPLICATE_CANONICAL_SOURCE_IDENTITY");
    versionByUrl.set(source.canonicalUrl, fingerprint);
  }

  const claims = array(value.claims, "CLAIMS").map((entry) => {
    exactKeys(entry, ["claimId", "claimTextSha256", "claimType", "propositionKind"], "CLAIM");
    if (!record(entry)) stage5e1gFail("CLAIM_SCHEMA_INVALID");
    return { claimId: id(entry.claimId, "CLAIM_ID"), claimTextSha256: sha(entry.claimTextSha256, "CLAIM_TEXT_SHA256"),
      claimType: id(entry.claimType, "CLAIM_TYPE"), propositionKind: id(entry.propositionKind, "PROPOSITION_KIND") };
  });
  unique(claims.map((claim) => claim.claimId), "CLAIM_ID");

  const evidence = array(value.evidence, "EVIDENCE").map((entry) => {
    exactKeys(entry, ["evidenceId", "sourceId", "passageSha256", "locatorId"], "EVIDENCE_RECORD");
    if (!record(entry)) stage5e1gFail("EVIDENCE_SCHEMA_INVALID");
    return { evidenceId: id(entry.evidenceId, "EVIDENCE_ID"), sourceId: id(entry.sourceId, "EVIDENCE_SOURCE_ID"),
      passageSha256: sha(entry.passageSha256, "PASSAGE_SHA256"), locatorId: id(entry.locatorId, "EVIDENCE_LOCATOR_ID") };
  });
  unique(evidence.map((item) => item.evidenceId), "EVIDENCE_ID");

  const links = array(value.links, "LINKS", 50_000).map((entry) => {
    exactKeys(entry, ["claimId", "evidenceId", "stance"], "LINK");
    if (!record(entry) || !EVIDENCE_STANCES.includes(entry.stance as never)) stage5e1gFail("LINK_INVALID");
    return { claimId: id(entry.claimId, "LINK_CLAIM_ID"), evidenceId: id(entry.evidenceId, "LINK_EVIDENCE_ID"), stance: entry.stance as EvidenceStance };
  });
  unique(links.map((link) => `${link.claimId}:${link.evidenceId}:${link.stance}`), "LINK");

  const locators = array(value.locators, "LOCATORS").map((entry) => {
    exactKeys(entry, ["locatorId", "evidenceId", "sourceId", "kind", "originalLocatorSha256", "normalizedLocatorSha256", "matchCardinality", "verificationAuthority"], "LOCATOR");
    if (!record(entry) || !LOCATOR_KINDS.includes(entry.kind as never) || entry.matchCardinality !== "unique") stage5e1gFail("LOCATOR_AMBIGUOUS_OR_INVALID");
    const authority = entry.verificationAuthority;
    if (!record(authority) || !["unverified_metadata", "independently_verified_locator_receipt_reference"].includes(String(authority.kind))) {
      stage5e1gFail("LOCATOR_AUTHORITY_INVALID");
    }
    let verificationAuthority: ScientificMetadataLocator["verificationAuthority"];
    if (authority.kind === "unverified_metadata") {
      exactKeys(authority, ["kind"], "LOCATOR_AUTHORITY");
      verificationAuthority = { kind: "unverified_metadata" };
    } else {
      exactKeys(authority, ["kind", "receiptSha256", "verifierIdentitySha256", "methodVersion"], "LOCATOR_AUTHORITY");
      verificationAuthority = {
        kind: "independently_verified_locator_receipt_reference",
        receiptSha256: sha(authority.receiptSha256, "LOCATOR_RECEIPT_SHA256"),
        verifierIdentitySha256: sha(authority.verifierIdentitySha256, "LOCATOR_VERIFIER_SHA256"),
        methodVersion: string(authority.methodVersion, "LOCATOR_METHOD_VERSION", 200),
      };
    }
    return {
      locatorId: id(entry.locatorId, "LOCATOR_ID"), evidenceId: id(entry.evidenceId, "LOCATOR_EVIDENCE_ID"),
      sourceId: id(entry.sourceId, "LOCATOR_SOURCE_ID"), kind: entry.kind as LocatorKind,
      originalLocatorSha256: sha(entry.originalLocatorSha256, "ORIGINAL_LOCATOR_SHA256"),
      normalizedLocatorSha256: sha(entry.normalizedLocatorSha256, "NORMALIZED_LOCATOR_SHA256"),
      matchCardinality: "unique" as const, verificationAuthority,
    };
  });
  unique(locators.map((locator) => locator.locatorId), "LOCATOR_ID");

  if (!Array.isArray(value.sectionRouting) || value.sectionRouting.length > 500) stage5e1gFail("SECTION_ROUTING_INVALID");
  const sectionRouting = value.sectionRouting.map((entry) => {
    exactKeys(entry, ["sectionId", "claimIds", "evidenceIds"], "SECTION_ROUTING");
    if (!record(entry) || !Array.isArray(entry.claimIds) || !Array.isArray(entry.evidenceIds)) stage5e1gFail("SECTION_ROUTING_INVALID");
    const claimIds = entry.claimIds.map((item) => id(item, "SECTION_CLAIM_ID"));
    const evidenceIds = entry.evidenceIds.map((item) => id(item, "SECTION_EVIDENCE_ID"));
    unique(claimIds, "SECTION_CLAIM_ID"); unique(evidenceIds, "SECTION_EVIDENCE_ID");
    return { sectionId: id(entry.sectionId, "SECTION_ID"), claimIds, evidenceIds };
  });
  unique(sectionRouting.map((section) => section.sectionId), "SECTION_ID");

  const sourceIds = new Set(sources.map((source) => source.sourceId));
  const claimIds = new Set(claims.map((claim) => claim.claimId));
  const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
  const locatorById = new Map(locators.map((locator) => [locator.locatorId, locator]));
  for (const item of evidence) {
    const locator = locatorById.get(item.locatorId);
    if (!sourceIds.has(item.sourceId) || !locator || locator.evidenceId !== item.evidenceId || locator.sourceId !== item.sourceId) {
      stage5e1gFail("EVIDENCE_AUTHORITY_UNRESOLVED");
    }
  }
  for (const link of links) if (!claimIds.has(link.claimId) || !evidenceById.has(link.evidenceId)) stage5e1gFail("LINK_UNRESOLVED");
  for (const claimId of claimIds) if (!links.some((link) => link.claimId === claimId)) stage5e1gFail("CLAIM_MISSING_EVIDENCE");
  for (const evidenceId of evidenceById.keys()) if (!links.some((link) => link.evidenceId === evidenceId)) stage5e1gFail("UNLINKED_EVIDENCE");
  for (const section of sectionRouting) {
    if (section.claimIds.some((claimId) => !claimIds.has(claimId)) || section.evidenceIds.some((evidenceId) => !evidenceById.has(evidenceId))) {
      stage5e1gFail("SECTION_ROUTING_UNRESOLVED");
    }
    for (const evidenceId of section.evidenceIds) {
      if (!links.some((link) => section.claimIds.includes(link.claimId) && link.evidenceId === evidenceId)) {
        stage5e1gFail("SECTION_ROUTING_LINK_MISSING");
      }
    }
  }

  const parsed = { version: SCIENTIFIC_EVIDENCE_METADATA_VERSION, packageId, packageRevision, manifestIdentitySha256,
    sources, claims, evidence, links, locators, sectionRouting } as ScientificEvidenceMetadataManifest;
  const { manifestIdentitySha256: _ignored, ...identityInput } = parsed;
  if (computeScientificEvidenceManifestIdentity(identityInput) !== manifestIdentitySha256) stage5e1gFail("MANIFEST_IDENTITY_MISMATCH");
  return parsed;
}

async function durableCreate(dir: string, name: string, value: unknown) {
  const destination = path.join(dir, name);
  const handle = await open(destination, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(`${stableScientificJson(value)}\n`, "utf8"); await handle.sync(); } finally { await handle.close(); }
  const directory = await open(dir, constants.O_RDONLY | constants.O_DIRECTORY);
  try { await directory.sync(); } finally { await directory.close(); }
}

export async function importScientificEvidenceMetadata(input: Readonly<{
  manifestPath: string;
  expectedManifestSha256: string;
  runDirectory: string;
}>) {
  const { bytes } = await readPrivateManifest(input.manifestPath, input.expectedManifestSha256);
  let raw: unknown;
  try { raw = JSON.parse(bytes.toString("utf8")); } catch { stage5e1gFail("MANIFEST_JSON_INVALID"); }
  const manifest = validateManifest(raw);
  const outputParent = await privateCanonicalParent(input.runDirectory);
  const runDirectory = path.join(outputParent, path.basename(input.runDirectory));
  try { await mkdir(runDirectory, { mode: 0o700 }); } catch { stage5e1gFail("RUN_DIRECTORY_ALREADY_EXISTS_OR_UNAVAILABLE"); }
  const runStat = await lstat(runDirectory);
  if (!runStat.isDirectory() || (runStat.mode & 0o077) !== 0) stage5e1gFail("PRIVATE_RUN_DIRECTORY_INVALID");

  const locatorReceiptReferences = manifest.locators.filter((locator) => locator.verificationAuthority.kind === "independently_verified_locator_receipt_reference").length;
  const pdfCount = manifest.sources.filter((source) => source.mediaType === "application/pdf").length;
  const authority = {
    kind: "owner_imported_metadata" as const,
    manifestSha256: input.expectedManifestSha256,
    manifestIdentitySha256: manifest.manifestIdentitySha256,
    establishes: "IDENTITY_AND_RELATIONSHIPS_ONLY" as const,
  };
  const bundle = { version: SCIENTIFIC_EVIDENCE_IMPORT_VERSION, status: "IMPORTED_METADATA_REVIEW_REQUIRED", authority, manifest };
  const audit = {
    version: SCIENTIFIC_EVIDENCE_IMPORT_VERSION,
    event: "metadata_imported",
    manifestSha256: input.expectedManifestSha256,
    manifestIdentitySha256: manifest.manifestIdentitySha256,
    counts: { sources: manifest.sources.length, claims: manifest.claims.length, evidence: manifest.evidence.length,
      links: manifest.links.length, locators: manifest.locators.length, sections: manifest.sectionRouting.length,
      locatorReceiptReferences, pdfSourcesWithoutExtraction: pdfCount },
    privacy: { rawClaimText: false, rawEvidencePassages: false, sourceDocuments: false, credentials: false },
    authorityEstablished: "IDENTITY_AND_RELATIONSHIPS_ONLY",
  };
  const report = {
    version: SCIENTIFIC_EVIDENCE_IMPORT_VERSION,
    status: "REVIEW_REQUIRED",
    liveDisposition: "NO_GO",
    mode: "OFFLINE_METADATA_ONLY",
    counts: audit.counts,
    reasonCodes: [
      "SOURCE_PROVENANCE_REQUIRES_EXTERNAL_VALIDATION",
      "LOCATOR_RECEIPT_REFERENCES_NOT_AUTHENTICATED_BY_IMPORTER",
      ...(pdfCount ? ["PDF_EXTRACTION_NOT_PERFORMED"] : []),
      "AI_REVIEW_NOT_PERFORMED",
      "QUALIFIED_HUMAN_APPROVAL_MISSING",
    ],
    deterministicAuditSha256: scientificSha256(stableScientificJson(audit)),
    liveAuthorization: false,
    scientificPublicationAuthority: false,
  };
  await durableCreate(runDirectory, "metadata-bundle.json", bundle);
  await durableCreate(runDirectory, "audit.json", audit);
  await durableCreate(runDirectory, "acceptance-report.json", report);
  return { bundle, audit, report, runDirectory };
}

export function locatorAuthorityForImportedBundle(locator: ScientificMetadataLocator):
  | { kind: "unverified_metadata" }
  | IndependentlyVerifiedLocatorAuthority {
  if (locator.verificationAuthority.kind === "unverified_metadata") return { kind: "unverified_metadata" };
  return { ...locator.verificationAuthority, importerStatus: "REFERENCE_ONLY_NOT_AUTHENTICATED" };
}
