import {
  assertCreatorScriptMatchesSectionPlan,
  createCreatorScriptNarrationAuthority,
  normalizeCreatorScript,
  type CreatorScript,
  type CreatorScriptSectionBudget,
} from "./creatorScript.ts";
import {
  CREATOR_SCRIPT_ACCEPTANCE_VERSION,
  evaluateCreatorScriptAcceptance,
  getCreatorScriptAcceptanceFailure,
  type CreatorScriptAcceptanceReport,
} from "./creatorScriptAcceptance.ts";
import {
  canonicalCreatorScriptBuildJson,
  createCreatorScriptBuildCheckpointId,
  createCreatorScriptBuildFailure,
  creatorScriptBuildIsStale,
  type CreatorScriptBuildCheckpoint,
  type CreatorScriptBuildFailure,
  type CreatorScriptBuildFailureCategory,
  type CreatorScriptBuildJson,
  type CreatorScriptBuildRecord,
  type CreatorScriptBuildSnapshot,
} from "./creatorScriptBuild.ts";
import {
  createCreatorScriptBuildScriptGenerationInput,
  normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint,
  type CreatorScriptBuildScriptGenerationStageResult,
} from "./creatorScriptBuildScriptGenerationCoordinator.ts";
import {
  normalizeCreatorScriptBuildAuthorityResultFromCheckpoint,
} from "./creatorScriptBuildAuthorityCoordinator.ts";
import {
  replayCreatorScriptBuildCompletedRepair,
  type CreatorScriptBuildScriptRepairStageResult,
} from "./creatorScriptBuildScriptRepairCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";
import type { CreatorScriptBuildRepository } from "../persistence/creatorScriptBuilds/types.ts";

export const CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION =
  "0.19E3C" as const;
export const CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_VERSION =
  "creator-script-build-acceptance-checkpoint-v1" as const;
export const CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_VERSION =
  "0.19E3C-accepted-result-authority-v1" as const;

type CreatorScriptBuildAcceptanceSourceStage = "script_generation" | "repair";

export type CreatorScriptBuildAcceptanceStageResult = Readonly<{
  version: "0.19E3C-acceptance-result-v1";
  outcome: "ACCEPTED" | "REJECTED";
  sourceStage: CreatorScriptBuildAcceptanceSourceStage;
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  report: CreatorScriptAcceptanceReport;
  contractVersions: Readonly<{
    coordinator: typeof CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION;
    acceptancePolicy: typeof CREATOR_SCRIPT_ACCEPTANCE_VERSION;
    checkpoint: typeof CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_VERSION;
  }>;
}>;

export type CreatorScriptBuildAcceptedResultAuthority = Readonly<{
  version: typeof CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_VERSION;
  acceptance: CreatorScriptBuildAcceptanceStageResult;
}>;

export type CreatorScriptBuildAcceptanceCoordinatorResult = Readonly<{
  version: typeof CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION;
  build: CreatorScriptBuildRecord;
  acceptance: CreatorScriptBuildAcceptanceStageResult;
  disposition: "ACCEPTED" | "REJECTED" | "RESUMED";
}>;

export type CreatorScriptBuildAcceptanceCoordinatorDependencies = Readonly<{
  repository: CreatorScriptBuildRepository;
  getCurrentProjectRevision: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<string | null>;
  now?: () => string;
}>;

class CreatorScriptBuildAcceptanceError extends Error {
  readonly category: CreatorScriptBuildFailureCategory;
  readonly code: string;

  constructor(category: CreatorScriptBuildFailureCategory, code: string) {
    super(code);
    this.name = "CreatorScriptBuildAcceptanceError";
    this.category = category;
    this.code = code;
  }
}

