import { createHash } from "node:crypto";
import {
  assertCreatorScriptMatchesSectionPlan,
  createCreatorScript,
  createCreatorScriptSectionBudgetPlan,
  getCreatorScriptDurationContract,
  normalizeCreatorScript,
  shouldUseCreatorScriptSectionNativeGeneration,
  validateCreatorScriptGenerationDuration,
  type CreatorScript,
  type CreatorScriptSectionBudget,
} from "./creatorScript.ts";
import {
  canonicalCreatorScriptBuildJson,
  createCreatorScriptBuildCheckpointId,
  createCreatorScriptBuildFailure,
  createCreatorScriptBuildOperationId,
  creatorScriptBuildIsStale,
  creatorScriptBuildOperationIsReusable,
  type CreatorScriptBuildCheckpoint,
  type CreatorScriptBuildFailure,
  type CreatorScriptBuildFailureCategory,
  type CreatorScriptBuildJson,
  type CreatorScriptBuildRecord,
  type CreatorScriptBuildSnapshot,
} from "./creatorScriptBuild.ts";
import {
  normalizeCreatorScriptBuildAuthorityResultFromCheckpoint,
  type CreatorScriptBuildAuthorityStageResult,
} from "./creatorScriptBuildAuthorityCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
  CreatorScriptBuildStageExecutionError,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";
import { parseCreatorProfile, type CreatorProfile } from "./creatorProfile.ts";
import type { CreatorScriptBuildRepository } from "../persistence/creatorScriptBuilds/types.ts";
import { createResearchClaimEvidenceGraph } from "../research/claimEvidenceGraph.ts";
import { createEditorialScriptContext } from "../research/editorialScriptContext.ts";
import {
  adaptCreatorLongFormSectionPlanToEvidenceCapability,
  adaptCreatorLongFormSectionPlanToUncertaintyCapability,
  createCreatorLongFormEvidenceReadiness,
  type CreatorLongFormEvidenceReadiness,
} from "../research/creatorLongFormEvidenceReadiness.ts";
import {
  createScriptPlannerGroundingDiagnostics,
  normalizeScriptPlannerEditorialContext,
  type ScriptPlannerEditorialContext,
} from "../research/scriptPlannerEditorialContext.ts";

export const CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_COORDINATOR_VERSION =
  "0.19E3A" as const;
export const CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_CHECKPOINT_VERSION =
  "creator-script-build-script-generation-checkpoint-v1" as const;
export const CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_VERSION =
  "creator-script-build-script-generation-operation-v1" as const;
export const CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_TYPE =
  "creator_script_build_script_generation" as const;

const SCRIPT_GENERATION_SEMANTIC_FINGERPRINT_VERSION =
  "creator-script-build-script-generation-semantic-v1" as const;

export type CreatorScriptBuildScriptGenerationInput = Readonly<{
  version: "0.19E3A-script-generation-request-v1";
  topic: string;
  researchSubject: string | null;
  title: string;
  contentType: string;
  format: string;
  language: "tr" | "en";
  requestedDurationSeconds: number;
  strategyFingerprint: string;
  approvedStrategy: CreatorScriptBuildSnapshot["strategy"]["approvedStrategy"];
  creatorProfile: CreatorProfile;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  sectionNative: boolean;
  longFormEvidenceReadiness: CreatorLongFormEvidenceReadiness;
  editorialContext: ScriptPlannerEditorialContext;
  permittedClaimIds: readonly string[];
}>;

export type CreatorScriptBuildScriptGenerationStageResult = Readonly<{
  version: "0.19E3A-script-generation-result-v1";
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  operationId: string;
  contractVersions: Readonly<{
    coordinator: typeof CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_COORDINATOR_VERSION;
    operation: typeof CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_VERSION;
    checkpoint: typeof CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_CHECKPOINT_VERSION;
  }>;
}>;

export type CreatorScriptBuildScriptGenerationCoordinatorResult = Readonly<{
  version: typeof CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_COORDINATOR_VERSION;
  build: CreatorScriptBuildRecord;
  generation: CreatorScriptBuildScriptGenerationStageResult;
  disposition: "ADVANCED" | "RESUMED";
}>;

export type CreatorScriptBuildScriptGenerationExecutor = (
  input: CreatorScriptBuildScriptGenerationInput,
) => Promise<unknown>;

export type CreatorScriptBuildScriptGenerationCoordinatorDependencies = Readonly<{
  repository: CreatorScriptBuildRepository;
  getCurrentProjectRevision: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<string | null>;
  executeScriptGeneration: CreatorScriptBuildScriptGenerationExecutor;
  now?: () => string;
}>;

class CreatorScriptBuildGeneratedScriptError extends Error {
  readonly category: CreatorScriptBuildFailureCategory;
  readonly code: string;

