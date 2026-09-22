import {
  normalizeScriptPlannerEditorialContext,
  type ScriptPlannerEditorialContext,
} from "../research/scriptPlannerEditorialContext.ts";

export const CREATOR_SCRIPT_VERSION = 1 as const;

export type CreatorScriptSectionKind = "opening" | "body" | "conclusion";

export type CreatorScriptSection = {
  id: string;
  kind: CreatorScriptSectionKind;
  heading?: string;
  text: string;
  claimIds: string[];
  evidenceReviewRequired: boolean;
  humanVerification?: { scriptRevision: number; verifiedAt: string };
};

export type CreatorScriptGrounding = {
  context: ScriptPlannerEditorialContext;
};

export type CreatorScriptApproval = {
  approvedRevision: number;
  approvedStrategyFingerprint: string;
  approvedAt: string;
};

export type CreatorScript = {
  version: typeof CREATOR_SCRIPT_VERSION;
  title: string;
  sections: CreatorScriptSection[];
  targetDurationSec: number;
  strategyFingerprint: string;
  revision: number;
  grounding: CreatorScriptGrounding;
  generatedAt: string;
  updatedAt: string;
  approval: CreatorScriptApproval | null;
};

export type CreatorScriptStatus = "draft" | "approved" | "stale";
export type CreatorScriptDurationStatus = "compliant" | "too_short" | "too_long";

export const CREATOR_SCRIPT_MIN_DURATION_RATIO = 0.9;
export const CREATOR_SCRIPT_MAX_DURATION_RATIO = 1.1;

export type CreatorScriptDurationContract = {
  targetDurationSec: number;
  wordsPerSecond: number;
  targetWordCount: number;
  minimumAcceptableWordCount: number;
  maximumAcceptableWordCount: number;
  actualWordCount: number;
  estimatedDurationSec: number;
  varianceSec: number;
  durationRatio: number;
  status: CreatorScriptDurationStatus;
};

export type CreatorScriptSectionBudget = {
  id: string;
  kind: CreatorScriptSectionKind;
  role: string;
  centralQuestion: string;
  progression: string;
  minimumWords: number;
  targetWords: number;
  maximumWords: number;
};

export type CreatorScriptSectionDiagnostic = CreatorScriptSectionBudget & {
  actualWords: number;
  deficitWords: number;
  excessWords: number;
  missing: boolean;
};

export class CreatorScriptDurationUnsatisfiedError extends Error {
  code = "CREATOR_SCRIPT_DURATION_UNSATISFIED" as const;
  diagnostics: CreatorScriptDurationContract;

  constructor(diagnostics: CreatorScriptDurationContract) {
    super("The generated script could not safely satisfy the requested duration.");
    this.name = "CreatorScriptDurationUnsatisfiedError";
    this.diagnostics = diagnostics;
  }
}

export class CreatorScriptDurationInvalidError extends Error {
  code = "CREATOR_SCRIPT_DURATION_INVALID" as const;