class CreatorScriptBuildRepairPhaseIncompleteError extends Error {
  constructor() {
    super("CREATOR_SCRIPT_BUILD_REPAIR_PHASE_INCOMPLETE");
    this.name = "CreatorScriptBuildRepairPhaseIncompleteError";
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

function buildJson(value: unknown): CreatorScriptBuildJson {
  const serialized = JSON.stringify(value);
  if (!serialized) throw new Error("CREATOR_SCRIPT_BUILD_JSON_INVALID");
  return JSON.parse(
    canonicalCreatorScriptBuildJson(JSON.parse(serialized)),
  ) as CreatorScriptBuildJson;
}

function equalCanonical(left: unknown, right: unknown) {
  const comparable = (value: unknown) => JSON.parse(JSON.stringify(value));
  return canonicalCreatorScriptBuildJson(comparable(left)) ===
    canonicalCreatorScriptBuildJson(comparable(right));
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

function textArray(value: unknown, code: string) {
  if (!Array.isArray(value)) throw new Error(code);
  return value.map((item) => {
    const normalized = clean(item, 240);
    if (!normalized) throw new Error(code);
    return normalized;
  });
}

function normalizeSectionPlan(value: unknown): CreatorScriptSectionBudget[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 24) {
    throw new Error("CREATOR_SCRIPT_BUILD_ACCEPTANCE_SECTION_PLAN_INVALID");
  }
  const plan = value.map((item, index): CreatorScriptSectionBudget => {
    const raw = record(item);
    const ownership = record(raw?.ownershipBoundary);
    const id = clean(raw?.id, 120);
    const kind = raw?.kind;
    const role = clean(raw?.role, 2_000);
    const centralQuestion = clean(raw?.centralQuestion, 4_000);
    const progression = clean(raw?.progression, 4_000);
    const minimumWords = Number(raw?.minimumWords);
    const targetWords = Number(raw?.targetWords);
    const maximumWords = Number(raw?.maximumWords);
    if (
      !raw || !ownership || !id ||
      !["opening", "body", "conclusion"].includes(String(kind)) ||
      !role || !centralQuestion || !progression ||
      ownership.usage !== "control_only_never_narrate" ||
      !Number.isInteger(minimumWords) || minimumWords < 0 ||
      !Number.isInteger(targetWords) || targetWords < 1 ||
      !Number.isInteger(maximumWords) || maximumWords < targetWords ||
      minimumWords > targetWords
    ) {
      throw new Error(
        `CREATOR_SCRIPT_BUILD_ACCEPTANCE_SECTION_PLAN_INVALID:${index + 1}`,
      );
    }
    return {
      id,
      kind: kind as CreatorScriptSectionBudget["kind"],
      role,
      centralQuestion,
      progression,
      ownershipBoundary: {
        usage: "control_only_never_narrate",
        owns: textArray(
          ownership.owns,
          "CREATOR_SCRIPT_BUILD_ACCEPTANCE_SECTION_PLAN_INVALID",
        ),
        excludes: textArray(
          ownership.excludes,
          "CREATOR_SCRIPT_BUILD_ACCEPTANCE_SECTION_PLAN_INVALID",
        ),
      },
      minimumWords,
      targetWords,
      maximumWords,
    };
  });
  if (
    plan[0]?.kind !== "opening" ||
    plan.at(-1)?.kind !== "conclusion" ||
    plan.slice(1, -1).some((section) => section.kind !== "body") ||
    new Set(plan.map((section) => section.id)).size !== plan.length
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_ACCEPTANCE_SECTION_PLAN_INVALID");
  }
  return plan;
}

function evaluateFinal(input: {
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  snapshot: CreatorScriptBuildSnapshot;
}) {
  return evaluateCreatorScriptAcceptance({
    script: input.script,
    sectionPlan: [...input.sectionPlan],
    language: input.snapshot.language,
    narrationAuthority: createCreatorScriptNarrationAuthority({
      editorialContext: input.script.grounding.context,
      creatorProvidedText: [
        input.snapshot.strategy.topic,
        input.snapshot.strategy.title,
        input.snapshot.strategy.approvedStrategy,
      ],
    }),
  });
}

function hardViolationCount(report: CreatorScriptAcceptanceReport) {
  return report.violations.filter((violation) => violation.severity === "hard")
    .length;
}

function createAcceptanceResult(input: {
  outcome: "ACCEPTED" | "REJECTED";
  sourceStage: CreatorScriptBuildAcceptanceSourceStage;
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  report: CreatorScriptAcceptanceReport;
}): CreatorScriptBuildAcceptanceStageResult {
  return deepFreeze({
    version: "0.19E3C-acceptance-result-v1" as const,
    outcome: input.outcome,
    sourceStage: input.sourceStage,
    script: input.script,
    sectionPlan: [...input.sectionPlan],
    report: input.report,
    contractVersions: {
      coordinator: CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION,
      acceptancePolicy: CREATOR_SCRIPT_ACCEPTANCE_VERSION,
      checkpoint: CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_VERSION,
    },
  });
}

function normalizeAcceptanceResult(input: {
  value: unknown;
  snapshot: CreatorScriptBuildSnapshot;
  expectedSource?: Readonly<{
    sourceStage: CreatorScriptBuildAcceptanceSourceStage;
    script: CreatorScript;
    sectionPlan: readonly CreatorScriptSectionBudget[];
  }>;
}) {
  const raw = record(input.value);
  if (
    !raw ||
    raw.version !== "0.19E3C-acceptance-result-v1" ||
    !["ACCEPTED", "REJECTED"].includes(String(raw.outcome)) ||
    !["script_generation", "repair"].includes(String(raw.sourceStage))
  ) {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_RESULT_INVALID",
    );
  }

  let script: CreatorScript;
  let sectionPlan: CreatorScriptSectionBudget[];
  try {
    script = normalizeCreatorScript(raw.script);
    sectionPlan = normalizeSectionPlan(raw.sectionPlan);
    assertCreatorScriptMatchesSectionPlan(script, sectionPlan);
  } catch {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_RESULT_INVALID",
    );
  }

