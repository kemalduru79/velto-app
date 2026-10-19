import { getCreatorScriptDocumentText, getCreatorScriptDurationContractForScript, normalizeCreatorScript, type CreatorScript, type CreatorScriptSection } from "./creatorScript.ts";
import { createHash } from "node:crypto";
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

export type CreatorScriptRewriteResearchResult = {
  sources: ResearchSource[];
  verifiedEvidence: CreatorScriptVerifiedResearchEvidence[];
};

export type CreatorScriptVerifiedResearchEvidence = {
  sourceId: string;
  excerpt: string;
  locator: { section: string | null; page: number | null; timecodeStartSec: number | null; timecodeEndSec: number | null };
  passageDigest: string;
  authority: "exa-source-highlight-v1";
};

export type CreatorScriptSectionLineage = { sourceSectionIds: string[] };
export type CreatorScriptRewriteSection = CreatorScriptSection & { lineage: CreatorScriptSectionLineage };

export type CreatorScriptRewriteProviderCandidate = {
  sections: CreatorScriptRewriteSection[];
  addedClaims: ScriptPlannerEditorialContext["claims"];
  addedEvidence: ScriptPlannerEditorialContext["evidence"];
  goalResults: CreatorScriptRewriteGoalResult[];
};

export type CreatorScriptClaimEvidenceAssessment = {
  claimId: string;
  status: "supported" | "unsupported" | "contradicted";
  evidenceIds: string[];
  summary: string;
};

export type CreatorScriptEditorialRewriteDependencies = {
  research: (input: { subject: string; language: "tr" | "en"; goals: CreatorScriptRewriteGoal[] }) => Promise<CreatorScriptRewriteResearchResult>;
  rewrite: (input: { script: CreatorScript; instruction: string; language: "tr" | "en"; goals: CreatorScriptRewriteGoal[]; sources: ResearchSource[]; verifiedEvidence: CreatorScriptVerifiedResearchEvidence[] }) => Promise<CreatorScriptRewriteProviderCandidate>;
  verifyClaims: (input: { claims: ScriptPlannerEditorialContext["claims"]; evidence: ScriptPlannerEditorialContext["evidence"]; sources: ResearchSource[] }) => Promise<CreatorScriptClaimEvidenceAssessment[]>;
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

export function isCreatorScriptFullRefinementRuntimeEnabled(env: { NODE_ENV?: string; CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED?: string }) {
  return env.NODE_ENV !== "production" && env.CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED === "true";
}

export function createCreatorScriptVerifiedResearchEvidence(sources: ResearchSource[]): CreatorScriptVerifiedResearchEvidence[] {
  return sources.flatMap((source) => {
    if (source.sourceMetadata.verifiedPassageAuthority !== "exa-source-highlight-v1") return [];
    const count = Math.min(4, Number(source.sourceMetadata.highlightCount) || 0);
    return Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      const excerpt = typeof source.sourceMetadata[`verifiedPassage${number}`] === "string" ? String(source.sourceMetadata[`verifiedPassage${number}`]).replace(/\s+/gu, " ").trim() : "";
      const passageDigest = typeof source.sourceMetadata[`verifiedPassage${number}Digest`] === "string" ? String(source.sourceMetadata[`verifiedPassage${number}Digest`]) : "";
      const locator = source.sourceMetadata[`verifiedPassage${number}Locator`] === `exa-highlight:${number}` ? `exa-highlight:${number}` : "";
      if (excerpt.length < 24 || createHash("sha256").update(excerpt).digest("hex") !== passageDigest || !locator) throw new Error("CREATOR_SCRIPT_REFINEMENT_SOURCE_PROVENANCE_INVALID");
      return { sourceId: source.sourceId, excerpt, passageDigest, authority: "exa-source-highlight-v1" as const, locator: { section: locator, page: null, timecodeStartSec: null, timecodeEndSec: null } };
    });
  });
}