  constructor() {
    super("A valid target duration between 5 and 3600 seconds is required.");
    this.name = "CreatorScriptDurationInvalidError";
  }
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const clean = (value: unknown, maxLength = 100_000) =>
  typeof value === "string"
    ? value.replace(/\r\n/g, "\n").trim().slice(0, maxLength)
    : "";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createCreatorStrategyFingerprint(input: Record<string, unknown>) {
  const canonical = JSON.stringify(canonicalize(input));
  return `creator-strategy-v1-${fnv1a(canonical)}-${canonical.length}`;
}

function normalizeSection(
  value: unknown,
  index: number,
  allowedClaimIds: Set<string>,
): CreatorScriptSection {
  const section = record(value);
  const id = clean(section?.id, 120);
  const kind = section?.kind;
  const text = clean(section?.text, 80_000);
  if (!section || !id || !text || !["opening", "body", "conclusion"].includes(String(kind))) {
    throw new Error(`CREATOR_SCRIPT_SECTION_INVALID:${index + 1}`);
  }
  const claimIds = Array.isArray(section.claimIds)
    ? [...new Set(section.claimIds.map((item) => clean(item, 300)).filter(Boolean))]
    : [];
  const unknownClaim = claimIds.find((claimId) => !allowedClaimIds.has(claimId));
  if (unknownClaim) throw new Error(`CREATOR_SCRIPT_CLAIM_UNKNOWN:${id}:${unknownClaim}`);
  return {
    id,
    kind: kind as CreatorScriptSectionKind,
    ...(clean(section.heading, 300) ? { heading: clean(section.heading, 300) } : {}),
    text,
    claimIds,
    evidenceReviewRequired: section.evidenceReviewRequired === true,
    ...(record(section.humanVerification) && Number(record(section.humanVerification)?.scriptRevision) > 0 && clean(record(section.humanVerification)?.verifiedAt, 100)
      ? { humanVerification: { scriptRevision: Number(record(section.humanVerification)?.scriptRevision), verifiedAt: clean(record(section.humanVerification)?.verifiedAt, 100) } }
      : {}),
  };
}

export function normalizeCreatorScript(value: unknown): CreatorScript {
  const script = record(value);
  const grounding = record(script?.grounding);
  let editorialContext: ScriptPlannerEditorialContext | null = null;
  try {
    editorialContext = normalizeScriptPlannerEditorialContext(grounding?.context);
  } catch {
    editorialContext = null;
  }
  if (!script || script.version !== CREATOR_SCRIPT_VERSION || !editorialContext) {
    throw new Error("CREATOR_SCRIPT_INVALID");
  }
  const allowedClaimIds = new Set(editorialContext.claims.map((claim) => claim.claimId));
  if (!Array.isArray(script.sections) || script.sections.length < 3 || script.sections.length > 24) {
    throw new Error("CREATOR_SCRIPT_SECTIONS_INVALID");
  }
  const claimById = new Map(editorialContext.claims.map((claim) => [claim.claimId, claim]));
  const primarySourceCoveredClaimIds = new Set(
    editorialContext.readiness.primarySourceCoveredClaimIds,
  );
  const rawSections = script.sections.map((section, index) => {
    const normalized = normalizeSection(section, index, allowedClaimIds);
    return {
      ...normalized,
      evidenceReviewRequired: normalized.evidenceReviewRequired || normalized.claimIds.some(
        (claimId) => {
          const claim = claimById.get(claimId);
          return (claim?.supportingEvidenceIds.length || 0) === 0 ||
            (claim?.claimType === "PRIMARY_SOURCE_CLAIM" &&
              !primarySourceCoveredClaimIds.has(claimId));
        },
      ),
    };
  });
  if (rawSections[0]?.kind !== "opening" || rawSections.at(-1)?.kind !== "conclusion" || rawSections.slice(1, -1).some((section) => section.kind !== "body")) {
    throw new Error("CREATOR_SCRIPT_STRUCTURE_INVALID");
  }
  if (new Set(rawSections.map((section) => section.id)).size !== rawSections.length) {
    throw new Error("CREATOR_SCRIPT_SECTION_ID_DUPLICATE");
  }
  const approval = script.approval === null ? null : record(script.approval);
  if (approval && (
    !Number.isInteger(approval.approvedRevision) || Number(approval.approvedRevision) < 1 ||
    !clean(approval.approvedStrategyFingerprint, 300) || !clean(approval.approvedAt, 100)
  )) throw new Error("CREATOR_SCRIPT_APPROVAL_INVALID");
  const targetDurationSec = Number(script.targetDurationSec);
  const revision = Number(script.revision);
  if (!clean(script.title, 500) || !Number.isFinite(targetDurationSec) || targetDurationSec <= 0 || !Number.isInteger(revision) || revision < 1 || !clean(script.strategyFingerprint, 300) || !clean(script.generatedAt, 100) || !clean(script.updatedAt, 100)) {
    throw new Error("CREATOR_SCRIPT_FIELDS_INVALID");
  }
  const sections = rawSections.map((section) => {
    const verificationValid = !section.evidenceReviewRequired && section.humanVerification?.scriptRevision === revision;
    return verificationValid ? section : { ...section, humanVerification: undefined };
  });
  return {
    version: CREATOR_SCRIPT_VERSION,
    title: clean(script.title, 500),
    sections,
    targetDurationSec,
    strategyFingerprint: clean(script.strategyFingerprint, 300),
    revision,
    grounding: { context: editorialContext },
    generatedAt: clean(script.generatedAt, 100),
    updatedAt: clean(script.updatedAt, 100),
    approval: approval ? {
      approvedRevision: Number(approval.approvedRevision),
      approvedStrategyFingerprint: clean(approval.approvedStrategyFingerprint, 300),
      approvedAt: clean(approval.approvedAt, 100),
    } : null,
  };
}

export function assertCreatorScriptVerificationAuthority(persisted: CreatorScript, candidate: CreatorScript) {
  const previousById = new Map(persisted.sections.map((section) => [section.id, section]));
  for (const section of candidate.sections) {
    const previous = previousById.get(section.id);
    if (!previous) continue;
    if (section.humanVerification && JSON.stringify(section.humanVerification) !== JSON.stringify(previous.humanVerification)) {
      throw new Error("CREATOR_SCRIPT_VERIFICATION_FORGED");
    }
    const sameLineage = candidate.generatedAt === persisted.generatedAt;
    const bindingsUnchanged = JSON.stringify(section.claimIds) === JSON.stringify(previous.claimIds);
    if (sameLineage && previous.evidenceReviewRequired && !section.evidenceReviewRequired && section.text === previous.text && bindingsUnchanged) {
      throw new Error("CREATOR_SCRIPT_VERIFICATION_FORGED");
    }
    if (sameLineage && section.text !== previous.text && section.claimIds.length > 0 && !section.evidenceReviewRequired) {
      throw new Error("CREATOR_SCRIPT_VERIFICATION_FORGED");
    }
  }
  return candidate;
}

export function isValidCreatorScript(value: unknown): value is CreatorScript {
  try {
    normalizeCreatorScript(value);
    return true;
  } catch {
    return false;
  }
}

export function createCreatorScript(input: Omit<CreatorScript, "version" | "revision" | "approval"> & { revision?: number }): CreatorScript {
  return normalizeCreatorScript({ ...input, version: CREATOR_SCRIPT_VERSION, revision: input.revision ?? 1, approval: null });
}

export function getCreatorScriptStatus(script: CreatorScript, currentStrategyFingerprint: string): CreatorScriptStatus {
  if (script.strategyFingerprint !== currentStrategyFingerprint) return "stale";
  return script.approval && script.approval.approvedRevision === script.revision && script.approval.approvedStrategyFingerprint === script.strategyFingerprint
    ? "approved"
    : "draft";
}

export function getCreatorScriptWordsPerSecond(language: "tr" | "en") {
  return language === "tr" ? 2.15 : 2.35;
}

export function validateCreatorScriptGenerationDuration(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 5 || value > 3600) {
    throw new CreatorScriptDurationInvalidError();
  }
  return value;
}