  if (
    script.strategyFingerprint !== input.snapshot.strategyFingerprint ||
    script.targetDurationSec !== input.snapshot.requestedDurationSeconds ||
    script.title !== input.snapshot.strategy.title ||
    script.approval !== null
  ) {
    throw new CreatorScriptBuildAcceptanceError(
      "AUTHORITY",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_SCRIPT_AUTHORITY_INVALID",
    );
  }

  const sourceStage = raw.sourceStage as CreatorScriptBuildAcceptanceSourceStage;
  if (
    input.expectedSource &&
    (
      sourceStage !== input.expectedSource.sourceStage ||
      !equalCanonical(script, input.expectedSource.script) ||
      !equalCanonical(sectionPlan, input.expectedSource.sectionPlan)
    )
  ) {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_SOURCE_MISMATCH",
    );
  }

  const report = evaluateFinal({
    script,
    sectionPlan,
    snapshot: input.snapshot,
  });
  if (!equalCanonical(raw.report, report)) {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_REPORT_MISMATCH",
    );
  }

  const outcome = raw.outcome as "ACCEPTED" | "REJECTED";
  const expectedOutcome = report.accepted ? "ACCEPTED" : "REJECTED";
  if (
    outcome !== expectedOutcome ||
    (outcome === "ACCEPTED" &&
      (report.repairRequired || hardViolationCount(report) !== 0))
  ) {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_OUTCOME_INVALID",
    );
  }

  const normalized = createAcceptanceResult({
    outcome,
    sourceStage,
    script,
    sectionPlan,
    report,
  });
  if (!equalCanonical(raw, normalized)) {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_RESULT_INVALID",
    );
  }
  return normalized;
}

export function normalizeCreatorScriptBuildAcceptedResultAuthority(input: {
  value: CreatorScriptBuildJson | null;
  snapshot: CreatorScriptBuildSnapshot;
}): CreatorScriptBuildAcceptedResultAuthority {
  const raw = record(input.value);
  if (
    !raw ||
    raw.version !== CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_INVALID");
  }
  const acceptance = normalizeAcceptanceResult({
    value: raw.acceptance,
    snapshot: input.snapshot,
  });
  if (acceptance.outcome !== "ACCEPTED" || !acceptance.report.accepted) {
    throw new Error("CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_INVALID");
  }
  const normalized = deepFreeze({
    version: CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_VERSION,
    acceptance,
  });
  if (!equalCanonical(raw, normalized)) {
    throw new Error("CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_INVALID");
  }
  return normalized;
}

