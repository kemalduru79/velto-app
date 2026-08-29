import {
  createCreatorEvidenceGovernanceReport,
  type CreatorEvidenceGovernanceReport,
  type CreatorGovernedSourceMedia,
} from "./evidenceGovernance.ts";
import type {
  ScriptQaIssue,
  ScriptQaIssueCode,
  ScriptQaReport,
} from "../research/scriptEvidenceQa.ts";

const SCRIPT_QA_CODES = new Set<ScriptQaIssueCode>([
  "STATEMENT_TRACEABILITY_REQUIRED",
  "STATEMENT_TRACEABILITY_PARTIAL",
  "EVIDENCE_MODE_MISMATCH",
  "CLAIM_CERTAINTY_MISMATCH",
  "COUNTER_EVIDENCE_NOT_REFLECTED",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown, maxLength = 2_000) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function nonNegativeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function uniqueIds(values: unknown) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => clean(value, 240))
      .filter(Boolean),
  )];
}

function normalizeScriptQa(value: unknown): ScriptQaReport | null {
  const source = record(value);
  if (!source || source.version !== "0.10H-2D") return null;
  const issues: ScriptQaIssue[] = [];

  for (const rawIssue of Array.isArray(source.issues) ? source.issues.slice(0, 240) : []) {
    const issue = record(rawIssue);
    if (!issue) continue;
    const code = clean(issue.code, 80) as ScriptQaIssueCode;
    const severity = issue.severity === "blocked" || issue.severity === "review"
      ? issue.severity
      : null;
    const statementId = clean(issue.statementId, 240);
    if (!SCRIPT_QA_CODES.has(code) || !severity || !statementId) continue;
    const sceneId = typeof issue.sceneId === "number"
      ? issue.sceneId
      : clean(issue.sceneId, 240);
    issues.push({
      code,
      severity,
      statementId,
      sceneId,
      message: clean(issue.message, 1_000),
    });
  }

  const blockedIssueCount = issues.filter((issue) => issue.severity === "blocked").length;
  const reviewIssueCount = issues.length - blockedIssueCount;
  return {
    version: "0.10H-2D",
    status: blockedIssueCount > 0 ? "blocked" : reviewIssueCount > 0 ? "review" : "ready",
    statementCount: nonNegativeInteger(source.statementCount),
    blockedIssueCount,
    reviewIssueCount,
    issues,
  };
}

type ProjectEvidenceBindingStatement = {
  statementId: string;
  sceneId: string;
  text: string;
  evidenceMode: "required" | "not_required";
  supportingSourceIds: string[];
};

function normalizeBindingStatements(value: unknown) {
  const binding = record(value);
  if (!binding || binding.version !== "0.10H-2C" || !Array.isArray(binding.statements)) {
    return null;
  }

  const statements: ProjectEvidenceBindingStatement[] = [];
  for (const rawStatement of binding.statements.slice(0, 160)) {
    const statement = record(rawStatement);
    if (!statement) continue;
    const statementId = clean(statement.statementId, 240);
    const sceneId = clean(String(statement.sceneId ?? ""), 240);
    const text = clean(statement.text, 20_000);
    const evidenceMode = statement.evidenceMode === "required"
      ? "required" as const
      : statement.evidenceMode === "not_required"
        ? "not_required" as const
        : null;
    if (!statementId || !sceneId || !text || !evidenceMode) continue;
    statements.push({
      statementId,
      sceneId,
      text,
      evidenceMode,
      supportingSourceIds: uniqueIds(statement.supportingSourceIds),
    });
  }
  return statements;
}

function currentSceneSpeechById(productionPackage: Record<string, unknown>) {
  const byId = new Map<string, string>();
  for (const rawScene of Array.isArray(productionPackage.scenes)
    ? productionPackage.scenes.slice(0, 100)
    : []) {
    const scene = record(rawScene);
    if (!scene) continue;
    const sceneId = clean(String(scene.id ?? ""), 240);
    if (!sceneId) continue;
    byId.set(
      sceneId,
      clean([clean(scene.narration, 10_000), clean(scene.dialogue, 10_000)]
        .filter(Boolean)
        .join(" "), 20_000),
    );
  }
  return byId;
}

export type CreatorProjectEvidenceGovernanceInput = {
  productionPackage: unknown;
  knownSourceIds?: readonly string[] | null;
  sourceMedia?: readonly CreatorGovernedSourceMedia[] | null;
  syntheticMediaUsed?: boolean;
  syntheticDisclosurePresent?: boolean;
};

/**
 * Adapts the existing CreatorLab production package into the H-5 evidence
 * governance contract. It does not create a second evidence store or a new
 * publish engine. A changed scene speech invalidates its prior evidence binding
 * until the source relationship is reviewed/rebuilt.
 */
export function createCreatorProjectEvidenceGovernanceReport(
  input: CreatorProjectEvidenceGovernanceInput,
): CreatorEvidenceGovernanceReport {
  const productionPackage = record(input.productionPackage) || {};
  const scriptPlan = record(productionPackage.scriptPlan);
  const editorialContext = record(scriptPlan?.editorialContext);
  const groundedEditorialUsed = editorialContext?.used === true;
  const editorialEvidence = record(productionPackage.editorialEvidence);
  const scriptQa = normalizeScriptQa(editorialEvidence?.qa);
  const bindingStatements = normalizeBindingStatements(editorialEvidence?.binding);
  const missingSourceIds: string[] = [];
  const mismatchedSourceIds: string[] = [];

  if (groundedEditorialUsed && !editorialEvidence) {
    missingSourceIds.push("editorial-evidence-package");
  } else if (groundedEditorialUsed) {
    if (!bindingStatements) missingSourceIds.push("editorial-evidence-binding");
    if (!scriptQa) missingSourceIds.push("editorial-script-qa");
  }

  const knownSourceSet = input.knownSourceIds
    ? new Set(input.knownSourceIds.map((value) => clean(value, 240)).filter(Boolean))
    : null;
  const sceneSpeechById = currentSceneSpeechById(productionPackage);

  for (const statement of bindingStatements || []) {
    if (knownSourceSet) {
      for (const sourceId of statement.supportingSourceIds) {
        if (!knownSourceSet.has(sourceId)) missingSourceIds.push(sourceId);
      }
    }

    if (
      statement.evidenceMode === "required" &&
      statement.supportingSourceIds.length > 0 &&
      sceneSpeechById.get(statement.sceneId) !== statement.text
    ) {
      mismatchedSourceIds.push(...statement.supportingSourceIds);
    }
  }

  return createCreatorEvidenceGovernanceReport({
    scriptQa,
    sourceMedia: input.sourceMedia,
    missingSourceIds,
    mismatchedSourceIds,
    syntheticMediaUsed: input.syntheticMediaUsed,
    syntheticDisclosurePresent: input.syntheticDisclosurePresent,
  });
}
