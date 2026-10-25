import { createHash } from "node:crypto";

import type { CreatorScriptBuildScriptGenerationInput } from "./creatorScriptBuildScriptGenerationCoordinator.ts";

export const CREATOR_SCRIPT_GENERATION_PILOT_VERSION =
  "stage-5e0-generation-pilot-v1" as const;
export const CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT = 5;

type GenerationProviderRequest = {
  ownerId: string;
  projectId: string;
  operationType: string;
  logicalOperationId: string;
  system: string;
  user: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  model?: string;
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max";
};

export type CreatorScriptGenerationPilotPublicEvidenceFixture = Readonly<{
  version: "stage-5e0-public-evidence-fixture-v1";
  fixtureId: string;
  generationInput: CreatorScriptBuildScriptGenerationInput;
  sourceVerifications: readonly Readonly<{
    sourceId: string;
    canonicalUrl: string;
    documentSha256: string;
    verificationMethod: "owner_verified_public_document";
  }>[];
  evidenceVerifications: readonly Readonly<{
    evidenceId: string;
    sourceId: string;
    passageSha256: string;
    locatorFingerprintSha256: string;
  }>[];
}>;

export type CreatorScriptGenerationPilotEnvelope = Readonly<{
  model: string;
  maximumProviderRequests: 5;
  maximumAttemptsPerRequest: 1;
  maximumInputTokensPerRequest: number;
  maximumOutputTokensPerRequest: number;
  maximumCostUsd: number;
  pricing: Readonly<{
    model: string;
    currency: "USD";
    inputUsdPerMillionTokens: number;
    outputUsdPerMillionTokens: number;
    source: string;
    verifiedAt: string;
  }>;
}>;

export type CreatorScriptGenerationPilotMockReceipt = Readonly<{
  status: "completed" | "ambiguous";
  requestId: string | null;
  attemptCount: number;
  inputTokens: number;
  outputTokens: number;
  output: Record<string, unknown> | null;
}>;

export type CreatorScriptGenerationPilotMockTransport = (input: {
  request: GenerationProviderRequest;
  controls: Readonly<{
    model: string;
    maxOutputTokens: number;
    maxRetries: 0;
    requestOrdinal: number;
  }>;
}) => Promise<CreatorScriptGenerationPilotMockReceipt>;

export type CreatorScriptGenerationPilotGenerationExecutor = (input: {
  ownerId: string;
  projectId: string;
  value: CreatorScriptBuildScriptGenerationInput;
  runJson: (request: GenerationProviderRequest) => Promise<Record<string, unknown>>;
}) => Promise<unknown>;

export type CreatorScriptGenerationPilotResult = Readonly<{
  version: typeof CREATOR_SCRIPT_GENERATION_PILOT_VERSION;
  mode: "offline_mock";
  fixtureId: string;
  fixtureFingerprintSha256: string;
  providerRequestCount: 5;
  maximumReservedCostUsd: number;
  actualMockUsage: Readonly<{
    inputTokens: number;
    outputTokens: number;
    hypotheticalCostUsd: number;
  }>;
  requests: readonly Readonly<{
    ordinal: number;
    logicalOperationId: string;
    sectionId: string;
    model: string;
    estimatedInputTokens: number;
    maximumOutputTokens: number;
    requestId: string;
  }>[];
  candidate: unknown;
  persistence: "none";
  durationAuthority: "estimated_words_only";
}>;

function fail(code: string): never {
  throw new Error(code);
}

function isSha256(value: string) {
  return /^[a-f0-9]{64}$/.test(value);
}

function finiteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function price(inputTokens: number, outputTokens: number, envelope: CreatorScriptGenerationPilotEnvelope) {
  return (
    inputTokens * envelope.pricing.inputUsdPerMillionTokens +
    outputTokens * envelope.pricing.outputUsdPerMillionTokens
  ) / 1_000_000;
}

