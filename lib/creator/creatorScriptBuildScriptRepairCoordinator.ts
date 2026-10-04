import { CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION } from "./creatorScriptBuildRepairProviderPolicy.ts";
import { createHash } from "node:crypto";
import {
  applyCreatorScriptAdditiveExpansion,
  creatorScriptAdditiveExpansionIntroducesLocalRepetition,
  countCreatorScriptWords,
  createCreatorScriptNarrationAuthority,
  createCreatorScriptRepairTargets,
  filterCreatorScriptDistinctiveRepairReplacements,
  getCreatorScriptEditorialDistinctivenessDiagnostics,
  getCreatorScriptRepairReplacementDiagnostics,
  normalizeCreatorScript,
  selectCreatorScriptExpansionCandidates,
  type CreatorScript,
  type CreatorScriptExpansionTarget,
  type CreatorScriptSection,
  type CreatorScriptSectionBudget,
} from "./creatorScript.ts";
import {
  creatorScriptAcceptanceMateriallyImproved,
  evaluateCreatorScriptAcceptance,
  getCreatorScriptAcceptanceExpansionTargets,
  type CreatorScriptAcceptanceReport,
  type CreatorScriptRepairStrategy,
  type CreatorScriptViolation,
} from "./creatorScriptAcceptance.ts";
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
  createCreatorScriptBuildScriptGenerationInput,
  createCreatorScriptSectionClaimAuthority,
  normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint,
  type CreatorScriptBuildScriptGenerationInput,
  type CreatorScriptBuildScriptGenerationStageResult,
} from "./creatorScriptBuildScriptGenerationCoordinator.ts";
import {
  normalizeCreatorScriptBuildAuthorityResultFromCheckpoint,
} from "./creatorScriptBuildAuthorityCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
  CreatorScriptBuildStageExecutionError,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";
import type { CreatorScriptBuildRepository } from "../persistence/creatorScriptBuilds/types.ts";

export const CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION =
  "0.19E3B-S3" as const;
export const CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION =
  "creator-script-build-script-repair-checkpoint-v3" as const;
export const CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION =
  "creator-script-build-script-repair-operation-v3" as const;
export const CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE =
  "creator_script_build_script_repair" as const;
export const CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS = 2 as const;
// Shared across rounds: rejected responses consume this budget too.
export const CREATOR_SCRIPT_BUILD_MAX_CANDIDATES_PER_TARGET = 2 as const;

const SCRIPT_REPAIR_SEMANTIC_FINGERPRINT_VERSION =
  "creator-script-build-script-repair-semantic-v3" as const;

type CreatorScriptBuildRepairDirection =
  | "expand"
  | "compress"
  | "rebalance_sections"
  | "differentiate_sections";

type CreatorScriptBuildReplacementTarget = Readonly<{
  sectionId: string;
  strategy: CreatorScriptRepairStrategy;
  direction: CreatorScriptBuildRepairDirection;
  beforeWords: number;
  requiredFinalMinWords: number;
  requiredFinalTargetWords: number;
  requiredFinalMaxWords: number;
  minimumRequiredGain: number;
  minimumRequiredReduction: number;
}>;

type CreatorScriptBuildRepairViolationDirective = Readonly<{
  code: CreatorScriptViolation["code"];
  sectionId: string | null;
  repairStrategy: CreatorScriptRepairStrategy;
  diagnostics: CreatorScriptViolation["diagnostics"];
}>;

type CreatorScriptBuildSemanticScriptAuthority = Readonly<{
  version: CreatorScript["version"];
  title: string;
  sections: readonly Readonly<{
    id: string;
    kind: CreatorScriptSection["kind"];
    heading?: string;
    text: string;
    claimIds: readonly string[];
    evidenceReviewRequired: boolean;
  }>[];
  targetDurationSec: number;
  strategyFingerprint: string;
  revision: number;
  grounding: CreatorScript["grounding"];
  approval: null;
}>;

export type CreatorScriptBuildScriptRepairInput = Readonly<{
  version: "0.19E3B-script-repair-request-v2";
  attempt: 1 | 2;
  candidate: Readonly<{
    buildId: string;
    sectionId: string;
    ordinal: 1 | 2;
    rejectionFeedback: CreatorScriptBuildCandidateValidation | null;
  }> | null;
  mode: "additive" | "replacement";
  currentScriptAuthority: CreatorScriptBuildSemanticScriptAuthority;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  repairSectionIds: readonly string[];
  repairStrategies: readonly CreatorScriptRepairStrategy[];
  repairableViolations: readonly CreatorScriptBuildRepairViolationDirective[];
  replacementTargets: readonly CreatorScriptBuildReplacementTarget[];
  expansionTargets: readonly CreatorScriptExpansionTarget[];
  permittedClaimIds: readonly string[];
  sectionClaimAuthority: readonly Readonly<{
    sectionId: string;
    mode: "global_grounded" | "theme_grounded" | "conceptual_only";
    themeToken: string | null;
    permittedClaimIds: readonly string[];
  }>[];
  creatorAuthority: Readonly<{
    topic: string;
    title: string;
    approvedStrategy: CreatorScriptBuildSnapshot["strategy"]["approvedStrategy"];
  }>;
}>;

export type CreatorScriptBuildScriptRepairStageResult = Readonly<{
  version: "0.19E3B-script-repair-result-v2";
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  attemptCount: number;
  candidateAttemptCount: number;
  appliedRevisionCount: number;
  candidateCallLimit: number;
  operationIds: readonly string[];
  reportSummary: Readonly<{
    initialReportVersion: string;
    finalReportVersion: string;
    initialHardViolationCount: number;
    finalHardViolationCount: number;
    finalRepairableViolationCount: number;
    finalBlockingViolationCount: number;
  }>;
  contractVersions: Readonly<{
    coordinator: typeof CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION;
    operation: typeof CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION;
    checkpoint: typeof CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION;
  }>;
}>;

export type CreatorScriptBuildScriptRepairCoordinatorResult = Readonly<{
  version: typeof CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION;
  build: CreatorScriptBuildRecord;
  repair: CreatorScriptBuildScriptRepairStageResult | null;
  observedReport: CreatorScriptAcceptanceReport;
  disposition:
    | "NO_REPAIR_REQUIRED"
    | "NOT_REPAIRABLE"
    | "REPAIR_PHASE_COMPLETED"
    | "RESUMED";
}>;

export type CreatorScriptBuildScriptRepairExecutor = (
  input: CreatorScriptBuildScriptRepairInput,
) => Promise<unknown>;

export type CreatorScriptBuildScriptRepairCoordinatorDependencies = Readonly<{
  repository: CreatorScriptBuildRepository;
  getCurrentProjectRevision: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<string | null>;
  executeScriptRepair: CreatorScriptBuildScriptRepairExecutor;
  now?: () => string;
}>;

class CreatorScriptBuildRepairError extends Error {
  readonly category: CreatorScriptBuildFailureCategory;
  readonly code: string;
  readonly operationId: string | null;
  readonly retryability: CreatorScriptBuildFailure["retryability"];
  readonly diagnostics: Record<string, string | number | boolean | null>;

