import { createHash } from "node:crypto";

import type { CreatorScriptGenerationPilotPublicEvidenceFixture } from
  "./creatorScriptGenerationPilotHarness.ts";
import {
  STAGE_5E1A_MAXIMUM_ATTEMPTS,
  STAGE_5E1A_MAXIMUM_COST_USD,
  STAGE_5E1A_MAXIMUM_INPUT_TOKENS_PER_REQUEST,
  STAGE_5E1A_MAXIMUM_OUTPUT_TOKENS_PER_REQUEST,
  STAGE_5E1A_PINNED_MODEL,
  STAGE_5E1A_RESPONSES_ENDPOINT,
  stage5e1aRequestFingerprintSha256,
  type Stage5e1aResponsesRequest,
} from "./creatorScriptGenerationPilotOfflineTransport.ts";

export const STAGE_5E1B_READINESS_VERSION =
  "stage-5e1b-pilot-readiness-v1" as const;
export const STAGE_5E1B_TOKEN_COUNT_ENDPOINT =
  "https://api.openai.com/v1/responses/input_tokens" as const;

export type Stage5e1bTokenAssuranceClassification =
  | "synthetic_test_bound"
  | "locally_estimated"
  | "model_compatible_calibrated_upper_bound"
  | "provider_exact_count";

export type Stage5e1bTokenAssurance = Readonly<{
  sectionId: string;
  classification: Stage5e1bTokenAssuranceClassification;
  requestFingerprintSha256: string;
  inputTokens: number;
  evidenceOrigin: "caller_supplied_offline";
  accountedComponents: Readonly<{
    model: true;
    inputMessages: true;
    structuredOutputSchema: true;
    dynamicCompletedSections: true;
  }>;
  method: string;
}>;

export type Stage5e1bSyntheticDocument = Readonly<{
  sourceId: string;
  canonicalUrl: string;
  mediaType: "text/plain" | "text/html" | "application/pdf";
  bytes: Uint8Array;
  documentSha256: string;
  extraction: "normalized_plain_text_v1" | "unsupported";
  provenance:
    | "synthetic_test_document"
    | "self_attested"
    | "independently_verified_publisher_document";
}>;

export type Stage5e1bSyntheticPassage = Readonly<{
  evidenceId: string;
  sourceId: string;
  passageSha256: string;
  normalizedPassageSha256: string;
  canonicalLocatorFingerprintSha256: string;
  locator: Readonly<{
    kind: "normalized_unicode_scalar_range";
    start: number;
    end: number;
  }>;
  locatorFingerprintSha256: string;
  provenance: "synthetic_deterministic_extraction" | "self_attested";
}>;

export type Stage5e1bReadinessManifest = Readonly<{
  version: typeof STAGE_5E1B_READINESS_VERSION;
  pilotId: string;
  contract: Readonly<{
    model: typeof STAGE_5E1A_PINNED_MODEL;
    endpoint: typeof STAGE_5E1A_RESPONSES_ENDPOINT;
    serviceTier: "default";
    maximumCalls: 5;
    targetDurationSeconds: 480;
    maximumInputTokensPerRequest: number;
    maximumOutputTokensPerRequest: number;
    modeledCostReservationUsd: number;
    structuredOutputSchemaSha256: string;
  }>;
  fixture: CreatorScriptGenerationPilotPublicEvidenceFixture;
  requests: readonly Readonly<{
    ordinal: number;
    sectionId: string;
    request: Stage5e1aResponsesRequest;
    tokenAssurance: Stage5e1bTokenAssurance;
  }>[];
  documents: readonly Stage5e1bSyntheticDocument[];
  passages: readonly Stage5e1bSyntheticPassage[];
  isolation: Readonly<{
    network: "mock_observation_only" | "os_egress_deny_verified";
    credentials: "not_loaded" | "isolated_ephemeral_credential";
    billingReceipts: "unavailable" | "independently_verified";
    durableAttemptAuthorization: "single_host_fsync" | "shared_transactional";
    liveTransport: "unavailable" | "separately_authorized";
    databaseWrites: "none";
  }>;
}>;

export type Stage5e1bAssessmentStatus = "PASS" | "REVIEW_REQUIRED" | "BLOCKED";