  constructor(category: CreatorScriptBuildFailureCategory, code: string) {
    super(code);
    this.name = "CreatorScriptBuildGeneratedScriptError";
    this.category = category;
    this.code = code;
  }
}

class CreatorScriptBuildGenerationContextError extends Error {
  readonly category: CreatorScriptBuildFailureCategory;
  readonly code: string;
  readonly diagnostics: Readonly<
    Record<string, string | number | boolean | null>
  >;

  constructor(input: {
    category: CreatorScriptBuildFailureCategory;
    code: string;
    diagnostics?: Record<string, string | number | boolean | null>;
  }) {
    super(input.code);
    this.name = "CreatorScriptBuildGenerationContextError";
    this.category = input.category;
    this.code = input.code;
    this.diagnostics = Object.freeze({ ...(input.diagnostics || {}) });
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim().slice(0, maxLength)
    : "";
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

function buildJson(value: unknown): CreatorScriptBuildJson {
  const serialized = JSON.stringify(value);
  if (!serialized) throw new Error("CREATOR_SCRIPT_BUILD_JSON_INVALID");
  return JSON.parse(
    canonicalCreatorScriptBuildJson(JSON.parse(serialized)),
  ) as CreatorScriptBuildJson;
}

function equalCanonical(left: unknown, right: unknown) {
  return canonicalCreatorScriptBuildJson(left) ===
    canonicalCreatorScriptBuildJson(right);
}

export function createCreatorScriptBuildScriptGenerationSemanticFingerprint(
  input: CreatorScriptBuildScriptGenerationInput,
) {
  return `${SCRIPT_GENERATION_SEMANTIC_FINGERPRINT_VERSION}:${createHash("sha256")
    .update(canonicalCreatorScriptBuildJson({
      contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_VERSION,
      input,
    }), "utf8")
    .digest("hex")}`;
}

export function createCreatorScriptBuildScriptGenerationOperationId(input: {
  buildId: string;
  generationInput: CreatorScriptBuildScriptGenerationInput;
}) {
  return createCreatorScriptBuildOperationId({
    buildId: input.buildId,
    stage: "script_generation",
    operationType: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_TYPE,
    semanticFingerprint:
      createCreatorScriptBuildScriptGenerationSemanticFingerprint(
        input.generationInput,
      ),
    contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_VERSION,
  });
}

function sortedUniqueIds(values: readonly string[], code: string) {
  const normalized = values.map((value) => clean(value, 300));
  if (
    normalized.some((value) => !value) ||
    new Set(normalized).size !== normalized.length
  ) {
    throw new Error(code);
  }
  return normalized.toSorted((left, right) => left.localeCompare(right));
}

function createPermittedGraph(authority: CreatorScriptBuildAuthorityStageResult) {
  const permittedClaimIds = sortedUniqueIds(
    authority.permittedClaimIds,
    "CREATOR_SCRIPT_BUILD_PERMITTED_CLAIMS_INVALID",
  );
  const excluded = new Set([
    ...authority.excludedPrimaryClaimIds,
    ...authority.unresolvedClaimIds,
  ]);
  if (permittedClaimIds.some((claimId) => excluded.has(claimId))) {
    throw new Error("CREATOR_SCRIPT_BUILD_PERMITTED_CLAIM_EXCLUDED");
  }
  const permittedSet = new Set(permittedClaimIds);
  const graphClaimIds = new Set(authority.graph.claims.map((claim) => claim.claimId));
  const missing = permittedClaimIds.find((claimId) => !graphClaimIds.has(claimId));
  if (missing) {
    throw new Error(`CREATOR_SCRIPT_BUILD_PERMITTED_CLAIM_MISSING:${missing}`);
  }

  const claims = authority.graph.claims
    .filter((claim) => permittedSet.has(claim.claimId))
    .toSorted((left, right) => left.claimId.localeCompare(right.claimId));
  if (claims.length === 0) {
    throw new Error("CREATOR_SCRIPT_BUILD_PERMITTED_CLAIMS_REQUIRED");
  }
  const links = authority.graph.links
    .filter((link) => permittedSet.has(link.claimId))
    .toSorted((left, right) => {
      const claimOrder = left.claimId.localeCompare(right.claimId);
      if (claimOrder !== 0) return claimOrder;
      const evidenceOrder = left.evidenceId.localeCompare(right.evidenceId);
      return evidenceOrder !== 0
        ? evidenceOrder
        : left.stance.localeCompare(right.stance);
    });
  const evidenceIds = new Set(links.map((link) => link.evidenceId));
  const evidence = authority.graph.evidence
    .filter((item) => evidenceIds.has(item.evidenceId))
    .toSorted((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const sourceIds = new Set(evidence.map((item) => item.sourceId));
  const sources = authority.graph.sources
    .filter((source) => sourceIds.has(source.sourceId))
    .toSorted((left, right) => left.sourceId.localeCompare(right.sourceId));
  const assessmentBySourceId = new Map(
    authority.sourceAssessments.map((item) => [item.sourceId, item]),
  );
  const sourceAssessments = sources.map((source) => {
    const assessment = assessmentBySourceId.get(source.sourceId);
    if (!assessment) {
      throw new Error(
        `CREATOR_SCRIPT_BUILD_SOURCE_ASSESSMENT_MISSING:${source.sourceId}`,
      );
    }
    return assessment;
  });
  return {
    graph: createResearchClaimEvidenceGraph({ sources, claims, evidence, links }),
    sourceAssessments,
    permittedClaimIds,
  };
}

export function createCreatorScriptBuildScriptGenerationInput(input: {
  snapshot: CreatorScriptBuildSnapshot;
  authority: CreatorScriptBuildAuthorityStageResult;
}): CreatorScriptBuildScriptGenerationInput {
  const duration = validateCreatorScriptGenerationDuration(
    input.snapshot.requestedDurationSeconds,
  );
  const profile = parseCreatorProfile(input.snapshot.creatorProfile);
  const projection = createPermittedGraph(input.authority);
  const editorialContext = normalizeScriptPlannerEditorialContext(
    createEditorialScriptContext({
      profile,
      graph: projection.graph,
      sourceAssessments: projection.sourceAssessments,
    }),
  );
  if (!editorialContext) {
    throw new Error("CREATOR_SCRIPT_BUILD_EDITORIAL_CONTEXT_INVALID");
  }
  const groundingDiagnostics = createScriptPlannerGroundingDiagnostics(
    editorialContext,
  );
  if (editorialContext.readiness.status === "blocked") {
    throw new CreatorScriptBuildGenerationContextError({
      category: "GROUNDING",
      code: "CREATOR_SCRIPT_BUILD_EDITORIAL_CONTEXT_BLOCKED",
      diagnostics: {
        blockingReason: groundingDiagnostics.blockingReasons[0] || "UNKNOWN",
      },
    });
  }
  const hasMaterialCounterview = editorialContext.claims.some(
    (claim) => claim.counterEvidenceIds.length > 0,
  );
  const baseSectionPlan = createCreatorScriptSectionBudgetPlan({
    targetDurationSec: duration,
    language: input.snapshot.language,
    hasMaterialCounterview,
  });
  const durationContract = getCreatorScriptDurationContract({
    targetDurationSec: duration,
    language: input.snapshot.language,
    actualWordCount: 0,
  });
  const sectionNative = shouldUseCreatorScriptSectionNativeGeneration(
    durationContract.targetWordCount,
  );
  const demonstrationAdaptiveSectionPlan = sectionNative
    ? adaptCreatorLongFormSectionPlanToEvidenceCapability({
        context: editorialContext,
        plan: baseSectionPlan,
      })
    : baseSectionPlan;
  const sectionPlan = sectionNative
    ? adaptCreatorLongFormSectionPlanToUncertaintyCapability({
        context: editorialContext,
        plan: demonstrationAdaptiveSectionPlan,
      })
    : baseSectionPlan;
  const longFormEvidenceReadiness = createCreatorLongFormEvidenceReadiness({
    context: editorialContext,
    plan: sectionPlan,
    sectionNative,
  });
  if (!longFormEvidenceReadiness.eligible) {
    throw new CreatorScriptBuildGenerationContextError({
      category: "GROUNDING",
      code: "CREATOR_SCRIPT_BUILD_LONG_FORM_EVIDENCE_NOT_READY",
      diagnostics: {
        sectionNative,
        readinessApplicable: longFormEvidenceReadiness.applicable,
        reasonCodes: longFormEvidenceReadiness.reasonCodes.join(",").slice(0, 500),
        reasonCount: longFormEvidenceReadiness.reasonCodes.length,
        fallbackBodySectionCount:
          longFormEvidenceReadiness.fallbackBodySectionIds.length,
        collapsedBodySectionCount:
          longFormEvidenceReadiness.collapsedBodySectionIds.length,
      },
    });
  }
  return deepFreeze({
    version: "0.19E3A-script-generation-request-v1" as const,
    topic: input.snapshot.strategy.topic,
    researchSubject: input.snapshot.strategy.researchSubject,
    title: input.snapshot.strategy.title,
    contentType: input.snapshot.strategy.contentType,
    format: input.snapshot.strategy.format,
    language: input.snapshot.language,
    requestedDurationSeconds: duration,
    strategyFingerprint: input.snapshot.strategyFingerprint,
    approvedStrategy: input.snapshot.strategy.approvedStrategy,
    creatorProfile: profile,
    sectionPlan,
    sectionNative,
    longFormEvidenceReadiness,
    editorialContext,
    permittedClaimIds: projection.permittedClaimIds,
  });
}

function normalizeCanonicalGeneratedScript(input: {
  value: unknown;
  authority: CreatorScriptBuildScriptGenerationInput;
}) {
  const raw = record(input.value);
  if (!raw) {
    throw new CreatorScriptBuildGeneratedScriptError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_GENERATED_SCRIPT_INVALID",
    );
  }
  if (clean(raw.strategyFingerprint, 300) !== input.authority.strategyFingerprint) {
    throw new CreatorScriptBuildGeneratedScriptError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_GENERATED_STRATEGY_MISMATCH",
    );
  }
  if (Number(raw.targetDurationSec) !== input.authority.requestedDurationSeconds) {
    throw new CreatorScriptBuildGeneratedScriptError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_GENERATED_DURATION_MISMATCH",
    );
  }
  if (clean(raw.title, 500) !== input.authority.title) {
    throw new CreatorScriptBuildGeneratedScriptError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_GENERATED_TITLE_MISMATCH",
    );
  }
  const grounding = record(raw.grounding);
  if (!equalCanonical(grounding?.context, input.authority.editorialContext)) {
    throw new CreatorScriptBuildGeneratedScriptError(
      "GROUNDING",
      "CREATOR_SCRIPT_BUILD_GENERATED_GROUNDING_MISMATCH",
    );
  }
  if (raw.approval !== null || Number(raw.revision) !== 1) {
    throw new CreatorScriptBuildGeneratedScriptError(
      "SCRIPT_POLICY",
      "CREATOR_SCRIPT_BUILD_GENERATED_STATE_INVALID",
    );
  }
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  if (sections.length !== input.authority.sectionPlan.length) {
    throw new CreatorScriptBuildGeneratedScriptError(
      "SCRIPT_POLICY",
      "CREATOR_SCRIPT_BUILD_GENERATED_SECTION_COUNT_MISMATCH",
    );
  }
  const allowedClaimIds = new Set(input.authority.permittedClaimIds);
  for (const [index, budget] of input.authority.sectionPlan.entries()) {
    const section = record(sections[index]);
    if (clean(section?.id, 120) !== budget.id) {
      throw new CreatorScriptBuildGeneratedScriptError(
        "SCRIPT_POLICY",
        "CREATOR_SCRIPT_BUILD_GENERATED_SECTION_ID_MISMATCH",
      );
    }
    if (section?.kind !== budget.kind) {
      throw new CreatorScriptBuildGeneratedScriptError(
        "SCRIPT_POLICY",
        "CREATOR_SCRIPT_BUILD_GENERATED_SECTION_KIND_MISMATCH",
      );
    }
    if (section?.humanVerification != null) {
      throw new CreatorScriptBuildGeneratedScriptError(
        "SCRIPT_POLICY",
        "CREATOR_SCRIPT_BUILD_GENERATED_VERIFICATION_INVALID",
      );
    }
    const claimIds = Array.isArray(section.claimIds)
      ? section.claimIds.map((claimId) => clean(claimId, 300))
      : [];
    const unknownClaimId = claimIds.find((claimId) =>
      !claimId || !allowedClaimIds.has(claimId)
    );
    if (unknownClaimId !== undefined) {
      throw new CreatorScriptBuildGeneratedScriptError(
        "GROUNDING",
        "CREATOR_SCRIPT_BUILD_GENERATED_CLAIM_NOT_PERMITTED",
      );
    }
  }