  constructor(
    category: CreatorScriptBuildFailureCategory,
    code: string,
    operationId: string | null = null,
    detail: { retryability?: CreatorScriptBuildFailure["retryability"]; diagnostics?: Record<string, string | number | boolean | null> } = {},
  ) {
    super(code);
    this.name = "CreatorScriptBuildRepairError";
    this.category = category;
    this.code = code;
    this.operationId = operationId;
    this.retryability = detail.retryability || "NON_RETRYABLE";
    this.diagnostics = detail.diagnostics || {};
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
  try {
    const leftJson = JSON.stringify(left);
    const rightJson = JSON.stringify(right);
    return leftJson !== undefined && rightJson !== undefined &&
      canonicalCreatorScriptBuildJson(JSON.parse(leftJson)) ===
        canonicalCreatorScriptBuildJson(JSON.parse(rightJson));
  } catch {
    return false;
  }
}

function semanticScriptAuthority(
  script: CreatorScript,
): CreatorScriptBuildSemanticScriptAuthority {
  return {
    version: script.version,
    title: script.title,
    sections: script.sections.map((section) => ({
      id: section.id,
      kind: section.kind,
      ...(section.heading ? { heading: section.heading } : {}),
      text: section.text,
      claimIds: [...section.claimIds],
      evidenceReviewRequired: section.evidenceReviewRequired,
    })),
    targetDurationSec: script.targetDurationSec,
    strategyFingerprint: script.strategyFingerprint,
    revision: script.revision,
    grounding: script.grounding,
    approval: null,
  };
}

function repairDirection(report: CreatorScriptAcceptanceReport) {
  const strategies = new Set(
    report.repairableViolations.map((violation) => violation.repairStrategy),
  );
  if (strategies.size > 1) return "rebalance_sections" as const;
  if (strategies.has("differentiate")) return "differentiate_sections" as const;
  if (report.duration.status === "too_long") return "compress" as const;
  if (report.duration.status === "too_short") return "expand" as const;
  return "rebalance_sections" as const;
}

function repairMode(report: CreatorScriptAcceptanceReport) {
  return report.repairableViolations.length > 0 &&
      report.repairableViolations.every((violation) =>
        violation.code === "GLOBAL_DURATION_TOO_SHORT"
      )
    ? "additive" as const
    : "replacement" as const;
}

export function createCreatorScriptBuildScriptRepairInput(input: {
  snapshot: CreatorScriptBuildSnapshot;
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  report: CreatorScriptAcceptanceReport;
  attempt: 1 | 2;
}): CreatorScriptBuildScriptRepairInput {
  if (!input.report.repairRequired || input.report.blockingViolations.length > 0) {
    throw new Error("CREATOR_SCRIPT_BUILD_REPAIR_NOT_REQUIRED");
  }
  const repairSectionIds = [...input.report.repairSectionIds];
  if (repairSectionIds.length === 0) {
    throw new Error("CREATOR_SCRIPT_BUILD_REPAIR_TARGETS_REQUIRED");
  }
  const sectionDiagnostics = new Map(
    input.report.sections.map((section) => [section.id, section]),
  );
  const direction = repairDirection(input.report);
  const replacementTargets = repairMode(input.report) === "replacement"
    ? repairSectionIds.flatMap((sectionId) => {
        const diagnostic = sectionDiagnostics.get(sectionId);
        if (!diagnostic) {
          throw new Error(
            `CREATOR_SCRIPT_BUILD_REPAIR_TARGET_MISSING:${sectionId}`,
          );
        }
        const sectionViolation = input.report.repairableViolations.find(
          (violation) => violation.sectionId === sectionId,
        );
        const localDirection: CreatorScriptBuildRepairDirection =
          diagnostic.actualWords < diagnostic.minimumWords
            ? "expand"
            : diagnostic.actualWords > diagnostic.maximumWords
              ? "compress"
              : sectionViolation?.repairStrategy === "expand"
                ? "expand"
                : sectionViolation?.repairStrategy === "compress"
                  ? "compress"
                  : sectionViolation?.repairStrategy === "differentiate"
                    ? "differentiate_sections"
                    : input.report.duration.status === "too_short"
                      ? "expand"
                      : input.report.duration.status === "too_long"
                        ? "compress"
                        : direction;
        return createCreatorScriptRepairTargets({
          sections: [diagnostic],
          direction: localDirection,
        }).map((target) => ({
          ...target,
          strategy: sectionViolation?.repairStrategy ||
            input.report.repairableViolations[0].repairStrategy,
        }));
      })
    : [];
  const expansionTargets = repairMode(input.report) === "additive"
    ? getCreatorScriptAcceptanceExpansionTargets({
        script: input.script,
        report: input.report,
        sectionPlan: [...input.sectionPlan],
      })
    : [];
  if (
    (repairMode(input.report) === "additive" && expansionTargets.length === 0) ||
    (repairMode(input.report) === "replacement" && replacementTargets.length === 0)
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_REPAIR_TARGETS_REQUIRED");
  }
  const permittedClaimIds = input.script.grounding.context.claims
    .map((claim) => claim.claimId)
    .toSorted();
  const sectionClaimAuthority = createCreatorScriptSectionClaimAuthority({
    editorialContext: input.script.grounding.context,
    sectionPlan: input.sectionPlan,
    permittedClaimIds,
  });
  return deepFreeze({
    version: "0.19E3B-script-repair-request-v2" as const,
    attempt: input.attempt,
    candidate: null,
    mode: repairMode(input.report),
    currentScriptAuthority: semanticScriptAuthority(input.script),
    sectionPlan: [...input.sectionPlan],
    repairSectionIds,
    repairStrategies: [...new Set(
      input.report.repairableViolations.map((violation) =>
        violation.repairStrategy
      ),
    )].toSorted(),
    repairableViolations: input.report.repairableViolations.map((violation) => ({
      code: violation.code,
      sectionId: violation.sectionId,
      repairStrategy: violation.repairStrategy,
      diagnostics: { ...violation.diagnostics },
    })),
    replacementTargets,
    expansionTargets,
    permittedClaimIds,
    sectionClaimAuthority,
    creatorAuthority: {
      topic: input.snapshot.strategy.topic,
      title: input.snapshot.strategy.title,
      approvedStrategy: input.snapshot.strategy.approvedStrategy,
    },
  });
}

export function createCreatorScriptBuildScriptRepairSemanticFingerprint(
  input: CreatorScriptBuildScriptRepairInput,
) {
  return `${SCRIPT_REPAIR_SEMANTIC_FINGERPRINT_VERSION}:${createHash("sha256")
    .update(canonicalCreatorScriptBuildJson({
      contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
      providerPolicyVersion: CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION,
      input,
    }), "utf8")
    .digest("hex")}`;
}

export function createCreatorScriptBuildScriptRepairOperationId(input: {
  buildId: string;
  repairInput: CreatorScriptBuildScriptRepairInput;
}) {
  return createCreatorScriptBuildOperationId({
    buildId: input.buildId,
    stage: "repair",
    operationType: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
    semanticFingerprint:
      createCreatorScriptBuildScriptRepairSemanticFingerprint(input.repairInput),
    contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
  });
}

/** Only a completed local compression may authorize a new duration compensation round. */
export function creatorScriptBuildRepairAllowsCrossConstraintContinuation(input: {
  completedAttempt: number;
  previous: CreatorScriptAcceptanceReport;
  current: CreatorScriptAcceptanceReport;
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  compressedSectionIds: readonly string[];
  remainingProviderCalls: number;
}) {
  if (input.completedAttempt !== 1 ||
      input.completedAttempt >= CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS ||
      input.remainingProviderCalls <= 0 || !input.current.repairRequired ||
      input.current.blockingViolations.length > 0) return false;
  const previousHard = input.previous.violations.filter((v) => v.severity === "hard");
  const currentHard = input.current.violations.filter((v) => v.severity === "hard");
  // A pure local overflow -> pure repairable shortage transition only.
  if (previousHard.length === 0 || previousHard.some((v) =>
    v.code !== "SECTION_OVER_MAX" || !v.repairable || !v.sectionId ||
    !input.compressedSectionIds.includes(v.sectionId) ||
    !input.current.sections.some((s) => s.id === v.sectionId && !s.missing &&
      s.actualWords >= s.minimumWords && s.actualWords <= s.maximumWords)
  )) return false;
  if (currentHard.length !== 1 || currentHard[0].code !== "GLOBAL_DURATION_TOO_SHORT" ||
      currentHard[0].sectionId !== null || !currentHard[0].repairable ||
      repairMode(input.current) !== "additive") return false;
  const deficit = input.current.duration.minimumAcceptableWordCount - input.current.duration.actualWordCount;
  const targets = getCreatorScriptAcceptanceExpansionTargets({
    script: input.script, report: input.current, sectionPlan: [...input.sectionPlan],
  });
  return deficit > 0 && targets.length > 0 && targets.every((target) =>
    target.requestedGainWords > 0 &&
    target.requestedGainWords <= target.maxAdditionalWords
  ) && targets.reduce((sum, target) => sum + target.requestedGainWords, 0) >= deficit;
}

export function creatorScriptBuildRepairAllowsNextAttempt(input: {
  completedAttempt: number;
  previous: CreatorScriptAcceptanceReport;
  current: CreatorScriptAcceptanceReport;
}) {
  return input.completedAttempt < CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS &&
    input.current.repairRequired &&
    input.current.blockingViolations.length === 0 &&
    creatorScriptAcceptanceMateriallyImproved({
      previous: input.previous,
      current: input.current,
    });
}

function assertClaimIdsPermitted(
  values: unknown,
  allowedClaimIds: Set<string>,
) {
  if (!Array.isArray(values)) {
    throw new CreatorScriptBuildRepairError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID",
    );
  }
  const claimIds = values.map((value) => clean(value, 300));
  if (claimIds.some((claimId) => !claimId || !allowedClaimIds.has(claimId))) {
    throw new CreatorScriptBuildRepairError(
      "GROUNDING",
      "CREATOR_SCRIPT_BUILD_REPAIR_CLAIM_NOT_PERMITTED",
    );
  }
  return [...new Set(claimIds)];
}