function validateEnvelope(envelope: CreatorScriptGenerationPilotEnvelope) {
  if (
    envelope.maximumProviderRequests !== CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT ||
    envelope.maximumAttemptsPerRequest !== 1
  ) fail("CREATOR_SCRIPT_GENERATION_PILOT_ENVELOPE_INVALID");
  if (!envelope.model.trim() || envelope.pricing.model !== envelope.model) {
    fail("CREATOR_SCRIPT_GENERATION_PILOT_MODEL_OR_PRICING_MISSING");
  }
  if (
    envelope.pricing.currency !== "USD" ||
    !envelope.pricing.source.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(envelope.pricing.verifiedAt) ||
    !finiteNonNegative(envelope.pricing.inputUsdPerMillionTokens) ||
    !finiteNonNegative(envelope.pricing.outputUsdPerMillionTokens) ||
    envelope.pricing.inputUsdPerMillionTokens === 0 ||
    envelope.pricing.outputUsdPerMillionTokens === 0
  ) fail("CREATOR_SCRIPT_GENERATION_PILOT_PRICING_MISSING");
  if (
    !Number.isInteger(envelope.maximumInputTokensPerRequest) ||
    envelope.maximumInputTokensPerRequest <= 0 ||
    !Number.isInteger(envelope.maximumOutputTokensPerRequest) ||
    envelope.maximumOutputTokensPerRequest <= 0 ||
    !finiteNonNegative(envelope.maximumCostUsd)
  ) fail("CREATOR_SCRIPT_GENERATION_PILOT_BUDGET_INVALID");
  const reserved = price(
    envelope.maximumInputTokensPerRequest * CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT,
    envelope.maximumOutputTokensPerRequest * CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT,
    envelope,
  );
  if (reserved > envelope.maximumCostUsd) {
    fail("CREATOR_SCRIPT_GENERATION_PILOT_BUDGET_EXHAUSTED");
  }
  return reserved;
}