export function countCreatorScriptWords(value: string) {
  return value.replace(/[“”"'’.,!?;:()\[\]{}]/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

export function getCreatorScriptDurationContract(input: {
  targetDurationSec: number;
  language: "tr" | "en";
  actualWordCount: number;
}): CreatorScriptDurationContract {
  const targetDurationSec = Number(input.targetDurationSec);
  const actualWordCount = Number(input.actualWordCount);
  if (!Number.isFinite(targetDurationSec) || targetDurationSec <= 0 || !Number.isInteger(actualWordCount) || actualWordCount < 0) {
    throw new Error("CREATOR_SCRIPT_DURATION_INPUT_INVALID");
  }
  const wordsPerSecond = getCreatorScriptWordsPerSecond(input.language);
  const targetWordCount = Math.round(targetDurationSec * wordsPerSecond);
  const minimumAcceptableWordCount = Math.ceil(targetWordCount * CREATOR_SCRIPT_MIN_DURATION_RATIO);
  const maximumAcceptableWordCount = Math.floor(targetWordCount * CREATOR_SCRIPT_MAX_DURATION_RATIO);
  const estimatedDurationSec = Math.round((actualWordCount / wordsPerSecond) * 10) / 10;
  const varianceSec = Math.round((estimatedDurationSec - targetDurationSec) * 10) / 10;
  const durationRatio = Math.round((estimatedDurationSec / targetDurationSec) * 1000) / 1000;
  const status: CreatorScriptDurationStatus = actualWordCount < minimumAcceptableWordCount
    ? "too_short"
    : actualWordCount > maximumAcceptableWordCount
      ? "too_long"
      : "compliant";
  return {
    targetDurationSec,
    wordsPerSecond,
    targetWordCount,
    minimumAcceptableWordCount,
    maximumAcceptableWordCount,
    actualWordCount,
    estimatedDurationSec,
    varianceSec,
    durationRatio,
    status,
  };
}

export function getCreatorScriptDurationContractForScript(script: CreatorScript, language: "tr" | "en") {
  return getCreatorScriptDurationContract({
    targetDurationSec: script.targetDurationSec,
    language,
    actualWordCount: countCreatorScriptWords(script.sections.map((section) => section.text).join("\n\n")),
  });
}

export function createCreatorScriptSectionBudgetPlan(input: {
  targetDurationSec: number;
  language: "tr" | "en";
  hasMaterialCounterview?: boolean;
}) {
  const duration = getCreatorScriptDurationContract({
    targetDurationSec: input.targetDurationSec,
    language: input.language,
    actualWordCount: 0,
  });
  const bodyCount = Math.max(1, Math.min(10, Math.round(duration.targetWordCount / 375)));
  const weights = [0.08, ...Array.from({ length: bodyCount }, () => 0.82 / bodyCount), 0.1];
  const targets = weights.map((weight) => Math.floor(duration.targetWordCount * weight));
  targets[targets.length - 1] += duration.targetWordCount - targets.reduce((sum, value) => sum + value, 0);
  const longForm = duration.targetWordCount > getCreatorScriptSafeSingleCallTargetWords();
  const bodyFunctions = [
    {
      role: "Define the phenomenon and sharpen the master question without explaining the mechanism yet",
      centralQuestion: "What exactly is happening, and why is the familiar framing incomplete?",
      progression: "Turns the opening stakes into a precise phenomenon the audience can investigate.",
    },
    {
      role: "Explain the central mechanism or causal process",
      centralQuestion: "How does the phenomenon actually work, step by step?",
      progression: "Adds causal explanation rather than restating that the phenomenon exists.",
    },
    {
      role: "Test the mechanism against the strongest concrete evidence or case",
      centralQuestion: "What evidence, case, or observation most clearly tests the explanation?",
      progression: "Moves from explanation to grounded examination of what supports it.",
    },
    input.hasMaterialCounterview
      ? {
          role: "Present and seriously test the strongest evidence-backed counterview or alternative explanation",
          centralQuestion: "What is the strongest credible challenge to the emerging thesis, and what survives it?",
          progression: "Introduces genuine tension and limits instead of token balance language.",
        }
      : {
          role: "Examine limits, uncertainty, and where the explanation may break down",
          centralQuestion: "What remains uncertain, conditional, or resistant to the main explanation?",
          progression: "Tests the thesis without inventing an unsupported opposing claim.",
        },
    {
      role: "Trace the social, relational, or systemic dimension",
      centralQuestion: "How does this move beyond the individual into relationships, institutions, or culture?",
      progression: "Adds a new scale of consequence rather than repeating the mechanism.",
    },
    {
      role: "Develop a second-order consequence that follows from the earlier evidence",
      centralQuestion: "If the argument is true, what less obvious consequence follows next?",
      progression: "Advances beyond first-order effects into a supported downstream implication.",
    },
    {
      role: "Examine the personal, moral, or existential consequence",
      centralQuestion: "What does this change about agency, responsibility, identity, or meaning?",
      progression: "Brings the established argument to its deepest human implication.",
    },
    {
      role: "Reconcile competing interpretations without flattening their disagreement",
      centralQuestion: "Which competing interpretation best fits the evidence, and what cannot be reconciled?",
      progression: "Synthesizes established tensions while preserving material uncertainty.",
    },
    {
      role: "Apply the argument to a distinct practical or future-facing consequence",
      centralQuestion: "Where does this argument lead when decisions or future conditions change?",
      progression: "Extends the argument into a new supported domain rather than paraphrasing it.",
    },
    {
      role: "Identify the final unresolved tension before synthesis",
      centralQuestion: "What decisive question remains unanswered after the evidence is weighed?",
      progression: "Creates the unresolved tension that the conclusion must honestly carry forward.",
    },
  ];
  const selectedBodyFunctions = bodyFunctions.slice(0, bodyCount);
  if (
    input.hasMaterialCounterview
    && selectedBodyFunctions.length > 0
    && !selectedBodyFunctions.some((item) => item.role.includes("counterview"))
  ) {
    selectedBodyFunctions[selectedBodyFunctions.length - 1] = bodyFunctions[3];
  }
  return targets.map((targetWords, index): CreatorScriptSectionBudget => {
    const kind: CreatorScriptSectionKind = index === 0
      ? "opening"
      : index === targets.length - 1
        ? "conclusion"
        : "body";
    const bodyFunction = selectedBodyFunctions[Math.max(0, index - 1)] ?? bodyFunctions.at(-1)!;
    return {
      id: kind === "body" ? `section-${index}` : kind,
      kind,
      role: kind === "opening"
        ? "Establish the master question, stakes, and selected hook"
        : kind === "conclusion"
          ? "Synthesize the answer, preserve uncertainty, and end on the strongest unresolved question"
          : longForm ? bodyFunction.role : `Develop grounded documentary argument ${index}`,
      centralQuestion: kind === "opening"
        ? "What question and stakes should make the audience need the answer?"
        : kind === "conclusion"
          ? "What can now be concluded, and what important uncertainty must remain open?"
          : longForm ? bodyFunction.centralQuestion : `What distinct part of the argument belongs in section ${index}?`,
      progression: kind === "opening"
        ? "Opens the inquiry without prematurely resolving it."
        : kind === "conclusion"
          ? "Synthesizes the progression without repeating the body section summaries."
          : longForm ? bodyFunction.progression : "Advances the narrative beyond the previous section.",
      minimumWords: Math.floor(targetWords * CREATOR_SCRIPT_MIN_DURATION_RATIO),
      targetWords,
      maximumWords: Math.ceil(targetWords * CREATOR_SCRIPT_MAX_DURATION_RATIO),
    };
  });
}

export function getCreatorScriptSectionDiagnostics(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  const sectionById = new Map(script.sections.map((section) => [section.id, section]));
  return plan.map((budget): CreatorScriptSectionDiagnostic => {
    const section = sectionById.get(budget.id);
    const actualWords = section ? countCreatorScriptWords(section.text) : 0;
    return {
      ...budget,
      actualWords,
      deficitWords: Math.max(0, budget.minimumWords - actualWords),
      excessWords: Math.max(0, actualWords - budget.maximumWords),
      missing: !section,
    };
  });
}

const CREATOR_SCRIPT_HEADING_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "behind", "by", "for", "from",
  "how", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the",
  "their", "this", "to", "what", "when", "where", "why", "with", "ve", "bir",
  "bu", "da", "de", "icin", "ile", "mi", "mı", "mu", "mü", "nasıl", "neden",
]);

function creatorScriptHeadingTokens(value: unknown) {
  return clean(value, 300)
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .map((token) => token.endsWith("ies") && token.length > 4
      ? `${token.slice(0, -3)}y`
      : token.endsWith("s") && token.length > 4
        ? token.slice(0, -1)
        : token)
    .filter((token) => token.length > 1 && !CREATOR_SCRIPT_HEADING_STOP_WORDS.has(token));
}

export function getCreatorScriptEditorialDistinctivenessFailures(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  assertCreatorScriptMatchesSectionPlan(script, plan);
  const bodySections = script.sections.filter((section) => section.kind === "body");
  const failures = new Set<string>();
  for (let index = 0; index < bodySections.length; index += 1) {
    const section = bodySections[index];
    const tokens = new Set(creatorScriptHeadingTokens(section.heading));
    if (tokens.size < 2) failures.add(section.id);
    for (let priorIndex = 0; priorIndex < index; priorIndex += 1) {
      const prior = bodySections[priorIndex];
      const priorTokens = new Set(creatorScriptHeadingTokens(prior.heading));
      const smallerSize = Math.min(tokens.size, priorTokens.size);
      if (smallerSize < 2) continue;
      const intersection = [...tokens].filter((token) => priorTokens.has(token)).length;
      if (intersection / smallerSize >= 0.72) failures.add(section.id);
    }
  }
  return plan.filter((section) => failures.has(section.id));
}

export function assertCreatorScriptHasDistinctEditorialSections(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  if (getCreatorScriptEditorialDistinctivenessFailures(script, plan).length > 0) {
    throw new Error("CREATOR_SCRIPT_EDITORIAL_DISTINCTIVENESS_UNSATISFIED");
  }
  return script;
}

export function assertCreatorScriptMatchesSectionPlan(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  if (
    script.sections.length !== plan.length
    || script.sections.some((section, index) => section.id !== plan[index]?.id || section.kind !== plan[index]?.kind)
  ) throw new Error("CREATOR_SCRIPT_SECTION_PLAN_MISMATCH");
  return script;
}

export function assertCreatorScriptSatisfiesSectionBudgets(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  assertCreatorScriptMatchesSectionPlan(script, plan);
  if (getCreatorScriptSectionDiagnostics(script, plan).some((section) =>
    section.missing || section.deficitWords > 0 || section.excessWords > 0
  )) throw new Error("CREATOR_SCRIPT_SECTION_BUDGET_UNSATISFIED");
  return script;
}

export function getCreatorScriptMaterialSectionFailures(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  const localVariance = Math.max(
    1 - CREATOR_SCRIPT_MIN_DURATION_RATIO,
    CREATOR_SCRIPT_MAX_DURATION_RATIO - 1,
  );
  return getCreatorScriptSectionDiagnostics(script, plan).filter((section) => {
    const materialMinimumWords = Math.floor(section.targetWords * (1 - (localVariance * 2)));
    const materialMaximumWords = Math.ceil(section.targetWords * (1 + (localVariance * 2)));
    return section.missing
      || section.actualWords === 0
      || section.actualWords < materialMinimumWords
      || section.actualWords > materialMaximumWords;
  });
}

export function getCreatorScriptDurationRepairSections(input: {
  script: CreatorScript;
  plan: CreatorScriptSectionBudget[];
  duration: CreatorScriptDurationContract;
}) {
  const diagnostics = getCreatorScriptSectionDiagnostics(input.script, input.plan);
  if (input.duration.status === "compliant") {
    const materialIds = new Set(
      getCreatorScriptMaterialSectionFailures(input.script, input.plan)
        .map((section) => section.id),
    );
    return diagnostics.filter((section) => materialIds.has(section.id));
  }

  const expanding = input.duration.status === "too_short";
  const primary = diagnostics.filter((section) => expanding
    ? section.actualWords < section.minimumWords
    : section.actualWords > section.maximumWords);
  const selectedIds = new Set(primary.map((section) => section.id));
  const selected = [...primary];
  const residualWords = expanding
    ? input.duration.minimumAcceptableWordCount - input.duration.actualWordCount
    : input.duration.actualWordCount - input.duration.maximumAcceptableWordCount;
  const capacity = (section: CreatorScriptSectionDiagnostic) => expanding
    ? Math.max(0, section.maximumWords - section.actualWords)
    : Math.max(0, section.actualWords - section.minimumWords);
  let controlledCapacity = selected.reduce((sum, section) => sum + capacity(section), 0);

  if (controlledCapacity < residualWords) {
    const additional = diagnostics
      .filter((section) => !selectedIds.has(section.id) && capacity(section) > 0)
      .sort((left, right) => capacity(right) - capacity(left));
    for (const section of additional) {
      selected.push(section);
      controlledCapacity += capacity(section);
      if (controlledCapacity >= residualWords) break;
    }
  }

  return controlledCapacity >= residualWords ? selected : [];
}

export function assertCreatorScriptHasHealthySectionStructure(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  assertCreatorScriptMatchesSectionPlan(script, plan);
  if (getCreatorScriptMaterialSectionFailures(script, plan).length > 0) {
    throw new Error("CREATOR_SCRIPT_SECTION_BUDGET_UNSATISFIED");
  }
  return script;
}

export function assertCreatorScriptHasSafeSectionStructure(
  script: CreatorScript,
  plan: CreatorScriptSectionBudget[],
) {
  assertCreatorScriptMatchesSectionPlan(script, plan);
  if (getCreatorScriptSectionDiagnostics(script, plan).some((section) =>
    section.missing || section.actualWords === 0 || section.excessWords > 0
  )) throw new Error("CREATOR_SCRIPT_SECTION_BUDGET_UNSATISFIED");
  return script;
}

export function filterCreatorScriptRepairReplacements(input: {
  script: CreatorScript;
  plan: CreatorScriptSectionBudget[];
  replacements: unknown[];
}) {
  assertCreatorScriptMatchesSectionPlan(input.script, input.plan);
  const diagnostics = new Map(
    getCreatorScriptSectionDiagnostics(input.script, input.plan)
      .map((section) => [section.id, section]),
  );
  return input.replacements.filter((value) => {
    const item = record(value);
    const id = clean(item?.id, 120);
    const diagnostic = diagnostics.get(id);
    if (!diagnostic) return false;
    const replacementWords = countCreatorScriptWords(clean(item?.text, 100_000));
    if (replacementWords === 0 || replacementWords > diagnostic.maximumWords) return false;
    if (diagnostic.actualWords < diagnostic.minimumWords && replacementWords <= diagnostic.actualWords) return false;
    if (diagnostic.actualWords > diagnostic.maximumWords && replacementWords >= diagnostic.actualWords) return false;
    return true;
  });
}

export function mergeCreatorScriptReplacementSections(input: {
  script: CreatorScript;
  replacements: unknown;
  plan?: CreatorScriptSectionBudget[];
}) {
  if (!Array.isArray(input.replacements) || input.replacements.length === 0) {
    throw new Error("CREATOR_SCRIPT_REPAIR_SECTIONS_REQUIRED");
  }
  const replacementById = new Map<string, unknown>();
  const allowedIds = input.plan?.map((section) => section.id)
    ?? input.script.sections.map((section) => section.id);
  for (const value of input.replacements) {
    const item = record(value);
    const id = clean(item?.id, 120);
    if (!id || replacementById.has(id) || !allowedIds.includes(id)) {
      throw new Error(`CREATOR_SCRIPT_REPAIR_SECTION_INVALID:${id || "unknown"}`);
    }
    replacementById.set(id, value);
  }
  const existingById = new Map(input.script.sections.map((section) => [section.id, section]));
  const nextRevision = input.script.revision + 1;
  const sections = allowedIds.map((id) => replacementById.get(id) ?? (() => { const section = existingById.get(id); return section?.humanVerification ? { ...section, humanVerification: { ...section.humanVerification, scriptRevision: nextRevision } } : section; })());
  if (sections.some((section) => !section)) {
    throw new Error("CREATOR_SCRIPT_REPAIR_SECTIONS_INCOMPLETE");
  }
  return normalizeCreatorScript({
    ...input.script,
    sections,
    revision: input.script.revision + 1,
    updatedAt: new Date().toISOString(),
    approval: null,
  });
}

export function getCreatorScriptOutputTokenBudget(targetWordCount: number) {
  return Math.max(1_500, Math.min(12_000, Math.ceil(targetWordCount * 2.5 + 1_500)));
}

export const CREATOR_SCRIPT_MIN_OUTPUT_TOKENS = 1_500;
export const CREATOR_SCRIPT_JSON_TOKEN_RESERVE = 300;
export const CREATOR_SCRIPT_CONSERVATIVE_TOKENS_PER_WORD = 1.5;
export const CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO = 0.12;

export function getCreatorScriptSafeSingleCallTargetWords() {
  return Math.floor(
    (CREATOR_SCRIPT_MIN_OUTPUT_TOKENS - CREATOR_SCRIPT_JSON_TOKEN_RESERVE)
      / CREATOR_SCRIPT_CONSERVATIVE_TOKENS_PER_WORD,
  );
}

export function shouldUseCreatorScriptSectionNativeGeneration(targetWordCount: number) {
  return Number.isFinite(targetWordCount) &&
    targetWordCount > getCreatorScriptSafeSingleCallTargetWords();
}

export function mergeCreatorScriptSectionUnits(input: {
  sections: unknown[];
  plan: CreatorScriptSectionBudget[];
}) {
  const sectionById = new Map<string, unknown>();
  const allowed = new Map(input.plan.map((section) => [section.id, section]));
  for (const sectionValue of input.sections) {
    const section = record(sectionValue);
    const id = clean(section?.id, 120);
    const budget = allowed.get(id);
    if (
      !id || !budget || sectionById.has(id) || section?.kind !== budget.kind ||
      clean(section?.role, 500) !== budget.role || !clean(section?.text, 100_000)
    ) {
      throw new Error(`CREATOR_SCRIPT_SECTION_UNIT_INVALID:${id || "unknown"}`);
    }
    sectionById.set(id, sectionValue);
  }
  if (sectionById.size !== input.plan.length) {
    throw new Error("CREATOR_SCRIPT_SECTION_UNITS_INCOMPLETE");
  }
  return input.plan
    .map((section) => sectionById.get(section.id))
    .filter((section) => section !== undefined);
}

export async function generateCreatorScriptSectionUnits(input: {
  plan: CreatorScriptSectionBudget[];
  generateSection: (
    section: CreatorScriptSectionBudget,
    index: number,
    completedSections: readonly unknown[],
  ) => Promise<unknown>;
}) {
  const completedSections: unknown[] = [];
  for (const [index, section] of input.plan.entries()) {
    const generated = await input.generateSection(section, index, completedSections);
    const validated = mergeCreatorScriptSectionUnits({
      sections: [generated],
      plan: [section],
    });
    completedSections.push(validated[0]);
  }
  return mergeCreatorScriptSectionUnits({
    sections: completedSections,
    plan: input.plan,
  });
}

export function isCreatorScriptResidualRepairEligible(
  diagnostics: CreatorScriptDurationContract,
) {
  if (diagnostics.status === "compliant") return false;
  const distanceToEnvelope = diagnostics.status === "too_short"
    ? diagnostics.minimumAcceptableWordCount - diagnostics.actualWordCount
    : diagnostics.actualWordCount - diagnostics.maximumAcceptableWordCount;
  return distanceToEnvelope > 0 &&
    distanceToEnvelope <= Math.ceil(
      diagnostics.targetWordCount * CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO,
    );
}

export function isCreatorScriptCurrentForStrategy(input: {
  script: CreatorScript | null;
  strategyFingerprint: string;
  targetDurationSec: number;
  language: "tr" | "en";
}) {
  const { script } = input;
  return Boolean(
    script
    && script.strategyFingerprint === input.strategyFingerprint
    && script.targetDurationSec === input.targetDurationSec
  );
}

export async function acceptCreatorScriptWithDurationRepair(input: {
  firstScript: CreatorScript;
  language: "tr" | "en";
  repair: (
    diagnostics: CreatorScriptDurationContract,
    script: CreatorScript,
    attempt: number,
  ) => Promise<CreatorScript>;
  requiresRepair?: (script: CreatorScript) => boolean;
  validateFinal?: (script: CreatorScript) => void;
  allowRepair?: boolean;
  maxRepairAttempts?: number;
  shouldRetryRepair?: (input: {
    previous: CreatorScriptDurationContract;
    current: CreatorScriptDurationContract;
    attempt: number;
  }) => boolean;
}) {
  const firstScript = normalizeCreatorScript(input.firstScript);
  const firstDiagnostics = getCreatorScriptDurationContractForScript(firstScript, input.language);
  if (firstDiagnostics.status === "compliant" && !input.requiresRepair?.(firstScript)) {
    input.validateFinal?.(firstScript);
    return { creatorScript: firstScript, diagnostics: firstDiagnostics, repaired: false };
  }
  if (input.allowRepair === false) {
    throw new CreatorScriptDurationUnsatisfiedError(firstDiagnostics);
  }
  const maxRepairAttempts = Math.max(1, Math.min(2, input.maxRepairAttempts ?? 1));
  let currentScript = firstScript;
  let currentDiagnostics = firstDiagnostics;
  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    const previousDiagnostics = currentDiagnostics;
    currentScript = normalizeCreatorScript(
      await input.repair(previousDiagnostics, currentScript, attempt),
    );
    currentDiagnostics = getCreatorScriptDurationContractForScript(currentScript, input.language);
    if (currentDiagnostics.status === "compliant") {
      input.validateFinal?.(currentScript);
      return {
        creatorScript: currentScript,
        diagnostics: currentDiagnostics,
        repaired: true,
        repairAttempts: attempt,
      };
    }
    if (
      attempt >= maxRepairAttempts
      || !input.shouldRetryRepair?.({
        previous: previousDiagnostics,
        current: currentDiagnostics,
        attempt,
      })
    ) {
      throw new CreatorScriptDurationUnsatisfiedError(currentDiagnostics);
    }
  }
  throw new CreatorScriptDurationUnsatisfiedError(currentDiagnostics);
}

