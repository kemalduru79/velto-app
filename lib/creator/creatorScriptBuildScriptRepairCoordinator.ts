import { createHash } from "node:crypto";
import {
  applyCreatorScriptAdditiveExpansion,
  countCreatorScriptWords,
  createCreatorScriptNarrationAuthority,
  createCreatorScriptRepairTargets,
  filterCreatorScriptDistinctiveRepairReplacements,
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
  "0.19E3B" as const;
export const CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION =
  "creator-script-build-script-repair-checkpoint-v1" as const;
export const CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION =
  "creator-script-build-script-repair-operation-v1" as const;
export const CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE =
  "creator_script_build_script_repair" as const;
export const CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS = 2 as const;

const SCRIPT_REPAIR_SEMANTIC_FINGERPRINT_VERSION =
  "creator-script-build-script-repair-semantic-v1" as const;

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
  version: "0.19E3B-script-repair-request-v1";
  attempt: 1 | 2;
  mode: "additive" | "replacement";
  currentScriptAuthority: CreatorScriptBuildSemanticScriptAuthority;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  repairSectionIds: readonly string[];
  repairStrategies: readonly CreatorScriptRepairStrategy[];
  repairableViolations: readonly CreatorScriptBuildRepairViolationDirective[];
  replacementTargets: readonly CreatorScriptBuildReplacementTarget[];
  expansionTargets: readonly CreatorScriptExpansionTarget[];
  permittedClaimIds: readonly string[];
  creatorAuthority: Readonly<{
    topic: string;
    title: string;
    approvedStrategy: CreatorScriptBuildSnapshot["strategy"]["approvedStrategy"];
  }>;
}>;