function loadGeneration(build: CreatorScriptBuildRecord) {
  const authorityCheckpoint = build.checkpoints.authority || null;
  const generationCheckpoint = build.checkpoints.script_generation || null;
  if (
    !authorityCheckpoint ||
    authorityCheckpoint.status !== "COMPLETED" ||
    !generationCheckpoint ||
    generationCheckpoint.status !== "COMPLETED"
  ) {
    throw new CreatorScriptBuildAcceptanceError(
      "AUTHORITY",
      "CREATOR_SCRIPT_BUILD_GENERATION_CHECKPOINT_REQUIRED",
    );
  }
  try {
    const authority = normalizeCreatorScriptBuildAuthorityResultFromCheckpoint(
      authorityCheckpoint.outputReference,
    );
    const generationInput = createCreatorScriptBuildScriptGenerationInput({
      snapshot: build.snapshot,
      authority,
    });
    return normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint({
      buildId: build.buildId,
      value: generationCheckpoint.outputReference,
      authority: generationInput,
    });
  } catch {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_GENERATION_CHECKPOINT_INVALID",
    );
  }
}

/**
 * E3C deliberately revalidates the E3B durable result instead of trusting its
 * stored report summary. This is a checkpoint-format validation boundary, not a
 * second repair policy: all policy truth is recomputed by 0.19D below.
 */
async function loadCompletedRepair(input: {
  build: CreatorScriptBuildRecord;
  generation: CreatorScriptBuildScriptGenerationStageResult;
  repository: CreatorScriptBuildRepository;
}): Promise<CreatorScriptBuildScriptRepairStageResult> {
  const checkpoint = input.build.checkpoints.repair;
  if (!checkpoint || checkpoint.status === "PENDING" || checkpoint.status === "RUNNING") {
    throw new CreatorScriptBuildRepairPhaseIncompleteError();
  }
  try {
    return await replayCreatorScriptBuildCompletedRepair(input);
  } catch {
    throw new CreatorScriptBuildAcceptanceError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_INVALID");
  }
}

function acceptanceCheckpointSourceStage(
  checkpoint: CreatorScriptBuildCheckpoint,
): CreatorScriptBuildAcceptanceSourceStage {
  const envelope = record(checkpoint.outputReference);
  const result = record(envelope?.result);
  if (
    checkpoint.status !== "COMPLETED" ||
    envelope?.version !== "0.19E3C-acceptance-checkpoint-output-v1" ||
    !["script_generation", "repair"].includes(String(result?.sourceStage))
  ) {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_INVALID",
    );
  }
  return result?.sourceStage as CreatorScriptBuildAcceptanceSourceStage;
}

function normalizeAcceptanceCheckpoint(input: {
  checkpoint: CreatorScriptBuildCheckpoint;
  snapshot: CreatorScriptBuildSnapshot;
  sourceStage: CreatorScriptBuildAcceptanceSourceStage;
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
}) {
  if (
    input.checkpoint.status !== "COMPLETED" ||
    input.checkpoint.contractVersion !==
      CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_VERSION ||
    input.checkpoint.operationId !== null
  ) {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_INVALID",
    );
  }
  const envelope = record(input.checkpoint.outputReference);
  if (envelope?.version !== "0.19E3C-acceptance-checkpoint-output-v1") {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_INVALID",
    );
  }
  return normalizeAcceptanceResult({
    value: envelope.result,
    snapshot: input.snapshot,
    expectedSource: {
      sourceStage: input.sourceStage,
      script: input.script,
      sectionPlan: input.sectionPlan,
    },
  });
}

function checkpoint(input: {
  buildId: string;
  status: "PENDING" | "COMPLETED";
  outputReference: CreatorScriptBuildJson | null;
  diagnostics: Record<string, string | number | boolean | null>;
  previous?: CreatorScriptBuildCheckpoint | null;
  now: () => string;
}): CreatorScriptBuildCheckpoint {
  return {
    checkpointId: createCreatorScriptBuildCheckpointId({
      buildId: input.buildId,
      stage: "acceptance",
      contractVersion: CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_VERSION,
    }),
    stage: "acceptance",
    status: input.status,
    contractVersion: CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_VERSION,
    operationId: null,
    outputReference: input.outputReference,
    diagnostics: Object.freeze({ ...input.diagnostics }),
    startedAt: input.previous?.startedAt || null,
    completedAt: input.status === "COMPLETED" ? input.now() : null,
  };
}

function acceptanceFailure(input: {
  category: CreatorScriptBuildFailureCategory;
  code: string;
  diagnostics?: Record<string, string | number | boolean | null>;
}): CreatorScriptBuildFailure {
  return createCreatorScriptBuildFailure({
    category: input.category,
    code: input.code,
    stage: "acceptance",
    retryability: "NON_RETRYABLE",
    diagnostics: input.diagnostics || {},
  });
}

