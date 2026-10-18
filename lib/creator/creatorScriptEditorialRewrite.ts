import { getCreatorScriptDocumentText, getCreatorScriptDurationContractForScript, type CreatorScript } from "./creatorScript.ts";

export const CREATOR_SCRIPT_REFINEMENT_MODES = ["focused_edit", "editorial_rewrite", "research_backed_rewrite"] as const;
export type CreatorScriptRefinementMode = typeof CREATOR_SCRIPT_REFINEMENT_MODES[number];

export const CREATOR_SCRIPT_REWRITE_GOAL_KINDS = ["structure", "evidence", "accessibility", "progression", "ending", "duration", "other"] as const;
export type CreatorScriptRewriteGoalKind = typeof CREATOR_SCRIPT_REWRITE_GOAL_KINDS[number];

export type CreatorScriptRewriteGoal = {
  goalId: string;
  kind: CreatorScriptRewriteGoalKind;
  instruction: string;
  plannedChange: string;
};

export type CreatorScriptRewriteGoalResult = {
  goalId: string;
  status: "satisfied" | "blocked";
  sectionIds: string[];
  summary: string;
};

export type CreatorScriptEvidenceDelta = {
  addedSourceIds: string[];
  removedSourceIds: string[];
  retainedSourceIds: string[];
  addedClaimIds: string[];
  removedClaimIds: string[];
};

export type CreatorScriptRewriteCandidate = {
  sections: Array<{ id: string; text: string; claimIds: string[]; reason: string }>;
  goalResults: CreatorScriptRewriteGoalResult[];
  evidenceDelta: CreatorScriptEvidenceDelta;
};

export type CreatorScriptRewriteValidation = {
  mode: Exclude<CreatorScriptRefinementMode, "focused_edit">;
  goals: CreatorScriptRewriteGoal[];
  duration: ReturnType<typeof getCreatorScriptDurationContractForScript>;
  hardCeilingSec: number;
  changedSectionIds: string[];
  evidenceDelta: CreatorScriptEvidenceDelta;
};