function allowedClaimIdsForRepairSection(
  input: CreatorScriptBuildScriptRepairInput,
  sectionId: string,
) {
  const local = input.sectionClaimAuthority.find((item) =>
    item.sectionId === sectionId
  );
  return new Set(local?.permittedClaimIds || input.permittedClaimIds);
}

function createCanonicalRepairedScript(input: {
  currentScript: CreatorScript;
  sections: CreatorScriptSection[];
  updatedAt: string;
}) {
  return normalizeCreatorScript({
    ...input.currentScript,
    sections: input.sections,
    revision: input.currentScript.revision + 1,
    updatedAt: input.updatedAt,
    approval: null,
  });
}

function sectionFromReplacementProposal(input: {
  currentSection: CreatorScriptSection;
  value: unknown;
  allowedClaimIds: Set<string>;
}) {
  const proposal = record(input.value);
  const text = clean(proposal?.text, 100_000);
  const heading = clean(proposal?.heading, 300);
  if (!proposal || !text) {
    throw new CreatorScriptBuildRepairError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID",
    );
  }
  return {
    id: input.currentSection.id,
    kind: input.currentSection.kind,
    ...(heading
      ? { heading }
      : input.currentSection.heading
        ? { heading: input.currentSection.heading }
        : {}),
    text,
    claimIds: assertClaimIdsPermitted(
      proposal.claimIds,
      input.allowedClaimIds,
    ),
    evidenceReviewRequired: false,
  };
}

export type CreatorScriptBuildCandidateValidation = Readonly<{
  accepted: boolean;
  reason: string;
  sectionId: string;
  beforeWords: number;
  candidateWords: number | null;
  minimumWords: number;
  maximumWords: number;
}>;

type ReplacementOutcome = Readonly<{
  validation: CreatorScriptBuildCandidateValidation;
  section: CreatorScriptSection | null;
}>;

export function createCreatorScriptBuildReplacementCandidateInput(input: {
  roundInput: CreatorScriptBuildScriptRepairInput;
  buildId: string;
  sectionId: string;
  ordinal: 1 | 2;
  rejectionFeedback?: CreatorScriptBuildCandidateValidation | null;
}): CreatorScriptBuildScriptRepairInput {
  const target = input.roundInput.replacementTargets.find((item) =>
    item.sectionId === input.sectionId
  );
  if (input.roundInput.mode !== "replacement" || !target || !input.buildId ||
      (input.ordinal !== 1 && input.ordinal !== 2)) {
    throw new Error("CREATOR_SCRIPT_BUILD_REPAIR_TARGET_INVALID");
  }
  return deepFreeze({
    ...input.roundInput,
    repairSectionIds: [target.sectionId],
    replacementTargets: [target],
    candidate: {
      buildId: input.buildId,
      sectionId: target.sectionId,
      ordinal: input.ordinal,
      rejectionFeedback: input.rejectionFeedback || null,
    },
  });
}