export function creatorScriptRepairMateriallyImproved(input: {
  previous: CreatorScriptDurationContract;
  current: CreatorScriptDurationContract;
}) {
  if (input.previous.status !== input.current.status || input.current.status === "compliant") {
    return false;
  }
  const previousDistance = input.previous.status === "too_short"
    ? input.previous.minimumAcceptableWordCount - input.previous.actualWordCount
    : input.previous.actualWordCount - input.previous.maximumAcceptableWordCount;
  const currentDistance = input.current.status === "too_short"
    ? input.current.minimumAcceptableWordCount - input.current.actualWordCount
    : input.current.actualWordCount - input.current.maximumAcceptableWordCount;
  const improvement = previousDistance - currentDistance;
  return currentDistance > 0
    && improvement >= Math.max(10, Math.ceil(previousDistance * 0.1));
}

export async function generateCreatorScriptWithDurationContract(input: {
  durationSec: unknown;
  language: "tr" | "en";
  generateInitial: (durationSec: number) => Promise<CreatorScript>;
  repair: (
    script: CreatorScript,
    diagnostics: CreatorScriptDurationContract,
    attempt: number,
  ) => Promise<CreatorScript>;
  requiresRepair?: (script: CreatorScript) => boolean;
  validateFinal?: (script: CreatorScript) => void;
  allowRepair?: boolean;
  maxRepairAttempts?: number;
  shouldRetryRepair?: (input: {
    previous: CreatorScriptDurationContract;
    current: CreatorScriptDurationContract;
    attempt: number;
  }) => boolean;
}) {
  const durationSec = validateCreatorScriptGenerationDuration(input.durationSec);
  const firstScript = await input.generateInitial(durationSec);
  return acceptCreatorScriptWithDurationRepair({
    firstScript,
    language: input.language,
    repair: (diagnostics, script, attempt) => input.repair(script, diagnostics, attempt),
    requiresRepair: input.requiresRepair,
    validateFinal: input.validateFinal,
    allowRepair: input.allowRepair,
    maxRepairAttempts: input.maxRepairAttempts,
    shouldRetryRepair: input.shouldRetryRepair,
  });
}