const normalizeText = (value: string) => value.replace(/\s+/gu, " ").trim();
const stableGoalId = (value: string, index: number) => {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `goal-${index + 1}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

function classifyGoal(value: string): CreatorScriptRewriteGoalKind {
  if (/\b(?:source|reference|research|study|evidence|case|claim|fact|stanford|academic)\b/iu.test(value)) return "evidence";
  if (/\b(?:structure|architecture|chapter|section|reorgan|rewrite|hook|story)\b/iu.test(value)) return "structure";
  if (/\b(?:b1|b2|simple|simplif|accessible|plain english|language)\b/iu.test(value)) return "accessibility";
  if (/\b(?:progress|contrast|position|tension|transition|paradox|wow)\b/iu.test(value)) return "progression";
  if (/\b(?:ending|conclusion|moral|final)\b/iu.test(value)) return "ending";
  if (/\b(?:duration|minute|length|shorter|longer|8:45|10:00)\b/iu.test(value)) return "duration";
  return "other";
}

export function normalizeCreatorScriptRefinementMode(value: unknown, scope: unknown): CreatorScriptRefinementMode {
  if (CREATOR_SCRIPT_REFINEMENT_MODES.includes(value as CreatorScriptRefinementMode)) return value as CreatorScriptRefinementMode;
  if (scope === "selection" || scope === "opening") return "focused_edit";
  throw new Error("CREATOR_SCRIPT_REFINEMENT_MODE_REQUIRED");
}

export function createCreatorScriptRewriteGoalPlan(instruction: string): CreatorScriptRewriteGoal[] {
  const normalized = instruction.trim();
  if (!normalized) throw new Error("CREATOR_SCRIPT_REFINEMENT_INSTRUCTION_REQUIRED");
  const parts = normalized.split(/\n+|;|(?<=[.!?])\s+/u).map(normalizeText).filter(Boolean);
  return [...new Set(parts)].map((part, index) => {
    const kind = classifyGoal(part);
    const plannedChange = kind === "evidence" ? "Reconcile claims with canonical source authority and expose the evidence delta."
      : kind === "structure" ? "Revise documentary architecture while preserving validated section identity or an explicit remapping."
      : kind === "accessibility" ? "Use accessible B1–B2 language without changing factual meaning."
      : kind === "progression" ? "Strengthen contrast and forward progression without repetition."
      : kind === "ending" ? "Strengthen the conclusion while preserving factual uncertainty."
      : kind === "duration" ? "Honor the configured target and hard duration ceiling without truncation."
      : "Make the requested editorial change and report where it was satisfied.";
    return { goalId: stableGoalId(part, index), kind, instruction: part, plannedChange };
  });
}

export function creatorScriptInstructionRequiresResearch(instruction: string) {
  return createCreatorScriptRewriteGoalPlan(instruction).some((goal) => goal.kind === "evidence");
}

const uniqueStrings = (values: string[], code: string) => {
  if (values.some((value) => !value || value.length > 200) || new Set(values).size !== values.length) throw new Error(code);
};

export function validateCreatorScriptRewriteCandidate(input: {
  script: CreatorScript;
  language: "tr" | "en";
  mode: Exclude<CreatorScriptRefinementMode, "focused_edit">;
  instruction: string;
  candidate: CreatorScriptRewriteCandidate;
  allowedClaimIds: string[];
  allowedSourceIds: string[];
  hardCeilingSec?: number;
}): CreatorScriptRewriteValidation {
  const goals = createCreatorScriptRewriteGoalPlan(input.instruction);
  if (input.mode === "editorial_rewrite" && creatorScriptInstructionRequiresResearch(input.instruction)) throw new Error("CREATOR_SCRIPT_REFINEMENT_RESEARCH_REQUIRED");
  const sectionIds = input.script.sections.map((section) => section.id);
  if (input.candidate.sections.length !== sectionIds.length || input.candidate.sections.some((section, index) => section.id !== sectionIds[index] || !normalizeText(section.text) || !normalizeText(section.reason))) {
    throw new Error("CREATOR_SCRIPT_REFINEMENT_SECTION_MAPPING_INVALID");
  }
  const allowedClaims = new Set(input.allowedClaimIds);
  const allowedSources = new Set(input.allowedSourceIds);
  for (const section of input.candidate.sections) {
    uniqueStrings(section.claimIds, "CREATOR_SCRIPT_REFINEMENT_CLAIM_AUTHORITY_INVALID");
    if (section.claimIds.some((claimId) => !allowedClaims.has(claimId))) throw new Error("CREATOR_SCRIPT_REFINEMENT_UNSUPPORTED_NEW_CLAIM");
  }
  const delta = input.candidate.evidenceDelta;
  for (const values of Object.values(delta)) uniqueStrings(values, "CREATOR_SCRIPT_REFINEMENT_EVIDENCE_DELTA_INVALID");
  if ([...delta.addedSourceIds, ...delta.retainedSourceIds].some((sourceId) => !allowedSources.has(sourceId)) || delta.addedClaimIds.some((claimId) => !allowedClaims.has(claimId))) {
    throw new Error("CREATOR_SCRIPT_REFINEMENT_SOURCE_AUTHORITY_INVALID");
  }
  if (input.mode === "research_backed_rewrite" && !delta.addedSourceIds.length && !delta.addedClaimIds.length) throw new Error("CREATOR_SCRIPT_REFINEMENT_MISSING_SOURCES");
  const results = new Map(input.candidate.goalResults.map((result) => [result.goalId, result]));
  if (results.size !== input.candidate.goalResults.length || goals.some((goal) => results.get(goal.goalId)?.status !== "satisfied")) throw new Error("CREATOR_SCRIPT_REFINEMENT_GOAL_MISMATCH");
  for (const result of input.candidate.goalResults) {
    if (!goals.some((goal) => goal.goalId === result.goalId) || !normalizeText(result.summary) || result.sectionIds.some((sectionId) => !sectionIds.includes(sectionId))) throw new Error("CREATOR_SCRIPT_REFINEMENT_GOAL_RESULT_INVALID");
  }
  const nextScript = { ...input.script, sections: input.script.sections.map((section, index) => ({ ...section, text: input.candidate.sections[index].text, claimIds: input.candidate.sections[index].claimIds })) };
  if (getCreatorScriptDocumentText(nextScript) === getCreatorScriptDocumentText(input.script)) throw new Error("CREATOR_SCRIPT_REFINEMENT_NO_CHANGE");
  const duration = getCreatorScriptDurationContractForScript(nextScript, input.language);
  const hardCeilingSec = input.hardCeilingSec ?? Math.min(600, Math.max(input.script.targetDurationSec, input.script.targetDurationSec + 75));
  if (duration.status !== "compliant" || duration.estimatedDurationSec > hardCeilingSec) throw new Error("CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED");
  return {
    mode: input.mode,
    goals,
    duration,
    hardCeilingSec,
    changedSectionIds: input.script.sections.filter((section, index) => section.text !== input.candidate.sections[index].text).map((section) => section.id),
    evidenceDelta: delta,
  };
}

export function isCreatorScriptFullRefinementRuntimeEnabled(env: { NODE_ENV?: string; CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED?: string }) {
  return env.NODE_ENV !== "production" && env.CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED === "true";
}