  let script: CreatorScript;
  try {
    script = normalizeCreatorScript(raw);
    assertCreatorScriptMatchesSectionPlan(
      script,
      [...input.authority.sectionPlan],
    );
  } catch {
    throw new CreatorScriptBuildGeneratedScriptError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_GENERATED_SCRIPT_INVALID",
    );
  }
  if (!equalCanonical(script.grounding.context, input.authority.editorialContext)) {
    throw new CreatorScriptBuildGeneratedScriptError(
      "GROUNDING",
      "CREATOR_SCRIPT_BUILD_GENERATED_GROUNDING_MISMATCH",
    );
  }
  return script;
}

function createCanonicalScriptFromProposal(input: {
  value: unknown;
  authority: CreatorScriptBuildScriptGenerationInput;
  generatedAt: string;
}) {
  const proposal = record(input.value);
  if (proposal?.version !== "0.19E3A-script-generation-proposal-v1") {
    throw new CreatorScriptBuildGeneratedScriptError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_SCRIPT_PROPOSAL_INVALID",
    );
  }
  const sections = Array.isArray(proposal.sections) ? proposal.sections : [];
  if (sections.length !== input.authority.sectionPlan.length) {
    throw new CreatorScriptBuildGeneratedScriptError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_GENERATED_SECTION_COUNT_MISMATCH",
    );
  }
  const allowedClaimIds = new Set(input.authority.permittedClaimIds);
  const canonicalSections = input.authority.sectionPlan.map((budget, index) => {
    const section = record(sections[index]);
    const text = clean(section?.text, 100_000);
    const heading = clean(section?.heading, 300);
    if (!section || !text || !Array.isArray(section.claimIds)) {
      throw new CreatorScriptBuildGeneratedScriptError(
        "MODEL_CONTRACT",
        "CREATOR_SCRIPT_BUILD_SCRIPT_PROPOSAL_INVALID",
      );
    }
    const claimIds = section.claimIds.map((claimId) => clean(claimId, 300));
    if (
      claimIds.some((claimId) => !claimId || !allowedClaimIds.has(claimId))
    ) {
      throw new CreatorScriptBuildGeneratedScriptError(
        "GROUNDING",
        "CREATOR_SCRIPT_BUILD_GENERATED_CLAIM_NOT_PERMITTED",
      );
    }
    return {
      id: budget.id,
      kind: budget.kind,
      ...(heading ? { heading } : {}),
      text,
      claimIds: [...new Set(claimIds)],
      evidenceReviewRequired: false,
    };
  });

  try {
    const script = createCreatorScript({
      title: input.authority.title,
      sections: canonicalSections,
      targetDurationSec: input.authority.requestedDurationSeconds,
      strategyFingerprint: input.authority.strategyFingerprint,
      grounding: { context: input.authority.editorialContext },
      generatedAt: input.generatedAt,
      updatedAt: input.generatedAt,
    });
    assertCreatorScriptMatchesSectionPlan(
      script,
      [...input.authority.sectionPlan],
    );
    return script;
  } catch (error) {
    if (error instanceof CreatorScriptBuildGeneratedScriptError) throw error;
    throw new CreatorScriptBuildGeneratedScriptError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_SCRIPT_PROPOSAL_INVALID",
    );
  }
}