function assembleReplacementProposal(input: {
  value: Record<string, unknown>;
  repairInput: CreatorScriptBuildScriptRepairInput;
  currentScript: CreatorScript;
}): ReplacementOutcome {
  const target = input.repairInput.replacementTargets[0];
  const proposal = record(input.value.section);
  if (!input.repairInput.candidate || input.repairInput.replacementTargets.length !== 1 ||
      !target || !proposal || typeof proposal.sectionId !== "string" ||
      typeof proposal.text !== "string" || !Array.isArray(proposal.claimIds) ||
      !(proposal.heading === null || typeof proposal.heading === "string")) {
    throw new CreatorScriptBuildRepairError(
      "MODEL_CONTRACT", "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID",
    );
  }
  const diagnostic = (reason: string, candidateWords: number | null): ReplacementOutcome => ({
    validation: {
      accepted: false, reason, sectionId: target.sectionId,
      beforeWords: target.beforeWords, candidateWords,
      minimumWords: target.requiredFinalMinWords,
      maximumWords: target.requiredFinalMaxWords,
    },
    section: null,
  });
  // Validate grounding even for a rejected geometric candidate.
  const allowedClaimIds = allowedClaimIdsForRepairSection(
    input.repairInput,
    target.sectionId,
  );
  assertClaimIdsPermitted(proposal.claimIds, allowedClaimIds);
  if (proposal.sectionId !== target.sectionId) {
    return diagnostic("wrong_section_identity", null);
  }
  const currentSection = input.currentScript.sections.find((section) =>
    section.id === target.sectionId
  );
  if (!currentSection) throw new CreatorScriptBuildRepairError(
    "SCRIPT_POLICY", "CREATOR_SCRIPT_BUILD_REPAIR_TARGET_INVALID",
  );
  const geometry = getCreatorScriptRepairReplacementDiagnostics({
    script: input.currentScript,
    plan: [...input.repairInput.sectionPlan],
    replacements: [{ id: target.sectionId, text: proposal.text }],
    targets: [target],
  })[0];
  if (!geometry.accepted) return diagnostic(geometry.reason, geometry.candidateWords);
  const section = sectionFromReplacementProposal({
    currentSection, value: proposal, allowedClaimIds,
  });
  const distinctive = filterCreatorScriptDistinctiveRepairReplacements({
    script: input.currentScript, replacements: [section],
    plan: [...input.repairInput.sectionPlan],
  });
  if (distinctive.replacements.length !== 1) {
    const targetMustDifferentiate =
      target.direction === "differentiate_sections" ||
      target.strategy === "differentiate";
    if (targetMustDifferentiate) {
      return diagnostic("distinctiveness_rejection", geometry.candidateWords);
    }
    const failureKey = (failure: {
      sectionId: string;
      comparedSectionId?: string;
      failureType: string;
    }) => [
      failure.failureType,
      failure.sectionId,
      failure.comparedSectionId || "",
    ].join("|");
    const existingFailureKeys = new Set(
      getCreatorScriptEditorialDistinctivenessDiagnostics(
        input.currentScript,
        [...input.repairInput.sectionPlan],
      ).map(failureKey),
    );
    const candidateIntroducedRegression = distinctive.failures.some((failure) =>
      (
        failure.sectionId === target.sectionId ||
        failure.comparedSectionId === target.sectionId
      ) && !existingFailureKeys.has(failureKey(failure))
    );
    if (candidateIntroducedRegression) {
      return diagnostic("distinctiveness_rejection", geometry.candidateWords);
    }
  }
  return {
    validation: { ...diagnostic("accepted", geometry.candidateWords).validation, accepted: true },
    section,
  };
}

function assembleAdditiveProposal(input: {
  value: Record<string, unknown>;
  repairInput: CreatorScriptBuildScriptRepairInput;
  currentScript: CreatorScript;
  updatedAt: string;
}) {
  const proposals = Array.isArray(input.value.additions)
    ? input.value.additions
    : [];
  if (proposals.length !== input.repairInput.expansionTargets.length) {
    throw new CreatorScriptBuildRepairError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID",
    );
  }
  const currentById = new Map(
    input.currentScript.sections.map((section) => [section.id, section]),
  );
  const validatedCandidates = input.repairInput.expansionTargets.flatMap(
    (target, index) => {
      const allowedClaimIds = allowedClaimIdsForRepairSection(
        input.repairInput,
        target.sectionId,
      );
      const currentSection = currentById.get(target.sectionId);
      const proposal = record(proposals[index]);
      if (!currentSection || !proposal) {
        throw new CreatorScriptBuildRepairError(
          "MODEL_CONTRACT",
          "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID",
        );
      }
      const placementAnchorId = clean(proposal.placementAnchorId, 120);
      if (!target.availablePlacementAnchors.some((anchor) =>
        anchor.id === placementAnchorId
      )) {
        throw new CreatorScriptBuildRepairError(
          "SCRIPT_POLICY",
          "CREATOR_SCRIPT_BUILD_REPAIR_ANCHOR_INVALID",
        );
      }
      const additionalText = clean(proposal.additionalText, 20_000);
      const additionWords = countCreatorScriptWords(additionalText);
      if (additionWords <= 0 || additionWords > target.maxAdditionalWords) {
        throw new CreatorScriptBuildRepairError(
          "SCRIPT_POLICY",
          "CREATOR_SCRIPT_BUILD_REPAIR_WRONG_DIRECTION",
        );
      }
      if (creatorScriptAdditiveExpansionIntroducesLocalRepetition({
        sectionText: currentSection.text,
        additionalText,
      })) {
        return [];
      }
      const applied = applyCreatorScriptAdditiveExpansion({
        section: currentSection,
        placementAnchorId,
        additionalText,
      });
      const claimIds = assertClaimIdsPermitted(
        proposal.claimIds,
        allowedClaimIds,
      );
      const replacement: CreatorScriptSection = {
        id: currentSection.id,
        kind: currentSection.kind,
        ...(currentSection.heading ? { heading: currentSection.heading } : {}),
        text: applied.text,
        claimIds: [...new Set([...currentSection.claimIds, ...claimIds])],
        evidenceReviewRequired: false,
      };
      return [{
        sectionId: target.sectionId,
        gainWords: countCreatorScriptWords(replacement.text) - target.currentWords,
        value: replacement,
      }];
    },
  );
  const deficitWords = input.repairInput.expansionTargets.reduce(
    (sum, target) => sum + target.requestedGainWords,
    0,
  );
  const selected = selectCreatorScriptExpansionCandidates({
    deficitWords,
    candidates: validatedCandidates,
    canonicalSectionOrder: input.repairInput.sectionPlan.map((section) =>
      section.id
    ),
  });
  if (selected.length === 0) {
    throw new CreatorScriptBuildRepairError(
      "SCRIPT_POLICY",
      "CREATOR_SCRIPT_BUILD_REPAIR_LOCAL_REPETITION",
    );
  }
  const replacementById = new Map(
    selected.map((candidate) => [candidate.sectionId, candidate.value]),
  );
  return createCanonicalRepairedScript({
    currentScript: input.currentScript,
    sections: input.currentScript.sections.map((section) =>
      replacementById.get(section.id) || section
    ),
    updatedAt: input.updatedAt,
  });
}

function assembleCanonicalRepairProposal(input: {
  value: unknown;
  repairInput: CreatorScriptBuildScriptRepairInput;
  currentScript: CreatorScript;
  updatedAt: string;
}) {
  const proposal = record(input.value);
  if (
    proposal?.version !== "0.19E3B-script-repair-proposal-v2" ||
    proposal.mode !== input.repairInput.mode
  ) {
    throw new CreatorScriptBuildRepairError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID",
    );
  }
  return input.repairInput.mode === "additive"
    ? assembleAdditiveProposal({ ...input, value: proposal })
    : (() => { throw new CreatorScriptBuildRepairError("INTERNAL", "CREATOR_SCRIPT_BUILD_REPAIR_SINGLE_TARGET_REQUIRED"); })();
}

