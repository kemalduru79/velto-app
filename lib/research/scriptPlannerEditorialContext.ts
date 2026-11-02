import { createEditorialScriptContext } from "./editorialScriptContext.ts";
import { parseCreatorProfile } from "../creator/creatorProfile.ts";
import { classifyResearchSourceDirectness } from "./sourceAssessment.ts";
import { createResearchTopicReadiness } from "./topicEvidenceReadiness.ts";
import {
  createResearchClaimEvidenceGraph,
  isResearchClaimType,
  isResearchPropositionKind,
  validateResearchClaimPropositionAuthority,
  type ResearchClaimEvidenceGraph,
  type ResearchClaim,
  type ResearchClaimEvidenceLink,
  type ResearchEvidence,
  type ResearchEvidenceLocator,
} from "./claimEvidenceGraph.ts";
import { resolveClaimAuthority } from "./claimAuthorityResolver.ts";
import type { ResearchSource } from "./sourceContract.ts";
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
    primarySourceRequiredClaimIds: string[];
    primarySourceCoveredClaimIds: string[];
  };
  claims: Array<{
    claimId: string;
    claimType: ResearchClaim["claimType"];
    text: string;
    propositionKind?: ResearchClaim["propositionKind"];
    origin?: ResearchClaim["origin"];
    supportingEvidenceIds: string[];
    counterEvidenceIds: string[];
    contextualEvidenceIds: string[];
  }>;
  evidence: ResearchEvidence[];
  counterEvidenceReview?: CounterEvidenceScopeReview;
  sources: Array<{
    sourceId: string;
    title: string;
    url: string;
    publisher: string;
    author: string | null;
    publishedAt: string | null;
    directness: ResearchSourceDirectness;
    reviewStatus: ResearchSourceReviewStatus;
    searchLane: string;
    sourceKind: string;
  }>;
};

