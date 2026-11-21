import { createHash } from "node:crypto";
import {
  SCIENTIFIC_REVIEW_VERSION, REVIEW_ROLES, exactKeys, isSha256, nonEmptyString,
  scientificReviewFail, uniqueIds,
} from "./contracts.ts";
import type {
  ScientificReviewInput, ScientificSourceMaterial, ReviewerRole, VerifiedPassage,
} from "./contracts.ts";

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Require exact source byte hashes and exact UTF-8 passage offsets. PDF locators stay unverified. */
export function validateScientificEvidence(
  input: ScientificReviewInput,
  materials: readonly ScientificSourceMaterial[],
): ReadonlyMap<string, VerifiedPassage> {
  exactKeys(input, ["version", "runId", "claims", "sources", "evidence"], "INPUT");
  if (input.version !== SCIENTIFIC_REVIEW_VERSION || !nonEmptyString(input.runId, 100) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(input.runId)) scientificReviewFail("INPUT_VERSION_OR_ID_INVALID");
  if (!Array.isArray(input.claims) || input.claims.length === 0 || input.claims.length > 1000 ||
      !Array.isArray(input.sources) || input.sources.length === 0 ||
      !Array.isArray(input.evidence) || input.evidence.length === 0 ||
      !Array.isArray(materials)) scientificReviewFail("INPUT_LISTS_INVALID");
  const claimIds = uniqueIds(input.claims, "claimId");
  const sourceIds = uniqueIds(input.sources, "sourceId");
  const evidenceIds = uniqueIds(input.evidence, "evidenceId");
  uniqueIds(materials, "sourceId");
  if (materials.length !== input.sources.length) scientificReviewFail("MATERIAL_COUNT_MISMATCH");
  const bySource = new Map(materials.map((m) => [m.sourceId, m]));
  const sourceById = new Map(input.sources.map((s) => [s.sourceId, s]));
  for (const source of input.sources) {
    exactKeys(source, ["sourceId", "title", "sourceVersion", "documentSha256", "mediaType", "extractedTextSha256"], "SOURCE");
    if (!nonEmptyString(source.title, 500) || !nonEmptyString(source.sourceVersion, 200) ||
        !isSha256(source.documentSha256) || !isSha256(source.extractedTextSha256) ||
        (source.mediaType !== "text/plain" && source.mediaType !== "application/pdf")) {
      scientificReviewFail("SOURCE_METADATA_INVALID");
    }
    const material = bySource.get(source.sourceId);
    if (!material || !(material.documentBytes instanceof Uint8Array) ||
        !nonEmptyString(material.extractedText, 10_000_000)) scientificReviewFail("SOURCE_BYTES_MISSING");
    if (sha256(material.documentBytes) !== source.documentSha256 ||
        sha256(material.extractedText) !== source.extractedTextSha256) scientificReviewFail("SOURCE_HASH_MISMATCH");
    if (source.mediaType === "text/plain" &&
        Buffer.compare(Buffer.from(material.documentBytes), Buffer.from(material.extractedText, "utf8")) !== 0) {
      scientificReviewFail("TEXT_DOCUMENT_EXTRACTION_MISMATCH");
    }
  }
  const validated = new Map<string, VerifiedPassage>();
  for (const ev of input.evidence) {
    exactKeys(ev, ["evidenceId", "sourceId", "passage", "passageSha256", "extractedStartByte", "extractedEndByte", "displayLocator"], "EVIDENCE");
    const source = sourceById.get(ev.sourceId);
    const material = bySource.get(ev.sourceId);
    if (!sourceIds.has(ev.sourceId) || !source || !material ||
        !nonEmptyString(ev.displayLocator, 500) || !nonEmptyString(ev.passage, 20000) ||
        !isSha256(ev.passageSha256) || !Number.isSafeInteger(ev.extractedStartByte) ||
        !Number.isSafeInteger(ev.extractedEndByte) || ev.extractedStartByte < 0 ||
        ev.extractedEndByte <= ev.extractedStartByte) scientificReviewFail("EVIDENCE_METADATA_INVALID");
    const textBytes = Buffer.from(material.extractedText, "utf8");
    const passageBytes = Buffer.from(ev.passage, "utf8");
    if (ev.extractedEndByte > textBytes.length ||
        Buffer.compare(textBytes.subarray(ev.extractedStartByte, ev.extractedEndByte), passageBytes) !== 0 ||
        sha256(passageBytes) !== ev.passageSha256) scientificReviewFail("PASSAGE_BYTE_OR_HASH_MISMATCH");
    validated.set(ev.evidenceId, {
      ...structuredClone(ev), sourceVersion: source.sourceVersion, sourceTitle: source.title,
      provenance: source.mediaType === "text/plain" ? "utf8_document_exact_byte_match" : "pdf_extracted_text_unverified_locator",
    });
  }
  for (const claim of input.claims) {
    exactKeys(claim, ["claimId", "claimText", "primaryRole", "evidenceIds", "scientificLimitations"], "CLAIM");
    if (!claimIds.has(claim.claimId) || !nonEmptyString(claim.claimText, 20000) ||
        !REVIEW_ROLES.includes(claim.primaryRole as ReviewerRole) ||
        !Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0 ||
        new Set(claim.evidenceIds).size !== claim.evidenceIds.length ||
        claim.evidenceIds.some((id: string) => !evidenceIds.has(id)) ||
        !Array.isArray(claim.scientificLimitations) ||
        !claim.scientificLimitations.every((s: string) => nonEmptyString(s, 2000))) {
      scientificReviewFail("CLAIM_METADATA_INVALID");
    }
  }
  return validated;
}
