import {
  isResearchClaimType,
  type ResearchClaim,
  type ResearchClaimEvidenceLink,
  type ResearchEvidence,
  type ResearchEvidenceLocator,
} from "./claimEvidenceGraph.ts";
import type {
  ResearchSourceDirectness,
  ResearchSourceReviewStatus,
} from "./sourceAssessment.ts";

export type ScriptPlannerEditorialContext = {
  version: "0.10H-2H";
  sourceVersion: "0.10H-2E";
  editorialConstitution: string;
  readiness: {
    status: "blocked" | "review" | "ready";
    editorialReadinessScore: number;
    reviewReasons: string[];
  };
  claims: Array<{
    claimId: string;
    claimType: ResearchClaim["claimType"];
    text: string;
    supportingEvidenceIds: string[];
    counterEvidenceIds: string[];
    contextualEvidenceIds: string[];
  }>;
  evidence: ResearchEvidence[];
  sources: Array<{
    sourceId: string;
    title: string;
    url: string;
    publisher: string;
    author: string | null;
    publishedAt: string | null;
    directness: ResearchSourceDirectness;
    reviewStatus: ResearchSourceReviewStatus;
  }>;
};

const MAX_CLAIMS = 40;
const MAX_EVIDENCE = 160;
const MAX_SOURCES = 60;
const MAX_EVIDENCE_IDS_PER_CLAIM = 80;

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const result = clean(value, maxLength);
  if (!result) throw new Error(`${label}_REQUIRED`);
  return result;
}

function uniqueIds(value: unknown, maxItems = MAX_EVIDENCE_IDS_PER_CLAIM) {
  const source = Array.isArray(value) ? value : [];
  if (source.length > maxItems) throw new Error("EDITORIAL_CONTEXT_REFERENCE_LIMIT_EXCEEDED");
  return [...new Set(source.map((item) => clean(item, 300)).filter(Boolean))];
}

function nullableText(value: unknown, maxLength: number) {
  return clean(value, maxLength) || null;
}

function finiteOrNull(value: unknown, min = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : null;
}

function integerOrNull(value: unknown, min = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min ? parsed : null;
}

function normalizeLocator(value: unknown): ResearchEvidenceLocator {
  const raw = asRecord(value) || {};
  return {
    section: nullableText(raw.section, 300),
    page: integerOrNull(raw.page),
    timecodeStartSec: finiteOrNull(raw.timecodeStartSec),
    timecodeEndSec: finiteOrNull(raw.timecodeEndSec),
  };
}

function normalizeReadiness(value: unknown): ScriptPlannerEditorialContext["readiness"] {
  const raw = asRecord(value) || {};
  const status = raw.status === "ready" || raw.status === "review" || raw.status === "blocked"
    ? raw.status
    : "review";
  const score = Number(raw.editorialReadinessScore);
  const editorialReadinessScore = Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : 0;
  const reviewReasons = Array.isArray(raw.reviewReasons)
    ? [...new Set(raw.reviewReasons.map((item) => clean(item, 400)).filter(Boolean))].slice(0, 30)
    : [];
  return { status, editorialReadinessScore, reviewReasons };
}

function normalizeClaims(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  if (source.length > MAX_CLAIMS) throw new Error("EDITORIAL_CONTEXT_CLAIM_LIMIT_EXCEEDED");
  const seen = new Set<string>();
  return source.map((item, index) => {
    const raw = asRecord(item) || {};
    const claimId = requiredText(raw.claimId, `EDITORIAL_CONTEXT_CLAIM_ID:${index + 1}`, 300);
    if (seen.has(claimId)) throw new Error(`EDITORIAL_CONTEXT_CLAIM_DUPLICATE:${claimId}`);
    seen.add(claimId);
    if (!isResearchClaimType(raw.claimType)) {
      throw new Error(`EDITORIAL_CONTEXT_CLAIM_TYPE_INVALID:${claimId}`);
    }
    return {
      claimId,
      claimType: raw.claimType,
      text: requiredText(raw.text, `EDITORIAL_CONTEXT_CLAIM_TEXT:${claimId}`, 1_600),
      supportingEvidenceIds: uniqueIds(raw.supportingEvidenceIds),
      counterEvidenceIds: uniqueIds(raw.counterEvidenceIds),
      contextualEvidenceIds: uniqueIds(raw.contextualEvidenceIds),
    };
  });
}

function normalizeEvidence(value: unknown): ResearchEvidence[] {
  const source = Array.isArray(value) ? value : [];
  if (source.length > MAX_EVIDENCE) throw new Error("EDITORIAL_CONTEXT_EVIDENCE_LIMIT_EXCEEDED");
  const seen = new Set<string>();
  return source.map((item, index) => {
    const raw = asRecord(item) || {};
    const evidenceId = requiredText(raw.evidenceId, `EDITORIAL_CONTEXT_EVIDENCE_ID:${index + 1}`, 300);
    if (seen.has(evidenceId)) throw new Error(`EDITORIAL_CONTEXT_EVIDENCE_DUPLICATE:${evidenceId}`);
    seen.add(evidenceId);
    return {
      evidenceId,
      sourceId: requiredText(raw.sourceId, `EDITORIAL_CONTEXT_EVIDENCE_SOURCE:${evidenceId}`, 300),
      excerpt: nullableText(raw.excerpt, 2_500),
      contextNote: nullableText(raw.contextNote, 800),
      locator: normalizeLocator(raw.locator),
    };
  });
}