export type ScriptPlannerGroundingDiagnostics = {
  groundingStatus: ScriptPlannerEditorialContext["readiness"]["status"];
  evidenceCount: number;
  claimCount: number;
  /** Compatibility alias for nonemptyExcerptCount; NOT a verified span-ID count. */
  canonicalSpanCount: number;
  nonemptyExcerptCount: number;
  missingExcerptEvidenceIds: string[];
  primaryCoverageApplicable: boolean;
  allowedClaimIdCount: number;
  missingClaimIds: string[];
  unknownClaimIds: string[];
  duplicateEvidenceIdentities: string[];
  duplicateSpanIdentities: string[];
  blockingReasons: string[];
  primaryEvidenceCount: number;
  claimRelativePrimaryEvidenceIds: string[];
  primaryCoverageByClaim: Array<{ claimId: string; evidenceIds: string[]; basis: string[] }>;
  nonPrimaryEvidenceCount: number;
  primaryCoverageRatio: number;
  primaryRequiredClaimIds: string[];
  primaryCoveredClaimIds: string[];
  primaryMissingClaimIds: string[];
  sourceClassificationCounts: Record<ResearchSourceDirectness, number>;
  sourceClassifications: Array<{
    sourceId: string;
    searchLane: string;
    sourceKind: string;
    directness: ResearchSourceDirectness;
    classificationReason: string;
  }>;
  primaryCoverageRule: "all_primary_source_claims_require_primary_support";
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
  if (value === null || value === undefined || value === "") return null;
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
  const primarySourceRequiredClaimIds = uniqueIds(raw.primarySourceRequiredClaimIds, MAX_CLAIMS);
  const primarySourceCoveredClaimIds = uniqueIds(raw.primarySourceCoveredClaimIds, MAX_CLAIMS);
  return {
    status,
    editorialReadinessScore,
    reviewReasons,
    primarySourceRequiredClaimIds,
    primarySourceCoveredClaimIds,
  };
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
    const hasPropositionAuthority = raw.propositionKind !== undefined || raw.origin !== undefined;
    const rawOrigin = asRecord(raw.origin);
    if (hasPropositionAuthority && (
      !isResearchPropositionKind(raw.propositionKind) ||
      !rawOrigin ||
      Object.keys(rawOrigin).sort().join(",") !== "attributedEntity,referencedWork" ||
      (rawOrigin.attributedEntity !== null && typeof rawOrigin.attributedEntity !== "string") ||
      (rawOrigin.referencedWork !== null && typeof rawOrigin.referencedWork !== "string")
    )) {
      throw new Error(`EDITORIAL_CONTEXT_CLAIM_PROPOSITION_INVALID:${claimId}`);
    }
    const claim = {
      claimId,
      claimType: raw.claimType,
      text: requiredText(raw.text, `EDITORIAL_CONTEXT_CLAIM_TEXT:${claimId}`, 1_600),
      ...(hasPropositionAuthority && isResearchPropositionKind(raw.propositionKind) && rawOrigin
        ? {
            propositionKind: raw.propositionKind,
            origin: {
              attributedEntity: nullableText(rawOrigin.attributedEntity, 500),
              referencedWork: nullableText(rawOrigin.referencedWork, 500),
            },
          }
        : {}),
      supportingEvidenceIds: uniqueIds(raw.supportingEvidenceIds),
      counterEvidenceIds: uniqueIds(raw.counterEvidenceIds),
      contextualEvidenceIds: uniqueIds(raw.contextualEvidenceIds),
    };
    validateResearchClaimPropositionAuthority(claim);
    return claim;
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
      searchLane: clean(raw.searchLane, 80) || "unknown",
      sourceKind: clean(raw.sourceKind, 80) || "other",
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

const RESEARCH_SOURCE_ADAPTER_IDS = new Set<ResearchSource["adapterId"]>([
  "youtube",
  "web",
  "primary",
  "academic",
  "news",
]);
const RESEARCH_SOURCE_MEDIA_KINDS = new Set<ResearchSource["mediaKind"]>([
  "video",
  "article",
  "paper",
  "document",
  "webpage",
  "other",
]);

function createScriptPlannerAuthorityGraph(
  context: ScriptPlannerEditorialContext,
) {
  const evidenceGraph = createScriptPlannerEvidenceGraph(context);
  return createResearchClaimEvidenceGraph({
    sources: context.sources.map((source): ResearchSource => ({
      sourceId: source.sourceId,
      adapterId: RESEARCH_SOURCE_ADAPTER_IDS.has(
          source.searchLane as ResearchSource["adapterId"],
        )
        ? source.searchLane as ResearchSource["adapterId"]
        : "web",
      mediaKind: RESEARCH_SOURCE_MEDIA_KINDS.has(
          source.sourceKind as ResearchSource["mediaKind"],
        )
        ? source.sourceKind as ResearchSource["mediaKind"]
        : "other",
      externalId: null,
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      author: source.author,
      publishedAt: source.publishedAt,
      language: null,
      summary: null,
      thumbnailUrl: null,
      durationSec: null,
      metrics: {},
      sourceMetadata: {},
    })),
    claims: evidenceGraph.claims,
    evidence: evidenceGraph.evidence,
    links: evidenceGraph.links,
  });
}

function resolveScriptPlannerClaimAuthority(
  context: ScriptPlannerEditorialContext,
) {
  return resolveClaimAuthority({
    graph: createScriptPlannerAuthorityGraph(context),
    sourceAssessments: context.sources.map((source) => ({
      sourceId: source.sourceId,
      directness: source.directness,
      provenanceStatus: "unknown",
      reviewStatus: source.reviewStatus,
      reviewReasons: [],
    })),
  });
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

function assertScriptPlannerPrimaryAuthority(
  context: ScriptPlannerEditorialContext,
) {
  const authority = resolveScriptPlannerClaimAuthority(context);
  const primarySourceRequiredClaimIds = authority.claims
    .filter((resolution) => resolution.requiresPrimary)
    .map((resolution) => resolution.claimId);
  const primarySourceCoveredClaimIds = authority.claims
    .filter((resolution) => resolution.status === "SUPPORTED_PRIMARY")
    .map((resolution) => resolution.claimId);

  if (
    !sameIds(
      context.readiness.primarySourceRequiredClaimIds,
      primarySourceRequiredClaimIds,
    ) ||
    !sameIds(
      context.readiness.primarySourceCoveredClaimIds,
      primarySourceCoveredClaimIds,
    )
  ) {
    throw new Error("EDITORIAL_CONTEXT_PRIMARY_AUTHORITY_MISMATCH");
  }
}

/**
 * Converts the H-2E editorial context into a bounded, provider-neutral prompt
 * contract for the existing Script Planner. Unknown client fields are dropped.
 */
export function normalizeScriptPlannerEditorialContext(
  value: unknown,
  allowScopeReview = true,
): ScriptPlannerEditorialContext | null {
  if (value === null || value === undefined) return null;
  const raw = asRecord(value);
  if (!raw) throw new Error("EDITORIAL_CONTEXT_INVALID");
  if (raw.version !== "0.10H-2E" && raw.version !== "0.10H-2H") {
    throw new Error("EDITORIAL_CONTEXT_VERSION_INVALID");
  }
  if (raw.version === "0.10H-2H" && raw.sourceVersion !== "0.10H-2E") {
    throw new Error("EDITORIAL_CONTEXT_SOURCE_VERSION_INVALID");
  }

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
  assertScriptPlannerPrimaryAuthority(context);
  if (raw.counterEvidenceReview !== undefined) {
    if (!allowScopeReview) throw new Error("COUNTER_REVIEW_NESTED_SNAPSHOT");
    const record = asRecord(raw.counterEvidenceReview);
    const original = normalizeScriptPlannerEditorialContext(record?.originalContext, false);
    if (!original) throw new Error("COUNTER_REVIEW_ORIGINAL_MISSING");
    const decision = record?.decision as CounterEvidenceScopeDecision;
    const derived = applyCounterEvidenceScopeReview(original, decision, record?.originalResearchSnapshot as ResearchClaimEvidenceGraph, record?.initialResearchSnapshot as ResearchClaimEvidenceGraph);
    const { counterEvidenceReview: provenance, ...expected } = derived;
    if (JSON.stringify(expected) !== JSON.stringify(context)) throw new Error("COUNTER_REVIEW_PROJECTION_MISMATCH");
    return { ...context, counterEvidenceReview: provenance };
  }
  return context;
}

/** Safe, content-free diagnostics for the script provider grounding gate. */
export function createScriptPlannerGroundingDiagnostics(
  context: ScriptPlannerEditorialContext,
): ScriptPlannerGroundingDiagnostics {
  const authority = resolveScriptPlannerClaimAuthority(context);
  const allowedClaimIds = new Set(context.claims.map((claim) => claim.claimId));
  const evidenceIds = new Set(context.evidence.map((item) => item.evidenceId));
  const sourceById = new Map(
    context.sources.map((source) => [source.sourceId, source]),
  );
  const missingClaimIds = context.claims
    .filter((claim) =>
      claim.claimType !== "THOUGHT_EXPERIMENT" &&
      [
        ...claim.supportingEvidenceIds,
        ...claim.counterEvidenceIds,
        ...claim.contextualEvidenceIds,
      ].length === 0
    )
    .map((claim) => claim.claimId);
  const unknownClaimIds = context.claims
    .flatMap((claim) => [
      ...claim.supportingEvidenceIds,
      ...claim.counterEvidenceIds,
      ...claim.contextualEvidenceIds,
    ].map((evidenceId) => evidenceIds.has(evidenceId) ? "" : claim.claimId))
    .filter((claimId, index, values) =>
      Boolean(claimId) && values.indexOf(claimId) === index
    );
  const primaryRequiredClaimIds = authority.claims
    .filter((resolution) => resolution.requiresPrimary)
    .map((resolution) => resolution.claimId);
  const primaryCoveredClaimIds = authority.claims
    .filter((resolution) => resolution.status === "SUPPORTED_PRIMARY")
    .map((resolution) => resolution.claimId);
  const primaryCoveredClaimIdSet = new Set(primaryCoveredClaimIds);
  const primaryMissingClaimIds = primaryRequiredClaimIds.filter(
    (claimId) => !primaryCoveredClaimIdSet.has(claimId),
  );
  const primaryEvidenceCount = context.evidence.filter((evidence) =>
    sourceById.get(evidence.sourceId)?.directness === "primary"
  ).length;
  const sourceClassificationCounts = context.sources.reduce(
    (counts, source) => {
      counts[source.directness] += 1;
      return counts;
    },
    { primary: 0, secondary: 0, tertiary: 0, unknown: 0 } as Record<ResearchSourceDirectness, number>,
  );

  // Canonical normalization rejects duplicate evidence/source identities before
  // this boundary. Keep explicit empty fields so production logs prove that fact.
  return {
    groundingStatus: context.readiness.status,
    evidenceCount: context.evidence.length,
    claimCount: context.claims.length,
    canonicalSpanCount: context.evidence.filter((item) => Boolean(item.excerpt?.trim())).length,
    nonemptyExcerptCount: context.evidence.filter((item) => Boolean(item.excerpt?.trim())).length,
    missingExcerptEvidenceIds: context.evidence.filter((item) => !item.excerpt?.trim()).map((item) => item.evidenceId),
    primaryCoverageApplicable: primaryRequiredClaimIds.length > 0,
    allowedClaimIdCount: allowedClaimIds.size,
    missingClaimIds,
    unknownClaimIds,
    duplicateEvidenceIdentities: [],
    duplicateSpanIdentities: [],
    blockingReasons: [...context.readiness.reviewReasons],
    primaryEvidenceCount,
    claimRelativePrimaryEvidenceIds: [...new Set(authority.claims
      .flatMap((claim) => claim.qualifyingPrimaryEvidenceIds)
      .filter((id) => sourceById.get(context.evidence.find((item) => item.evidenceId === id)?.sourceId || "")?.directness !== "primary"))],
    primaryCoverageByClaim: authority.claims.filter((claim) => claim.requiresPrimary).map((claim) => ({
      claimId: claim.claimId, evidenceIds: claim.qualifyingPrimaryEvidenceIds,
      basis: claim.reasons.filter((reason) => reason === "GLOBAL_PRIMARY_SUPPORT" || reason === "CLAIM_RELATIVE_PRIMARY_SUPPORT"),
    })),
    nonPrimaryEvidenceCount: context.evidence.length - primaryEvidenceCount,
    primaryCoverageRatio: primaryRequiredClaimIds.length === 0
      ? 1
      : primaryCoveredClaimIds.length / primaryRequiredClaimIds.length,
    primaryRequiredClaimIds,
    primaryCoveredClaimIds,
    primaryMissingClaimIds,
    sourceClassificationCounts,
    sourceClassifications: context.sources.map((source) => ({
      sourceId: source.sourceId,
      searchLane: source.searchLane,
      sourceKind: source.sourceKind,
      directness: source.directness,
      classificationReason: source.directness === "primary"
        ? source.searchLane === "academic" && source.sourceKind === "paper"
          ? "academic_publication"
          : "verified_first_party_provenance"
        : source.searchLane === "primary"
          ? "primary_search_intent_unverified"
          : "third_party_commentary",
    })),
    primaryCoverageRule: "all_primary_source_claims_require_primary_support",
  };
}

export function createScriptPlannerEvidenceGraph(
  context: ScriptPlannerEditorialContext,
) {
  const claims: ResearchClaim[] = context.claims.map((claim) => ({
    claimId: claim.claimId,
    claimType: claim.claimType,
    text: claim.text,
    ...(claim.propositionKind && claim.origin
      ? {
          propositionKind: claim.propositionKind,
          origin: { ...claim.origin },
        }
      : {}),
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

/** Fail closed on legacy/null excerpts and outstanding editorial review. Never
 * promote client readiness, primary classification or counter-evidence stance. */
export function createScriptPlannerGenerationGroundingGate(context: ScriptPlannerEditorialContext) {
  const linkedIds = new Set(context.claims.flatMap((claim) => [
    ...claim.supportingEvidenceIds, ...claim.counterEvidenceIds, ...claim.contextualEvidenceIds,
  ]));
  const missingExcerptEvidenceIds = context.evidence
    .filter((item) => linkedIds.has(item.evidenceId) && !item.excerpt?.trim())
    .map((item) => item.evidenceId);
  const recomputed = createResearchTopicReadiness({
    graph: createScriptPlannerAuthorityGraph(context),
    sourceAssessments: context.sources.map((source) => ({
      sourceId: source.sourceId, directness: source.directness,
      provenanceStatus: "unknown", reviewStatus: source.reviewStatus, reviewReasons: [],
    })),
  });
  const reasons = new Set([...context.readiness.reviewReasons, ...recomputed.reviewReasons]);
  if (missingExcerptEvidenceIds.length) reasons.add("EVIDENCE_EXCERPTS_REQUIRED");
  if (context.readiness.status !== "ready" && reasons.size === 0) reasons.add("EDITORIAL_REVIEW_REQUIRED");
  const nextActions = [
    ...(missingExcerptEvidenceIds.length ? ["rerun_editorial_analysis_from_existing_sources"] : []),
    ...(reasons.has("MATERIAL_COUNTER_EVIDENCE_REVIEW") ? ["review_material_counter_evidence"] : []),
    ...(reasons.has("PRIMARY_SOURCE_COVERAGE_REQUIRED") ? ["retrieve_qualifying_primary_sources"] : []),
    ...(reasons.has("SOURCE_PROVENANCE_REVIEW") ? ["review_source_provenance"] : []),
  ];
  const counterReview = createCounterEvidenceReview(context);
  const message = [
    missingExcerptEvidenceIds.length ? "Evidence excerpts are missing. Re-run editorial analysis from the existing sources to restore source-owned passages." : "",
    reasons.has("MATERIAL_COUNTER_EVIDENCE_REVIEW") ? `Material counter-evidence requires editorial review. Unresolved claims: ${counterReview.unresolvedClaimIds.join(", ")}. Inspect real opposing passages, explicitly omit unresolved assertions, or stop and obtain qualifying sources.` : "",
    reasons.has("PRIMARY_SOURCE_COVERAGE_REQUIRED") ? "Retrieve qualifying primary-source evidence for the claims that require it." : "",
    reasons.has("SOURCE_PROVENANCE_REVIEW") ? "Review source provenance before generating a script." : "",
  ].filter(Boolean).join(" ") || "Editorial evidence requires review before script generation.";
  return { unresolvedCounterClaimIds: counterReview.unresolvedClaimIds, eligible: reasons.size === 0, reasonCodes: [...reasons], missingExcerptEvidenceIds, nextActions, message };
}


export type CounterEvidenceScopeDecision = {
  snapshotFingerprint: string;
  excludedClaimIds: string[];
  rationale: string;
  confirmed: true;
};
export type CounterEvidenceScopeReview = {
  initialResearchSnapshot: ResearchClaimEvidenceGraph;
  originalResearchSnapshot: ResearchClaimEvidenceGraph;
  originalContext: ScriptPlannerEditorialContext;
  decision: CounterEvidenceScopeDecision;
};

// A stale-view fingerprint, NOT an authorization token. Project/session/CAS
// authorization remains server-owned. Derivation below compares full records.
function counterReviewFingerprint(context: ScriptPlannerEditorialContext) {
  let first = 2166136261, second = 5381;
  for (const char of JSON.stringify(context)) {
    first = Math.imul(first ^ char.charCodeAt(0), 16777619);
    second = Math.imul(second, 33) ^ char.charCodeAt(0);
  }
  return `${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
}

/** Reassess each material claim against the unchanged corpus, once per review.
 * A limitation is informative context, never a synthetic contradicts relation.
 * This does not attest scientific truth or upgrade a source's primary status. */
export function createCounterEvidenceReview(context: ScriptPlannerEditorialContext) {
  const required = new Set(["THEORY", "FORECAST", "HYPOTHESIS", "METAPHYSICAL_CLAIM", "EDITORIAL_INFERENCE"]);
  const authority = resolveScriptPlannerClaimAuthority(context);
  const passages = (ids: string[]) => ids.flatMap((id) => {
    const evidence = context.evidence.find((item) => item.evidenceId === id);
    const source = context.sources.find((item) => item.sourceId === evidence?.sourceId);
    return evidence?.excerpt?.trim() && source ? [{ ...evidence, source }] : [];
  });
  const claims = context.claims.filter((claim) => required.has(claim.claimType)).map((claim) => {
    const counter = passages(claim.counterEvidenceIds);
    const contextual = passages(claim.contextualEvidenceIds);
    return {
      claimId: claim.claimId, claimType: claim.claimType, text: claim.text,
      support: passages(claim.supportingEvidenceIds), counter, contextual,
      outcome: counter.length ? "counterevidence_present" as const
        : contextual.length ? "context_only_not_counterevidence" as const : "no_counterevidence_in_snapshot" as const,
      canExclude: !authority.claims.find((item) => item.claimId === claim.claimId)?.requiresPrimary,
    };
  });
  return {
    snapshotFingerprint: counterReviewFingerprint(context), claims,
    unresolvedClaimIds: claims.filter((claim) => claim.counter.length === 0).map((claim) => claim.claimId),
    nextActions: ["inspect_claim_passages", "explicitly_omit_unresolved_assertions_or_stop", "obtain_qualifying_sources_before_retrying_retained_claims"],
  };
}

/** An explicit change in script scope, never approval of unsupported science.
 * Preserve the entire original snapshot. Do not rewrite a claim, its type,
 * origin, source classification, excerpt or link stance. Recompute all gates. */
export function applyCounterEvidenceScopeReview(
  original: ScriptPlannerEditorialContext,
  decision: CounterEvidenceScopeDecision,
  originalResearchSnapshot: ResearchClaimEvidenceGraph,
  initialResearchSnapshot = originalResearchSnapshot,
): ScriptPlannerEditorialContext {
  if (original.counterEvidenceReview) throw new Error("COUNTER_REVIEW_ALREADY_APPLIED");
  if (!originalResearchSnapshot || originalResearchSnapshot.version !== "0.10H-1B") throw new Error("COUNTER_REVIEW_RESEARCH_SNAPSHOT_REQUIRED");
  const research = createResearchClaimEvidenceGraph(originalResearchSnapshot);
  const initial = createResearchClaimEvidenceGraph(initialResearchSnapshot);
  for (const claim of research.claims) {
    const first = initial.claims.find((item) => item.claimId === claim.claimId);
    if (!first || JSON.stringify(first) !== JSON.stringify(claim)) throw new Error("COUNTER_REVIEW_INITIAL_CLAIM_CHANGED");
  }
  const assessments = research.sources.map((source) => {
    const originalSource = original.sources.find((item) => item.sourceId === source.sourceId);
    if (!originalSource || classifyResearchSourceDirectness(source).directness !== originalSource.directness) throw new Error("COUNTER_REVIEW_SOURCE_PROVENANCE_MISMATCH");
    return { ...originalSource, provenanceStatus: "unknown" as const, reviewReasons: [] };
  });
  const restored = normalizeScriptPlannerEditorialContext(createEditorialScriptContext({
    profile: parseCreatorProfile(null), graph: research, sourceAssessments: assessments,
  }), false)!;
  restored.editorialConstitution = original.editorialConstitution;
  if (JSON.stringify(restored) !== JSON.stringify(original)) throw new Error("COUNTER_REVIEW_RESEARCH_SNAPSHOT_MISMATCH");
  for (const evidence of research.evidence) {
    const passage = evidence.excerpt?.replace(/\s+/g, " ").trim();
    const material = research.sources.find((source) => source.sourceId === evidence.sourceId)?.summary?.replace(/\s+/g, " ").trim();
    if (passage && !material?.includes(passage)) throw new Error("COUNTER_REVIEW_EXCERPT_OWNERSHIP_UNVERIFIED");
  }
  const review = createCounterEvidenceReview(original);
  if (!decision || decision.confirmed !== true ||
      decision.snapshotFingerprint !== review.snapshotFingerprint) throw new Error("COUNTER_REVIEW_STALE_OR_UNCONFIRMED");
  if (!Array.isArray(decision.excludedClaimIds) || decision.excludedClaimIds.length === 0 || decision.excludedClaimIds.length > review.unresolvedClaimIds.length ||
      new Set(decision.excludedClaimIds).size !== decision.excludedClaimIds.length ||
      typeof decision.rationale !== "string" || decision.rationale.trim().length < 12 || decision.rationale.length > 1000) {
    throw new Error("COUNTER_REVIEW_DECISION_INVALID");
  }
  for (const id of decision.excludedClaimIds) {
    const claim = review.claims.find((item) => item.claimId === id);
    if (!claim || !review.unresolvedClaimIds.includes(id)) throw new Error("COUNTER_REVIEW_EXCLUSION_NOT_UNRESOLVED");
    if (!claim.canExclude) throw new Error(`COUNTER_REVIEW_PRIMARY_OBLIGATION_RETAINED:${id}`);
  }
  const excluded = new Set(decision.excludedClaimIds);
  const remaining = review.unresolvedClaimIds.filter((id) => !excluded.has(id));
  if (remaining.length) throw new Error(`COUNTER_REVIEW_UNRESOLVED:${remaining.join(",")}`);
  const claims = original.claims.filter((claim) => !excluded.has(claim.claimId));
  if (claims.length === 0 || !claims.some((claim) => claim.claimType !== "THOUGHT_EXPERIMENT")) throw new Error("COUNTER_REVIEW_NO_FACTUAL_SCRIPT_BASIS");
  const projected = { ...original, claims };
  const readiness = createResearchTopicReadiness({
    graph: createScriptPlannerAuthorityGraph(projected),
    sourceAssessments: original.sources.map((source) => ({ ...source, provenanceStatus: "unknown" as const, reviewReasons: [] })),
  });
  const reviewReasons = [...new Set([
    ...original.readiness.reviewReasons.filter((reason) => reason !== "MATERIAL_COUNTER_EVIDENCE_REVIEW"),
    ...readiness.reviewReasons,
  ])];
  const reviewed: ScriptPlannerEditorialContext = {
    ...projected,
    readiness: normalizeReadiness({ ...readiness, status: readiness.status === "blocked" ? "blocked" : reviewReasons.length ? "review" : "ready", reviewReasons }),
    counterEvidenceReview: { initialResearchSnapshot: structuredClone(initialResearchSnapshot), originalResearchSnapshot: structuredClone(originalResearchSnapshot), originalContext: structuredClone(original), decision: structuredClone(decision) },
  };
  if (new TextEncoder().encode(JSON.stringify(reviewed)).byteLength > 2_000_000) throw new Error("COUNTER_REVIEW_SNAPSHOT_TOO_LARGE");
  return reviewed;
}