export type Stage5e1bReadinessReport = Readonly<{
  version: typeof STAGE_5E1B_READINESS_VERSION;
  status: Stage5e1bAssessmentStatus;
  liveDisposition: "NO_GO";
  manifestFingerprintSha256: string;
  checks: readonly Readonly<{
    id: string;
    status: Stage5e1bAssessmentStatus;
    reasonCodes: readonly string[];
  }>[];
  reasonCodes: readonly string[];
  coverage: Readonly<{
    requestCount: number;
    sectionCount: number;
    sourceCount: number;
    passageCount: number;
  }>;
  tokenCalibrationPlan: Readonly<{
    status: "UNVERIFIED";
    endpoint: typeof STAGE_5E1B_TOKEN_COUNT_ENDPOINT;
    requiresSeparateAuthorization: true;
    countsAsAdditionalProviderRequest: true;
    exactSerializedRequestRequired: true;
    dynamicPerSectionAdmissionRequired: true;
    discrepancyPolicy: "block_and_recalibrate";
    nonTextInputAllowed: false;
  }>;
  persistence: "none";
}>;

type Check = Stage5e1bReadinessReport["checks"][number];

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function check(
  id: string,
  status: Stage5e1bAssessmentStatus,
  reasonCodes: readonly string[] = [],
): Check {
  return Object.freeze({ id, status, reasonCodes: Object.freeze([...reasonCodes].toSorted()) });
}

function report(input: {
  manifestFingerprintSha256: string;
  checks: readonly Check[];
  coverage?: Partial<Stage5e1bReadinessReport["coverage"]>;
}): Stage5e1bReadinessReport {
  const reasonCodes = [...new Set(input.checks.flatMap((item) => item.reasonCodes))].toSorted();
  const status = input.checks.some((item) => item.status === "BLOCKED")
    ? "BLOCKED"
    : input.checks.some((item) => item.status === "REVIEW_REQUIRED")
      ? "REVIEW_REQUIRED"
      : "PASS";
  return Object.freeze({
    version: STAGE_5E1B_READINESS_VERSION,
    status,
    liveDisposition: "NO_GO",
    manifestFingerprintSha256: input.manifestFingerprintSha256,
    checks: Object.freeze([...input.checks]),
    reasonCodes: Object.freeze(reasonCodes),
    coverage: Object.freeze({
      requestCount: input.coverage?.requestCount ?? 0,
      sectionCount: input.coverage?.sectionCount ?? 0,
      sourceCount: input.coverage?.sourceCount ?? 0,
      passageCount: input.coverage?.passageCount ?? 0,
    }),
    tokenCalibrationPlan: Object.freeze({
      status: "UNVERIFIED",
      endpoint: STAGE_5E1B_TOKEN_COUNT_ENDPOINT,
      requiresSeparateAuthorization: true,
      countsAsAdditionalProviderRequest: true,
      exactSerializedRequestRequired: true,
      dynamicPerSectionAdmissionRequired: true,
      discrepancyPolicy: "block_and_recalibrate",
      nonTextInputAllowed: false,
    }),
    persistence: "none",
  });
}

function blockedInvalidManifest(code: string): Stage5e1bReadinessReport {
  return report({
    manifestFingerprintSha256: sha256("invalid-stage-5e1b-manifest"),
    checks: [check("manifest_integrity", "BLOCKED", [code])],
  });
}

function normalizeDeterministicText(value: string) {
  return value.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\t\n\f\r ]+/g, " ").trim();
}

function unicodeScalars(value: string) {
  return [...value];
}

function passageScalarOccurrences(document: string, passage: string) {
  const documentScalars = unicodeScalars(document);
  const passageScalars = unicodeScalars(passage);
  const starts: number[] = [];
  for (let start = 0; start <= documentScalars.length - passageScalars.length; start += 1) {
    if (passageScalars.every((scalar, index) => documentScalars[start + index] === scalar)) {
      starts.push(start);
    }
  }
  return { documentScalars, passageScalars, starts };
}

function decodePlainText(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("SOURCE_TEXT_DECODING_INVALID");
  }
}

function parseUser(request: Stage5e1aResponsesRequest) {
  const message = request.body.input.find((item) => item.role === "user");
  if (!message) throw new Error("REQUEST_USER_INPUT_MISSING");
  try {
    return JSON.parse(message.content) as Record<string, unknown>;
  } catch {
    throw new Error("REQUEST_USER_INPUT_INVALID");
  }
}

