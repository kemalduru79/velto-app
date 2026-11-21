import { createHash } from "node:crypto";
import { canonicalAcceptanceSha256 } from "./creatorScriptCanonicalAcceptance.ts";
import { normalizeCreatorScript } from "./creatorScript.ts";
import { inspectCreatorProjectStatePersistenceAuthority } from "./projectState.ts";

export const STAGE4B2E_CANONICAL_INTAKE_VERSION = "stage4b2e-owner-canonical-intake-v1" as const;

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const ids = (value: unknown) => Array.isArray(value) ? value.map((item) => String(record(item).id || "").trim()) : [];
const unique = (value: string[]) => value.every(Boolean) && new Set(value).size === value.length;

export function createStage4B2EOwnerCanonicalCapture(input: {
  projectValue: unknown;
  rawResponseBytes: Uint8Array;
  expectedProjectId: string;
}) {
  const project = record(input.projectValue);
  if (project.id !== input.expectedProjectId) throw new Error("CANONICAL_CAPTURE_PROJECT_ID_MISMATCH");
  if (project.flow_type !== "creator_lab") throw new Error("CANONICAL_CAPTURE_FLOW_MISMATCH");
  if (typeof project.updated_at !== "string" || !project.updated_at.trim()) throw new Error("CANONICAL_CAPTURE_REVISION_MISSING");

  const authority = inspectCreatorProjectStatePersistenceAuthority(project);
  if (authority.status !== "valid" || !authority.snapshot || !authority.script) {
    throw new Error(`CANONICAL_CAPTURE_PROJECT_STATE_${authority.status.toUpperCase()}`);
  }
  const script = normalizeCreatorScript(authority.script);
  const sceneIds = ids(project.scenes);
  const canonicalSceneIds = ids(authority.snapshot.createReview.scenes);
  if (!unique(sceneIds) || !unique(canonicalSceneIds)) throw new Error("CANONICAL_CAPTURE_SCENE_IDENTITY_INVALID");

  const context = script.grounding.context;
  const projectIdentitySha256 = sha256(String(project.id));
  const scriptSha256 = canonicalAcceptanceSha256(script);
  const groundingSha256 = canonicalAcceptanceSha256(context);
  const sceneIdentitySha256 = canonicalAcceptanceSha256([sceneIds, canonicalSceneIds]);
  const rawResponseSha256 = sha256(input.rawResponseBytes);
  const sourceIds = new Set(context.sources.map((source) => source.sourceId));
  const evidenceIds = new Set(context.evidence.map((item) => item.evidenceId));
  const claimIds = new Set(context.claims.map((claim) => claim.claimId));
  const referencesValid = context.evidence.every((item) => sourceIds.has(item.sourceId)) &&
    context.claims.every((claim) => [...claim.supportingEvidenceIds, ...claim.counterEvidenceIds, ...claim.contextualEvidenceIds].every((id) => evidenceIds.has(id))) &&
    script.sections.every((section) => section.claimIds.every((id) => claimIds.has(id)));
  const sectionOrderValid = script.sections.map((section) => section.kind).join(",") === "opening,body,body,body,conclusion";
  const structurallyAligned = sceneIds.length === 36 && canonicalSceneIds.length === 36 &&
    sceneIds.every((id, index) => id === canonicalSceneIds[index]);
  const language = authority.snapshot.brief.language;
  const baselineShape = language === "en" && script.revision === 1 && script.targetDurationSec === 480 &&
    script.approval === null && script.sections.length === 5 && sectionOrderValid && context.claims.length === 7 &&
    context.evidence.length === 13 && context.sources.length === 7 && referencesValid && structurallyAligned;

  const intake = {
    version: STAGE4B2E_CANONICAL_INTAKE_VERSION,
    language,
    projectIdentitySha256,
    projectRevision: project.updated_at,
    script,
    sceneIds,
    canonicalSceneIds,
    sources: context.sources,
    claims: context.claims,
    evidence: context.evidence,
    fingerprints: {
      algorithm: "velto-js-stable-json-sha256-v1",
      scriptSha256,
      groundingSha256,
      sceneIdentitySha256,
    },
    rawCapture: {
      algorithm: "raw-http-response-bytes-sha256",
      responseSha256: rawResponseSha256,
    },
  };
  const report = {
    status: baselineShape ? "STRUCTURAL_BASELINE_CAPTURED" : "BLOCKED",
    stage4b2Status: "REVIEW_REQUIRED",
    actualCanonicalSnapshot: false,
    closeStage4B2: false,
    projectIdentitySha256,
    projectRevision: project.updated_at,
    counts: {
      sections: script.sections.length,
      persistedScenes: sceneIds.length,
      canonicalScenes: canonicalSceneIds.length,
      claims: context.claims.length,
      evidence: context.evidence.length,
      sources: context.sources.length,
    },
    fingerprints: intake.fingerprints,
    rawCapture: intake.rawCapture,
    checks: {
      english: language === "en",
      revisionOne: script.revision === 1,
      targetDuration480: script.targetDurationSec === 480,
      approvalNull: script.approval === null,
      fiveOrderedSections: script.sections.length === 5 && sectionOrderValid && new Set(script.sections.map((section) => section.id)).size === 5,
      sceneIdentitiesAligned: structurallyAligned,
      groundingCountsMatch: context.claims.length === 7 && context.evidence.length === 13 && context.sources.length === 7,
      groundingReferencesValid: referencesValid,
    },
    hashScopeNotice: "PostgreSQL jsonb::text hashes and legacy MD5 observations are not comparable to velto-js-stable-json-sha256-v1.",
    missingRequirements: [
      "INDEPENDENT_DETACHED_BASELINE_MANIFEST",
      "SEVEN_INDEPENDENT_ORIGINAL_SOURCE_RECEIPTS",
      "COMPLETE_FACTUAL_ASSERTION_INVENTORY",
      "INDEPENDENT_SEMANTIC_REVIEW",
      "INDEPENDENT_EDITORIAL_REVIEW",
      "SEPARATELY_APPROVED_OWNER_AUTHORITY_KEY",
      "AUTHENTICATED_POST_REVIEW_COMPARISON",
      "OWNER_STAGE_CLOSURE_APPROVAL",
    ],
  };
  return { intake, report };
}

export function compareStage4B2ECaptures(before: ReturnType<typeof createStage4B2EOwnerCanonicalCapture>["report"], after: ReturnType<typeof createStage4B2EOwnerCanonicalCapture>["report"]) {
  const unchanged = before.projectIdentitySha256 === after.projectIdentitySha256 &&
    before.projectRevision === after.projectRevision &&
    before.fingerprints.scriptSha256 === after.fingerprints.scriptSha256 &&
    before.fingerprints.groundingSha256 === after.fingerprints.groundingSha256 &&
    before.fingerprints.sceneIdentitySha256 === after.fingerprints.sceneIdentitySha256;
  return {
    status: unchanged ? "UNCHANGED" : "BLOCKED",
    stage4b2Status: "REVIEW_REQUIRED",
    actualCanonicalSnapshot: false,
    closeStage4B2: false,
    authenticatedReadOnlyComparison: unchanged,
    before: { projectRevision: before.projectRevision, fingerprints: before.fingerprints },
    after: { projectRevision: after.projectRevision, fingerprints: after.fingerprints },
  };
}