async function failBuild(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  category: CreatorScriptBuildFailureCategory;
  code: string;
}): Promise<never> {
  const failed = await input.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: input.build.state,
    nextState: "FAILED",
    failure: acceptanceFailure({
      category: input.category,
      code: input.code,
    }),
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: input.code,
    buildId: failed.buildId,
  });
}

async function assertCurrentProjectAuthority(input: {
  dependencies: CreatorScriptBuildAcceptanceCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
}) {
  const currentProjectRevision =
    await input.dependencies.getCurrentProjectRevision({
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

  const code = currentProjectRevision
    ? "CREATOR_SCRIPT_BUILD_PROJECT_STALE"
    : "CREATOR_SCRIPT_BUILD_PROJECT_AUTHORITY_MISSING";
  const failure = acceptanceFailure({
    category: "AUTHORITY",
    code,
  });
  const nextState = currentProjectRevision ? "STALE" : "FAILED";
  const changed = await input.dependencies.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: input.build.state,
    nextState,
    failure,
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code,
    buildId: changed.buildId,
  });
}

function assertCoordinatorContract(snapshot: CreatorScriptBuildSnapshot) {
  if (
    snapshot.contractVersions.creatorScriptBuildAcceptanceCoordinator !==
      CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_ACCEPTANCE_CONTRACT_MISMATCH");
  }
}

async function ensureAcceptanceCheckpoint(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  now: () => string;
}) {
  const existing = input.build.checkpoints.acceptance || null;
  if (
    existing &&
    existing.contractVersion !== CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_VERSION
  ) {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_CONTRACT_MISMATCH",
    );
  }
  if (existing) return input.build;
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: input.build.state,
    checkpoint: checkpoint({
      buildId: input.build.buildId,
      status: "PENDING",
      outputReference: null,
      diagnostics: {},
      now: input.now,
    }),
  });
}

async function completeAcceptanceCheckpoint(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  result: CreatorScriptBuildAcceptanceStageResult;
  now: () => string;
}) {
  const previous = input.build.checkpoints.acceptance || null;
  if (previous?.status !== "PENDING") {
    throw new CreatorScriptBuildAcceptanceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_NOT_PENDING",
    );
  }
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: input.build.state,
    checkpoint: checkpoint({
      buildId: input.build.buildId,
      status: "COMPLETED",
      outputReference: buildJson({
        version: "0.19E3C-acceptance-checkpoint-output-v1",
        result: input.result,
      }),
      diagnostics: {
        outcome: input.result.outcome,
        sourceStage: input.result.sourceStage,
        scriptRevision: input.result.script.revision,
        acceptanceReportVersion: input.result.report.version,
        hardViolationCount: hardViolationCount(input.result.report),
        repairableViolationCount:
          input.result.report.repairableViolations.length,
        blockingViolationCount:
          input.result.report.blockingViolations.length,
      },
      previous,
      now: input.now,
    }),
  });
}

function acceptedAuthority(
  acceptance: CreatorScriptBuildAcceptanceStageResult,
): CreatorScriptBuildAcceptedResultAuthority {
  if (acceptance.outcome !== "ACCEPTED" || !acceptance.report.accepted) {
    throw new Error("CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_INVALID");
  }
  return deepFreeze({
    version: CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_VERSION,
    acceptance,
  });
}