export function getCreatorScriptMetrics(script: CreatorScript, language: "tr" | "en") {
  const fullText = getCreatorScriptDocumentText(script);
  const duration = getCreatorScriptDurationContractForScript(script, language);
  const groundedSections = script.sections.filter((section) => section.claimIds.length > 0).length;
  return { fullText, wordCount: duration.actualWordCount, estimatedDurationSec: duration.estimatedDurationSec, targetDurationSec: script.targetDurationSec, varianceSec: duration.varianceSec, evidenceCoverage: script.sections.length ? groundedSections / script.sections.length : 0 };
}

export function getCreatorScriptDocumentText(script: CreatorScript) {
  return script.sections.map((section) => section.text).join("\n\n");
}

function projectCreatorScriptDocumentSections(script: CreatorScript, documentText: string) {
  const normalizedDocument = clean(documentText, 100_000);
  if (!normalizedDocument) throw new Error("CREATOR_SCRIPT_DOCUMENT_TEXT_REQUIRED");
  const originalDocument = getCreatorScriptDocumentText(script);
  if (normalizedDocument === originalDocument) return script.sections.map((section) => section.text);

  let unchangedPrefixLength = 0;
  while (
    unchangedPrefixLength < originalDocument.length &&
    unchangedPrefixLength < normalizedDocument.length &&
    originalDocument[unchangedPrefixLength] === normalizedDocument[unchangedPrefixLength]
  ) unchangedPrefixLength += 1;
  let unchangedSuffixLength = 0;
  while (
    unchangedSuffixLength < originalDocument.length - unchangedPrefixLength &&
    unchangedSuffixLength < normalizedDocument.length - unchangedPrefixLength &&
    originalDocument[originalDocument.length - unchangedSuffixLength - 1] ===
      normalizedDocument[normalizedDocument.length - unchangedSuffixLength - 1]
  ) unchangedSuffixLength += 1;

  const spans: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const section of script.sections) {
    spans.push({ start: cursor, end: cursor + section.text.length });
    cursor += section.text.length + 2;
  }
  const originalEditStart = unchangedPrefixLength;
  const originalEditEnd = originalDocument.length - unchangedSuffixLength;
  const startSectionIndex = spans.findIndex((span) => originalEditStart <= span.end);
  const endProbe = Math.max(originalEditStart, originalEditEnd);
  let endSectionIndex = spans.findLastIndex((span) => endProbe >= span.start);
  if (startSectionIndex < 0) throw new Error("CREATOR_SCRIPT_DOCUMENT_STRUCTURE_INVALID");
  endSectionIndex = Math.max(startSectionIndex, endSectionIndex);

  const startSpan = spans[startSectionIndex];
  const endSpan = spans[endSectionIndex];
  const replacementEnd = normalizedDocument.length - unchangedSuffixLength;
  const affectedDocument = [
    script.sections[startSectionIndex].text.slice(0, Math.max(0, originalEditStart - startSpan.start)),
    normalizedDocument.slice(originalEditStart, replacementEnd),
    script.sections[endSectionIndex].text.slice(Math.max(0, originalEditEnd - endSpan.start)),
  ].join("");
  const affectedSectionCount = endSectionIndex - startSectionIndex + 1;
  const affectedTexts = affectedSectionCount === 1
    ? [affectedDocument.trim()]
    : affectedDocument.split(/\n\s*\n/).map((text) => text.trim());
  if (affectedTexts.length !== affectedSectionCount || affectedTexts.some((text) => !text)) {
    throw new Error("CREATOR_SCRIPT_DOCUMENT_BOUNDARY_AMBIGUOUS");
  }
  return script.sections.map((section, index) =>
    index < startSectionIndex || index > endSectionIndex
      ? section.text
      : affectedTexts[index - startSectionIndex],
  );
}