function normalizeOperationResult(input: {
  value: CreatorScriptBuildJson | null;
  authority: CreatorScriptBuildScriptGenerationInput;
}) {
  const raw = record(input.value);
  if (raw?.version !== "0.19E3A-script-generation-operation-result-v1") {
    throw new CreatorScriptBuildGeneratedScriptError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_SCRIPT_OPERATION_RESULT_INVALID",
    );
  }
  return normalizeCanonicalGeneratedScript({
    value: raw.script,
    authority: input.authority,
  });
}

function createStageResult(input: {
  script: CreatorScript;
  authority: CreatorScriptBuildScriptGenerationInput;
  operationId: string;
}): CreatorScriptBuildScriptGenerationStageResult {
  return Object.freeze({
    version: "0.19E3A-script-generation-result-v1" as const,
    script: input.script,
    sectionPlan: [...input.authority.sectionPlan],
    operationId: input.operationId,
    contractVersions: Object.freeze({
      coordinator: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_COORDINATOR_VERSION,
      operation: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_VERSION,
      checkpoint: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_CHECKPOINT_VERSION,
    }),
  });
}

export function normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint(input: {
  buildId: string;
  value: CreatorScriptBuildJson | null;
  authority: CreatorScriptBuildScriptGenerationInput;
}) {
  const raw = record(input.value);
  const result = record(raw?.result);
  if (
    raw?.version !== "0.19E3A-script-generation-checkpoint-output-v1" ||
    result?.version !== "0.19E3A-script-generation-result-v1" ||
    !equalCanonical(result.sectionPlan, input.authority.sectionPlan)
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_SCRIPT_CHECKPOINT_OUTPUT_INVALID");
  }
  const operationId = clean(result.operationId, 300);
  if (
    !operationId ||
    operationId !== createCreatorScriptBuildScriptGenerationOperationId({
      buildId: input.buildId,
      generationInput: input.authority,
    })
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_SCRIPT_CHECKPOINT_OPERATION_INVALID");
  }
  return createStageResult({
    script: normalizeCanonicalGeneratedScript({
      value: result.script,
      authority: input.authority,
    }),
    authority: input.authority,
    operationId,
  });
}

