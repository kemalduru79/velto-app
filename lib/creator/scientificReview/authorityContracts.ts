import { createHash } from "node:crypto";

/** Stage 5E1G-A adds metadata authority without changing Stage 5E1F inputs. */
export const SCIENTIFIC_EVIDENCE_METADATA_VERSION = "stage-5e1g-a-evidence-metadata-v1" as const;
export const SCIENTIFIC_EVIDENCE_IMPORT_VERSION = "stage-5e1g-a-metadata-import-v1" as const;

export const EVIDENCE_STANCES = ["supports", "contradicts", "contextualizes"] as const;
export type EvidenceStance = (typeof EVIDENCE_STANCES)[number];
export const LOCATOR_KINDS = [
  "html_dom_range",
  "pdf_page_block",
  "normalized_unicode_scalar_range",
] as const;
export type LocatorKind = (typeof LOCATOR_KINDS)[number];

export type ImportedMetadataAuthority = Readonly<{
  kind: "owner_imported_metadata";
  manifestSha256: string;
  manifestIdentitySha256: string;
  /** This authority never establishes source authenticity or semantic support. */
  establishes: "IDENTITY_AND_RELATIONSHIPS_ONLY";
}>;
export type IndependentlyVerifiedLocatorAuthority = Readonly<{
  kind: "independently_verified_locator_receipt_reference";
  receiptSha256: string;
  verifierIdentitySha256: string;
  methodVersion: string;
  /** The importer preserves the reference but does not validate its issuer. */
  importerStatus: "REFERENCE_ONLY_NOT_AUTHENTICATED";
}>;
export type AiReviewJudgmentAuthority = Readonly<{
  kind: "ai_review_judgment";
  judgmentSha256: string;
  modelIdentitySha256: string;
  scientificAuthority: false;
}>;
export type QualifiedHumanApprovalAuthority = Readonly<{
  kind: "qualified_human_approval";
  approvalReceiptSha256: string;
  reviewerIdentitySha256: string;
  conflictDisclosureSha256: string;
  authenticatedByOwner: boolean;
}>;
export type ScientificAuthority =
  | ImportedMetadataAuthority
  | IndependentlyVerifiedLocatorAuthority
  | AiReviewJudgmentAuthority
  | QualifiedHumanApprovalAuthority;

export type ScientificMetadataSource = Readonly<{
  sourceId: string;
  canonicalUrl: string;
  canonicalUrlSha256: string;
  titleSha256: string;
  publisherSha256: string;
  sourceVersion: string;
  mediaType: "text/plain" | "text/html" | "application/pdf";
  documentSha256: string;
  acquisitionAuthority: Readonly<{
    kind: "owner_supplied_reference" | "publisher_receipt_reference";
    receiptSha256: string;
  }>;
}>;
export type ScientificMetadataClaim = Readonly<{
  claimId: string;
  claimTextSha256: string;
  claimType: string;
  propositionKind: string;
}>;
export type ScientificMetadataEvidence = Readonly<{
  evidenceId: string;
  sourceId: string;
  passageSha256: string;
  locatorId: string;
}>;
export type ScientificMetadataLink = Readonly<{
  claimId: string;
  evidenceId: string;
  stance: EvidenceStance;
}>;
export type ScientificMetadataLocator = Readonly<{
  locatorId: string;
  evidenceId: string;
  sourceId: string;
  kind: LocatorKind;
  originalLocatorSha256: string;
  normalizedLocatorSha256: string;
  matchCardinality: "unique" | "ambiguous" | "missing";
  verificationAuthority:
    | Readonly<{ kind: "unverified_metadata" }>
    | Omit<IndependentlyVerifiedLocatorAuthority, "importerStatus">;
}>;
export type ScientificMetadataSectionRouting = Readonly<{
  sectionId: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
}>;
export type ScientificEvidenceMetadataManifest = Readonly<{
  version: typeof SCIENTIFIC_EVIDENCE_METADATA_VERSION;
  packageId: string;
  packageRevision: string;
  manifestIdentitySha256: string;
  sources: readonly ScientificMetadataSource[];
  claims: readonly ScientificMetadataClaim[];
  evidence: readonly ScientificMetadataEvidence[];
  links: readonly ScientificMetadataLink[];
  locators: readonly ScientificMetadataLocator[];
  sectionRouting: readonly ScientificMetadataSectionRouting[];
}>;

export function stage5e1gFail(reason: string): never {
  throw new Error(`STAGE_5E1G_A_${reason}`);
}
export function stableScientificJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableScientificJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableScientificJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export function scientificSha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
export function computeScientificEvidenceManifestIdentity(
  manifest: Omit<ScientificEvidenceMetadataManifest, "manifestIdentitySha256">,
): string {
  return scientificSha256(stableScientificJson(manifest));
}
