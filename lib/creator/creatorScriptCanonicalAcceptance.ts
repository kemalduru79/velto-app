import { createHash } from "node:crypto";
import { getCreatorScriptDurationContractForScript, normalizeCreatorScript, type CreatorScript } from "./creatorScript.ts";
import { applyCreatorScriptProposal, createCreatorScriptProposal, discardCreatorScriptProposal } from "./creatorScriptRevisions.ts";
import { assessOriginalSourceClaimAuthority, verifyOriginalSourceEvidence, type OriginalSourceDocument } from "../research/originalSourceEvidence.ts";
import type { ResearchClaim, ResearchEvidence } from "../research/claimEvidenceGraph.ts";
import type { ResearchSource } from "../research/sourceContract.ts";

export const STAGE4B2_CANONICAL_SNAPSHOT_VERSION = "stage4b2-canonical-snapshot-v2" as const;
export const STAGE4B2_CANONICAL_MANIFEST_VERSION = "stage4b2-detached-baseline-v1" as const;
export type CanonicalAcceptanceStatus = "PASS" | "REVIEW_REQUIRED" | "BLOCKED";
type Check = { id: string; status: CanonicalAcceptanceStatus; detail: string };
type SemanticAssessment = { claimId: string; status: "supported" | "unsupported" | "contradicted"; evidenceIds: string[] };