type RepairOperationOutcome = Readonly<{
  script: CreatorScript | null;
  replacement: ReplacementOutcome | null;
  assembledAt: string;
}>;

function normalizeOperationResult(input: {
  value: CreatorScriptBuildJson | null;
  currentScript: CreatorScript;
  repairInput: CreatorScriptBuildScriptRepairInput;
}): RepairOperationOutcome {
  const raw = record(input.value);
  if (raw?.version !== "0.19E3B-script-repair-operation-result-v2" ||
      !equalCanonical(raw.request, input.repairInput) ||
      raw.semanticFingerprint !== createCreatorScriptBuildScriptRepairSemanticFingerprint(input.repairInput) ||
      typeof raw.assembledAt !== "string" || !Number.isFinite(Date.parse(raw.assembledAt))) {
    throw new CreatorScriptBuildRepairError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_RESULT_INVALID");
  }
  const recomputed = validateRepairResponse({
    value: raw.proposal, currentScript: input.currentScript,
    repairInput: input.repairInput, updatedAt: raw.assembledAt,
  });
  if (!equalCanonical(raw.outcome, recomputed)) {
    throw new CreatorScriptBuildRepairError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_RESULT_INVALID");
  }
  return { ...recomputed, assembledAt: raw.assembledAt };
}

function validateRepairResponse(input: {
  value: unknown;
  currentScript: CreatorScript;
  repairInput: CreatorScriptBuildScriptRepairInput;
  updatedAt: string;
}): Omit<RepairOperationOutcome, "assembledAt"> {
  const proposal = record(input.value);
  if (proposal?.version !== "0.19E3B-script-repair-proposal-v2" ||
      proposal.mode !== input.repairInput.mode) {
    throw new CreatorScriptBuildRepairError("MODEL_CONTRACT", "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID");
  }
  return input.repairInput.mode === "replacement"
    ? { script: null, replacement: assembleReplacementProposal({ ...input, value: proposal }) }
    : { script: assembleCanonicalRepairProposal(input), replacement: null };
}

function reportHardViolationCount(report: CreatorScriptAcceptanceReport) {
  return report.violations.filter((violation) => violation.severity === "hard")
    .length;
}