function normalizeSources(value: unknown): ScriptPlannerEditorialContext["sources"] {
  const source = Array.isArray(value) ? value : [];
  if (source.length > MAX_SOURCES) throw new Error("EDITORIAL_CONTEXT_SOURCE_LIMIT_EXCEEDED");
  const directnessValues = new Set<ResearchSourceDirectness>(["primary", "secondary", "tertiary", "unknown"]);
  const reviewValues = new Set<ResearchSourceReviewStatus>(["usable", "review", "insufficient"]);
  const seen = new Set<string>();
  return source.map((item, index) => {
    const raw = asRecord(item) || {};
    const sourceId = requiredText(raw.sourceId, `EDITORIAL_CONTEXT_SOURCE_ID:${index + 1}`, 300);
    if (seen.has(sourceId)) throw new Error(`EDITORIAL_CONTEXT_SOURCE_DUPLICATE:${sourceId}`);
    seen.add(sourceId);
    const directness = directnessValues.has(raw.directness as ResearchSourceDirectness)
      ? raw.directness as ResearchSourceDirectness
      : "unknown";
    const reviewStatus = reviewValues.has(raw.reviewStatus as ResearchSourceReviewStatus)
      ? raw.reviewStatus as ResearchSourceReviewStatus
      : "review";
    return {
      sourceId,
      title: requiredText(raw.title, `EDITORIAL_CONTEXT_SOURCE_TITLE:${sourceId}`, 500),
      url: requiredText(raw.url, `EDITORIAL_CONTEXT_SOURCE_URL:${sourceId}`, 2_000),
      publisher: clean(raw.publisher, 300),
      author: nullableText(raw.author, 500),
      publishedAt: nullableText(raw.publishedAt, 100),
      directness,
      reviewStatus,
    };
  });
}

function assertReferences(context: ScriptPlannerEditorialContext) {
  const sourceIds = new Set(context.sources.map((source) => source.sourceId));
  const evidenceIds = new Set(context.evidence.map((item) => item.evidenceId));

  for (const item of context.evidence) {
    if (!sourceIds.has(item.sourceId)) {
      throw new Error(`EDITORIAL_CONTEXT_EVIDENCE_SOURCE_MISSING:${item.evidenceId}:${item.sourceId}`);
    }
  }

  for (const claim of context.claims) {
    for (const evidenceId of [
      ...claim.supportingEvidenceIds,
      ...claim.counterEvidenceIds,
      ...claim.contextualEvidenceIds,
    ]) {
      if (!evidenceIds.has(evidenceId)) {
        throw new Error(`EDITORIAL_CONTEXT_EVIDENCE_MISSING:${claim.claimId}:${evidenceId}`);
      }
    }
  }
}

/**
 * Converts the H-2E editorial context into a bounded, provider-neutral prompt
 * contract for the existing Script Planner. Unknown client fields are dropped.
 */
export function normalizeScriptPlannerEditorialContext(
  value: unknown,
): ScriptPlannerEditorialContext | null {
  if (value === null || value === undefined) return null;
  const raw = asRecord(value);
  if (!raw) throw new Error("EDITORIAL_CONTEXT_INVALID");
  if (raw.version !== "0.10H-2E") throw new Error("EDITORIAL_CONTEXT_VERSION_INVALID");

  const context: ScriptPlannerEditorialContext = {
    version: "0.10H-2H",
    sourceVersion: "0.10H-2E",
    editorialConstitution: requiredText(
      raw.editorialConstitution,
      "EDITORIAL_CONTEXT_CONSTITUTION",
      8_000,
    ),
    readiness: normalizeReadiness(raw.readiness),
    claims: normalizeClaims(raw.claims),
    evidence: normalizeEvidence(raw.evidence),
    sources: normalizeSources(raw.sources),
  };
  assertReferences(context);
  return context;
}

export function createScriptPlannerEvidenceGraph(
  context: ScriptPlannerEditorialContext,
) {
  const claims: ResearchClaim[] = context.claims.map((claim) => ({
    claimId: claim.claimId,
    claimType: claim.claimType,
    text: claim.text,
  }));
  const links: ResearchClaimEvidenceLink[] = [];
  const seen = new Set<string>();
  const addLink = (
    claimId: string,
    evidenceId: string,
    stance: ResearchClaimEvidenceLink["stance"],
  ) => {
    const key = `${claimId}:${evidenceId}:${stance}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ claimId, evidenceId, stance });
  };

  for (const claim of context.claims) {
    claim.supportingEvidenceIds.forEach((evidenceId) => addLink(claim.claimId, evidenceId, "supports"));
    claim.counterEvidenceIds.forEach((evidenceId) => addLink(claim.claimId, evidenceId, "contradicts"));
    claim.contextualEvidenceIds.forEach((evidenceId) => addLink(claim.claimId, evidenceId, "contextualizes"));
  }

  return {
    claims,
    evidence: context.evidence.map((item) => ({ ...item, locator: { ...item.locator } })),
    links,
  };
}