async function applyCompletedAcceptance(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  result: CreatorScriptBuildAcceptanceStageResult;
}): Promise<CreatorScriptBuildAcceptanceCoordinatorResult> {
  if (input.result.outcome === "ACCEPTED") {
    const authority = acceptedAuthority(input.result);
    const accepted = await input.repository.transition({
      ownerId: input.build.ownerId,
      buildId: input.build.buildId,
      expectedState: input.build.state,
      nextState: "ACCEPTED",
      resultAuthority: buildJson(authority),
    });
    let normalizedAuthority: CreatorScriptBuildAcceptedResultAuthority;
    try {
      normalizedAuthority = normalizeCreatorScriptBuildAcceptedResultAuthority({
        value: accepted.resultAuthority,
        snapshot: accepted.snapshot,
      });
    } catch {
      return await failBuild({
        repository: input.repository,
        build: accepted,
        category: "INTERNAL",
        code: "CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_WRITE_INVALID",
      });
    }
    if (!equalCanonical(normalizedAuthority.acceptance, input.result)) {
      return await failBuild({
        repository: input.repository,
        build: accepted,
        category: "INTERNAL",
        code: "CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_WRITE_INVALID",
      });
    }
    return {
      version: CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION,
      build: accepted,
      acceptance: input.result,
      disposition: "ACCEPTED",
    };
  }

  const policyFailure = getCreatorScriptAcceptanceFailure(input.result.report);
  const rejected = await input.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: input.build.state,
    nextState: "FAILED",
    failure: createCreatorScriptBuildFailure({
      category: policyFailure.category,
      code: policyFailure.code,
      stage: "acceptance",
      retryability: "NON_RETRYABLE",
      diagnostics: {},
    }),
  });
  return {
    version: CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION,
    build: rejected,
    acceptance: input.result,
    disposition: "REJECTED",
  };
}

async function resumeAcceptedBuild(input: {
  dependencies: CreatorScriptBuildAcceptanceCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
}) {
  const checkpointValue = input.build.checkpoints.acceptance || null;
  if (!checkpointValue || !input.build.resultAuthority) {
    return await failBuild({
      repository: input.dependencies.repository,
      build: input.build,
      category: "INPUT",
      code: "CREATOR_SCRIPT_BUILD_ACCEPTED_AUTHORITY_INCOMPLETE",
    });
  }

  try {
    const sourceStage = acceptanceCheckpointSourceStage(checkpointValue);
    const generation = loadGeneration(input.build);
    const source = sourceStage === "repair"
      ? await loadCompletedRepair({ build: input.build, generation, repository: input.dependencies.repository })
      : generation;
    const script = source.script;
    const sectionPlan = source.sectionPlan;
    const acceptance = normalizeAcceptanceCheckpoint({
      checkpoint: checkpointValue,
      snapshot: input.build.snapshot,
      sourceStage,
      script,
      sectionPlan,
    });
    if (acceptance.outcome !== "ACCEPTED") {
      throw new CreatorScriptBuildAcceptanceError(
        "INPUT",
        "CREATOR_SCRIPT_BUILD_ACCEPTED_CHECKPOINT_NOT_ACCEPTED",
      );
    }
    const authority = normalizeCreatorScriptBuildAcceptedResultAuthority({
      value: input.build.resultAuthority,
      snapshot: input.build.snapshot,
    });
    if (!equalCanonical(authority.acceptance, acceptance)) {
      throw new CreatorScriptBuildAcceptanceError(
        "INPUT",
        "CREATOR_SCRIPT_BUILD_ACCEPTED_AUTHORITY_MISMATCH",
      );
    }
    return {
      version: CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION,
      build: input.build,
      acceptance,
      disposition: "RESUMED" as const,
    };
  } catch (error) {
    const acceptanceError = error instanceof CreatorScriptBuildAcceptanceError
      ? error
      : new CreatorScriptBuildAcceptanceError(
          "INPUT",
          "CREATOR_SCRIPT_BUILD_ACCEPTED_AUTHORITY_INVALID",
        );
    return await failBuild({
      repository: input.dependencies.repository,
      build: input.build,
      category: acceptanceError.category,
      code: acceptanceError.code,
    });
  }
}