export type CreatorScriptBuildScriptRepairStageResult = Readonly<{
  version: "0.19E3B-script-repair-result-v1";
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  attemptCount: number;
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

  constructor(
    category: CreatorScriptBuildFailureCategory,
    code: string,
    operationId: string | null = null,
  ) {
    super(code);
    this.name = "CreatorScriptBuildRepairError";
    this.category = category;
    this.code = code;
    this.operationId = operationId;
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
  const comparable = (value: unknown) => JSON.parse(JSON.stringify(value));
  return canonicalCreatorScriptBuildJson(comparable(left)) ===
    canonicalCreatorScriptBuildJson(comparable(right));
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
    ? createCreatorScriptRepairTargets({
        sections: repairSectionIds.map((sectionId) => {
          const diagnostic = sectionDiagnostics.get(sectionId);
          if (!diagnostic) {
            throw new Error(
              `CREATOR_SCRIPT_BUILD_REPAIR_TARGET_MISSING:${sectionId}`,
            );
          }
          return diagnostic;
        }),
        direction,
      }).map((target) => ({
        ...target,
        strategy: input.report.repairableViolations.find((violation) =>
          violation.sectionId === target.sectionId
        )?.repairStrategy || input.report.repairableViolations[0].repairStrategy,
      }))
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
  return deepFreeze({
    version: "0.19E3B-script-repair-request-v1" as const,
    attempt: input.attempt,
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
    permittedClaimIds: input.script.grounding.context.claims
      .map((claim) => claim.claimId)
      .toSorted(),
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

function assembleReplacementProposal(input: {
  value: Record<string, unknown>;
  repairInput: CreatorScriptBuildScriptRepairInput;
  currentScript: CreatorScript;
  updatedAt: string;
}) {
  const proposals = Array.isArray(input.value.sections) ? input.value.sections : [];
  if (proposals.length !== input.repairInput.replacementTargets.length) {
    throw new CreatorScriptBuildRepairError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID",
    );
  }
  const currentById = new Map(
    input.currentScript.sections.map((section) => [section.id, section]),
  );
  const allowedClaimIds = new Set(input.repairInput.permittedClaimIds);
  const replacements = input.repairInput.replacementTargets.map((target, index) => {
    const currentSection = currentById.get(target.sectionId);
    if (!currentSection) {
      throw new CreatorScriptBuildRepairError(
        "SCRIPT_POLICY",
        "CREATOR_SCRIPT_BUILD_REPAIR_TARGET_INVALID",
      );
    }
    return sectionFromReplacementProposal({
      currentSection,
      value: proposals[index],
      allowedClaimIds,
    });
  });
  const replacementDiagnostics = getCreatorScriptRepairReplacementDiagnostics({
    script: input.currentScript,
    plan: [...input.repairInput.sectionPlan],
    replacements,
  });
  if (
    replacementDiagnostics.length !== replacements.length ||
    replacementDiagnostics.some((diagnostic) => !diagnostic.accepted)
  ) {
    throw new CreatorScriptBuildRepairError(
      "SCRIPT_POLICY",
      "CREATOR_SCRIPT_BUILD_REPAIR_WRONG_DIRECTION",
    );
  }
  const distinctive = filterCreatorScriptDistinctiveRepairReplacements({
    script: input.currentScript,
    replacements,
    plan: [...input.repairInput.sectionPlan],
  });
  if (distinctive.replacements.length !== replacements.length) {
    throw new CreatorScriptBuildRepairError(
      "SCRIPT_POLICY",
      "CREATOR_SCRIPT_BUILD_REPAIR_DISTINCTIVENESS_REGRESSION",
    );
  }
  const replacementById = new Map(
    replacements.map((section) => [section.id, section]),
  );
  return createCanonicalRepairedScript({
    currentScript: input.currentScript,
    sections: input.currentScript.sections.map((section) =>
      replacementById.get(section.id) || section
    ),
    updatedAt: input.updatedAt,
  });
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
  const allowedClaimIds = new Set(input.repairInput.permittedClaimIds);
  const validatedCandidates = input.repairInput.expansionTargets.map(
    (target, index) => {
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
      return {
        sectionId: target.sectionId,
        gainWords: countCreatorScriptWords(replacement.text) - target.currentWords,
        value: replacement,
      };
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
      "INTERNAL",
      "CREATOR_SCRIPT_BUILD_REPAIR_SELECTION_EMPTY",
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
    proposal?.version !== "0.19E3B-script-repair-proposal-v1" ||
    proposal.mode !== input.repairInput.mode
  ) {
    throw new CreatorScriptBuildRepairError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID",
    );
  }
  return input.repairInput.mode === "additive"
    ? assembleAdditiveProposal({ ...input, value: proposal })
    : assembleReplacementProposal({ ...input, value: proposal });
}

function normalizeCanonicalRepairScript(input: {
  value: unknown;
  currentScript: CreatorScript;
  repairInput: CreatorScriptBuildScriptRepairInput;
}) {
  let script: CreatorScript;
  try {
    script = normalizeCreatorScript(input.value);
  } catch {
    throw new CreatorScriptBuildRepairError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_RESULT_INVALID",
    );
  }
  if (
    script.title !== input.currentScript.title ||
    script.targetDurationSec !== input.currentScript.targetDurationSec ||
    script.strategyFingerprint !== input.currentScript.strategyFingerprint ||
    script.generatedAt !== input.currentScript.generatedAt ||
    script.revision !== input.currentScript.revision + 1 ||
    script.approval !== null ||
    !equalCanonical(script.grounding.context, input.currentScript.grounding.context) ||
    script.sections.length !== input.repairInput.sectionPlan.length
  ) {
    throw new CreatorScriptBuildRepairError(
      "SCRIPT_POLICY",
      "CREATOR_SCRIPT_BUILD_REPAIR_AUTHORITY_MISMATCH",
    );
  }
  const targetIds = new Set(input.repairInput.repairSectionIds);
  const allowedClaimIds = new Set(input.repairInput.permittedClaimIds);
  for (const [index, section] of script.sections.entries()) {
    const expected = input.repairInput.sectionPlan[index];
    const previous = input.currentScript.sections[index];
    if (
      section.id !== expected?.id ||
      section.kind !== expected.kind ||
      section.humanVerification != null ||
      section.evidenceReviewRequired ||
      section.claimIds.some((claimId) => !allowedClaimIds.has(claimId))
    ) {
      throw new CreatorScriptBuildRepairError(
        "SCRIPT_POLICY",
        "CREATOR_SCRIPT_BUILD_REPAIR_AUTHORITY_MISMATCH",
      );
    }
    if (!targetIds.has(section.id) && !equalCanonical(section, previous)) {
      throw new CreatorScriptBuildRepairError(
        "SCRIPT_POLICY",
        "CREATOR_SCRIPT_BUILD_REPAIR_UNTARGETED_MUTATION",
      );
    }
  }
  return script;
}

function normalizeOperationResult(input: {
  value: CreatorScriptBuildJson | null;
  currentScript: CreatorScript;
  repairInput: CreatorScriptBuildScriptRepairInput;
}) {
  const raw = record(input.value);
  if (
    raw?.version !== "0.19E3B-script-repair-operation-result-v1" ||
    Number(raw.attempt) !== input.repairInput.attempt
  ) {
    throw new CreatorScriptBuildRepairError(
      "MODEL_CONTRACT",
      "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_RESULT_INVALID",
    );
  }
  return normalizeCanonicalRepairScript({
    value: raw.script,
    currentScript: input.currentScript,
    repairInput: input.repairInput,
  });
}

function reportHardViolationCount(report: CreatorScriptAcceptanceReport) {
  return report.violations.filter((violation) => violation.severity === "hard")
    .length;
}

function createStageResult(input: {
  script: CreatorScript;
  sectionPlan: readonly CreatorScriptSectionBudget[];
  attemptCount: number;
  operationIds: readonly string[];
  initialReport: CreatorScriptAcceptanceReport;
  finalReport: CreatorScriptAcceptanceReport;
}): CreatorScriptBuildScriptRepairStageResult {
  return deepFreeze({
    version: "0.19E3B-script-repair-result-v1" as const,
    script: input.script,
    sectionPlan: [...input.sectionPlan],
    attemptCount: input.attemptCount,
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
  if (build.state === "REPAIRING" && previous?.status !== "FAILED") {
    if (previous?.status === "COMPLETED") {
      throw new Error("CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_ALREADY_COMPLETED");
    }
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

function normalizeCompletedRepairCheckpoint(input: {
  value: CreatorScriptBuildJson | null;
  generation: CreatorScriptBuildScriptGenerationStageResult;
  initialReport: CreatorScriptAcceptanceReport;
  evaluate: (script: CreatorScript) => CreatorScriptAcceptanceReport;
}) {
  const raw = record(input.value);
  const result = record(raw?.result);
  if (
    raw?.version !== "0.19E3B-script-repair-checkpoint-output-v1" ||
    result?.version !== "0.19E3B-script-repair-result-v1" ||
    !equalCanonical(result.sectionPlan, input.generation.sectionPlan)
  ) {
    throw new CreatorScriptBuildRepairError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID",
    );
  }
  const attemptCount = Number(result.attemptCount);
  const operationIds = Array.isArray(result.operationIds)
    ? result.operationIds.map((value) => clean(value, 300))
    : [];
  if (
    !Number.isInteger(attemptCount) || attemptCount < 1 ||
    attemptCount > CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS ||
    operationIds.length !== attemptCount || operationIds.some((value) => !value)
  ) {
    throw new CreatorScriptBuildRepairError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID",
    );
  }
  let script: CreatorScript;
  try {
    script = normalizeCreatorScript(result.script);
  } catch {
    throw new CreatorScriptBuildRepairError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID",
    );
  }
  if (
    script.revision !== input.generation.script.revision + attemptCount ||
    script.title !== input.generation.script.title ||
    script.targetDurationSec !== input.generation.script.targetDurationSec ||
    script.strategyFingerprint !== input.generation.script.strategyFingerprint ||
    script.generatedAt !== input.generation.script.generatedAt ||
    script.approval !== null ||
    !equalCanonical(
      script.grounding.context,
      input.generation.script.grounding.context,
    ) ||
    script.sections.length !== input.generation.sectionPlan.length ||
    script.sections.some((section, index) =>
      section.id !== input.generation.sectionPlan[index]?.id ||
      section.kind !== input.generation.sectionPlan[index]?.kind ||
      section.humanVerification != null
    )
  ) {
    throw new CreatorScriptBuildRepairError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID",
    );
  }
  const finalReport = input.evaluate(script);
  const normalized = createStageResult({
    script,
    sectionPlan: input.generation.sectionPlan,
    attemptCount,
    operationIds,
    initialReport: input.initialReport,
    finalReport,
  });
  if (!equalCanonical(result, normalized)) {
    throw new CreatorScriptBuildRepairError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID",
    );
  }
  return { repair: normalized, observedReport: finalReport };
}

async function executeRepairOperation(input: {
  dependencies: CreatorScriptBuildScriptRepairCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
  currentScript: CreatorScript;
  repairInput: CreatorScriptBuildScriptRepairInput;
  now: () => string;
}) {
  await assertCurrentProjectAuthority({
    dependencies: input.dependencies,
    build: input.build,
  });
  const semanticFingerprint =
    createCreatorScriptBuildScriptRepairSemanticFingerprint(input.repairInput);
  const requested = await input.dependencies.repository.requestOperation({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    stage: "repair",
    operationType: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
    semanticFingerprint,
    contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
  });
  const operation = requested.operation;
  if (operation.state === "FAILED") {
    throw new CreatorScriptBuildRepairError(
      operation.failure?.category || "INTERNAL",
      operation.failure?.code ||
        "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_FAILED_WITHOUT_FAILURE",
      operation.operationId,
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
  if (creatorScriptBuildOperationIsReusable(operation)) {
    return {
      script: normalizeOperationResult({
        value: operation.resultReference,
        currentScript: input.currentScript,
        repairInput: input.repairInput,
      }),
      operationId: operation.operationId,
      build: input.build,
    };
  }

  const build = await markRepairRunning({
    repository: input.dependencies.repository,
    build: input.build,
    operationId: operation.operationId,
    now: input.now,
  });
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
    );
  }
  let script: CreatorScript;
  try {
    script = assembleCanonicalRepairProposal({
      value: rawProposal,
      repairInput: input.repairInput,
      currentScript: input.currentScript,
      updatedAt: input.now(),
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
    });
    await input.dependencies.repository.transitionOperation({
      ownerId: build.ownerId,
      buildId: build.buildId,
      operationId: operation.operationId,
      expectedState: "PENDING",
      nextState: "FAILED",
      failure,
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
      version: "0.19E3B-script-repair-operation-result-v1",
      attempt: input.repairInput.attempt,
      script,
    }),
  });
  return { script, operationId: operation.operationId, build };
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
      const resumed = normalizeCompletedRepairCheckpoint({
        value: checkpointValue.outputReference,
        generation,
        initialReport,
        evaluate: evaluateScript,
      });
      return {
        version: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_COORDINATOR_VERSION,
        build,
        repair: resumed.repair,
        observedReport: resumed.observedReport,
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

  let currentScript = generation.script;
  let currentReport = initialReport;
  const operationIds: string[] = [];
  let attemptCount = 0;
  for (
    let attempt = 1;
    attempt <= CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS;
    attempt += 1
  ) {
    if (!currentReport.repairRequired || currentReport.blockingViolations.length > 0) {
      break;
    }
    let repairInput: CreatorScriptBuildScriptRepairInput;
    try {
      repairInput = createCreatorScriptBuildScriptRepairInput({
        snapshot: build.snapshot,
        script: currentScript,
        sectionPlan: generation.sectionPlan,
        report: currentReport,
        attempt: attempt as 1 | 2,
      });
    } catch {
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        failure: repairFailure({
          category: "SCRIPT_POLICY",
          code: "CREATOR_SCRIPT_BUILD_REPAIR_TARGETS_INVALID",
        }),
        now,
      });
    }
    try {
      const operationResult = await executeRepairOperation({
        dependencies: input.dependencies,
        build,
        currentScript,
        repairInput,
        now,
      });
      build = operationResult.build;
      currentScript = operationResult.script;
      operationIds.push(operationResult.operationId);
      attemptCount = attempt;
    } catch (error) {
      if (error instanceof CreatorScriptBuildCoordinatorBlockedError) throw error;
      const repairError = error instanceof CreatorScriptBuildRepairError
        ? error
        : new CreatorScriptBuildRepairError(
            "INTERNAL",
            "CREATOR_SCRIPT_BUILD_REPAIR_INTERNAL",
          );
      return await failBuild({
        repository: input.dependencies.repository,
        build,
        failure: repairFailure({
          category: repairError.category,
          code: repairError.code,
          operationId: repairError.operationId || operationIds.at(-1) || null,
        }),
        now,
      });
    }
    const previousReport = currentReport;
    currentReport = evaluateScript(currentScript);
    if (currentReport.accepted || !currentReport.repairRequired) break;
    if (!creatorScriptBuildRepairAllowsNextAttempt({
      completedAttempt: attempt,
      previous: previousReport,
      current: currentReport,
    })) break;
  }

  const repair = createStageResult({
    script: currentScript,
    sectionPlan: generation.sectionPlan,
    attemptCount,
    operationIds,
    initialReport,
    finalReport: currentReport,
  });
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
        version: "0.19E3B-script-repair-checkpoint-output-v1",
        result: repair,
      }),
      diagnostics: {
        attemptCount,
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