function checkpoint(input: {
  buildId: string;
  status: CreatorScriptBuildCheckpoint["status"];
  operationId: string | null;
  outputReference: CreatorScriptBuildJson | null;
  diagnostics: Record<string, string | number | boolean | null>;
  previous?: CreatorScriptBuildCheckpoint | null;
  now: () => string;
}): CreatorScriptBuildCheckpoint {
  const startedAt = input.previous?.startedAt ||
    (input.status === "RUNNING" ? input.now() : null);
  const completedAt = input.status === "COMPLETED" || input.status === "FAILED"
    ? input.now()
    : null;
  return {
    checkpointId: createCreatorScriptBuildCheckpointId({
      buildId: input.buildId,
      stage: "script_generation",
      contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_CHECKPOINT_VERSION,
    }),
    stage: "script_generation",
    status: input.status,
    contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_CHECKPOINT_VERSION,
    operationId: input.operationId,
    outputReference: input.outputReference,
    diagnostics: Object.freeze({ ...input.diagnostics }),
    startedAt,
    completedAt,
  };
}

function stageFailure(input: {
  category: CreatorScriptBuildFailureCategory;
  code: string;
  retryability?: CreatorScriptBuildFailure["retryability"];
  operationId?: string | null;
  diagnostics?: Record<string, string | number | boolean | null>;
}) {
  return createCreatorScriptBuildFailure({
    category: input.category,
    code: input.code,
    stage: "script_generation",
    retryability: input.retryability || "NON_RETRYABLE",
    operationId: input.operationId || null,
    diagnostics: input.diagnostics || {},
  });
}

