import {
  createCreatorScriptAdditiveExpansionPlan,
  creatorScriptHasGroundingBlocker,
  getCreatorScriptDurationContractForScript,
  getCreatorScriptDurationRepairSections,
  getCreatorScriptEditorialDistinctivenessDiagnostics,
  getCreatorScriptNarrationSafetyViolations,
  getCreatorScriptSectionDiagnostics,
  isCreatorScriptResidualRepairEligible,
  type CreatorScript,
  type CreatorScriptDurationContract,
  type CreatorScriptNarrationSafetyViolation,
  type CreatorScriptSectionBudget,
  type CreatorScriptSectionDiagnostic,
} from "./creatorScript.ts";

export const CREATOR_SCRIPT_ACCEPTANCE_VERSION = "0.19D" as const;

export type CreatorScriptViolationCode =
  | "GLOBAL_DURATION_TOO_SHORT"
  | "GLOBAL_DURATION_TOO_LONG"
  | "SECTION_MISSING"
  | "SECTION_EMPTY"
  | "SECTION_OVER_MAX"
  | "SECTION_SOFT_UNDER_MIN"
  | "EDITORIAL_DISTINCTIVENESS"
  | "GROUNDING_BLOCKED"
  | "NARRATION_SAFETY";

export type CreatorScriptRepairStrategy =
  | "expand"
  | "compress"
  | "rebalance"
  | "differentiate"
  | "none";

type CreatorScriptViolationDiagnosticValue = string | number | boolean | null;

export type CreatorScriptViolation = {
  code: CreatorScriptViolationCode;
  severity: "hard" | "soft";
  repairable: boolean;
  sectionId: string | null;
  repairStrategy: CreatorScriptRepairStrategy;
  diagnostics: Record<string, CreatorScriptViolationDiagnosticValue>;
};

export type CreatorScriptAcceptanceReport = {
  version: typeof CREATOR_SCRIPT_ACCEPTANCE_VERSION;
  accepted: boolean;
  repairRequired: boolean;
  violations: CreatorScriptViolation[];
  repairableViolations: CreatorScriptViolation[];
  blockingViolations: CreatorScriptViolation[];
  repairSectionIds: string[];
  duration: CreatorScriptDurationContract;
  sections: CreatorScriptSectionDiagnostic[];
};

export type CreatorScriptAcceptanceFailureCategory =
  | "SCRIPT_POLICY"
  | "GROUNDING";

export type CreatorScriptAcceptanceFailure = {
  category: CreatorScriptAcceptanceFailureCategory;
  code:
    | "CREATOR_SCRIPT_DURATION_UNSATISFIED"
    | "CREATOR_SCRIPT_SECTION_BUDGET_UNSATISFIED"
    | "CREATOR_SCRIPT_EDITORIAL_DISTINCTIVENESS_UNSATISFIED"
    | "CREATOR_SCRIPT_GROUNDING_BLOCKED"
    | "CREATOR_SCRIPT_NARRATION_EDITORIAL_LEAKAGE"
    | "CREATOR_SCRIPT_NARRATION_UNSUPPORTED_NAMED_AUTHORITY";
  message: string;
};

function narrationDiagnostic(
  violation: CreatorScriptNarrationSafetyViolation,
): CreatorScriptViolation["diagnostics"] {
  return {
    category: violation.category,
    marker: violation.marker.slice(0, 120),
    matchStart: violation.matchStart ?? null,
    matchEnd: violation.matchEnd ?? null,
  };
}

function sectionPlanMatches(script: CreatorScript, plan: CreatorScriptSectionBudget[]) {
  return script.sections.length === plan.length
    && script.sections.every((section, index) =>
      section.id === plan[index]?.id && section.kind === plan[index]?.kind
    );
}