function createStageResult(input: {
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  attemptCount: number;
  candidateCallLimit: number;
  operationIds: readonly string[];
  initialReport: CreatorScriptAcceptanceReport;
  finalReport: CreatorScriptAcceptanceReport;
}): CreatorScriptBuildScriptRepairStageResult {
  return deepFreeze({
    version: "0.19E3B-script-repair-result-v2" as const,
    script: input.script,
    sectionPlan: [...input.sectionPlan],
    attemptCount: input.attemptCount,
    candidateAttemptCount: input.operationIds.length,
    appliedRevisionCount: input.attemptCount,
    candidateCallLimit: input.candidateCallLimit,
    operationIds: [...input.operationIds],
    reportSummary: {
      initialReportVersion: input.initialReport.version,
      finalReportVersion: input.finalReport.version,
      initialHardViolationCount: reportHardViolationCount(input.initialReport),
      finalHardViolationCount: reportHardViolationCount(input.finalReport),
      finalRepairableViolationCount:
        input.finalReport.repairableViolations.length,
      finalBlockingViolationCount: input.finalReport.blockingViolations.length,
    },
    contractVersions: {
      coordinator: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION,
      operation: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
      checkpoint: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION,
    },
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
  return {
    checkpointId: createCreatorScriptBuildCheckpointId({
      buildId: input.buildId,
      stage: "repair",
      contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION,
    }),
    stage: "repair",
    status: input.status,
    contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION,
    operationId: input.operationId,
    outputReference: input.outputReference,
    diagnostics: Object.freeze({ ...input.diagnostics }),
    startedAt: input.previous?.startedAt ||
      (input.status === "RUNNING" ? input.now() : null),
    completedAt: input.status === "COMPLETED" || input.status === "FAILED"
      ? input.now()
      : null,
  };
}

function repairFailure(input: {
  category: CreatorScriptBuildFailureCategory;
  code: string;
  retryability?: CreatorScriptBuildFailure["retryability"];
  operationId?: string | null;
  diagnostics?: Record<string, string | number | boolean | null>;
}) {
  return createCreatorScriptBuildFailure({
    category: input.category,
    code: input.code,
    stage: "repair",
    retryability: input.retryability || "NON_RETRYABLE",
    operationId: input.operationId || null,
    diagnostics: input.diagnostics || {},
  });
}

async function assertCurrentProjectAuthority(input: {
  dependencies: CreatorScriptBuildScriptRepairCoordinatorDependencies;
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
  const failure = repairFailure({
    category: "AUTHORITY",
    code: currentProjectRevision
      ? "CREATOR_SCRIPT_BUILD_PROJECT_STALE"
      : "CREATOR_SCRIPT_BUILD_PROJECT_AUTHORITY_MISSING",
  });
  const build = await input.dependencies.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: input.build.state,
    nextState: currentProjectRevision ? "STALE" : "FAILED",
    failure,
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: failure.code,
    buildId: build.buildId,
  });
}

async function ensureRepairCheckpoint(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  now: () => string;
}) {
  const existing = input.build.checkpoints.repair || null;
  if (
    existing &&
    existing.contractVersion !== CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_CONTRACT_MISMATCH");
  }
  if (existing) return input.build;
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: "REPAIRING",
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

async function markRepairRunning(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  operationId: string;
  now: () => string;
}) {
  const previous = input.build.checkpoints.repair || null;
  if (previous?.status === "RUNNING") return input.build;
  if (previous?.status !== "PENDING") {
    throw new Error("CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_NOT_PENDING");
  }
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: "REPAIRING",
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
  const previous = input.build.checkpoints.repair || null;
  let build = input.build;
  if (build.state === "REPAIRING" && previous?.status !== "FAILED" && previous?.status !== "COMPLETED") {
    build = await input.repository.saveCheckpoint({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedBuildState: "REPAIRING",
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
    expectedState: build.state,
    nextState: "FAILED",
    failure: input.failure,
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: input.failure.code,
    buildId: failed.buildId,
    operationId: input.failure.operationId,
  });
}

function evaluate(input: {
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

function loadGeneration(input: {
  build: CreatorScriptBuildRecord;
}): {
  generationInput: CreatorScriptBuildScriptGenerationInput;
  generation: CreatorScriptBuildScriptGenerationStageResult;
} {
  const authorityCheckpoint = input.build.checkpoints.authority || null;
  const generationCheckpoint = input.build.checkpoints.script_generation || null;
  if (
    !authorityCheckpoint || authorityCheckpoint.status !== "COMPLETED" ||
    !generationCheckpoint || generationCheckpoint.status !== "COMPLETED"
  ) {
    throw new CreatorScriptBuildRepairError(
      "AUTHORITY",
      "CREATOR_SCRIPT_BUILD_GENERATION_CHECKPOINT_REQUIRED",
    );
  }
  const authority = normalizeCreatorScriptBuildAuthorityResultFromCheckpoint(
    authorityCheckpoint.outputReference,
  );
  const generationInput = createCreatorScriptBuildScriptGenerationInput({
    snapshot: input.build.snapshot,
    authority,
  });
  const generation =
    normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint({
      buildId: input.build.buildId,
      value: generationCheckpoint.outputReference,
      authority: generationInput,
    });
  return { generationInput, generation };
}


async function executeRepairOperation(input: {
  dependencies: CreatorScriptBuildScriptRepairCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
  currentScript: CreatorScript;
  repairInput: CreatorScriptBuildScriptRepairInput;
  now: () => string;
  replayOnly?: boolean;
}) {
  if (!input.replayOnly) await assertCurrentProjectAuthority({
    dependencies: input.dependencies,
    build: input.build,
  });
  const semanticFingerprint =
    createCreatorScriptBuildScriptRepairSemanticFingerprint(input.repairInput);
  const identity = {
    ownerId: input.build.ownerId, buildId: input.build.buildId, stage: "repair" as const,
    operationType: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
    semanticFingerprint, contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
  };
  const operationId = createCreatorScriptBuildScriptRepairOperationId({
    buildId: input.build.buildId, repairInput: input.repairInput,
  });
  const stored = input.replayOnly
    ? await input.dependencies.repository.getOperationForOwner(operationId, input.build.buildId, input.build.ownerId)
    : null;
  if (input.replayOnly && !stored) throw new CreatorScriptBuildRepairError(
    "INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_MISSING",
  );
  const requested = input.replayOnly
    ? { operation: stored!, created: false }
    : await input.dependencies.repository.requestOperation(identity);
  const operation = requested.operation;
  if (operation.operationId !== operationId || operation.buildId !== identity.buildId ||
      operation.ownerId !== identity.ownerId || operation.stage !== identity.stage ||
      operation.operationType !== identity.operationType ||
      operation.semanticFingerprint !== semanticFingerprint || operation.contractVersion !== identity.contractVersion) {
    throw new CreatorScriptBuildRepairError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_IDENTITY_INVALID", operationId);
  }
  if (operation.state === "FAILED") {
    throw new CreatorScriptBuildRepairError(
      operation.failure?.category || "INTERNAL",
      operation.failure?.code ||
        "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_FAILED_WITHOUT_FAILURE",
      operation.operationId,
      { retryability: operation.failure?.retryability },
    );
  }
  if (
    operation.state === "OUTCOME_UNCERTAIN" ||
    (operation.state === "PENDING" && !requested.created)
  ) {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
      buildId: input.build.buildId,
      operationId: operation.operationId,
    });
  }
  if ((input.replayOnly || operation.state === "COMPLETED") && !creatorScriptBuildOperationIsReusable(operation)) {
    throw new CreatorScriptBuildRepairError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_RESULT_INVALID", operation.operationId);
  }
  if (creatorScriptBuildOperationIsReusable(operation)) {
    try {
      return {
        ...normalizeOperationResult({
          value: operation.resultReference, currentScript: input.currentScript,
          repairInput: input.repairInput,
        }),
        operationId: operation.operationId, build: input.build,
      };
    } catch {
      throw new CreatorScriptBuildRepairError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_RESULT_INVALID", operation.operationId);
    }
  }

  const build = await markRepairRunning({
    repository: input.dependencies.repository,
    build: input.build,
    operationId: operation.operationId,
    now: input.now,
  });
  await assertCurrentProjectAuthority({ dependencies: input.dependencies, build });
  let rawProposal: unknown;
  try {
    rawProposal = await input.dependencies.executeScriptRepair(input.repairInput);
  } catch (error) {
    const executionError = error instanceof CreatorScriptBuildStageExecutionError
      ? error
      : new CreatorScriptBuildStageExecutionError({
          category: "PROVIDER",
          code: "CREATOR_SCRIPT_BUILD_REPAIR_EXECUTOR_OUTCOME_UNCLASSIFIED",
          retryability: "UNKNOWN_OUTCOME",
        });
    const failure = repairFailure({
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
    throw new CreatorScriptBuildRepairError(
      executionError.category,
      executionError.code,
      operation.operationId,
      { retryability: executionError.retryability, diagnostics: { ...executionError.diagnostics } },
    );
  }
  let outcome: Omit<RepairOperationOutcome, "assembledAt">;
  const assembledAt = input.now();
  try {
    outcome = validateRepairResponse({
      value: rawProposal,
      repairInput: input.repairInput,
      currentScript: input.currentScript,
      updatedAt: assembledAt,
    });
  } catch (error) {
    const repairError = error instanceof CreatorScriptBuildRepairError
      ? error
      : new CreatorScriptBuildRepairError(
          "MODEL_CONTRACT",
          "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID",
        );
    const failure = repairFailure({
      category: repairError.category,
      code: repairError.code,
      operationId: operation.operationId,
      diagnostics: { rejectionReason: repairError.code === "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID" ? "malformed_proposal" : "authority_or_policy_failure" },
    });
    await input.dependencies.repository.transitionOperation({
      ownerId: build.ownerId,
      buildId: build.buildId,
      operationId: operation.operationId,
      expectedState: "PENDING",
      nextState: "FAILED",
      failure,
      resultReference: buildJson({ version: "0.19E3B-script-repair-invalid-proposal-v2", request: input.repairInput, proposal: rawProposal, diagnostics: failure.diagnostics }),
    });
    throw new CreatorScriptBuildRepairError(
      repairError.category,
      repairError.code,
      operation.operationId,
    );
  }
  await input.dependencies.repository.transitionOperation({
    ownerId: build.ownerId,
    buildId: build.buildId,
    operationId: operation.operationId,
    expectedState: "PENDING",
    nextState: "COMPLETED",
    resultReference: buildJson({
      version: "0.19E3B-script-repair-operation-result-v2",
      request: input.repairInput,
      semanticFingerprint,
      proposal: rawProposal,
      outcome,
      assembledAt,
    }),
  });
  return { ...outcome, assembledAt, operationId: operation.operationId, build };
}

async function runRepairRounds(input: {
  build: CreatorScriptBuildRecord;
  generation: CreatorScriptBuildScriptGenerationStageResult;
  dependencies: CreatorScriptBuildScriptRepairCoordinatorDependencies;
  now: () => string;
  replayOnly?: boolean;
}) {
  let build = input.build;
  let currentScript = input.generation.script;
  const evaluateScript = (script: CreatorScript) => evaluate({
    script, sectionPlan: input.generation.sectionPlan, snapshot: build.snapshot,
  });
  const initialReport = evaluateScript(currentScript);
  let currentReport = initialReport;
  const candidateCallLimit = Math.max(1, initialReport.repairSectionIds.length) *
    CREATOR_SCRIPT_BUILD_MAX_CANDIDATES_PER_TARGET;
  const operationIds: string[] = [];
  const ordinals = new Map<string, number>();
  let attemptCount = 0;
  for (let round = 1; round <= CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS; round += 1) {
    if (!currentReport.repairRequired || currentReport.blockingViolations.length > 0) break;
    const roundInput = createCreatorScriptBuildScriptRepairInput({
      snapshot: build.snapshot, script: currentScript,
      sectionPlan: input.generation.sectionPlan, report: currentReport, attempt: round as 1 | 2,
    });
    let assembledScript: CreatorScript;
    if (roundInput.mode === "additive") {
      if (operationIds.length >= candidateCallLimit) throw new CreatorScriptBuildRepairError(
        "SCRIPT_POLICY", "CREATOR_SCRIPT_BUILD_REPAIR_BUDGET_EXHAUSTED", operationIds.at(-1) || null,
      );
      const result = await executeRepairOperation({ ...input, build, currentScript, repairInput: roundInput });
      build = result.build;
      operationIds.push(result.operationId);
      if (!result.script) throw new CreatorScriptBuildRepairError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_RESULT_INVALID");
      assembledScript = result.script;
    } else {
      const replacements = new Map<string, CreatorScriptSection>();
      let assembledAt = currentScript.updatedAt;
      for (const target of roundInput.replacementTargets) {
        let feedback: CreatorScriptBuildCandidateValidation | null = null;
        while (!replacements.has(target.sectionId)) {
          const ordinal = (ordinals.get(target.sectionId) || 0) + 1;
          if (ordinal > CREATOR_SCRIPT_BUILD_MAX_CANDIDATES_PER_TARGET || operationIds.length >= candidateCallLimit) {
            throw new CreatorScriptBuildRepairError("SCRIPT_POLICY", "CREATOR_SCRIPT_BUILD_REPAIR_BUDGET_EXHAUSTED", operationIds.at(-1) || null,
              { diagnostics: { sectionId: target.sectionId, candidateAttemptCount: operationIds.length, candidateCallLimit, lastRejectionReason: feedback?.reason || "target_budget_exhausted" } });
          }
          const repairInput = createCreatorScriptBuildReplacementCandidateInput({
            roundInput, buildId: build.buildId, sectionId: target.sectionId, ordinal: ordinal as 1 | 2,
            rejectionFeedback: feedback,
          });
          const result = await executeRepairOperation({ ...input, build, currentScript, repairInput });
          build = result.build;
          operationIds.push(result.operationId);
          ordinals.set(target.sectionId, ordinal);
          if (!result.replacement) throw new CreatorScriptBuildRepairError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_RESULT_INVALID");
          if (Date.parse(result.assembledAt) > Date.parse(assembledAt)) assembledAt = result.assembledAt;
          feedback = result.replacement.validation;
          if (result.replacement.section) replacements.set(target.sectionId, result.replacement.section);
        }
      }
      const sections = currentScript.sections.map((section) => replacements.get(section.id) || section);
      // Validate distinctiveness across the combined replacements, not just individually.
      const distinctive = filterCreatorScriptDistinctiveRepairReplacements({
        script: currentScript, plan: [...input.generation.sectionPlan], replacements: [...replacements.values()],
      });
      if (distinctive.replacements.length !== replacements.size) throw new CreatorScriptBuildRepairError(
        "SCRIPT_POLICY", "CREATOR_SCRIPT_BUILD_REPAIR_DISTINCTIVENESS_REGRESSION", operationIds.at(-1) || null,
      );
      assembledScript = createCanonicalRepairedScript({ currentScript, sections, updatedAt: assembledAt });
    }
    const nextReport = evaluateScript(assembledScript);
    // Unsafe prose never becomes an installed repair revision.
    if (nextReport.blockingViolations.length > 0) throw new CreatorScriptBuildRepairError(
      nextReport.blockingViolations.some((v) => v.code === "GROUNDING_BLOCKED") ? "GROUNDING" : "SCRIPT_POLICY",
      "CREATOR_SCRIPT_BUILD_REPAIR_ASSEMBLED_SCRIPT_REJECTED", operationIds.at(-1) || null,
    );
    if (!input.replayOnly) await assertCurrentProjectAuthority({ dependencies: input.dependencies, build });
    const previousReport = currentReport;
    currentScript = assembledScript;
    currentReport = nextReport;
    attemptCount = round;
    if (currentReport.accepted || !currentReport.repairRequired) break;
    if (!creatorScriptBuildRepairAllowsNextAttempt({ completedAttempt: round, previous: previousReport, current: currentReport }) &&
        !creatorScriptBuildRepairAllowsCrossConstraintContinuation({
          completedAttempt: round, previous: previousReport, current: currentReport,
          script: currentScript, sectionPlan: input.generation.sectionPlan,
          compressedSectionIds: roundInput.replacementTargets.filter((t) => t.direction === "compress").map((t) => t.sectionId),
          remainingProviderCalls: candidateCallLimit - operationIds.length,
        })) break;
  }
  return { build, repair: createStageResult({
    script: currentScript, sectionPlan: input.generation.sectionPlan, attemptCount,
    candidateCallLimit, operationIds, initialReport, finalReport: currentReport,
  }) };
}

/** Read-only reconstruction also protects acceptance against tampered durable artifacts. */
export async function replayCreatorScriptBuildCompletedRepair(input: {
  build: CreatorScriptBuildRecord;
  generation: CreatorScriptBuildScriptGenerationStageResult;
  repository: CreatorScriptBuildRepository;
}): Promise<CreatorScriptBuildScriptRepairStageResult> {
  assertCoordinatorContract(input.build.snapshot);
  const checkpointValue = input.build.checkpoints.repair;
  const raw = record(checkpointValue?.outputReference);
  const result = record(raw?.result);
  if (checkpointValue?.status !== "COMPLETED" ||
      checkpointValue.checkpointId !== createCreatorScriptBuildCheckpointId({
        buildId: input.build.buildId, stage: "repair", contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION,
      }) ||
      checkpointValue.contractVersion !== CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION ||
      raw?.version !== "0.19E3B-script-repair-checkpoint-output-v2" ||
      result?.version !== "0.19E3B-script-repair-result-v2") {
    throw new CreatorScriptBuildRepairError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID");
  }
  const replay = await runRepairRounds({
    build: input.build, generation: input.generation, replayOnly: true,
    dependencies: { repository: input.repository, getCurrentProjectRevision: async () => null,
      executeScriptRepair: async () => { throw new Error("REPLAY_DISPATCH_FORBIDDEN"); } },
    now: () => { throw new Error("REPLAY_CLOCK_FORBIDDEN"); },
  });
  const expectedDiagnostics = {
    attemptCount: replay.repair.attemptCount,
    candidateAttemptCount: replay.repair.candidateAttemptCount,
    appliedRevisionCount: replay.repair.appliedRevisionCount,
    candidateCallLimit: replay.repair.candidateCallLimit,
    finalHardViolationCount: replay.repair.reportSummary.finalHardViolationCount,
    finalRepairableViolationCount: replay.repair.reportSummary.finalRepairableViolationCount,
    finalBlockingViolationCount: replay.repair.reportSummary.finalBlockingViolationCount,
  };
  if (!equalCanonical(result, replay.repair) ||
      !equalCanonical(checkpointValue.diagnostics, expectedDiagnostics) ||
      checkpointValue.operationId !== replay.repair.operationIds.at(-1)) {
    throw new CreatorScriptBuildRepairError("INPUT", "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID");
  }
  return replay.repair;
}

function assertCoordinatorContract(snapshot: CreatorScriptBuildSnapshot) {
  if (
    snapshot.contractVersions.creatorScriptBuildScriptRepairCoordinator !==
      CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CONTRACT_MISMATCH");
  }
}

export async function runCreatorScriptBuildScriptRepairCoordinator(input: {
  ownerId: string;
  buildId: string;
  dependencies: CreatorScriptBuildScriptRepairCoordinatorDependencies;
}): Promise<CreatorScriptBuildScriptRepairCoordinatorResult> {
  const now = input.dependencies.now || (() => new Date().toISOString());
  let build = await input.dependencies.repository.getForOwner(
    input.buildId,
    input.ownerId,
  );
  if (!build) throw new Error("CREATOR_SCRIPT_BUILD_NOT_FOUND");
  assertCoordinatorContract(build.snapshot);
  const buildSnapshot = build.snapshot;
  if (build.state !== "SCRIPT_GENERATED" && build.state !== "REPAIRING") {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_STATE_INVALID",
      buildId: build.buildId,
    });
  }
  await assertCurrentProjectAuthority({ dependencies: input.dependencies, build });

  let generation: CreatorScriptBuildScriptGenerationStageResult;
  try {
    generation = loadGeneration({ build }).generation;
  } catch (error) {
    const repairError = error instanceof CreatorScriptBuildRepairError
      ? error
      : new CreatorScriptBuildRepairError(
          "INPUT",
          "CREATOR_SCRIPT_BUILD_GENERATION_CHECKPOINT_INVALID",
        );
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      failure: repairFailure({
        category: repairError.category,
        code: repairError.code,
      }),
      now,
    });
  }
  const evaluateScript = (script: CreatorScript) => evaluate({
    script,
    sectionPlan: generation.sectionPlan,
    snapshot: buildSnapshot,
  });
  const initialReport = evaluateScript(generation.script);
  const existingCheckpoint = build.checkpoints.repair || null;

  if (build.state === "SCRIPT_GENERATED") {
    if (initialReport.accepted) {
      return {
        version: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION,
        build,
        repair: null,
        observedReport: initialReport,
        disposition: "NO_REPAIR_REQUIRED",
      };
    }
    if (!initialReport.repairRequired) {
      return {
        version: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION,
        build,
        repair: null,
        observedReport: initialReport,
        disposition: "NOT_REPAIRABLE",
      };
    }
    build = await input.dependencies.repository.transition({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedState: "SCRIPT_GENERATED",
      nextState: "REPAIRING",
    });
  } else if (!existingCheckpoint) {
    if (!initialReport.repairRequired) {
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        failure: repairFailure({
          category: "INTERNAL",
          code: "CREATOR_SCRIPT_BUILD_REPAIR_RESUME_STATE_INVALID",
        }),
        now,
      });
    }
  }

  build = await ensureRepairCheckpoint({
    repository: input.dependencies.repository,
    build,
    now,
  });
  const checkpointValue = build.checkpoints.repair || null;
  if (checkpointValue?.status === "COMPLETED") {
    try {
      const resumed = await replayCreatorScriptBuildCompletedRepair({
        build, generation, repository: input.dependencies.repository,
      });
      return {
        version: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION,
        build,
        repair: resumed,
        observedReport: evaluateScript(resumed.script),
        disposition: "RESUMED",
      };
    } catch (error) {
      const repairError = error instanceof CreatorScriptBuildRepairError
        ? error
        : new CreatorScriptBuildRepairError(
            "INPUT",
            "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID",
          );
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        failure: repairFailure({
          category: repairError.category,
          code: repairError.code,
        }),
        now,
      });
    }
  }
  if (checkpointValue?.status === "FAILED") {
    return await failBuild({
      repository: input.dependencies.repository,
      build,
      failure: repairFailure({
        category: typeof checkpointValue.diagnostics.failureCategory === "string"
          ? checkpointValue.diagnostics.failureCategory as CreatorScriptBuildFailureCategory
          : "INTERNAL",
        code: typeof checkpointValue.diagnostics.failureCode === "string"
          ? checkpointValue.diagnostics.failureCode
          : "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_FAILED",
        operationId: checkpointValue.operationId,
      }),
      now,
    });
  }

  let repair: CreatorScriptBuildScriptRepairStageResult;
  try {
    const result = await runRepairRounds({ build, generation, dependencies: input.dependencies, now });
    build = result.build;
    repair = result.repair;
  } catch (error) {
    if (error instanceof CreatorScriptBuildCoordinatorBlockedError) throw error;
    const repairError = error instanceof CreatorScriptBuildRepairError
      ? error : new CreatorScriptBuildRepairError("INTERNAL", "CREATOR_SCRIPT_BUILD_REPAIR_INTERNAL");
    // Reload: candidate operation/checkpoint writes may have advanced since entry.
    build = await input.dependencies.repository.getForOwner(build.buildId, build.ownerId) || build;
    return await failBuild({ repository: input.dependencies.repository, build, now,
      failure: repairFailure({ category: repairError.category, code: repairError.code,
        operationId: repairError.operationId, retryability: repairError.retryability, diagnostics: repairError.diagnostics }) });
  }
  const currentReport = evaluateScript(repair.script);
  await assertCurrentProjectAuthority({ dependencies: input.dependencies, build });
  const operationIds = repair.operationIds;
  const attemptCount = repair.attemptCount;
  const previous = build.checkpoints.repair || null;
  build = await input.dependencies.repository.saveCheckpoint({
    ownerId: build.ownerId,
    buildId: build.buildId,
    expectedBuildState: "REPAIRING",
    checkpoint: checkpoint({
      buildId: build.buildId,
      status: "COMPLETED",
      operationId: operationIds.at(-1) || null,
      outputReference: buildJson({
        version: "0.19E3B-script-repair-checkpoint-output-v2",
        result: repair,
      }),
      diagnostics: {
        attemptCount,
        candidateAttemptCount: repair.candidateAttemptCount,
        appliedRevisionCount: repair.appliedRevisionCount,
        candidateCallLimit: repair.candidateCallLimit,
        finalHardViolationCount: reportHardViolationCount(currentReport),
        finalRepairableViolationCount: currentReport.repairableViolations.length,
        finalBlockingViolationCount: currentReport.blockingViolations.length,
      },
      previous,
      now,
    }),
  });
  return {
    version: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION,
    build,
    repair,
    observedReport: currentReport,
    disposition: "REPAIR_PHASE_COMPLETED",
  };
}
