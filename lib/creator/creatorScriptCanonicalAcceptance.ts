import { createHash } from "node:crypto";
import { getCreatorScriptDurationContractForScript, normalizeCreatorScript, type CreatorScript } from "./creatorScript.ts";
import { applyCreatorScriptProposal, createCreatorScriptProposal, discardCreatorScriptProposal } from "./creatorScriptRevisions.ts";
import { assessOriginalSourceClaimAuthority, verifyOriginalSourceEvidence, type OriginalSourceDocument } from "../research/originalSourceEvidence.ts";
import type { ResearchClaim, ResearchEvidence } from "../research/claimEvidenceGraph.ts";
import type { ResearchSource } from "../research/sourceContract.ts";

export const STAGE4B2_CANONICAL_SNAPSHOT_VERSION = "stage4b2-canonical-snapshot-v1" as const;
export type CanonicalAcceptanceStatus = "PASS" | "REVIEW_REQUIRED" | "BLOCKED";
type Check = { id: string; status: CanonicalAcceptanceStatus; detail: string };

export type Stage4B2CanonicalSnapshot = {
  version: typeof STAGE4B2_CANONICAL_SNAPSHOT_VERSION;
  authorization: { kind: "owner_supplied_read_only"; approvedAt: string };
  expectedSnapshotSha256: string;
  language: "en";
  script: unknown;
  sceneIds: string[];
  canonicalSceneIds: string[];
  sources: ResearchSource[];
  claims: Array<ResearchClaim & { supportingEvidenceIds: string[] }>;
  evidence: ResearchEvidence[];
  originalDocuments: OriginalSourceDocument[];
  semanticAssessments: Array<{ claimId: string; status: "supported" | "unsupported" | "contradicted"; evidenceIds: string[]; authority: "independent_human_review" }>;
  factualAssertions: Array<{ assertionId: string; sectionId: string; claimIds: string[]; textSha256: string }>;
  editorialReview?: { authority: "independent_human_review"; englishClarity: boolean; narrativeProgression: boolean; factualPrecision: boolean; repetitionAcceptable: boolean; wordBoundariesValid: boolean };
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
export const canonicalSnapshotPayloadSha256 = (snapshot: Omit<Stage4B2CanonicalSnapshot, "expectedSnapshotSha256"> | Stage4B2CanonicalSnapshot) => {
  const { expectedSnapshotSha256: _ignored, ...payload } = snapshot as Stage4B2CanonicalSnapshot;
  return sha256(stable(payload));
};
const add = (checks: Check[], id: string, status: CanonicalAcceptanceStatus, detail: string) => checks.push({ id, status, detail });
const graphIdsUnique = (items: Array<{ [key: string]: unknown }>, key: string) => new Set(items.map((item) => String(item[key] || ""))).size === items.length && items.every((item) => typeof item[key] === "string" && Boolean(String(item[key])));

export function missingStage4B2CanonicalSnapshotReport() {
  return {
    status: "REVIEW_REQUIRED" as const,
    actualCanonicalSnapshot: false,
    closeStage4B2: false,
    checks: [{ id: "CANONICAL_SNAPSHOT_ADMISSION", status: "REVIEW_REQUIRED" as const, detail: "CANONICAL_SNAPSHOT_UNAVAILABLE" }],
    missingRequirements: ["AUTHORIZED_READ_ONLY_CANONICAL_SNAPSHOT", "INDEPENDENT_ORIGINAL_SOURCE_AND_EDITORIAL_REVIEW"],
    zeroWrite: true,
  };
}

export function assessStage4B2CanonicalWholeScript(snapshotValue: unknown) {
  const before = sha256(stable(snapshotValue));
  const snapshot = structuredClone(snapshotValue) as Stage4B2CanonicalSnapshot;
  const checks: Check[] = [];
  if (!snapshot || snapshot.version !== STAGE4B2_CANONICAL_SNAPSHOT_VERSION || snapshot.authorization?.kind !== "owner_supplied_read_only") {
    add(checks, "CANONICAL_SNAPSHOT_ADMISSION", "BLOCKED", "CANONICAL_SNAPSHOT_AUTHORITY_INVALID");
    return finalize("BLOCKED", false, checks, ["AUTHORIZED_READ_ONLY_CANONICAL_SNAPSHOT"], before, snapshotValue, {});
  }
  const digest = canonicalSnapshotPayloadSha256(snapshot);
  const admitted = /^[a-f0-9]{64}$/.test(snapshot.expectedSnapshotSha256) && digest === snapshot.expectedSnapshotSha256;
  add(checks, "CANONICAL_SNAPSHOT_ADMISSION", admitted ? "PASS" : "BLOCKED", admitted ? "IMMUTABLE_SNAPSHOT_HASH_MATCH" : "CANONICAL_SNAPSHOT_HASH_MISMATCH");

  let script: CreatorScript | null = null;
  try { script = normalizeCreatorScript(snapshot.script); } catch { add(checks, "SCRIPT_SCHEMA", "BLOCKED", "CANONICAL_SCRIPT_INVALID"); }
  if (script) {
    const roles = script.sections.map((section) => section.kind).join(",");
    const structureOk = script.revision === 1 && script.targetDurationSec === 480 && script.sections.length === 5 && roles === "opening,body,body,body,conclusion";
    add(checks, "SCRIPT_IDENTITY_ORDER_REVISION", structureOk ? "PASS" : "BLOCKED", structureOk ? "FIVE_SECTION_REVISION_ONE_480_SECOND_BASELINE" : "CANONICAL_SCRIPT_BASELINE_MISMATCH");
  }
  const sceneOk = snapshot.sceneIds?.length === 36 && snapshot.canonicalSceneIds?.length === 36 && graphIdsUnique(snapshot.sceneIds.map((id) => ({ id })), "id") && graphIdsUnique(snapshot.canonicalSceneIds.map((id) => ({ id })), "id") && snapshot.sceneIds.every((id, index) => id === snapshot.canonicalSceneIds[index]);
  add(checks, "SCENE_INTEGRITY", sceneOk ? "PASS" : "BLOCKED", sceneOk ? "36_ORDERED_SCENES_MATCH_CANONICAL_REFERENCES" : "SCENE_OR_CANONICAL_REFERENCE_LOSS");

  const graphShapeOk = snapshot.claims?.length === 7 && snapshot.evidence?.length === 13 && snapshot.sources?.length === 7 && graphIdsUnique(snapshot.claims, "claimId") && graphIdsUnique(snapshot.evidence, "evidenceId") && graphIdsUnique(snapshot.sources, "sourceId");
  const sourceIds = new Set(snapshot.sources?.map((item) => item.sourceId));
  const evidenceIds = new Set(snapshot.evidence?.map((item) => item.evidenceId));
  const graphRefsOk = graphShapeOk && snapshot.evidence.every((item) => sourceIds.has(item.sourceId)) && snapshot.claims.every((claim) => claim.supportingEvidenceIds.length > 0 && claim.supportingEvidenceIds.every((id) => evidenceIds.has(id))) && (!script || script.sections.every((section) => section.claimIds.every((id) => snapshot.claims.some((claim) => claim.claimId === id))));
  add(checks, "CLAIM_EVIDENCE_SOURCE_GRAPH", graphRefsOk ? "PASS" : "BLOCKED", graphRefsOk ? "7_CLAIMS_13_EVIDENCE_7_SOURCES_REFERENTIALLY_VALID" : "GROUNDING_GRAPH_INVALID");

  let acceptedClaims = 0; let reviewedClaims = 0; let rejectedClaims = 0;
  if (graphRefsOk) for (const claim of snapshot.claims) {
    const supporting = snapshot.evidence.filter((item) => claim.supportingEvidenceIds.includes(item.evidenceId));
    const fidelity = supporting.map((item) => verifyOriginalSourceEvidence({ source: snapshot.sources.find((source) => source.sourceId === item.sourceId)!, evidence: item, document: snapshot.originalDocuments?.find((document) => document.sourceId === item.sourceId) }));
    const semantic = snapshot.semanticAssessments?.find((item) => item.claimId === claim.claimId);
    if (!semantic || semantic.authority !== "independent_human_review") { reviewedClaims += 1; continue; }
    const result = assessOriginalSourceClaimAuthority({ claim, evidence: supporting, sources: snapshot.sources, fidelity, semanticAssessment: semantic });
    if (result.status === "accepted") acceptedClaims += 1; else if (result.status === "requires_review") reviewedClaims += 1; else rejectedClaims += 1;
  }
  const evidenceStatus: CanonicalAcceptanceStatus = rejectedClaims ? "BLOCKED" : acceptedClaims === 7 ? "PASS" : "REVIEW_REQUIRED";
  add(checks, "ORIGINAL_SOURCE_SEMANTIC_AUTHORITY", evidenceStatus, rejectedClaims ? "UNSUPPORTED_CONTRADICTED_OR_SUBSTITUTED_CLAIM" : acceptedClaims === 7 ? "ALL_CLAIMS_INDEPENDENTLY_SUPPORTED" : "INDEPENDENT_EVIDENCE_REVIEW_INCOMPLETE");

  const assertionCoverage = script && Array.isArray(snapshot.factualAssertions) && snapshot.factualAssertions.length > 0 && snapshot.factualAssertions.every((item) => script!.sections.some((section) => section.id === item.sectionId) && item.claimIds.length > 0 && item.claimIds.every((id) => snapshot.claims.some((claim) => claim.claimId === id)) && /^[a-f0-9]{64}$/.test(item.textSha256));
  add(checks, "FACTUAL_ASSERTION_BINDING", assertionCoverage ? "PASS" : "REVIEW_REQUIRED", assertionCoverage ? "ASSERTION_INVENTORY_BOUND_TO_CANONICAL_CLAIMS" : "UNBOUND_ASSERTION_AUDIT_REQUIRED");

  let duration = null;
  if (script) {
    duration = getCreatorScriptDurationContractForScript(script, "en");
    const durationOk = duration.status === "compliant";
    add(checks, "THYNEL_DURATION_AND_WORD_BOUNDARIES", durationOk ? "PASS" : "BLOCKED", durationOk ? "480_SECOND_WORD_ENVELOPE_COMPLIANT" : `WORD_ENVELOPE_${duration.status.toUpperCase()}`);
  }
  const editorial = snapshot.editorialReview;
  const editorialOk = editorial?.authority === "independent_human_review" && editorial.englishClarity && editorial.narrativeProgression && editorial.factualPrecision && editorial.repetitionAcceptable && editorial.wordBoundariesValid;
  add(checks, "EDITORIAL_QUALITY", editorialOk ? "PASS" : "REVIEW_REQUIRED", editorialOk ? "INDEPENDENT_EDITORIAL_REVIEW_ACCEPTED" : "INDEPENDENT_EDITORIAL_REVIEW_REQUIRED");

  if (script) {
    const previewCandidate = structuredClone(script);
    previewCandidate.sections = previewCandidate.sections.map((section, index) => index === 0 ? { ...section, text: `${section.text} Preview.` } : section);
    previewCandidate.revision += 1; previewCandidate.updatedAt = "offline-preview"; previewCandidate.approval = null;
    const proposal = createCreatorScriptProposal({ script, scope: "whole_script", instruction: "Offline lifecycle acceptance only.", nextScript: previewCandidate, mode: "editorial_rewrite" });
    const state = { script, pendingRefinement: proposal, revisionHistory: [] };
    const discarded = discardCreatorScriptProposal(state, proposal.proposalId);
    let staleRejected = false;
    try { applyCreatorScriptProposal({ ...script, revision: script.revision + 1 }, proposal, "en"); } catch (error) { staleRejected = String(error).includes("CREATOR_SCRIPT_REFINEMENT_STALE"); }
    const lifecycleOk = state.script === script && discarded.script === script && discarded.pendingRefinement === null && staleRejected;
    add(checks, "PREVIEW_DISCARD_STALE_CAS", lifecycleOk ? "PASS" : "BLOCKED", lifecycleOk ? "OFFLINE_CLONES_ONLY_NO_APPLY_STALE_REJECTED" : "REFINEMENT_LIFECYCLE_AUTHORITY_FAILED");
  }
  const status: CanonicalAcceptanceStatus = checks.some((item) => item.status === "BLOCKED") ? "BLOCKED" : checks.some((item) => item.status === "REVIEW_REQUIRED") ? "REVIEW_REQUIRED" : "PASS";
  const missing = checks.filter((item) => item.status !== "PASS").map((item) => item.detail);
  return finalize(status, true, checks, missing, before, snapshotValue, { acceptedClaims, reviewedClaims, rejectedClaims, duration });
}

function finalize(status: CanonicalAcceptanceStatus, actualCanonicalSnapshot: boolean, checks: Check[], missingRequirements: string[], before: string, original: unknown, metrics: Record<string, unknown>) {
  const zeroWrite = before === sha256(stable(original));
  return { status: zeroWrite ? status : "BLOCKED" as const, actualCanonicalSnapshot, closeStage4B2: false, checks, missingRequirements, zeroWrite, metrics };
}