function requestManifestIdentity(manifest: Stage5e1bReadinessManifest) {
  return {
    version: manifest.version,
    pilotId: manifest.pilotId,
    contract: manifest.contract,
    fixtureFingerprintSha256: sha256(stableJson(manifest.fixture)),
    requests: manifest.requests.map((item) => ({
      ordinal: item.ordinal,
      sectionId: item.sectionId,
      requestFingerprintSha256: stage5e1aRequestFingerprintSha256(item.request),
      tokenAssurance: item.tokenAssurance,
    })),
    documents: manifest.documents.map((item) => ({
      sourceId: item.sourceId,
      canonicalUrl: item.canonicalUrl,
      mediaType: item.mediaType,
      documentSha256: item.documentSha256,
      extraction: item.extraction,
      provenance: item.provenance,
    })),
    passages: manifest.passages,
    isolation: manifest.isolation,
  };
}

function exactStringArray(value: unknown, expected: readonly string[]) {
  return Array.isArray(value) && stableJson(value) === stableJson(expected);
}

function containsForbiddenAuthorityKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenAuthorityKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
    key === "editorialContext" ||
    key === "sectionEvidenceAuthorities" ||
    key === "sectionClaimRouting" ||
    containsForbiddenAuthorityKey(item)
  );
}

function validateContract(manifest: Stage5e1bReadinessManifest) {
  const { contract, fixture } = manifest;
  if (
    manifest.version !== STAGE_5E1B_READINESS_VERSION ||
    !manifest.pilotId.trim() ||
    contract.model !== STAGE_5E1A_PINNED_MODEL ||
    contract.endpoint !== STAGE_5E1A_RESPONSES_ENDPOINT ||
    contract.serviceTier !== "default" ||
    contract.maximumCalls !== STAGE_5E1A_MAXIMUM_ATTEMPTS ||
    contract.targetDurationSeconds !== 480 ||
    contract.maximumInputTokensPerRequest !== STAGE_5E1A_MAXIMUM_INPUT_TOKENS_PER_REQUEST ||
    contract.maximumOutputTokensPerRequest !== STAGE_5E1A_MAXIMUM_OUTPUT_TOKENS_PER_REQUEST ||
    contract.modeledCostReservationUsd !== STAGE_5E1A_MAXIMUM_COST_USD ||
    fixture.generationInput.narrativePolicy !== "science_documentary_v1" ||
    fixture.generationInput.format !== "youtube_video" ||
    fixture.generationInput.requestedDurationSeconds !== 480 ||
    fixture.generationInput.sectionPlan.length !== 5 ||
    fixture.generationInput.sectionEvidenceAuthorities?.length !== 5 ||
    fixture.generationInput.sectionClaimRouting?.length !== 5
  ) throw new Error("PILOT_CONTRACT_INVALID");
}