export function evaluateCreatorScriptAcceptance(input: {
  script: CreatorScript;
  sectionPlan: CreatorScriptSectionBudget[];
  language: "tr" | "en";
  narrationAuthority: string;
}): CreatorScriptAcceptanceReport {
  const { script, sectionPlan } = input;
  const duration = getCreatorScriptDurationContractForScript(script, input.language);
  const sections = getCreatorScriptSectionDiagnostics(script, sectionPlan);
  const violations: CreatorScriptViolation[] = [];
  const sectionById = new Map(script.sections.map((section) => [section.id, section]));
  const durationRepairSections = duration.status === "compliant"
    ? []
    : getCreatorScriptDurationRepairSections({ script, plan: sectionPlan, duration });
  const residualRepairEligible = duration.status === "compliant"
    ? false
    : isCreatorScriptResidualRepairEligible(duration);
  const globalDurationRepairable = residualRepairEligible
    && durationRepairSections.length > 0;

  if (script.sections.length !== sectionPlan.length) {
    violations.push({
      code: "SECTION_MISSING",
      severity: "hard",
      repairable: false,
      sectionId: null,
      repairStrategy: "none",
      diagnostics: {
        reason: "section_count_mismatch",
        expectedSectionCount: sectionPlan.length,
        actualSectionCount: script.sections.length,
      },
    });
  }

  if (duration.status !== "compliant") {
    const tooShort = duration.status === "too_short";
    violations.push({
      code: tooShort ? "GLOBAL_DURATION_TOO_SHORT" : "GLOBAL_DURATION_TOO_LONG",
      severity: "hard",
      repairable: globalDurationRepairable,
      sectionId: null,
      repairStrategy: globalDurationRepairable
        ? tooShort ? "expand" : "compress"
        : "none",
      diagnostics: {
        actualWords: duration.actualWordCount,
        minimumWords: duration.minimumAcceptableWordCount,
        maximumWords: duration.maximumAcceptableWordCount,
        distanceWords: tooShort
          ? duration.minimumAcceptableWordCount - duration.actualWordCount
          : duration.actualWordCount - duration.maximumAcceptableWordCount,
      },
    });
  }

  for (const [sectionIndex, section] of sections.entries()) {
    const currentSection = sectionById.get(section.id);
    if (!currentSection) {
      violations.push({
        code: "SECTION_MISSING",
        severity: "hard",
        repairable: false,
        sectionId: section.id,
        repairStrategy: "none",
        diagnostics: { expectedKind: section.kind, expectedIndex: sectionIndex },
      });
      continue;
    }
    const positionedSection = script.sections[sectionIndex];
    if (
      positionedSection?.id !== section.id
      || positionedSection?.kind !== section.kind
    ) {
      violations.push({
        code: "SECTION_MISSING",
        severity: "hard",
        repairable: false,
        sectionId: section.id,
        repairStrategy: "none",
        diagnostics: {
          expectedKind: section.kind,
          expectedIndex: sectionIndex,
          reason: "section_order_or_kind_mismatch",
        },
      });
    }
    if (section.actualWords === 0 || !currentSection.text.trim()) {
      violations.push({
        code: "SECTION_EMPTY",
        severity: "hard",
        repairable: false,
        sectionId: section.id,
        repairStrategy: "none",
        diagnostics: { actualWords: section.actualWords },
      });
      continue;
    }
    if (section.excessWords > 0) {
      violations.push({
        code: "SECTION_OVER_MAX",
        severity: "hard",
        repairable: true,
        sectionId: section.id,
        repairStrategy: "compress",
        diagnostics: {
          actualWords: section.actualWords,
          maximumWords: section.maximumWords,
          excessWords: section.excessWords,
        },
      });
    }
    if (section.deficitWords > 0) {
      violations.push({
        code: "SECTION_SOFT_UNDER_MIN",
        severity: "soft",
        repairable: false,
        sectionId: section.id,
        repairStrategy: "none",
        diagnostics: {
          actualWords: section.actualWords,
          minimumWords: section.minimumWords,
          deficitWords: section.deficitWords,
        },
      });
    }
  }

  if (sectionPlanMatches(script, sectionPlan)) {
    for (const failure of getCreatorScriptEditorialDistinctivenessDiagnostics(
      script,
      sectionPlan,
    )) {
      violations.push({
        code: "EDITORIAL_DISTINCTIVENESS",
        severity: "hard",
        repairable: true,
        sectionId: failure.sectionId,
        repairStrategy: "differentiate",
        diagnostics: {
          failureType: failure.failureType,
          comparedSectionId: failure.comparedSectionId ?? null,
          meaningfulHeadingTokenCount: failure.meaningfulHeadingTokenCount,
          overlapRatio: failure.overlapRatio ?? null,
        },
      });
    }
  }

  if (creatorScriptHasGroundingBlocker(script)) {
    const blockedSections = script.sections
      .filter((section) => section.evidenceReviewRequired)
      .map((section) => section.id);
    if (script.grounding.context.readiness.status === "blocked") {
      violations.push({
        code: "GROUNDING_BLOCKED",
        severity: "hard",
        repairable: false,
        sectionId: null,
        repairStrategy: "none",
        diagnostics: { reason: "editorial_context_blocked" },
      });
    }
    for (const sectionId of blockedSections) {
      violations.push({
        code: "GROUNDING_BLOCKED",
        severity: "hard",
        repairable: false,
        sectionId,
        repairStrategy: "none",
        diagnostics: { reason: "section_evidence_review_required" },
      });
    }
  }

  for (const violation of getCreatorScriptNarrationSafetyViolations({
    sections: script.sections,
    authoritativeText: input.narrationAuthority,
  })) {
    violations.push({
      code: "NARRATION_SAFETY",
      severity: "hard",
      repairable: false,
      sectionId: violation.sectionId,
      repairStrategy: "none",
      diagnostics: narrationDiagnostic(violation),
    });
  }

  const hardViolations = violations.filter((violation) => violation.severity === "hard");
  const repairableViolations = hardViolations.filter((violation) => violation.repairable);
  const blockingViolations = hardViolations.filter((violation) => !violation.repairable);
  const targetIds = new Set<string>();
  for (const violation of repairableViolations) {
    if (violation.sectionId) targetIds.add(violation.sectionId);
  }
  if (duration.status !== "compliant" && globalDurationRepairable) {
    for (const section of durationRepairSections) targetIds.add(section.id);
  }
  const repairSectionIds = sectionPlan
    .map((section) => section.id)
    .filter((sectionId) => targetIds.has(sectionId));
  const accepted = hardViolations.length === 0;
  return {
    version: CREATOR_SCRIPT_ACCEPTANCE_VERSION,
    accepted,
    repairRequired: !accepted
      && blockingViolations.length === 0
      && repairableViolations.length > 0
      && repairSectionIds.length > 0,
    violations,
    repairableViolations,
    blockingViolations,
    repairSectionIds,
    duration,
    sections,
  };
}