export type Stage4B2CanonicalSnapshot = { version: typeof STAGE4B2_CANONICAL_SNAPSHOT_VERSION; language: "en"; projectIdentitySha256: string; projectRevision: string; script: unknown; sceneIds: string[]; canonicalSceneIds: string[]; sources: ResearchSource[]; claims: Array<ResearchClaim & { supportingEvidenceIds: string[] }>; evidence: ResearchEvidence[]; originalDocuments: OriginalSourceDocument[]; factualAssertions: Array<{ assertionId: string; sectionId: string; start: number; end: number; claimIds: string[]; textSha256: string }> };
export type Stage4B2DetachedBaselineManifest = { version: typeof STAGE4B2_CANONICAL_MANIFEST_VERSION; trustClass: "synthetic_fixture" | "authenticated_canonical"; projectIdentitySha256: string; projectRevision: string; snapshotSha256: string; scriptSha256: string; groundingSha256: string; sceneIdentitySha256: string; scriptRevision: number; targetDurationSec: number; sectionIds: string[]; sceneIds: string[]; canonicalSceneIds: string[]; sourceEvidenceAttestations: Array<{ sourceId: string; documentSha256: string; acquisitionReceiptSha256: string }>; semanticAssessments: SemanticAssessment[]; semanticReviewReceiptSha256: string; editorialReview: { englishClarity: boolean; narrativeProgression: boolean; factualPrecision: boolean; repetitionAcceptable: boolean; wordBoundariesValid: boolean; reviewReceiptSha256: string }; factualInventoryReview: { complete: boolean; inventorySha256: string; reviewReceiptSha256: string } };
export type Stage4B2DetachedAdmission = { manifest: Stage4B2DetachedBaselineManifest; expectedManifestSha256: string; boundary: "detached_read_only_hash_pin" };
export type Stage4B2IndependentAuthorityVerifier = {
  authorityClass: "synthetic_test" | "owner_controlled";
  verifyPersistedBaseline: (input: { projectIdentitySha256: string; projectRevision: string; snapshotSha256: string; manifestSha256: string }) => boolean;
  verifySourceAcquisitionReceipt: (input: { sourceId: string; sourceUrl: string; documentSha256: string; receiptSha256: string }) => boolean;
  verifyReviewReceipt: (input: { kind: "semantic" | "factual_inventory" | "editorial"; receiptSha256: string; subjectSha256: string }) => boolean;
  verifyPersistedBeforeAfter: (input: { projectIdentitySha256: string; projectRevision: string; scriptSha256: string; sceneIdentitySha256: string }) => boolean;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const isDigest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object" ? `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}` : JSON.stringify(value);
export const canonicalAcceptanceSha256 = (value: unknown) => sha256(stable(value));
const safeAcceptanceSha256 = (value: unknown) => { try { const serialized = stable(value); return typeof serialized === "string" ? sha256(serialized) : null; } catch { return null; } };
const add = (checks: Check[], id: string, status: CanonicalAcceptanceStatus, detail: string) => checks.push({ id, status, detail });
const uniqueStrings = (value: unknown, length?: number): value is string[] => Array.isArray(value) && (length === undefined || value.length === length) && value.every((item) => typeof item === "string" && item.length > 0) && new Set(value).size === value.length;
const uniqueRecords = (value: unknown, key: string, length: number) => Array.isArray(value) && value.length === length && value.every((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>)[key] === "string") && new Set(value.map((item) => (item as Record<string, unknown>)[key])).size === value.length;
const same = (left: unknown, right: unknown) => stable(left) === stable(right);

export function missingStage4B2CanonicalSnapshotReport() { return { status: "REVIEW_REQUIRED" as const, actualCanonicalSnapshot: false, syntheticFixture: false, closeStage4B2: false, checks: [{ id: "CANONICAL_SNAPSHOT_ADMISSION", status: "REVIEW_REQUIRED" as const, detail: "CANONICAL_SNAPSHOT_OR_DETACHED_MANIFEST_UNAVAILABLE" }], missingRequirements: ["AUTHORIZED_READ_ONLY_CANONICAL_SNAPSHOT", "DETACHED_PERSISTED_BASELINE_MANIFEST", "INDEPENDENT_ORIGINAL_SOURCE_AND_EDITORIAL_REVIEW"], zeroWrite: true }; }

export function assessStage4B2CanonicalWholeScript(snapshotValue: unknown, admissionValue?: unknown, authorityVerifier?: Stage4B2IndependentAuthorityVerifier) {
  const before = safeAcceptanceSha256(snapshotValue); const checks: Check[] = [];
  try {
    const snapshot = structuredClone(snapshotValue) as Stage4B2CanonicalSnapshot;
    const admission = structuredClone(admissionValue) as Stage4B2DetachedAdmission;
    const manifest = admission?.manifest;
    const snapshotShape = snapshot?.version === STAGE4B2_CANONICAL_SNAPSHOT_VERSION && snapshot.language === "en" && isDigest(snapshot.projectIdentitySha256) && typeof snapshot.projectRevision === "string" && snapshot.projectRevision.length > 0 && uniqueStrings(snapshot.sceneIds) && uniqueStrings(snapshot.canonicalSceneIds) && uniqueRecords(snapshot.sources, "sourceId", 7) && uniqueRecords(snapshot.claims, "claimId", 7) && uniqueRecords(snapshot.evidence, "evidenceId", 13) && Array.isArray(snapshot.originalDocuments) && Array.isArray(snapshot.factualAssertions);
    const manifestShape = admission?.boundary === "detached_read_only_hash_pin" && manifest?.version === STAGE4B2_CANONICAL_MANIFEST_VERSION && ["synthetic_fixture", "authenticated_canonical"].includes(manifest.trustClass) && isDigest(admission.expectedManifestSha256) && canonicalAcceptanceSha256(manifest) === admission.expectedManifestSha256 && Array.isArray(manifest.sourceEvidenceAttestations) && Array.isArray(manifest.semanticAssessments);
    if (!snapshotShape || !manifestShape) return malformed(checks, before, snapshotValue);
    const synthetic = manifest.trustClass === "synthetic_fixture";
    const snapshotBound = manifest.snapshotSha256 === canonicalAcceptanceSha256(snapshot) && manifest.projectIdentitySha256 === snapshot.projectIdentitySha256 && manifest.projectRevision === snapshot.projectRevision;
    add(checks, "DETACHED_CANONICAL_ADMISSION", snapshotBound ? "PASS" : "BLOCKED", snapshotBound ? "DETACHED_MANIFEST_AND_SNAPSHOT_BOUND" : "DETACHED_BASELINE_BINDING_MISMATCH");
    const canonicalAdmissionVerified = !synthetic && snapshotBound && authorityVerifier?.authorityClass === "owner_controlled" && authorityVerifier.verifyPersistedBaseline({ projectIdentitySha256: snapshot.projectIdentitySha256, projectRevision: snapshot.projectRevision, snapshotSha256: manifest.snapshotSha256, manifestSha256: admission.expectedManifestSha256 }) === true;
    add(checks, "CANONICAL_PROVENANCE_AUTHORITY", canonicalAdmissionVerified ? "PASS" : "REVIEW_REQUIRED", synthetic ? "SYNTHETIC_FIXTURE_NOT_CANONICAL_PROVENANCE" : canonicalAdmissionVerified ? "INDEPENDENT_PERSISTED_BASELINE_AUTHORITY_VERIFIED" : "INDEPENDENT_PERSISTED_BASELINE_AUTHORITY_REQUIRED");
    let script: CreatorScript;
    try { script = normalizeCreatorScript(snapshot.script); } catch { add(checks, "SCRIPT_SCHEMA", "BLOCKED", "CANONICAL_SCRIPT_INVALID"); return finish(checks, synthetic, before, snapshotValue, {}); }
    const sectionIds = script.sections.map((section) => section.id);
    const structureOk = script.revision === 1 && script.targetDurationSec === 480 && script.sections.length === 5 && script.sections.map((section) => section.kind).join(",") === "opening,body,body,body,conclusion" && manifest.scriptRevision === script.revision && manifest.targetDurationSec === script.targetDurationSec && same(manifest.sectionIds, sectionIds) && manifest.scriptSha256 === canonicalAcceptanceSha256(script);
    add(checks, "SCRIPT_IDENTITY_ORDER_REVISION", structureOk ? "PASS" : "BLOCKED", structureOk ? "DETACHED_FIVE_SECTION_REVISION_ONE_BASELINE_MATCH" : "CANONICAL_SCRIPT_BASELINE_MISMATCH");
    const sceneOk = snapshot.sceneIds.length === 36 && snapshot.canonicalSceneIds.length === 36 && same(snapshot.sceneIds, snapshot.canonicalSceneIds) && same(manifest.sceneIds, snapshot.sceneIds) && same(manifest.canonicalSceneIds, snapshot.canonicalSceneIds) && manifest.sceneIdentitySha256 === canonicalAcceptanceSha256([snapshot.sceneIds, snapshot.canonicalSceneIds]);
    add(checks, "SCENE_INTEGRITY", sceneOk ? "PASS" : "BLOCKED", sceneOk ? "DETACHED_36_SCENE_IDENTITIES_MATCH" : "SCENE_IDENTITY_OR_REFERENCE_MISMATCH");
    const context = script.grounding.context;
    const graphMatches = manifest.groundingSha256 === canonicalAcceptanceSha256(context) && same(snapshot.evidence, context.evidence) && same(snapshot.claims, context.claims) && snapshot.sources.every((source, index) => { const grounded = context.sources[index]; return grounded && source.sourceId === grounded.sourceId && source.title === grounded.title && source.url === grounded.url && source.publisher === grounded.publisher && source.author === grounded.author && source.publishedAt === grounded.publishedAt; });
    add(checks, "CANONICAL_GROUNDING_GRAPH", graphMatches ? "PASS" : "BLOCKED", graphMatches ? "GRAPH_DERIVED_FROM_SCRIPT_GROUNDING" : "SUBSTITUTED_OR_INCONSISTENT_GROUNDING_GRAPH");
    let acceptedClaims = 0; let reviewedClaims = 0; let rejectedClaims = 0;
    const assessmentIds = manifest.semanticAssessments.map((item) => item.claimId);
    if (graphMatches && uniqueStrings(assessmentIds, 7)) for (const claim of snapshot.claims) {
      const supporting = snapshot.evidence.filter((item) => claim.supportingEvidenceIds.includes(item.evidenceId));
      const sourceAttested = supporting.every((item) => { const document = snapshot.originalDocuments.find((candidate) => candidate.sourceId === item.sourceId); const attestation = manifest.sourceEvidenceAttestations.find((candidate) => candidate.sourceId === item.sourceId); const source = snapshot.sources.find((candidate) => candidate.sourceId === item.sourceId); const mechanicallyBound = Boolean(document && attestation && source && isDigest(attestation.acquisitionReceiptSha256) && sha256(document.content) === attestation.documentSha256 && (synthetic || document.acquisition === "trusted_fetch")); return mechanicallyBound && (synthetic || authorityVerifier?.verifySourceAcquisitionReceipt({ sourceId: item.sourceId, sourceUrl: source!.url, documentSha256: attestation!.documentSha256, receiptSha256: attestation!.acquisitionReceiptSha256 }) === true); });
      if (!sourceAttested) { reviewedClaims += 1; continue; }
      const fidelity = supporting.map((item) => verifyOriginalSourceEvidence({ source: snapshot.sources.find((source) => source.sourceId === item.sourceId)!, evidence: item, document: snapshot.originalDocuments.find((document) => document.sourceId === item.sourceId) }));
      const semantic = manifest.semanticAssessments.find((item) => item.claimId === claim.claimId)!;
      const result = assessOriginalSourceClaimAuthority({ claim, evidence: supporting, sources: snapshot.sources, fidelity, semanticAssessment: semantic });
      if (result.status === "accepted") acceptedClaims += 1; else if (result.status === "requires_review") reviewedClaims += 1; else rejectedClaims += 1;
    }
    const semanticAuthorityVerified = !synthetic && isDigest(manifest.semanticReviewReceiptSha256) && authorityVerifier?.verifyReviewReceipt({ kind: "semantic", receiptSha256: manifest.semanticReviewReceiptSha256, subjectSha256: canonicalAcceptanceSha256(manifest.semanticAssessments) }) === true;
    const evidenceStatus: CanonicalAcceptanceStatus = rejectedClaims ? "BLOCKED" : acceptedClaims === 7 && semanticAuthorityVerified ? "PASS" : "REVIEW_REQUIRED";
    add(checks, "INDEPENDENT_SOURCE_AND_SEMANTIC_AUTHORITY", evidenceStatus, rejectedClaims ? "UNSUPPORTED_CONTRADICTED_OR_SUBSTITUTED_CLAIM" : acceptedClaims === 7 && semanticAuthorityVerified ? "INDEPENDENT_SOURCE_AND_SEMANTIC_AUTHORITY_VERIFIED" : "INDEPENDENT_SOURCE_OR_SEMANTIC_REVIEW_REQUIRED");
    const assertionIds = snapshot.factualAssertions.map((item) => item?.assertionId);
    const assertionsBound = uniqueStrings(assertionIds) && snapshot.factualAssertions.length > 0 && snapshot.factualAssertions.every((item) => { const section = script.sections.find((candidate) => candidate.id === item.sectionId); const span = section && Number.isInteger(item.start) && Number.isInteger(item.end) && item.start >= 0 && item.end > item.start && item.end <= section.text.length ? section.text.slice(item.start, item.end) : null; return span !== null && isDigest(item.textSha256) && sha256(span) === item.textSha256 && uniqueStrings(item.claimIds) && item.claimIds.every((id) => snapshot.claims.some((claim) => claim.claimId === id)); });
    const inventory = manifest.factualInventoryReview;
    const inventoryComplete = assertionsBound && inventory?.complete === true && isDigest(inventory.reviewReceiptSha256) && inventory.inventorySha256 === canonicalAcceptanceSha256(snapshot.factualAssertions);
    add(checks, "FACTUAL_ASSERTION_SPAN_BINDING", assertionsBound ? "PASS" : "BLOCKED", assertionsBound ? "ASSERTIONS_BOUND_TO_EXACT_SCRIPT_SPANS_AND_CLAIMS" : "ASSERTION_SPAN_OR_CLAIM_BINDING_INVALID");
    const inventoryAuthorityVerified = !synthetic && inventoryComplete && authorityVerifier?.verifyReviewReceipt({ kind: "factual_inventory", receiptSha256: inventory.reviewReceiptSha256, subjectSha256: inventory.inventorySha256 }) === true;
    add(checks, "FACTUAL_ASSERTION_INVENTORY_AUTHORITY", inventoryAuthorityVerified ? "PASS" : "REVIEW_REQUIRED", inventoryAuthorityVerified ? "INDEPENDENT_COMPLETE_FACTUAL_INVENTORY_VERIFIED" : inventoryComplete ? "INVENTORY_INTEGRITY_VALID_BUT_INDEPENDENT_COMPLETENESS_REVIEW_UNVERIFIED" : "COMPLETE_REVIEWED_FACTUAL_INVENTORY_REQUIRED");
    const duration = getCreatorScriptDurationContractForScript(script, "en");
    add(checks, "THYNEL_DURATION", duration.status === "compliant" ? "PASS" : "BLOCKED", duration.status === "compliant" ? "480_SECOND_WORD_ENVELOPE_COMPLIANT" : `WORD_ENVELOPE_${duration.status.toUpperCase()}`);
    const editorial = manifest.editorialReview;
    const editorialOk = isDigest(editorial?.reviewReceiptSha256) && editorial.englishClarity && editorial.narrativeProgression && editorial.factualPrecision && editorial.repetitionAcceptable && editorial.wordBoundariesValid;
    const editorialAuthorityVerified = !synthetic && editorialOk && authorityVerifier?.verifyReviewReceipt({ kind: "editorial", receiptSha256: editorial.reviewReceiptSha256, subjectSha256: manifest.scriptSha256 }) === true;
    add(checks, "INDEPENDENT_EDITORIAL_QUALITY", editorialAuthorityVerified ? "PASS" : "REVIEW_REQUIRED", editorialAuthorityVerified ? "INDEPENDENT_EDITORIAL_REVIEW_VERIFIED" : editorialOk ? "EDITORIAL_RECEIPT_INTEGRITY_VALID_BUT_REVIEWER_AUTHORITY_UNVERIFIED" : "INDEPENDENT_EDITORIAL_REVIEW_REQUIRED");
    const preview = structuredClone(script); preview.sections = preview.sections.map((section, index) => index === 0 ? { ...section, text: `${section.text} Preview.` } : section); preview.revision += 1; preview.updatedAt = "offline-preview"; preview.approval = null;
    const proposal = createCreatorScriptProposal({ script, scope: "whole_script", instruction: "Offline mechanical lifecycle check only.", nextScript: preview, mode: "editorial_rewrite" });
    const discarded = discardCreatorScriptProposal({ script, pendingRefinement: proposal, revisionHistory: [] }, proposal.proposalId); let staleRejected = false;
    try { applyCreatorScriptProposal({ ...script, revision: script.revision + 1 }, proposal, "en"); } catch (error) { staleRejected = String(error).includes("CREATOR_SCRIPT_REFINEMENT_STALE"); }
    add(checks, "MECHANICAL_PREVIEW_DISCARD_CAS", discarded.script === script && discarded.pendingRefinement === null && staleRejected ? "PASS" : "BLOCKED", "MECHANICAL_ONLY_NOT_SEMANTIC_REWRITE_ACCEPTANCE");
    const persistedProjectImmutabilityVerified = canonicalAdmissionVerified && authorityVerifier?.verifyPersistedBeforeAfter({ projectIdentitySha256: snapshot.projectIdentitySha256, projectRevision: snapshot.projectRevision, scriptSha256: manifest.scriptSha256, sceneIdentitySha256: manifest.sceneIdentitySha256 }) === true;
    add(checks, "PERSISTED_PROJECT_IMMUTABILITY", persistedProjectImmutabilityVerified ? "PASS" : "REVIEW_REQUIRED", persistedProjectImmutabilityVerified ? "AUTHENTICATED_BEFORE_AFTER_PERSISTED_FINGERPRINTS_MATCH" : "AUTHENTICATED_BEFORE_AFTER_PERSISTED_FINGERPRINTS_REQUIRED");
    return finish(checks, synthetic, before, snapshotValue, { acceptedClaims, reviewedClaims, rejectedClaims, duration }, canonicalAdmissionVerified, persistedProjectImmutabilityVerified);
  } catch { return malformed(checks, before, snapshotValue); }
}

function malformed(checks: Check[], before: string | null, original: unknown) { add(checks, "SNAPSHOT_SCHEMA", "BLOCKED", "CANONICAL_SNAPSHOT_OR_MANIFEST_MALFORMED"); return finish(checks, false, before, original, {}); }
function finish(checks: Check[], synthetic: boolean, before: string | null, original: unknown, metrics: Record<string, unknown>, canonicalAdmissionVerified = false, persistedProjectImmutabilityVerified = false) { const after = safeAcceptanceSha256(original); const localInputUnchanged = before !== null && after !== null && before === after; const componentStatus: CanonicalAcceptanceStatus = checks.some((item) => item.status === "BLOCKED") ? "BLOCKED" : checks.some((item) => item.status === "REVIEW_REQUIRED") ? "REVIEW_REQUIRED" : "PASS"; const status: CanonicalAcceptanceStatus = before === null || !localInputUnchanged ? "BLOCKED" : synthetic && componentStatus === "PASS" ? "REVIEW_REQUIRED" : componentStatus; const missingRequirements = checks.filter((item) => item.status !== "PASS").map((item) => item.detail); if (synthetic && componentStatus === "PASS") missingRequirements.push("AUTHENTICATED_CANONICAL_SNAPSHOT_REQUIRED"); return { status, componentStatus, claimedCanonicalTrustClass: synthetic ? "synthetic_fixture" : "authenticated_canonical", canonicalAdmissionVerified, actualCanonicalSnapshot: canonicalAdmissionVerified, syntheticFixture: synthetic, closeStage4B2: false, checks, missingRequirements, zeroWrite: localInputUnchanged, zeroWriteScope: "LOCAL_INPUT_MECHANICAL_ONLY", persistedProjectImmutabilityVerified, metrics }; }