function validateRequests(manifest: Stage5e1bReadinessManifest) {
  if (manifest.requests.length !== 5) throw new Error("REQUEST_SET_INCOMPLETE");
  const sectionIds = new Set<string>();
  const tokenReasons = new Set<string>();
  let tokenBlocked = false;
  for (const [index, item] of manifest.requests.entries()) {
    const request = item.request;
    const section = manifest.fixture.generationInput.sectionPlan[index];
    const authority = manifest.fixture.generationInput.sectionEvidenceAuthorities?.find(
      (candidate) => candidate.sectionId === item.sectionId,
    );
    if (
      item.ordinal !== index + 1 ||
      !section ||
      section.id !== item.sectionId ||
      sectionIds.has(item.sectionId) ||
      !authority ||
      request.endpoint !== STAGE_5E1A_RESPONSES_ENDPOINT ||
      request.body.model !== STAGE_5E1A_PINNED_MODEL ||
      request.body.service_tier !== "default" ||
      request.body.max_output_tokens !== STAGE_5E1A_MAXIMUM_OUTPUT_TOKENS_PER_REQUEST ||
      request.requestOptions.maxRetries !== 0 ||
      request.body.tools.length !== 0 ||
      request.body.store !== false ||
      request.body.background !== false ||
      request.body.text.format.type !== "json_schema" ||
      request.body.text.format.strict !== true ||
      sha256(stableJson(request.body.text.format.schema)) !==
        manifest.contract.structuredOutputSchemaSha256
    ) throw new Error("REQUEST_CONTRACT_INVALID");
    sectionIds.add(item.sectionId);
    const user = parseUser(request);
    const activeSection = user.activeSection as { id?: unknown } | undefined;
    const completedSections = user.completedSections;
    const claimAuthority = user.activeSectionClaimAuthority as {
      sectionId?: unknown;
      claimIds?: unknown;
      evidenceIds?: unknown;
    } | undefined;
    if (
      activeSection?.id !== item.sectionId ||
      !Array.isArray(completedSections) ||
      completedSections.length !== index ||
      completedSections.some((completed, completedIndex) =>
        !completed ||
        typeof completed !== "object" ||
        (completed as { id?: unknown }).id !==
          manifest.fixture.generationInput.sectionPlan[completedIndex]?.id
      ) ||
      claimAuthority?.sectionId !== item.sectionId ||
      !exactStringArray(claimAuthority.claimIds, authority.claimIds) ||
      !exactStringArray(claimAuthority.evidenceIds, authority.evidenceIds) ||
      stableJson(user.activeSectionEvidenceSelection) !== stableJson(authority.selection)
    ) throw new Error("SECTION_EVIDENCE_BOUNDARY_INVALID");
    if (containsForbiddenAuthorityKey(user)) {
      throw new Error("CROSS_SECTION_AUTHORITY_EXPOSED");
    }

    for (const unit of authority.selection.units) {
      if (!authority.claimIds.includes(unit.claimId)) {
        throw new Error("SECTION_EVIDENCE_BOUNDARY_INVALID");
      }
      for (const binding of [
        ...unit.supportingEvidence,
        ...unit.counterEvidence,
        ...unit.contextualEvidence,
      ]) {
        if (!authority.evidenceIds.includes(binding.evidenceId)) {
          throw new Error("SECTION_EVIDENCE_BOUNDARY_INVALID");
        }
      }
    }

    const assurance = item.tokenAssurance;
    if (
      assurance.sectionId !== item.sectionId ||
      assurance.requestFingerprintSha256 !== stage5e1aRequestFingerprintSha256(request)
    ) throw new Error("TOKEN_REQUEST_FINGERPRINT_MISMATCH");
    if (
      assurance.evidenceOrigin !== "caller_supplied_offline" ||
      !assurance.method.trim() ||
      assurance.accountedComponents.model !== true ||
      assurance.accountedComponents.inputMessages !== true ||
      assurance.accountedComponents.structuredOutputSchema !== true ||
      assurance.accountedComponents.dynamicCompletedSections !== true ||
      !Number.isInteger(assurance.inputTokens) ||
      assurance.inputTokens <= 0 ||
      assurance.inputTokens > STAGE_5E1A_MAXIMUM_INPUT_TOKENS_PER_REQUEST
    ) throw new Error("TOKEN_ASSURANCE_INCOMPLETE");
    if (assurance.classification === "synthetic_test_bound") {
      tokenReasons.add("TOKEN_ASSURANCE_SYNTHETIC_ONLY");
    } else if (assurance.classification === "locally_estimated") {
      tokenReasons.add("TOKEN_ASSURANCE_LOCAL_ESTIMATE_ONLY");
    } else if (assurance.classification === "model_compatible_calibrated_upper_bound") {
      tokenReasons.add("TOKEN_CALIBRATION_NOT_INDEPENDENTLY_VERIFIED");
      tokenBlocked = true;
    } else if (assurance.classification === "provider_exact_count") {
      tokenReasons.add("PROVIDER_EXACT_COUNT_RECEIPT_NOT_INDEPENDENTLY_VERIFIED");
      tokenBlocked = true;
    } else {
      throw new Error("TOKEN_ASSURANCE_CLASSIFICATION_INVALID");
    }
  }
  return { sectionIds, tokenReasons, tokenBlocked };
}