function violationIdentity(violation: CreatorScriptViolation) {
  return `${violation.code}:${violation.sectionId ?? "global"}`;
}

function measurableViolationDistance(violation: CreatorScriptViolation) {
  if (violation.code === "GLOBAL_DURATION_TOO_SHORT" || violation.code === "GLOBAL_DURATION_TOO_LONG") {
    return Number(violation.diagnostics.distanceWords) || 0;
  }
  if (violation.code === "SECTION_OVER_MAX") {
    return Number(violation.diagnostics.excessWords) || 0;
  }
  if (violation.code === "EDITORIAL_DISTINCTIVENESS") {
    return Number(violation.diagnostics.overlapRatio) || 1;
  }
  return 1;
}

export function creatorScriptAcceptanceMateriallyImproved(input: {
  previous: CreatorScriptAcceptanceReport;
  current: CreatorScriptAcceptanceReport;
}) {
  if (input.current.accepted || !input.current.repairRequired) return false;
  const previousHard = input.previous.violations.filter((violation) => violation.severity === "hard");
  const currentHard = input.current.violations.filter((violation) => violation.severity === "hard");
  const previousIds = new Set(previousHard.map(violationIdentity));
  if (currentHard.some((violation) => !previousIds.has(violationIdentity(violation)))) return false;
  if (currentHard.length < previousHard.length) return true;
  const previousDistance = previousHard.reduce(
    (sum, violation) => sum + measurableViolationDistance(violation),
    0,
  );
  const currentDistance = currentHard.reduce(
    (sum, violation) => sum + measurableViolationDistance(violation),
    0,
  );
  return currentDistance < previousDistance;
}

export function getCreatorScriptAcceptanceFailure(
  report: CreatorScriptAcceptanceReport,
): CreatorScriptAcceptanceFailure {
  if (report.accepted) {
    throw new Error("CREATOR_SCRIPT_ACCEPTANCE_INTERNAL_CONTRADICTION");
  }
  if (report.violations.some((violation) => violation.code === "GROUNDING_BLOCKED")) {
    return {
      category: "GROUNDING",
      code: "CREATOR_SCRIPT_GROUNDING_BLOCKED",
      message: "The generated script did not satisfy its grounding authority.",
    };
  }
  const narration = report.violations.find((violation) => violation.code === "NARRATION_SAFETY");
  if (narration) {
    return {
      category: "SCRIPT_POLICY",
      code: narration.diagnostics.category === "internal_editorial_leakage"
        ? "CREATOR_SCRIPT_NARRATION_EDITORIAL_LEAKAGE"
        : "CREATOR_SCRIPT_NARRATION_UNSUPPORTED_NAMED_AUTHORITY",
      message: "The generated script did not satisfy production-safe narration policy.",
    };
  }
  if (report.violations.some((violation) =>
    violation.code === "GLOBAL_DURATION_TOO_SHORT"
    || violation.code === "GLOBAL_DURATION_TOO_LONG"
  )) {
    return {
      category: "SCRIPT_POLICY",
      code: "CREATOR_SCRIPT_DURATION_UNSATISFIED",
      message: "The generated script could not safely satisfy the requested duration.",
    };
  }
  if (report.violations.some((violation) => violation.code === "EDITORIAL_DISTINCTIVENESS")) {
    return {
      category: "SCRIPT_POLICY",
      code: "CREATOR_SCRIPT_EDITORIAL_DISTINCTIVENESS_UNSATISFIED",
      message: "The generated script did not satisfy editorial distinctiveness policy.",
    };
  }
  return {
    category: "SCRIPT_POLICY",
    code: "CREATOR_SCRIPT_SECTION_BUDGET_UNSATISFIED",
    message: "The generated script did not satisfy section safety policy.",
  };
}

export function getCreatorScriptAcceptanceExpansionTargets(input: {
  script: CreatorScript;
  report: CreatorScriptAcceptanceReport;
  sectionPlan: CreatorScriptSectionBudget[];
}) {
  if (!input.report.violations.some((violation) =>
    violation.code === "GLOBAL_DURATION_TOO_SHORT" && violation.repairable
  )) return [];
  const globalDeficitWords = Math.max(
    0,
    input.report.duration.minimumAcceptableWordCount - input.report.duration.actualWordCount,
  );
  return createCreatorScriptAdditiveExpansionPlan({
    script: input.script,
    plan: input.sectionPlan,
    globalDeficitWords,
  });
}