function sameLocator(left: CreatorScriptVerifiedResearchEvidence["locator"], right: CreatorScriptVerifiedResearchEvidence["locator"]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateSectionLineage(script: CreatorScript, sections: CreatorScriptRewriteSection[]) {
  const oldIds = new Set(script.sections.map((section) => section.id));
  const newIds = new Set<string>();
  const represented = new Set<string>();
  if (sections.length < 2 || sections[0]?.kind !== "opening" || sections.at(-1)?.kind !== "conclusion" || sections.slice(1, -1).some((section) => section.kind !== "body")) throw new Error("CREATOR_SCRIPT_REFINEMENT_SECTION_STRUCTURE_INVALID");
  for (const section of sections) {
    if (!section.id || newIds.has(section.id) || !normalizeText(section.text) || !section.lineage || !Array.isArray(section.lineage.sourceSectionIds)) throw new Error("CREATOR_SCRIPT_REFINEMENT_SECTION_MAPPING_INVALID");
    uniqueStrings(section.lineage.sourceSectionIds, "CREATOR_SCRIPT_REFINEMENT_SECTION_MAPPING_INVALID");
    if (!section.lineage.sourceSectionIds.length || section.lineage.sourceSectionIds.some((id) => !oldIds.has(id))) throw new Error("CREATOR_SCRIPT_REFINEMENT_SECTION_MAPPING_INVALID");
    if (oldIds.has(section.id) && !section.lineage.sourceSectionIds.includes(section.id)) throw new Error("CREATOR_SCRIPT_REFINEMENT_SECTION_MAPPING_INVALID");
    section.lineage.sourceSectionIds.forEach((id) => represented.add(id));
    newIds.add(section.id);
  }
  if (represented.size !== oldIds.size) throw new Error("CREATOR_SCRIPT_REFINEMENT_SECTION_MAPPING_INVALID");
}

async function canonicalAddedContext(input: { current: ScriptPlannerEditorialContext; research: CreatorScriptRewriteResearchResult; candidate: CreatorScriptRewriteProviderCandidate; verifyClaims: CreatorScriptEditorialRewriteDependencies["verifyClaims"] }) {
  const sourceById = new Map(input.research.sources.map((source) => [source.sourceId, source]));
  const verifiedEvidence = createCreatorScriptVerifiedResearchEvidence(input.research.sources);
  if (!input.research.verifiedEvidence.length) throw new Error("CREATOR_SCRIPT_REFINEMENT_MISSING_VERIFIED_EVIDENCE");
  if (verifiedEvidence.length !== input.research.verifiedEvidence.length || verifiedEvidence.some((canonical) => !input.research.verifiedEvidence.some((provided) => canonical.sourceId === provided.sourceId && canonical.excerpt === provided.excerpt && canonical.passageDigest === provided.passageDigest && canonical.authority === provided.authority && sameLocator(canonical.locator, provided.locator)))) throw new Error("CREATOR_SCRIPT_REFINEMENT_SOURCE_PROVENANCE_INVALID");
  if (!sourceById.size || !verifiedEvidence.length) throw new Error("CREATOR_SCRIPT_REFINEMENT_MISSING_VERIFIED_EVIDENCE");
  const evidenceIds = new Set<string>();
  uniqueStrings(input.candidate.addedClaims.map((claim) => claim.claimId), "CREATOR_SCRIPT_REFINEMENT_CLAIM_AUTHORITY_INVALID");
  for (const evidence of input.candidate.addedEvidence) {
    const source = sourceById.get(evidence.sourceId);
    const passage = verifiedEvidence.find((item) => item.sourceId === evidence.sourceId && item.excerpt === evidence.excerpt && sameLocator(item.locator, evidence.locator));
    if (!source || !passage || createHash("sha256").update(evidence.excerpt || "").digest("hex") !== passage.passageDigest) throw new Error("CREATOR_SCRIPT_REFINEMENT_SOURCE_AUTHORITY_INVALID");
    if (evidenceIds.has(evidence.evidenceId)) throw new Error("CREATOR_SCRIPT_REFINEMENT_EVIDENCE_DELTA_INVALID");
    evidenceIds.add(evidence.evidenceId);
  }
  for (const claim of input.candidate.addedClaims) {
    const references = [...claim.supportingEvidenceIds, ...claim.counterEvidenceIds, ...claim.contextualEvidenceIds];
    if (!references.length || references.some((id) => !evidenceIds.has(id))) throw new Error("CREATOR_SCRIPT_REFINEMENT_UNSUPPORTED_NEW_CLAIM");
    const supporting = input.candidate.addedEvidence.filter((evidence) => claim.supportingEvidenceIds.includes(evidence.evidenceId));
    const referencedSources = supporting.map((evidence) => sourceById.get(evidence.sourceId)).filter((source): source is ResearchSource => Boolean(source));
    if (!supporting.length || (claim.origin?.referencedWork && !referencedSources.some((source) => source.url === claim.origin?.referencedWork || source.sourceId === claim.origin?.referencedWork))) throw new Error("CREATOR_SCRIPT_REFINEMENT_UNSUPPORTED_NEW_CLAIM");
  }
  const assessments = await input.verifyClaims({ claims: input.candidate.addedClaims, evidence: input.candidate.addedEvidence, sources: input.research.sources });
  const assessmentByClaim = new Map(assessments.map((assessment) => [assessment.claimId, assessment]));
  const addedClaimIds = new Set(input.candidate.addedClaims.map((claim) => claim.claimId));
  if (assessmentByClaim.size !== assessments.length || assessments.length !== addedClaimIds.size || assessments.some((assessment) => !addedClaimIds.has(assessment.claimId) || !normalizeText(assessment.summary) || new Set(assessment.evidenceIds).size !== assessment.evidenceIds.length) || input.candidate.addedClaims.some((claim) => {
    const assessment = assessmentByClaim.get(claim.claimId);
    return assessment?.status !== "supported" || !assessment.evidenceIds.length || assessment.evidenceIds.some((id) => !claim.supportingEvidenceIds.includes(id));
  })) throw new Error("CREATOR_SCRIPT_REFINEMENT_CLAIM_EVIDENCE_MISMATCH");
  const sources = input.research.sources.map((source) => ({
    sourceId: source.sourceId, title: source.title, url: source.url, publisher: source.publisher, author: source.author, publishedAt: source.publishedAt,
    directness: source.adapterId === "academic" ? "primary" as const : "secondary" as const,
    reviewStatus: source.sourceMetadata.provenanceVerified === true ? "usable" as const : "review" as const, searchLane: source.adapterId === "academic" ? "supporting_evidence" : "primary_source", sourceKind: source.mediaKind,
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
  dependencies: CreatorScriptEditorialRewriteDependencies;
}): Promise<CreatorScriptEditorialRewriteResult> {
  const goals = createCreatorScriptRewriteGoalPlan(input.instruction);
  if (input.mode === "editorial_rewrite" && goals.some((goal) => goal.kind === "evidence")) throw new Error("CREATOR_SCRIPT_REFINEMENT_RESEARCH_REQUIRED");
  const research = input.mode === "research_backed_rewrite" ? await input.dependencies.research({ subject: input.subject, language: input.language, goals }) : { sources: [], verifiedEvidence: [] };
  if (input.mode === "research_backed_rewrite" && !research.sources.length) throw new Error("CREATOR_SCRIPT_REFINEMENT_MISSING_SOURCES");
  const candidate = await input.dependencies.rewrite({ script: input.script, instruction: input.instruction, language: input.language, goals, sources: research.sources, verifiedEvidence: research.verifiedEvidence });
  validateSectionLineage(input.script, candidate.sections);
  const context = input.mode === "research_backed_rewrite"
    ? await canonicalAddedContext({ current: input.script.grounding.context, research, candidate, verifyClaims: input.dependencies.verifyClaims })
    : input.script.grounding.context;
  if (input.mode === "editorial_rewrite" && (candidate.addedClaims.length || candidate.addedEvidence.length)) throw new Error("CREATOR_SCRIPT_REFINEMENT_RESEARCH_REQUIRED");
  const allowedClaimIds = new Set(context.claims.map((claim) => claim.claimId));
  for (const section of candidate.sections) {
    uniqueStrings(section.claimIds, "CREATOR_SCRIPT_REFINEMENT_CLAIM_AUTHORITY_INVALID");
    if (section.claimIds.some((claimId) => !allowedClaimIds.has(claimId))) throw new Error("CREATOR_SCRIPT_REFINEMENT_UNSUPPORTED_NEW_CLAIM");
  }
  const now = (input.dependencies.now || (() => new Date().toISOString()))();
  const nextScript = normalizeCreatorScript({ ...input.script, sections: candidate.sections.map(({ lineage: _lineage, ...section }) => section), grounding: { context }, revision: input.script.revision + 1, updatedAt: now, approval: null });
  const assessment = await input.dependencies.assess({ before: input.script, after: nextScript, goals });
  const resultByGoal = new Map(assessment.map((result) => [result.goalId, result]));
  const goalIds = new Set(goals.map((goal) => goal.goalId));
  const proposedSectionIds = new Set(nextScript.sections.map((section) => section.id));
  if (assessment.length !== resultByGoal.size || assessment.length !== goalIds.size || assessment.some((result) => !goalIds.has(result.goalId) || !normalizeText(result.summary) || !result.sectionIds.length || result.sectionIds.some((sectionId) => !proposedSectionIds.has(sectionId))) || goals.some((goal) => resultByGoal.get(goal.goalId)?.status !== "satisfied")) throw new Error("CREATOR_SCRIPT_REFINEMENT_GOAL_MISMATCH");
  const addedClaimIds = context.claims.filter((claim) => !input.script.grounding.context.claims.some((prior) => prior.claimId === claim.claimId)).map((claim) => claim.claimId);
  const addedSourceIds = context.sources.filter((source) => !input.script.grounding.context.sources.some((prior) => prior.sourceId === source.sourceId)).map((source) => source.sourceId);
  if (input.mode === "research_backed_rewrite" && (!addedClaimIds.length || !addedSourceIds.length || !nextScript.sections.some((section) => section.claimIds.some((claimId) => addedClaimIds.includes(claimId))))) throw new Error("CREATOR_SCRIPT_REFINEMENT_UNSUPPORTED_NEW_CLAIM");
  if (getCreatorScriptDocumentText(nextScript) === getCreatorScriptDocumentText(input.script)) throw new Error("CREATOR_SCRIPT_REFINEMENT_NO_CHANGE");
  const duration = getCreatorScriptDurationContractForScript(nextScript, input.language);
  if (duration.status !== "compliant") throw new Error("CREATOR_SCRIPT_REFINEMENT_DURATION_UNSATISFIED");
  return { script: nextScript, goalResults: assessment, evidenceDelta: { addedSourceIds, removedSourceIds: [], retainedSourceIds: input.script.grounding.context.sources.map((source) => source.sourceId), addedClaimIds, removedClaimIds: [] } };
}