function validateFixture(fixture: CreatorScriptGenerationPilotPublicEvidenceFixture) {
  const value = fixture.generationInput;
  if (
    fixture.version !== "stage-5e0-public-evidence-fixture-v1" ||
    !fixture.fixtureId.trim() ||
    value.narrativePolicy !== "science_documentary_v1" ||
    value.format !== "youtube_video" ||
    value.requestedDurationSeconds !== 480 ||
    value.sectionNative !== true ||
    value.sectionPlan.length !== CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT ||
    value.sectionEvidenceAuthorities?.length !== CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT ||
    value.sectionClaimRouting?.length !== CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT
  ) fail("CREATOR_SCRIPT_GENERATION_PILOT_FIXTURE_INVALID");

  const canonicalSources = new Map(
    value.editorialContext.sources.map((source) => [source.sourceId, source]),
  );
  const canonicalEvidence = new Map(
    value.editorialContext.evidence.map((evidence) => [evidence.evidenceId, evidence]),
  );
  const sourceVerifications = new Map<string, (typeof fixture.sourceVerifications)[number]>();
  for (const verification of fixture.sourceVerifications) {
    if (
      sourceVerifications.has(verification.sourceId) ||
      verification.verificationMethod !== "owner_verified_public_document" ||
      !isSha256(verification.documentSha256)
    ) fail("CREATOR_SCRIPT_GENERATION_PILOT_SOURCE_PROVENANCE_INVALID");
    const source = canonicalSources.get(verification.sourceId);
    if (!source || source.url !== verification.canonicalUrl || source.reviewStatus !== "usable") {
      fail("CREATOR_SCRIPT_GENERATION_PILOT_SOURCE_PROVENANCE_INVALID");
    }
    sourceVerifications.set(verification.sourceId, verification);
  }
  const evidenceVerifications = new Map<string, (typeof fixture.evidenceVerifications)[number]>();
  for (const verification of fixture.evidenceVerifications) {
    if (
      evidenceVerifications.has(verification.evidenceId) ||
      !isSha256(verification.passageSha256) ||
      !isSha256(verification.locatorFingerprintSha256)
    ) fail("CREATOR_SCRIPT_GENERATION_PILOT_EVIDENCE_PROVENANCE_INVALID");
    const evidence = canonicalEvidence.get(verification.evidenceId);
    if (!evidence || evidence.sourceId !== verification.sourceId) {
      fail("CREATOR_SCRIPT_GENERATION_PILOT_EVIDENCE_PROVENANCE_INVALID");
    }
    evidenceVerifications.set(verification.evidenceId, verification);
  }

  for (const authority of value.sectionEvidenceAuthorities) {
    const route = value.sectionClaimRouting.find((item) => item.sectionId === authority.sectionId);
    if (
      !route ||
      authority.claimIds.some((claimId) => !route.claimIds.includes(claimId)) ||
      authority.evidenceIds.some((evidenceId) => !route.evidenceIds?.includes(evidenceId))
    ) fail("CREATOR_SCRIPT_GENERATION_PILOT_SECTION_AUTHORITY_INVALID");
    if (authority.selection.units.length > 5 || JSON.stringify(authority.selection.units).length > 12_000) {
      fail("CREATOR_SCRIPT_GENERATION_PILOT_EVIDENCE_BUDGET_INVALID");
    }
    for (const unit of authority.selection.units) {
      for (const binding of [
        ...unit.supportingEvidence,
        ...unit.counterEvidence,
        ...unit.contextualEvidence,
      ]) {
        if (!sourceVerifications.has(binding.sourceId)) {
          fail("CREATOR_SCRIPT_GENERATION_PILOT_SOURCE_PROVENANCE_MISSING");
        }
        const evidenceVerification = evidenceVerifications.get(binding.evidenceId);
        if (!evidenceVerification || evidenceVerification.sourceId !== binding.sourceId) {
          fail("CREATOR_SCRIPT_GENERATION_PILOT_EVIDENCE_PROVENANCE_MISSING");
        }
        const canonical = canonicalEvidence.get(binding.evidenceId);
        if (
          !canonical ||
          canonical.sourceId !== binding.sourceId ||
          typeof canonical.excerpt !== "string" ||
          sha256(canonical.excerpt) !== evidenceVerification.passageSha256 ||
          sha256(JSON.stringify(canonical.locator)) !== evidenceVerification.locatorFingerprintSha256
        ) fail("CREATOR_SCRIPT_GENERATION_PILOT_EVIDENCE_PROVENANCE_INVALID");
      }
    }
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function fixtureFingerprint(fixture: CreatorScriptGenerationPilotPublicEvidenceFixture) {
  return sha256(JSON.stringify(fixture));
}

export async function executeOfflineCreatorScriptGenerationPilot(input: {
  fixture: CreatorScriptGenerationPilotPublicEvidenceFixture;
  envelope: CreatorScriptGenerationPilotEnvelope;
  ownerId: string;
  projectId: string;
  liveProviderAccess: false;
  countInputTokens: (request: GenerationProviderRequest) => number;
  mockTransport: CreatorScriptGenerationPilotMockTransport;
  executeGeneration: CreatorScriptGenerationPilotGenerationExecutor;
}): Promise<CreatorScriptGenerationPilotResult> {
  if (input.liveProviderAccess !== false) {
    fail("CREATOR_SCRIPT_GENERATION_PILOT_LIVE_PROVIDER_DISABLED");
  }
  validateFixture(input.fixture);
  const maximumReservedCostUsd = validateEnvelope(input.envelope);
  const requestIds = new Set<string>();
  const logicalOperationIds = new Set<string>();
  const requests: CreatorScriptGenerationPilotResult["requests"][number][] = [];
  let actualInputTokens = 0;
  let actualOutputTokens = 0;

  const candidate = await input.executeGeneration({
    ownerId: input.ownerId,
    projectId: input.projectId,
    value: input.fixture.generationInput,
    runJson: async (request) => {
      const ordinal = requests.length + 1;
      if (ordinal > CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT) {
        fail("CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_LIMIT_EXCEEDED");
      }
      if (logicalOperationIds.has(request.logicalOperationId)) {
        fail("CREATOR_SCRIPT_GENERATION_PILOT_DUPLICATE_REQUEST");
      }
      logicalOperationIds.add(request.logicalOperationId);
      if (request.model !== input.envelope.model) {
        fail("CREATOR_SCRIPT_GENERATION_PILOT_MODEL_MISMATCH");
      }
      const estimatedInputTokens = input.countInputTokens(request);
      if (
        !Number.isInteger(estimatedInputTokens) ||
        estimatedInputTokens <= 0 ||
        estimatedInputTokens > input.envelope.maximumInputTokensPerRequest
      ) fail("CREATOR_SCRIPT_GENERATION_PILOT_INPUT_TOKEN_LIMIT_EXCEEDED");

      const receipt = await input.mockTransport({
        request,
        controls: {
          model: input.envelope.model,
          maxOutputTokens: input.envelope.maximumOutputTokensPerRequest,
          maxRetries: 0,
          requestOrdinal: ordinal,
        },
      });
      if (
        receipt.status !== "completed" ||
        !receipt.requestId ||
        !receipt.output ||
        receipt.attemptCount !== 1
      ) fail("CREATOR_SCRIPT_GENERATION_PILOT_PROVIDER_COMPLETION_AMBIGUOUS");
      if (requestIds.has(receipt.requestId)) {
        fail("CREATOR_SCRIPT_GENERATION_PILOT_DUPLICATE_REQUEST");
      }
      requestIds.add(receipt.requestId);
      if (
        !Number.isInteger(receipt.inputTokens) ||
        receipt.inputTokens < 0 ||
        receipt.inputTokens > input.envelope.maximumInputTokensPerRequest ||
        !Number.isInteger(receipt.outputTokens) ||
        receipt.outputTokens < 0 ||
        receipt.outputTokens > input.envelope.maximumOutputTokensPerRequest
      ) fail("CREATOR_SCRIPT_GENERATION_PILOT_PROVIDER_USAGE_INVALID");
      actualInputTokens += receipt.inputTokens;
      actualOutputTokens += receipt.outputTokens;
      if (price(actualInputTokens, actualOutputTokens, input.envelope) > input.envelope.maximumCostUsd) {
        fail("CREATOR_SCRIPT_GENERATION_PILOT_BUDGET_EXHAUSTED");
      }
      const sectionId = (request.user as { activeSection?: { id?: unknown } })
        .activeSection?.id;
      if (typeof sectionId !== "string") {
        fail("CREATOR_SCRIPT_GENERATION_PILOT_SECTION_ID_MISSING");
      }
      requests.push(Object.freeze({
        ordinal,
        logicalOperationId: request.logicalOperationId,
        sectionId,
        model: request.model,
        estimatedInputTokens,
        maximumOutputTokens: input.envelope.maximumOutputTokensPerRequest,
        requestId: receipt.requestId,
      }));
      return receipt.output;
    },
  });

  if (requests.length !== CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT) {
    fail("CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT_INVALID");
  }
  return Object.freeze({
    version: CREATOR_SCRIPT_GENERATION_PILOT_VERSION,
    mode: "offline_mock",
    fixtureId: input.fixture.fixtureId,
    fixtureFingerprintSha256: fixtureFingerprint(input.fixture),
    providerRequestCount: CREATOR_SCRIPT_GENERATION_PILOT_REQUEST_COUNT,
    maximumReservedCostUsd,
    actualMockUsage: Object.freeze({
      inputTokens: actualInputTokens,
      outputTokens: actualOutputTokens,
      hypotheticalCostUsd: price(actualInputTokens, actualOutputTokens, input.envelope),
    }),
    requests: Object.freeze(requests),
    candidate,
    persistence: "none",
    durationAuthority: "estimated_words_only",
  });
}