export function editCreatorScriptDocument(
  script: CreatorScript,
  documentText: string,
  updatedAt = new Date().toISOString(),
) {
  const sectionTexts = projectCreatorScriptDocumentSections(script, documentText);
  if (sectionTexts.some((text) => !text)) throw new Error("CREATOR_SCRIPT_DOCUMENT_STRUCTURE_INVALID");
  if (sectionTexts.every((text, index) => text === script.sections[index].text)) return script;
  const sections = script.sections.map((section, index) => {
    const changed = section.text !== sectionTexts[index];
    return {
      ...section,
      text: sectionTexts[index],
      evidenceReviewRequired: section.evidenceReviewRequired || (changed && section.claimIds.length > 0),
      ...(changed ? { humanVerification: undefined } : section.humanVerification ? { humanVerification: { ...section.humanVerification, scriptRevision: script.revision + 1 } } : {}),
    };
  });
  return normalizeCreatorScript({
    ...script,
    sections,
    revision: script.revision + 1,
    updatedAt,
    approval: null,
  });
}

export function getCreatorScriptSectionSourceReview(script: CreatorScript, sectionId: string) {
  const section = script.sections.find((item) => item.id === sectionId);
  if (!section || !section.evidenceReviewRequired || script.grounding.context.readiness.status === "blocked") return null;
  const claims = new Map(script.grounding.context.claims.map((claim) => [claim.claimId, claim]));
  const evidence = new Map(script.grounding.context.evidence.map((item) => [item.evidenceId, item]));
  const sources = new Map(script.grounding.context.sources.map((source) => [source.sourceId, source]));
  const items = section.claimIds.map((claimId) => {
    const claim = claims.get(claimId);
    const support = claim?.supportingEvidenceIds.map((id) => evidence.get(id)).filter((item) => item !== undefined).map((item) => ({
      sourceTitle: sources.get(item.sourceId)?.title || "",
      excerpt: item.excerpt,
      context: item.contextNote,
    })).filter((item) => item.sourceTitle && item.excerpt) ?? [];
    return claim && support.length ? { statement: claim.text, sources: support } : null;
  }).filter((item) => item !== null);
  return items.length === section.claimIds.length && items.length > 0 ? { sectionId, items } : null;
}

