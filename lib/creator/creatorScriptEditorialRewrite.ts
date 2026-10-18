import { getCreatorScriptDocumentText, getCreatorScriptDurationContractForScript, normalizeCreatorScript, type CreatorScript, type CreatorScriptSection } from "./creatorScript.ts";
import { createScriptPlannerEvidenceGraph, normalizeScriptPlannerEditorialContext, type ScriptPlannerEditorialContext } from "../research/scriptPlannerEditorialContext.ts";
import type { ResearchSource } from "../research/sourceContract.ts";
import { createResearchClaimEvidenceGraph } from "../research/claimEvidenceGraph.ts";
import { resolveClaimAuthority } from "../research/claimAuthorityResolver.ts";

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

export type CreatorScriptRewriteResearchResult = {
  sources: ResearchSource[];
};

export type CreatorScriptRewriteProviderCandidate = {
  sections: CreatorScriptSection[];
  addedClaims: ScriptPlannerEditorialContext["claims"];
  addedEvidence: ScriptPlannerEditorialContext["evidence"];
  goalResults: CreatorScriptRewriteGoalResult[];
};

export type CreatorScriptEditorialRewriteDependencies = {
  research: (input: { subject: string; language: "tr" | "en"; goals: CreatorScriptRewriteGoal[] }) => Promise<CreatorScriptRewriteResearchResult>;
  rewrite: (input: { script: CreatorScript; instruction: string; language: "tr" | "en"; goals: CreatorScriptRewriteGoal[]; sources: ResearchSource[] }) => Promise<CreatorScriptRewriteProviderCandidate>;
  assess: (input: { before: CreatorScript; after: CreatorScript; goals: CreatorScriptRewriteGoal[] }) => Promise<CreatorScriptRewriteGoalResult[]>;
  now?: () => string;
};