async function assertCurrentProjectAuthority(input: {
  dependencies: CreatorScriptBuildScriptGenerationCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
}) {
  const currentProjectRevision = await input.dependencies.getCurrentProjectRevision({
    ownerId: input.build.ownerId,
    projectId: input.build.projectId,
  });
  if (
    currentProjectRevision &&
    !creatorScriptBuildIsStale({
      snapshot: input.build.snapshot,
      currentProjectRevision,
    })
  ) return;
  const failure = stageFailure({
    category: "AUTHORITY",
    code: currentProjectRevision
      ? "CREATOR_SCRIPT_BUILD_PROJECT_STALE"
      : "CREATOR_SCRIPT_BUILD_PROJECT_AUTHORITY_MISSING",
  });
  const build = await input.dependencies.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: "AUTHORITY_RESOLVED",
    nextState: currentProjectRevision ? "STALE" : "FAILED",
    failure,
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: failure.code,
    buildId: build.buildId,
  });
}

async function ensureCheckpoint(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  now: () => string;
}) {
  const existing = input.build.checkpoints.script_generation || null;
  if (
    existing &&
    existing.contractVersion !==
      CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_CHECKPOINT_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_SCRIPT_CHECKPOINT_CONTRACT_MISMATCH");
  }
  if (existing) return input.build;
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: "AUTHORITY_RESOLVED",
    checkpoint: checkpoint({
      buildId: input.build.buildId,
      status: "PENDING",
      operationId: null,
      outputReference: null,
      diagnostics: {},
      now: input.now,
    }),
  });
}

async function markRunning(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  operationId: string;
  now: () => string;
}) {
  const previous = input.build.checkpoints.script_generation || null;
  if (previous?.status === "RUNNING") return input.build;
  if (previous?.status !== "PENDING") {
    throw new Error("CREATOR_SCRIPT_BUILD_SCRIPT_CHECKPOINT_NOT_PENDING");
  }
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: "AUTHORITY_RESOLVED",
    checkpoint: checkpoint({
      buildId: input.build.buildId,
      status: "RUNNING",
      operationId: input.operationId,
      outputReference: null,
      diagnostics: {},
      previous,
      now: input.now,
    }),
  });
}

async function failBuild(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  failure: CreatorScriptBuildFailure;
  now: () => string;
}): Promise<never> {
  const previous = input.build.checkpoints.script_generation || null;
  let build = input.build;
  if (previous?.status !== "FAILED") {
    if (previous?.status === "COMPLETED") {
      throw new Error("CREATOR_SCRIPT_BUILD_SCRIPT_CHECKPOINT_ALREADY_COMPLETED");
    }
    build = await input.repository.saveCheckpoint({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedBuildState: "AUTHORITY_RESOLVED",
      checkpoint: checkpoint({
        buildId: build.buildId,
        status: "FAILED",
        operationId: input.failure.operationId,
        outputReference: null,
        diagnostics: {
          ...input.failure.diagnostics,
          failureCategory: input.failure.category,
          failureCode: input.failure.code,
          retryability: input.failure.retryability,
        },
        previous,
        now: input.now,
      }),
    });
  }
  const failed = await input.repository.transition({
    ownerId: build.ownerId,
    buildId: build.buildId,
    expectedState: "AUTHORITY_RESOLVED",
    nextState: "FAILED",
    failure: input.failure,
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: input.failure.code,
    buildId: failed.buildId,
    operationId: input.failure.operationId,
  });
}

function assertCoordinatorContract(snapshot: CreatorScriptBuildSnapshot) {
  if (
    snapshot.contractVersions.creatorScriptBuildScriptGenerationCoordinator !==
      CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_COORDINATOR_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_CONTRACT_MISMATCH");
  }
}