export function verifyCreatorScriptSectionSources(script: CreatorScript, sectionId: string, verifiedAt = new Date().toISOString()) {
  if (!getCreatorScriptSectionSourceReview(script, sectionId)) throw new Error("CREATOR_SCRIPT_MANUAL_VERIFICATION_UNAVAILABLE");
  return normalizeCreatorScript({
    ...script,
    sections: script.sections.map((section) => section.id === sectionId ? {
      ...section,
      evidenceReviewRequired: false,
      humanVerification: { scriptRevision: script.revision, verifiedAt },
    } : section),
  });
}

export function creatorScriptHasGroundingBlocker(script: CreatorScript) {
  return script.grounding.context.readiness.status === "blocked" || script.sections.some((section) => section.evidenceReviewRequired);
}

export function canBuildScenesFromCreatorScript(script: CreatorScript | null, currentStrategyFingerprint: string) {
  return Boolean(script && getCreatorScriptStatus(script, currentStrategyFingerprint) === "approved" && !creatorScriptHasGroundingBlocker(script));
}

export function acceptGeneratedCreatorScript<TScene>(input: {
  generatedScript: unknown;
  origin: { projectId: string; generation: number };
  active: { projectId: string; generation: number };
  workspaceStep: number;
  scenes: readonly TScene[];
}) {
  if (input.origin.projectId !== input.active.projectId || input.origin.generation !== input.active.generation) {
    return null;
  }
  return {
    script: normalizeCreatorScript(input.generatedScript),
    workspaceStep: input.workspaceStep,
    scenes: input.scenes,
  };
}