export type CreatorScriptEditorialRewriteResult = {
  script: CreatorScript;
  goalResults: CreatorScriptRewriteGoalResult[];
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

const sourceExcerpt = (source: ResearchSource) => [source.summary, ...Object.values(source.sourceMetadata)].filter((value): value is string => typeof value === "string").join(" ").replace(/\s+/gu, " ").toLocaleLowerCase();

function canonicalAddedContext(input: { current: ScriptPlannerEditorialContext; research: CreatorScriptRewriteResearchResult; candidate: CreatorScriptRewriteProviderCandidate }) {
  const sourceById = new Map(input.research.sources.map((source) => [source.sourceId, source]));
  if (!sourceById.size) throw new Error("CREATOR_SCRIPT_REFINEMENT_MISSING_SOURCES");
  const evidenceIds = new Set<string>();
  for (const evidence of input.candidate.addedEvidence) {
    const source = sourceById.get(evidence.sourceId);
    if (!source || !evidence.excerpt || evidence.excerpt.trim().length < 24 || !sourceExcerpt(source).includes(evidence.excerpt.replace(/\s+/gu, " ").trim().toLocaleLowerCase())) throw new Error("CREATOR_SCRIPT_REFINEMENT_SOURCE_AUTHORITY_INVALID");
    if (evidenceIds.has(evidence.evidenceId)) throw new Error("CREATOR_SCRIPT_REFINEMENT_EVIDENCE_DELTA_INVALID");
    evidenceIds.add(evidence.evidenceId);
  }
  for (const claim of input.candidate.addedClaims) {
    const references = [...claim.supportingEvidenceIds, ...claim.counterEvidenceIds, ...claim.contextualEvidenceIds];
    if (!references.length || references.some((id) => !evidenceIds.has(id))) throw new Error("CREATOR_SCRIPT_REFINEMENT_UNSUPPORTED_NEW_CLAIM");
    const supporting = input.candidate.addedEvidence.filter((evidence) => claim.supportingEvidenceIds.includes(evidence.evidenceId));
    const supportedText = supporting.map((evidence) => evidence.excerpt || "").join(" ").toLocaleLowerCase();
    const claimNumbers = claim.text.match(/\b\d+(?:[.,]\d+)?\b/gu) || [];
    const referencedSources = supporting.map((evidence) => sourceById.get(evidence.sourceId)).filter((source): source is ResearchSource => Boolean(source));
    if (!supporting.length || claimNumbers.some((number) => !supportedText.includes(number.toLocaleLowerCase())) || (claim.origin?.referencedWork && !referencedSources.some((source) => source.url === claim.origin?.referencedWork))) throw new Error("CREATOR_SCRIPT_REFINEMENT_UNSUPPORTED_NEW_CLAIM");
  }
  const sources = input.research.sources.map((source) => ({
    sourceId: source.sourceId, title: source.title, url: source.url, publisher: source.publisher, author: source.author, publishedAt: source.publishedAt,
    directness: source.adapterId === "primary" ? "primary" as const : source.adapterId === "academic" ? "secondary" as const : "tertiary" as const,
    reviewStatus: "usable" as const, searchLane: source.adapterId === "academic" ? "supporting_evidence" : "primary_source", sourceKind: source.mediaKind,
  }));
  const allClaims = [...input.current.claims, ...input.candidate.addedClaims];
  const allEvidence = [...input.current.evidence, ...input.candidate.addedEvidence];
  const allSources = [...input.current.sources, ...sources].filter((source, index, values) => values.findIndex((item) => item.sourceId === source.sourceId) === index);
  const provisional = { ...input.current, claims: allClaims, evidence: allEvidence, sources: allSources } as ScriptPlannerEditorialContext;
  const graphParts = createScriptPlannerEvidenceGraph(provisional);
  const graph = createResearchClaimEvidenceGraph({ ...graphParts, sources: allSources.map((source) => ({ sourceId: source.sourceId, adapterId: "web", mediaKind: ["video", "article", "paper", "document", "webpage", "other"].includes(source.sourceKind) ? source.sourceKind as ResearchSource["mediaKind"] : "other", externalId: null, title: source.title, url: source.url, publisher: source.publisher, author: source.author, publishedAt: source.publishedAt, language: null, summary: null, thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: {} })) });
  const authority = resolveClaimAuthority({ graph, sourceAssessments: allSources.map((source) => ({ sourceId: source.sourceId, directness: source.directness, provenanceStatus: "unknown", reviewStatus: source.reviewStatus, reviewReasons: [] })) });
  const primarySourceRequiredClaimIds = authority.claims.filter((claim) => claim.requiresPrimary).map((claim) => claim.claimId);
  const primarySourceCoveredClaimIds = authority.claims.filter((claim) => claim.status === "SUPPORTED_PRIMARY").map((claim) => claim.claimId);
  return normalizeScriptPlannerEditorialContext({ ...provisional, readiness: { ...input.current.readiness, primarySourceRequiredClaimIds, primarySourceCoveredClaimIds } })!;
}

export async function executeCreatorScriptEditorialRewrite(input: {
  script: CreatorScript;
  subject: string;
  instruction: string;
  language: "tr" | "en";
  mode: Exclude<CreatorScriptRefinementMode, "focused_edit">;
  hardCeilingSec?: number;
  dependencies: CreatorScriptEditorialRewriteDependencies;
}): Promise<CreatorScriptEditorialRewriteResult> {
  const goals = createCreatorScriptRewriteGoalPlan(input.instruction);
  if (input.mode === "editorial_rewrite" && goals.some((goal) => goal.kind === "evidence")) throw new Error("CREATOR_SCRIPT_REFINEMENT_RESEARCH_REQUIRED");
  const research = input.mode === "research_backed_rewrite" ? await input.dependencies.research({ subject: input.subject, language: input.language, goals }) : { sources: [] };
  if (input.mode === "research_backed_rewrite" && !research.sources.length) throw new Error("CREATOR_SCRIPT_REFINEMENT_MISSING_SOURCES");
  const candidate = await input.dependencies.rewrite({ script: input.script, instruction: input.instruction, language: input.language, goals, sources: research.sources });
  const context = input.mode === "research_backed_rewrite"
    ? canonicalAddedContext({ current: input.script.grounding.context, research, candidate })
    : input.script.grounding.context;
  const now = (input.dependencies.now || (() => new Date().toISOString()))();
  const nextScript = normalizeCreatorScript({ ...input.script, sections: candidate.sections, grounding: { context }, revision: input.script.revision + 1, updatedAt: now, approval: null });
  const assessment = await input.dependencies.assess({ before: input.script, after: nextScript, goals });
  const resultByGoal = new Map(assessment.map((result) => [result.goalId, result]));
  if (assessment.length !== resultByGoal.size || goals.some((goal) => resultByGoal.get(goal.goalId)?.status !== "satisfied")) throw new Error("CREATOR_SCRIPT_REFINEMENT_GOAL_MISMATCH");
  const oldSectionIds = input.script.sections.map((section) => section.id);
  const newSectionIds = nextScript.sections.map((section) => section.id);
  if (goals.some((goal) => goal.kind === "structure") && JSON.stringify(oldSectionIds) === JSON.stringify(newSectionIds)) throw new Error("CREATOR_SCRIPT_REFINEMENT_GOAL_MISMATCH");
  const addedClaimIds = context.claims.filter((claim) => !input.script.grounding.context.claims.some((prior) => prior.claimId === claim.claimId)).map((claim) => claim.claimId);
  const addedSourceIds = context.sources.filter((source) => !input.script.grounding.context.sources.some((prior) => prior.sourceId === source.sourceId)).map((source) => source.sourceId);
  if (input.mode === "research_backed_rewrite" && (!addedClaimIds.length || !addedSourceIds.length || !nextScript.sections.some((section) => section.claimIds.some((claimId) => addedClaimIds.includes(claimId))))) throw new Error("CREATOR_SCRIPT_REFINEMENT_UNSUPPORTED_NEW_CLAIM");
  if (getCreatorScriptDocumentText(nextScript) === getCreatorScriptDocumentText(input.script)) throw new Error("CREATOR_SCRIPT_REFINEMENT_NO_CHANGE");
  const duration = getCreatorScriptDurationContractForScript(nextScript, input.language);
  if (duration.status !== "compliant" || (input.hardCeilingSec !== undefined && duration.estimatedDurationSec > input.hardCeilingSec)) throw new Error("CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED");
  return { script: nextScript, goalResults: assessment, evidenceDelta: { addedSourceIds, removedSourceIds: [], retainedSourceIds: input.script.grounding.context.sources.map((source) => source.sourceId), addedClaimIds, removedClaimIds: [] } };
}