export async function runCreatorScriptBuildScriptGenerationCoordinator(input: {
  ownerId: string;
  buildId: string;
  dependencies: CreatorScriptBuildScriptGenerationCoordinatorDependencies;
}): Promise<CreatorScriptBuildScriptGenerationCoordinatorResult> {
  const now = input.dependencies.now || (() => new Date().toISOString());
  let build = await input.dependencies.repository.getForOwner(
    input.buildId,
    input.ownerId,
  );
  if (!build) throw new Error("CREATOR_SCRIPT_BUILD_NOT_FOUND");
  assertCoordinatorContract(build.snapshot);
  if (build.state !== "AUTHORITY_RESOLVED") {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_STATE_INVALID",
      buildId: build.buildId,
    });
  }
  await assertCurrentProjectAuthority({ dependencies: input.dependencies, build });
  build = await ensureCheckpoint({
    repository: input.dependencies.repository,
    build,
    now,
  });

  const authorityCheckpoint = build.checkpoints.authority || null;
  if (!authorityCheckpoint || authorityCheckpoint.status !== "COMPLETED") {
    const failure = stageFailure({
      category: "AUTHORITY",
      code: "CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_REQUIRED",
    });
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now,
    });
  }

  let authority: CreatorScriptBuildAuthorityStageResult;
  let generationInput: CreatorScriptBuildScriptGenerationInput;
  try {
    authority = normalizeCreatorScriptBuildAuthorityResultFromCheckpoint(
      authorityCheckpoint.outputReference,
    );
    generationInput = createCreatorScriptBuildScriptGenerationInput({
      snapshot: build.snapshot,
      authority,
    });
  } catch (error) {
    const contextError = error instanceof CreatorScriptBuildGenerationContextError
      ? error
      : null;
    const category: CreatorScriptBuildFailureCategory = contextError?.category ||
      "AUTHORITY";
    const failure = stageFailure({
      category,
      code: contextError?.code ||
        "CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_INVALID",
      diagnostics: contextError ? { ...contextError.diagnostics } : {},
    });
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now,
    });
  }

  const existingCheckpoint = build.checkpoints.script_generation || null;
  if (existingCheckpoint?.status === "COMPLETED") {
    let generation: CreatorScriptBuildScriptGenerationStageResult;
    try {
      generation = normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint({
        buildId: build.buildId,
        value: existingCheckpoint.outputReference,
        authority: generationInput,
      });
    } catch {
      const failure = stageFailure({
        category: "INPUT",
        code: "CREATOR_SCRIPT_BUILD_SCRIPT_CHECKPOINT_OUTPUT_INVALID",
        operationId: existingCheckpoint.operationId,
      });
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        failure,
        now,
      });
    }
    build = await input.dependencies.repository.transition({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedState: "AUTHORITY_RESOLVED",
      nextState: "SCRIPT_GENERATED",
    });
    return {
      version: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_COORDINATOR_VERSION,
      build,
      generation,
      disposition: "RESUMED",
    };
  }
  if (existingCheckpoint?.status === "FAILED") {
    const failure = stageFailure({
      category: typeof existingCheckpoint.diagnostics.failureCategory === "string"
        ? existingCheckpoint.diagnostics.failureCategory as CreatorScriptBuildFailureCategory
        : "INTERNAL",
      code: typeof existingCheckpoint.diagnostics.failureCode === "string"
        ? existingCheckpoint.diagnostics.failureCode
        : "CREATOR_SCRIPT_BUILD_SCRIPT_CHECKPOINT_FAILED",
      retryability:
        existingCheckpoint.diagnostics.retryability === "RETRYABLE" ||
          existingCheckpoint.diagnostics.retryability === "UNKNOWN_OUTCOME"
          ? existingCheckpoint.diagnostics.retryability
          : "NON_RETRYABLE",
      operationId: existingCheckpoint.operationId,
    });
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now,
    });
  }

  await assertCurrentProjectAuthority({ dependencies: input.dependencies, build });
  const semanticFingerprint =
    createCreatorScriptBuildScriptGenerationSemanticFingerprint(generationInput);
  const requested = await input.dependencies.repository.requestOperation({
    ownerId: build.ownerId,
    buildId: build.buildId,
    stage: "script_generation",
    operationType: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_TYPE,
    semanticFingerprint,
    contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_VERSION,
  });
  const operation = requested.operation;
  if (operation.state === "FAILED") {
    const failure = operation.failure || stageFailure({
      category: "INTERNAL",
      code: "CREATOR_SCRIPT_BUILD_SCRIPT_OPERATION_FAILED_WITHOUT_FAILURE",
      operationId: operation.operationId,
    });
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now,
    });
  }
  if (
    operation.state === "OUTCOME_UNCERTAIN" ||
    (operation.state === "PENDING" && !requested.created)
  ) {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
      buildId: build.buildId,
      operationId: operation.operationId,
    });
  }

  let script: CreatorScript;
  if (creatorScriptBuildOperationIsReusable(operation)) {
    try {
      script = normalizeOperationResult({
        value: operation.resultReference,
        authority: generationInput,
      });
    } catch (error) {
      const generatedError = error instanceof CreatorScriptBuildGeneratedScriptError
        ? error
        : new CreatorScriptBuildGeneratedScriptError(
            "MODEL_CONTRACT",
            "CREATOR_SCRIPT_BUILD_SCRIPT_OPERATION_RESULT_INVALID",
          );
      const failure = stageFailure({
        category: generatedError.category,
        code: generatedError.code,
        operationId: operation.operationId,
      });
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        failure,
        now,
      });
    }
  } else {
    build = await markRunning({
      repository: input.dependencies.repository,
      build,
      operationId: operation.operationId,
      now,
    });
    let rawProposal: unknown;
    try {
      rawProposal = await input.dependencies.executeScriptGeneration(
        generationInput,
      );
    } catch (error) {
      const executionError = error instanceof CreatorScriptBuildStageExecutionError
        ? error
        : new CreatorScriptBuildStageExecutionError({
            category: "PROVIDER",
            code: "CREATOR_SCRIPT_BUILD_SCRIPT_EXECUTOR_OUTCOME_UNCLASSIFIED",
            retryability: "UNKNOWN_OUTCOME",
          });
      const failure = stageFailure({
        category: executionError.category,
        code: executionError.code,
        retryability: executionError.retryability,
        operationId: operation.operationId,
        diagnostics: { ...executionError.diagnostics },
      });
      if (executionError.retryability === "UNKNOWN_OUTCOME") {
        await input.dependencies.repository.transitionOperation({
          ownerId: build.ownerId,
          buildId: build.buildId,
          operationId: operation.operationId,
          expectedState: "PENDING",
          nextState: "OUTCOME_UNCERTAIN",
          failure,
        });
        throw new CreatorScriptBuildCoordinatorBlockedError({
          code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
          buildId: build.buildId,
          operationId: operation.operationId,
        });
      }
      await input.dependencies.repository.transitionOperation({
        ownerId: build.ownerId,
        buildId: build.buildId,
        operationId: operation.operationId,
        expectedState: "PENDING",
        nextState: "FAILED",
        failure,
      });
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        failure,
        now,
      });
    }

    try {
      script = createCanonicalScriptFromProposal({
        value: rawProposal,
        authority: generationInput,
        generatedAt: now(),
      });
    } catch (error) {
      const generatedError = error instanceof CreatorScriptBuildGeneratedScriptError
        ? error
        : new CreatorScriptBuildGeneratedScriptError(
            "MODEL_CONTRACT",
            "CREATOR_SCRIPT_BUILD_GENERATED_SCRIPT_INVALID",
          );
      const failure = stageFailure({
        category: generatedError.category,
        code: generatedError.code,
        operationId: operation.operationId,
      });
      await input.dependencies.repository.transitionOperation({
        ownerId: build.ownerId,
        buildId: build.buildId,
        operationId: operation.operationId,
        expectedState: "PENDING",
        nextState: "FAILED",
        failure,
      });
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        failure,
        now,
      });
    }
    await input.dependencies.repository.transitionOperation({
      ownerId: build.ownerId,
      buildId: build.buildId,
      operationId: operation.operationId,
      expectedState: "PENDING",
      nextState: "COMPLETED",
      resultReference: buildJson({
        version: "0.19E3A-script-generation-operation-result-v1",
        script,
      }),
    });
  }

  const generation = createStageResult({
    script,
    authority: generationInput,
    operationId: operation.operationId,
  });
  const previous = build.checkpoints.script_generation || null;
  build = await input.dependencies.repository.saveCheckpoint({
    ownerId: build.ownerId,
    buildId: build.buildId,
    expectedBuildState: "AUTHORITY_RESOLVED",
    checkpoint: checkpoint({
      buildId: build.buildId,
      status: "COMPLETED",
      operationId: operation.operationId,
      outputReference: buildJson({
        version: "0.19E3A-script-generation-checkpoint-output-v1",
        result: generation,
      }),
      diagnostics: {
        sectionCount: script.sections.length,
        permittedClaimCount: generationInput.permittedClaimIds.length,
      },
      previous,
      now,
    }),
  });
  build = await input.dependencies.repository.transition({
    ownerId: build.ownerId,
    buildId: build.buildId,
    expectedState: "AUTHORITY_RESOLVED",
    nextState: "SCRIPT_GENERATED",
  });
  return {
    version: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_COORDINATOR_VERSION,
    build,
    generation,
    disposition: "ADVANCED",
  };
}