function validateEvidence(manifest: Stage5e1bReadinessManifest) {
  const sourceVerifications = new Map(
    manifest.fixture.sourceVerifications.map((item) => [item.sourceId, item]),
  );
  const evidenceVerifications = new Map(
    manifest.fixture.evidenceVerifications.map((item) => [item.evidenceId, item]),
  );
  const canonicalSources = new Map(
    manifest.fixture.generationInput.editorialContext.sources.map((item) => [item.sourceId, item]),
  );
  const canonicalEvidence = new Map(
    manifest.fixture.generationInput.editorialContext.evidence.map((item) => [item.evidenceId, item]),
  );
  const requiredEvidenceIds = new Set(
    manifest.fixture.generationInput.sectionEvidenceAuthorities?.flatMap(
      (authority) => authority.evidenceIds,
    ) || [],
  );
  const requiredSourceIds = new Set(
    [...requiredEvidenceIds].map((evidenceId) => canonicalEvidence.get(evidenceId)?.sourceId),
  );
  if (requiredSourceIds.has(undefined)) throw new Error("EVIDENCE_PASSAGE_MISSING");
  const documents = new Map(manifest.documents.map((item) => [item.sourceId, item]));
  const passages = new Map(manifest.passages.map((item) => [item.evidenceId, item]));
  if (documents.size !== manifest.documents.length || passages.size !== manifest.passages.length) {
    throw new Error("EVIDENCE_IDENTITY_DUPLICATED");
  }
  if (
    documents.size !== requiredSourceIds.size ||
    sourceVerifications.size !== requiredSourceIds.size ||
    evidenceVerifications.size !== requiredEvidenceIds.size
  ) throw new Error("EVIDENCE_SET_INCOMPLETE");
  const normalizedDocuments = new Map<string, string>();
  const provenanceReasons = new Set<string>();
  for (const [sourceId, document] of documents) {
    const verification = sourceVerifications.get(sourceId);
    const source = canonicalSources.get(sourceId);
    if (
      !verification ||
      !source ||
      !requiredSourceIds.has(sourceId) ||
      source.url !== document.canonicalUrl ||
      verification.canonicalUrl !== document.canonicalUrl ||
      sha256(document.bytes) !== document.documentSha256 ||
      document.documentSha256 !== verification.documentSha256
    ) throw new Error("SOURCE_DOCUMENT_HASH_INVALID");
    if (document.mediaType !== "text/plain" || document.extraction !== "normalized_plain_text_v1") {
      throw new Error("SOURCE_EXTRACTION_UNSUPPORTED");
    }
    if (document.provenance === "self_attested") {
      throw new Error("SOURCE_PROVENANCE_SELF_ATTESTED");
    }
    if (document.provenance === "independently_verified_publisher_document") {
      throw new Error("SOURCE_PROVENANCE_RECEIPT_UNVERIFIED");
    }
    provenanceReasons.add("SOURCE_PROVENANCE_SYNTHETIC_ONLY");
    normalizedDocuments.set(sourceId, normalizeDeterministicText(decodePlainText(document.bytes)));
  }
  for (const evidenceId of requiredEvidenceIds) {
    const passage = passages.get(evidenceId);
    const verification = evidenceVerifications.get(evidenceId);
    const canonical = canonicalEvidence.get(evidenceId);
    if (
      !passage ||
      !verification ||
      !canonical ||
      passage.sourceId !== canonical.sourceId ||
      verification.sourceId !== canonical.sourceId ||
      typeof canonical.excerpt !== "string" ||
      !canonical.excerpt.trim()
    ) {
      throw new Error("EVIDENCE_PASSAGE_MISSING");
    }
    if (passage.provenance !== "synthetic_deterministic_extraction") {
      throw new Error("EVIDENCE_PROVENANCE_INVALID");
    }
    const normalizedDocument = normalizedDocuments.get(passage.sourceId);
    const normalizedPassage = normalizeDeterministicText(canonical.excerpt);
    const occurrence = normalizedDocument
      ? passageScalarOccurrences(normalizedDocument, normalizedPassage)
      : null;
    if (
      !normalizedDocument ||
      !occurrence ||
      passage.passageSha256 !== verification.passageSha256 ||
      passage.passageSha256 !== sha256(canonical.excerpt) ||
      passage.normalizedPassageSha256 !== sha256(normalizedPassage) ||
      passage.canonicalLocatorFingerprintSha256 !== verification.locatorFingerprintSha256 ||
      passage.canonicalLocatorFingerprintSha256 !== sha256(JSON.stringify(canonical.locator)) ||
      passage.locator.kind !== "normalized_unicode_scalar_range" ||
      !Number.isInteger(passage.locator.start) ||
      !Number.isInteger(passage.locator.end) ||
      passage.locator.start < 0 ||
      passage.locator.end <= passage.locator.start ||
      passage.locator.end > occurrence.documentScalars.length ||
      occurrence.documentScalars
        .slice(passage.locator.start, passage.locator.end)
        .join("") !== normalizedPassage ||
      passage.locatorFingerprintSha256 !== sha256(stableJson(passage.locator))
    ) throw new Error("EVIDENCE_LOCATOR_INVALID");
    if (
      occurrence.starts.length !== 1 ||
      occurrence.starts[0] !== passage.locator.start
    ) throw new Error("EVIDENCE_PASSAGE_AMBIGUOUS_OR_MISSING");
  }
  if (passages.size !== requiredEvidenceIds.size) {
    throw new Error("EVIDENCE_PASSAGE_SET_INVALID");
  }
  return { provenanceReasons, sourceCount: documents.size, passageCount: passages.size };
}