export async function runCreatorScriptBuildAcceptanceCoordinator(input: {
  ownerId: string;
  buildId: string;
  dependencies: CreatorScriptBuildAcceptanceCoordinatorDependencies;
}): Promise<CreatorScriptBuildAcceptanceCoordinatorResult> {
  const now = input.dependencies.now || (() => new Date().toISOString());
  let build = await input.dependencies.repository.getForOwner(
    input.buildId,
    input.ownerId,
  );
  if (!build) throw new Error("CREATOR_SCRIPT_BUILD_NOT_FOUND");
  assertCoordinatorContract(build.snapshot);

  if (
    build.state !== "SCRIPT_GENERATED" &&
    build.state !== "REPAIRING" &&
    build.state !== "ACCEPTED"
  ) {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_ACCEPTANCE_STATE_INVALID",
      buildId: build.buildId,
    });
  }

  await assertCurrentProjectAuthority({
    dependencies: input.dependencies,
    build,
  });

  if (build.state !== "ACCEPTED" && build.resultAuthority !== null) {
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      category: "INPUT",
      code: "CREATOR_SCRIPT_BUILD_RESULT_AUTHORITY_PREMATURE",
    });
  }

  if (build.state === "ACCEPTED") {
    return await resumeAcceptedBuild({
      dependencies: input.dependencies,
      build,
    });
  }

  let generation: CreatorScriptBuildScriptGenerationStageResult;
  try {
    generation = loadGeneration(build);
  } catch (error) {
    const acceptanceError = error instanceof CreatorScriptBuildAcceptanceError
      ? error
      : new CreatorScriptBuildAcceptanceError(
          "INPUT",
          "CREATOR_SCRIPT_BUILD_GENERATION_CHECKPOINT_INVALID",
        );
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      category: acceptanceError.category,
      code: acceptanceError.code,
    });
  }

  let sourceStage: CreatorScriptBuildAcceptanceSourceStage = "script_generation";
  let script = generation.script;
  let sectionPlan = generation.sectionPlan;

  if (build.state === "REPAIRING") {
    try {
      const repair = await loadCompletedRepair({ build, generation, repository: input.dependencies.repository });
      sourceStage = "repair";
      script = repair.script;
      sectionPlan = repair.sectionPlan;
    } catch (error) {
      if (error instanceof CreatorScriptBuildRepairPhaseIncompleteError) {
        throw new CreatorScriptBuildCoordinatorBlockedError({
          code: "CREATOR_SCRIPT_BUILD_REPAIR_PHASE_INCOMPLETE",
          buildId: build.buildId,
        });
      }
      const acceptanceError = error instanceof CreatorScriptBuildAcceptanceError
        ? error
        : new CreatorScriptBuildAcceptanceError(
            "INPUT",
            "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_INVALID",
          );
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        category: acceptanceError.category,
        code: acceptanceError.code,
      });
    }
  }

  const report = evaluateFinal({
    script,
    sectionPlan,
    snapshot: build.snapshot,
  });

  const existingCheckpoint = build.checkpoints.acceptance || null;
  if (
    build.state === "SCRIPT_GENERATED" &&
    !report.accepted &&
    report.repairRequired
  ) {
    if (existingCheckpoint) {
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        category: "INPUT",
        code: "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_UNEXPECTED",
      });
    }
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_REPAIR_PHASE_REQUIRED",
      buildId: build.buildId,
    });
  }

  if (existingCheckpoint?.status === "COMPLETED") {
    try {
      const completed = normalizeAcceptanceCheckpoint({
        checkpoint: existingCheckpoint,
        snapshot: build.snapshot,
        sourceStage,
        script,
        sectionPlan,
      });
      return await applyCompletedAcceptance({
        repository: input.dependencies.repository,
        build,
        result: completed,
      });
    } catch (error) {
      const acceptanceError = error instanceof CreatorScriptBuildAcceptanceError
        ? error
        : new CreatorScriptBuildAcceptanceError(
            "INPUT",
            "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_INVALID",
          );
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        category: acceptanceError.category,
        code: acceptanceError.code,
      });
    }
  }

  if (
    existingCheckpoint &&
    existingCheckpoint.status !== "PENDING"
  ) {
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      category: "INPUT",
      code: "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_INVALID",
    });
  }

  try {
    build = await ensureAcceptanceCheckpoint({
      repository: input.dependencies.repository,
      build,
      now,
    });
  } catch (error) {
    const acceptanceError = error instanceof CreatorScriptBuildAcceptanceError
      ? error
      : new CreatorScriptBuildAcceptanceError(
          "INPUT",
          "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_INVALID",
        );
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      category: acceptanceError.category,
      code: acceptanceError.code,
    });
  }

  const outcome = report.accepted ? "ACCEPTED" as const : "REJECTED" as const;
  const result = createAcceptanceResult({
    outcome,
    sourceStage,
    script,
    sectionPlan,
    report,
  });

  try {
    build = await completeAcceptanceCheckpoint({
      repository: input.dependencies.repository,
      build,
      result,
      now,
    });
  } catch {
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      category: "INTERNAL",
      code: "CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_WRITE_FAILED",
    });
  }

  return await applyCompletedAcceptance({
    repository: input.dependencies.repository,
    build,
    result,
  });
}