export function approveCreatorScript(script: CreatorScript, currentStrategyFingerprint: string, approvedAt = new Date().toISOString()) {
  if (script.strategyFingerprint !== currentStrategyFingerprint) throw new Error("CREATOR_SCRIPT_STALE");
  if (creatorScriptHasGroundingBlocker(script)) throw new Error("CREATOR_SCRIPT_GROUNDING_BLOCKED");
  return normalizeCreatorScript({ ...script, approval: { approvedRevision: script.revision, approvedStrategyFingerprint: script.strategyFingerprint, approvedAt } });
}

export function editCreatorScriptSection(script: CreatorScript, sectionId: string, text: string, updatedAt = new Date().toISOString()) {
  const normalizedText = clean(text, 80_000);
  if (!normalizedText) throw new Error("CREATOR_SCRIPT_SECTION_TEXT_REQUIRED");
  let found = false;
  const sections = script.sections.map((section) => {
    if (section.id !== sectionId) return section.humanVerification ? { ...section, humanVerification: { ...section.humanVerification, scriptRevision: script.revision + 1 } } : section;
    found = true;
    if (section.text === normalizedText) return section;
    return { ...section, text: normalizedText, evidenceReviewRequired: section.claimIds.length > 0, humanVerification: undefined };
  });
  if (!found) throw new Error("CREATOR_SCRIPT_SECTION_NOT_FOUND");
  return normalizeCreatorScript({ ...script, sections, revision: script.revision + 1, updatedAt, approval: null });
}

export function regenerateCreatorScriptSection(script: CreatorScript, sectionId: string, replacement: unknown, updatedAt = new Date().toISOString()) {
  const allowedClaimIds = new Set(script.grounding.context.claims.map((claim) => claim.claimId));
  const currentIndex = script.sections.findIndex((section) => section.id === sectionId);
  if (currentIndex < 0) throw new Error("CREATOR_SCRIPT_SECTION_NOT_FOUND");
  const nextSection = normalizeSection(replacement, currentIndex, allowedClaimIds);
  if (nextSection.id !== sectionId || nextSection.kind !== script.sections[currentIndex].kind) throw new Error("CREATOR_SCRIPT_REGENERATION_TARGET_MISMATCH");
  const sections = script.sections.map((section, index) => index === currentIndex ? { ...nextSection, humanVerification: undefined } : section.humanVerification ? { ...section, humanVerification: { ...section.humanVerification, scriptRevision: script.revision + 1 } } : section);
  return normalizeCreatorScript({ ...script, sections, revision: script.revision + 1, updatedAt, approval: null });
}

export function createCreatorScriptSceneSegments(script: CreatorScript, sceneCount: number) {
  const sectionWords = script.sections.map((section) => section.text.split(/\s+/).filter(Boolean));
  const totalWords = sectionWords.reduce((sum, words) => sum + words.length, 0);
  const safeCount = Math.max(
    script.sections.length,
    Math.min(36, Math.max(1, totalWords), Math.round(sceneCount)),
  );
  const allocations = script.sections.map(() => 1);
  for (let remaining = safeCount - script.sections.length; remaining > 0; remaining -= 1) {
    let selected = 0;
    let selectedPressure = -1;
    sectionWords.forEach((words, index) => {
      const pressure = words.length / allocations[index];
      if (pressure > selectedPressure) {
        selected = index;
        selectedPressure = pressure;
      }
    });
    allocations[selected] += 1;
  }
  const segments = script.sections.flatMap((section, sectionIndex) => {
    const words = sectionWords[sectionIndex];
    const count = Math.min(allocations[sectionIndex], Math.max(1, words.length));
    return Array.from({ length: count }, (_, index) => ({
      sectionId: section.id,
      narration: words.slice(Math.floor(index * words.length / count), Math.floor((index + 1) * words.length / count)).join(" "),
      claimIds: section.claimIds,
    }));
  });
  return segments.map((segment, index) => ({
    id: index + 1,
    narration: segment.narration,
    scriptRevision: script.revision,
    scriptSectionId: segment.sectionId,
    scriptSegmentIndex: index,
    editorialClaimIds: segment.claimIds,
  }));
}

export function assembleCreatorScriptScenes<TScene extends Record<string, unknown>>(input: {
  segments: ReturnType<typeof createCreatorScriptSceneSegments>;
  sceneShells: readonly TScene[];
  createSceneShell: (index: number) => TScene;
}) {
  return input.segments.map((segment, index) => ({
    ...(input.sceneShells[index] ?? input.createSceneShell(index)),
    narration: segment.narration,
    dialogue: "",
    scriptRevision: segment.scriptRevision,
    scriptSectionId: segment.scriptSectionId,
    scriptSegmentIndex: segment.scriptSegmentIndex,
    editorialClaimIds: segment.editorialClaimIds,
  }));
}

export function shouldSurfaceCreatorScriptOperationFailure(input: {
  origin: { projectId: string; generation: number };
  active: { projectId: string; generation: number };
  sourceRevision: number;
  installedRevision: number | null;
  currentRevision: number | null;
}) {
  if (input.origin.projectId !== input.active.projectId || input.origin.generation !== input.active.generation) return false;
  const expectedRevision = input.installedRevision ?? input.sourceRevision;
  return input.currentRevision === expectedRevision;
}