export function verifyStage5e1bPilotReadiness(
  value: unknown,
): Stage5e1bReadinessReport {
  if (!value || typeof value !== "object") {
    return blockedInvalidManifest("READINESS_MANIFEST_INVALID");
  }
  const manifest = value as Stage5e1bReadinessManifest;
  let fingerprint = sha256("invalid-stage-5e1b-manifest");
  try {
    validateContract(manifest);
    fingerprint = sha256(stableJson(requestManifestIdentity(manifest)));
    const requestResult = validateRequests(manifest);
    const evidenceResult = validateEvidence(manifest);
    if (manifest.isolation.databaseWrites !== "none") {
      throw new Error("DATABASE_WRITE_ISOLATION_INVALID");
    }
    const checks: Check[] = [
      check("manifest_integrity", "PASS"),
      check("pilot_contract", "PASS"),
      check("request_and_section_identity", "PASS"),
      check("section_evidence_isolation", "PASS"),
      check("source_document_integrity", "PASS"),
      check("passage_locator_integrity", "PASS"),
      check(
        "token_assurance",
        requestResult.tokenBlocked ? "BLOCKED" : "REVIEW_REQUIRED",
        [...requestResult.tokenReasons],
      ),
      check("independent_source_provenance", "REVIEW_REQUIRED", [
        ...evidenceResult.provenanceReasons,
      ]),
      manifest.isolation.network === "os_egress_deny_verified"
        ? check("network_isolation", "BLOCKED", ["NETWORK_ISOLATION_ATTESTATION_UNVERIFIED"])
        : check("network_isolation", "BLOCKED", ["OS_EGRESS_ISOLATION_MISSING"]),
      manifest.isolation.credentials === "not_loaded"
        ? check("credential_isolation", "PASS")
        : check("credential_isolation", "BLOCKED", ["CREDENTIAL_ISOLATION_ATTESTATION_UNVERIFIED"]),
      manifest.isolation.billingReceipts === "unavailable"
        ? check("billing_receipt_assurance", "BLOCKED", ["BILLING_RECEIPT_AUTHORITY_MISSING"])
        : check("billing_receipt_assurance", "BLOCKED", ["BILLING_RECEIPT_ATTESTATION_UNVERIFIED"]),
      manifest.isolation.durableAttemptAuthorization === "single_host_fsync"
        ? check("durable_attempt_authorization", "REVIEW_REQUIRED", ["ATTEMPT_LEDGER_SINGLE_HOST_ONLY"])
        : check("durable_attempt_authorization", "BLOCKED", ["SHARED_LEDGER_ATTESTATION_UNVERIFIED"]),
      manifest.isolation.liveTransport === "unavailable"
        ? check("live_transport_availability", "BLOCKED", ["LIVE_TRANSPORT_UNAVAILABLE"])
        : check("live_transport_availability", "BLOCKED", ["LIVE_TRANSPORT_UNAUTHORIZED"]),
    ];
    return report({
      manifestFingerprintSha256: fingerprint,
      checks,
      coverage: {
        requestCount: manifest.requests.length,
        sectionCount: requestResult.sectionIds.size,
        sourceCount: evidenceResult.sourceCount,
        passageCount: evidenceResult.passageCount,
      },
    });
  } catch (error: unknown) {
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "READINESS_MANIFEST_INVALID";
    return report({
      manifestFingerprintSha256: fingerprint,
      checks: [check("manifest_integrity", "BLOCKED", [code])],
    });
  }
}
