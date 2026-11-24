import type { createCounterEvidenceReview, CounterEvidenceScopeDecision } from "./scriptPlannerEditorialContext.ts";
import {
  normalizeCreatorDocumentarySourcePlanningContext,
  normalizeCreatorEvidenceVisualPlanningContext,
} from "../creator/productionIntelligenceRequest.ts";
import { createCreatorSceneDocumentaryContext } from "../creator/sceneDocumentaryContext.ts";
import type {
  ResearchClaim,
  ResearchClaimEvidenceGraph,
} from "./claimEvidenceGraph.ts";
import { researchSourceQualifiesAsPrimaryForClaim } from "./claimAuthorityResolver.ts";
import type { ResearchSourceAssessment } from "./sourceAssessment.ts";
import type { ResearchSource } from "./sourceContract.ts";
import { createResearchSourceMediaReference } from "./sourceMediaReference.ts";
import type { ScriptEvidenceBindingMap } from "./scriptEvidenceBinding.ts";
import { normalizeCreatorTopicAuthority } from "../creator/creatorWorkflowAuthority.ts";
import { canonicalResearchUrl } from "./orchestratedResearch.ts";

export type CreatorEditorialPipelineStage =
  | "research"
  | "editorial_analysis"
  | "script_plan";

export class CreatorEditorialPipelineError extends Error {
  stage: CreatorEditorialPipelineStage;
  status: number | null;
  code: string | null;
  // Ephemeral review-only payload; not an accepted script.
  reviewOnlyDraft: unknown | null = null;
  parentReview: ParentSourceReview | null = null;

  constructor(input: {
    stage: CreatorEditorialPipelineStage;
    message: string;
    status?: number | null;
    code?: string | null;
  }) {
    super(input.message);
    this.name = "CreatorEditorialPipelineError";
    this.stage = input.stage;
    this.status = input.status ?? null;
    this.code = input.code ?? null;
  }
}

export type ParentSourceReview = { projectId: string; snapshotDigest: string; researchRevision: number; requirements: Array<{ claimId: string; evidenceId: string; sourceId: string }> };

export type CreatorEditorialPipelineInput = {
  accessToken: string;
  topic: string;
  researchSubject?: string;
  creatorProfile?: unknown;
  scriptPlanRequest: Record<string, unknown>;
  includeRecentContext?: boolean;
  maxResultsPerLane?: number;
  fetchImpl?: typeof fetch;
  onCounterEvidenceReview?: (review: ReturnType<typeof createCounterEvidenceReview>) => Promise<CounterEvidenceScopeDecision | null>;
  onParentSourceReview?: (review: ParentSourceReview) => Promise<void>;
  operationIsCurrent?: () => boolean;
};

export type CreatorEditorialPipelineProductionIntelligenceContext = {
  sceneId: string;
  documentarySourceContext: NonNullable<
    ReturnType<typeof normalizeCreatorDocumentarySourcePlanningContext>
  >;
  evidenceVisualContext: NonNullable<
    ReturnType<typeof normalizeCreatorEvidenceVisualPlanningContext>
  >;
};

export type CreatorEditorialPipelineResult = {
  productionPackage: unknown;
  scriptPlan: unknown;
  creatorScript: unknown;
  productionIntelligenceContexts: CreatorEditorialPipelineProductionIntelligenceContext[];
  editorialSummary: {
    researchSourceCount: number;
    readinessStatus: string | null;
    editorialReadinessScore: number | null;
  };
};

type JsonRecord = Record<string, unknown>;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

/** Exclude ambiguous identities rather than merging independently retrieved documents. */
export function selectUnambiguousPrimaryCandidates(values: JsonRecord[]) {
  const byId = new Map<string, Set<string>>();
  const byUrl = new Map<string, Set<string>>();
  const recordsById = new Map<string, Set<string>>();
  for (const value of values) {
    const id = clean(value.sourceId, 300);
    const url = canonicalResearchUrl(clean(value.url, 2_000));
    if (!id || !url) continue;
    const identities = byId.get(id) || new Set<string>();
    identities.add(url); byId.set(id, identities);
    const ids = byUrl.get(url) || new Set<string>();
    ids.add(id); byUrl.set(url, ids);
    const records = recordsById.get(id) || new Set<string>();
    records.add(JSON.stringify(value)); recordsById.set(id, records);
  }
  const selected = new Map<string, JsonRecord>();
  for (const value of values) {
    const id = clean(value.sourceId, 300);
    const url = canonicalResearchUrl(clean(value.url, 2_000));
    if (!id || !url || byId.get(id)?.size !== 1 || byUrl.get(url)?.size !== 1 || recordsById.get(id)?.size !== 1) continue;
    if (!selected.has(id)) selected.set(id, value);
  }
  return [...selected.values()];
}

export function editorialReadinessRequiresPrimaryAcquisition(value: unknown) {
  const readiness = asRecord(value);
  return asArray(readiness?.reviewReasons)
    .map((reason) => clean(reason, 120))
    .includes("PRIMARY_SOURCE_COVERAGE_REQUIRED");
}

function asPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function primarySourceIdsForClaim(
  values: unknown[],
  claim: ResearchClaim | null,
) {
  return values.flatMap((value) => {
    const source = asRecord(value);
    if (!source) return [];

    const sourceId = clean(source.sourceId, 300);
    if (!sourceId) return [];

    const normalizedSource = {
      ...source,
      sourceMetadata: asRecord(source.sourceMetadata) || {},
    } as unknown as ResearchSource;

    return researchSourceQualifiesAsPrimaryForClaim({
      source: normalizedSource,
      claim,
    })
      ? [sourceId]
      : [];
  });
}

function hasEditorialGraph(value: unknown): value is ResearchClaimEvidenceGraph {
  const graph = asRecord(value);
  return Boolean(
    graph &&
    Array.isArray(graph.sources) &&
    Array.isArray(graph.claims) &&
    Array.isArray(graph.evidence) &&
    Array.isArray(graph.links),
  );
}

function hasScriptEvidenceBindings(value: unknown): value is ScriptEvidenceBindingMap {
  const bindings = asRecord(value);
  return Boolean(bindings && Array.isArray(bindings.statements));
}

function createProductionIntelligenceContexts(input: {
  editorial: JsonRecord;
  scriptPlan: JsonRecord;
}): CreatorEditorialPipelineProductionIntelligenceContext[] {
  const productionPackage = asRecord(input.scriptPlan.productionPackage);
  const editorialEvidence = asRecord(productionPackage?.editorialEvidence);
  const bindingsValue = editorialEvidence?.binding;

  // Legacy/offline callers that do not contain the H-2H backstage binding remain
  // valid. Normal grounded CreatorLab output includes this binding.
  if (!hasScriptEvidenceBindings(bindingsValue)) return [];

  if (!hasEditorialGraph(input.editorial.graph)) {
    throw new CreatorEditorialPipelineError({
      stage: "script_plan",
      code: "EDITORIAL_PIPELINE_PI_GRAPH_MISSING",
      message: "Grounded production context could not be assembled.",
    });
  }

  const graph = input.editorial.graph;
  const sourceAssessments = asArray(
    input.editorial.sourceAssessments,
  ) as ResearchSourceAssessment[];
  const sourceReferences = graph.sources.map((source) =>
    createResearchSourceMediaReference(source),
  );
  const sceneIds = [...new Set(
    asArray(productionPackage?.scenes)
      .map((scene) => asPositiveInteger(asRecord(scene)?.id))
      .filter((sceneId): sceneId is number => sceneId !== null),
  )];

  return sceneIds.map((sceneId) => {
    const sceneContext = createCreatorSceneDocumentaryContext({
      sceneId,
      bindings: bindingsValue,
      graph,
      sourceReferences,
      sourceAssessments,
    });
    const documentarySourceContext =
      normalizeCreatorDocumentarySourcePlanningContext(
        sceneContext.documentarySourceContext,
      );
    const evidenceVisualContext = normalizeCreatorEvidenceVisualPlanningContext(
      sceneContext.evidenceVisualContext,
      sceneId,
    );

    if (!documentarySourceContext || !evidenceVisualContext) {
      throw new CreatorEditorialPipelineError({
        stage: "script_plan",
        code: "EDITORIAL_PIPELINE_PI_CONTEXT_INVALID",
        message: "Grounded production context could not be assembled.",
      });
    }

    return {
      sceneId: String(sceneId),
      documentarySourceContext,
      evidenceVisualContext,
    };
  });
}

async function parseJsonResponse(response: Response) {
  return await response.json().catch(() => ({})) as JsonRecord;
}

function responseMessage(payload: JsonRecord, fallback: string) {
  return clean(payload.error, 500) || fallback;
}

async function postJson(input: {
  stage: CreatorEditorialPipelineStage;
  url: string;
  accessToken: string;
  body: JsonRecord;
  fetchImpl: typeof fetch;
}) {
  const response = await input.fetchImpl(input.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify(input.body),
  });
  const payload = await parseJsonResponse(response);
  if (!response.ok || payload.success !== true) {
    const failure = new CreatorEditorialPipelineError({
      stage: input.stage,
      status: response.status,
      code: clean(payload.code, 120) || null,
      message: responseMessage(payload, `Creator editorial ${input.stage} failed.`),
    });
    if (input.stage === "script_plan" &&
        failure.code === "CREATOR_SCRIPT_DURATION_UNSATISFIED" &&
        payload.reviewOnly === true &&
        payload.reviewDraft && typeof payload.reviewDraft === "object") {
      failure.reviewOnlyDraft = payload.reviewDraft;
    }
    throw failure;
  }
  return payload;
}

/**
 * Runs the normal CreatorLab grounded editorial path before the existing Script
 * Planner. This helper intentionally fails closed: normal grounded production
 * never silently falls back to an ungrounded script when research or editorial
 * analysis fails.
 */
export async function runCreatorEditorialScriptPipeline(
  input: CreatorEditorialPipelineInput,
): Promise<CreatorEditorialPipelineResult> {
  const accessToken = clean(input.accessToken, 8_000);
  if (!accessToken) {
    throw new CreatorEditorialPipelineError({
      stage: "research",
      code: "EDITORIAL_PIPELINE_AUTH_REQUIRED",
      message: "A valid session is required for grounded editorial production.",
    });
  }
  const topicAuthority = normalizeCreatorTopicAuthority(input.topic);
  const topic = clean(input.researchSubject, 600) || clean(topicAuthority, 600);
  if (!topicAuthority) {
    throw new CreatorEditorialPipelineError({
      stage: "research",
      code: "EDITORIAL_PIPELINE_TOPIC_REQUIRED",
      message: "A topic is required for grounded editorial production.",
    });
  }
  const fetchImpl = input.fetchImpl || globalThis.fetch.bind(globalThis);
  await postJson({
    stage: "script_plan",
    url: "/api/creator-script-plan",
    accessToken,
    fetchImpl,
    body: {
      ...input.scriptPlanRequest,
      operation: "validate_generation_authority",
      topic,
      topicAuthority,
    },
  });

  const researchRequestBody = {
    mode: "orchestrated",
    subject: topic,
    includeRecentContext: input.includeRecentContext === true,
    maxResultsPerLane: input.maxResultsPerLane ?? 5,
  };

  const research = await postJson({
    stage: "research",
    url: "/api/creator-research",
    accessToken,
    fetchImpl,
    body: researchRequestBody,
  });

  let sources = Array.isArray(research.sources) ? research.sources : [];
  if (sources.length === 0) {
    throw new CreatorEditorialPipelineError({
      stage: "research",
      code: "EDITORIAL_PIPELINE_NO_SOURCES",
      message: "Grounded research returned no usable sources.",
    });
  }

  const sourceResearchPurposes: Record<string, string[]> = {};
  const addResearchPurposes = (payload: JsonRecord) => {
    for (const laneValue of asArray(payload.lanes)) {
      const lane = asRecord(laneValue);
      const purpose = clean(lane?.purpose, 80);
      if (!purpose) continue;
      for (const sourceIdValue of asArray(lane?.sourceIds)) {
        const sourceId = clean(sourceIdValue, 300);
        if (!sourceId) continue;
        sourceResearchPurposes[sourceId] = [
          ...new Set([...(sourceResearchPurposes[sourceId] || []), purpose]),
        ];
      }
    }
  };

  addResearchPurposes(research);

  let editorial = await postJson({
    stage: "editorial_analysis",
    url: "/api/creator-editorial-analysis",
    accessToken,
    fetchImpl,
    body: {
      topic,
      sources,
      sourceResearchPurposes,
      projectId: input.scriptPlanRequest.projectId,
      creatorProfile: input.creatorProfile ?? {},
    },
  });

  const parentProjectId = clean(input.scriptPlanRequest.projectId, 200);
  const parentSnapshotDigest = clean(editorial.sourceAuthoritySnapshotDigest, 64);
  const parentCurrent = () => Boolean(input.operationIsCurrent?.()) && clean(input.scriptPlanRequest.projectId, 200) === parentProjectId && clean(input.accessToken, 8_000) === accessToken;
  const parentFailure = (code: string, message: string) => new CreatorEditorialPipelineError({ stage: 'editorial_analysis', code, message });
  if (!parentProjectId || !/^[0-9a-f]{64}$/.test(parentSnapshotDigest) || !parentCurrent()) throw parentFailure('STALE_RESEARCH', 'The project or research changed. Restart the review.');
  const parentStatus = async (expectedRevision?: number) => {
    if (!parentCurrent()) throw parentFailure('STALE_RESEARCH', 'The project or research changed. Restart the review.');
    const response = await fetchImpl('/api/creator-evidence-evaluation', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${accessToken}` }, body:JSON.stringify({ operation:'review_status', projectId:parentProjectId, snapshotDigest:parentSnapshotDigest }) });
    const payload = await parseJsonResponse(response);
    if (!parentCurrent() || payload.status === 'STALE_RESEARCH') throw parentFailure('STALE_RESEARCH', 'The project or research changed. Restart the review.');
    if (!response.ok || payload.success !== true || payload.status === 'AUTHORITY_INVALID') throw parentFailure('AUTHORITY_INVALID', 'Source authority could not be verified.');
    const revision = asPositiveInteger(payload.researchRevision);
    if (payload.projectId !== parentProjectId || payload.snapshotDigest !== parentSnapshotDigest || revision === null || (expectedRevision !== undefined && revision !== expectedRevision)) throw parentFailure('STALE_RESEARCH', 'The project or research changed. Restart the review.');
    if (payload.status !== 'REVIEW_REQUIRED' && payload.status !== 'REVIEW_COMPLETE') throw parentFailure('AUTHORITY_INVALID', 'Source authority could not be verified.');
    return { payload, revision };
  };
  const initialParent = await parentStatus();
  if (initialParent.payload.status === 'REVIEW_REQUIRED') {
    const requirements = asArray(initialParent.payload.requirements).map(asRecord);
    if (requirements.some(item => !item || typeof item.claimId !== 'string' || typeof item.evidenceId !== 'string' || typeof item.sourceId !== 'string')) throw parentFailure('AUTHORITY_INVALID', 'Source authority could not be verified.');
    const pending: ParentSourceReview = { projectId:parentProjectId, snapshotDigest:parentSnapshotDigest, researchRevision:initialParent.revision, requirements:requirements as ParentSourceReview['requirements'] };
    if (!input.onParentSourceReview) { const error = parentFailure('SOURCE_AUTHORITY_REVIEW_REQUIRED', 'Authorized source review is required before continuing.'); error.parentReview = pending; throw error; }
    await input.onParentSourceReview(pending);
    const confirmed = await parentStatus(initialParent.revision);
    if (confirmed.payload.status !== 'REVIEW_COMPLETE') { const error = parentFailure('SOURCE_AUTHORITY_REVIEW_REQUIRED', 'Authorized source review is still required.'); error.parentReview = pending; throw error; }
  }

  const firstReadiness = asRecord(editorial.readiness);
  const firstPrimaryRequiredClaimIds = asArray(
    firstReadiness?.primarySourceRequiredClaimIds,
  )
    .map((value) => clean(value, 120))
    .filter(Boolean);
  const firstPrimaryCoveredClaimIds = new Set(
    asArray(firstReadiness?.primarySourceCoveredClaimIds)
      .map((value) => clean(value, 120))
      .filter(Boolean),
  );

  const firstGraph = asRecord(editorial.graph);
  const firstGraphClaims = asArray(firstGraph?.claims)
    .map((value) => asRecord(value))
    .filter((value): value is JsonRecord => value !== null);

  const primaryAcquisitionTargets = firstPrimaryRequiredClaimIds
    .filter((claimId) => !firstPrimaryCoveredClaimIds.has(claimId))
    .map((claimId) => {
      const claim = firstGraphClaims.find(
        (candidate) => clean(candidate.claimId, 120) === claimId,
      );

      const propositionKind = clean(claim?.propositionKind, 80);
      const origin = asRecord(claim?.origin);
      const authoritySubject =
        clean(origin?.attributedEntity, 240) ||
        clean(origin?.referencedWork, 320);
      const claimSubject = clean(claim?.text, 600) || topic;

      const retryClaimType =
        propositionKind === "original_research_result"
          ? "RESEARCH_FINDING"
          : propositionKind === "attributed_statement" ||
              propositionKind === "document_assertion" ||
              !propositionKind
            ? "PRIMARY_SOURCE_CLAIM"
            : null;

      if (!retryClaimType) {
        throw new CreatorEditorialPipelineError({
          stage: "editorial_analysis",
          code: "EDITORIAL_PIPELINE_PRIMARY_SOURCE_UNRESOLVED",
          message: "Required primary-source evidence could not be verified.",
        });
      }

      return {
        claimId,
        propositionKind: propositionKind || null,
        claimType: retryClaimType,
        claim: (claim || null) as unknown as ResearchClaim | null,
        subject: authoritySubject
          ? `${authoritySubject}: ${claimSubject}`.slice(0, 600)
          : claimSubject,
      };
    });

  if (editorialReadinessRequiresPrimaryAcquisition(firstReadiness)) {
    if (primaryAcquisitionTargets.length === 0) {
      throw new CreatorEditorialPipelineError({
        stage: "editorial_analysis",
        code: "EDITORIAL_PIPELINE_PRIMARY_SOURCE_UNRESOLVED",
        message: "Required primary-source evidence could not be verified.",
      });
    }

    const primarySourceCandidates: JsonRecord[] = [];

    const acquisitionDiagnostics: Array<{
      claimId: string;
      propositionKind: string | null;
      claimType: string;
      lanes: Array<{
        laneId: string;
        purpose: string;
        resultCount: number;
      }>;
      verifiedPrimarySourceIds: string[];
      result: string;
    }> = [];

    for (const target of primaryAcquisitionTargets) {
      const primaryResearch = await postJson({
        stage: "research",
        url: "/api/creator-research",
        accessToken,
        fetchImpl,
        body: {
          ...researchRequestBody,
          subject: target.subject,
          claimType: target.claimType,
        },
      });

      const primarySources = Array.isArray(primaryResearch.sources)
        ? primaryResearch.sources
        : [];

      addResearchPurposes(primaryResearch);

      for (const sourceValue of primarySources) {
        const source = asRecord(sourceValue);
        if (!source) continue;

        const sourceId = clean(source.sourceId, 300);
        const url = clean(source.url, 2_000);
        const normalizedSource = {
          ...source,
          sourceMetadata: asRecord(source.sourceMetadata) || {},
        } as unknown as ResearchSource;
        if (
          !sourceId ||
          !researchSourceQualifiesAsPrimaryForClaim({
            source: normalizedSource,
            claim: target.claim,
          })
        ) continue;
        if (!canonicalResearchUrl(url)) continue;
        primarySourceCandidates.push(source);
      }

      const verifiedPrimarySourceIds =
        primarySourceIdsForClaim(primarySources, target.claim);

      const lanes = asArray(primaryResearch.lanes).flatMap((value) => {
        const lane = asRecord(value);
        if (!lane) return [];

        const laneId = clean(lane.laneId, 120);
        const purpose = clean(lane.purpose, 80);
        if (!laneId || !purpose) return [];

        return [{
          laneId,
          purpose,
          resultCount: asArray(lane.sourceIds).length,
        }];
      });

      acquisitionDiagnostics.push({
        claimId: target.claimId,
        propositionKind: target.propositionKind,
        claimType: target.claimType,
        lanes,
        verifiedPrimarySourceIds,
        result: verifiedPrimarySourceIds.length > 0
          ? "verified_primary_available"
          : "verified_primary_missing",
      });

    }

    const candidatePrimarySources = selectUnambiguousPrimaryCandidates(primarySourceCandidates);
    if (candidatePrimarySources.length === 0) {
      console.info("CREATOR_EDITORIAL_PRIMARY_ACQUISITION", {
        targets: acquisitionDiagnostics,
        verifiedPrimarySourceIds: [],
        result: "verified_primary_missing_safe_exclusion_requested",
      });

      // No claim-qualified primary source was found. This is not sufficient
      // reason to abort the entire script. The trusted server coverage endpoint
      // receives an empty candidate set and derives a script-safe graph by
      // excluding only still-unverified mandatory-primary claims.
    }

    console.info("CREATOR_EDITORIAL_PRIMARY_ACQUISITION", {
      targets: acquisitionDiagnostics,
      verifiedPrimarySourceIds: candidatePrimarySources
        .map((source) => clean(source.sourceId, 300))
        .filter(Boolean),
      result: acquisitionDiagnostics.some(
        (diagnostic) => diagnostic.verifiedPrimarySourceIds.length === 0,
      )
        ? "pooled_primary_candidates_available"
        : "verified_primary_available",
    });

    const augmentedEditorial = await postJson({
      stage: "editorial_analysis",
      url: "/api/creator-editorial-primary-coverage",
      accessToken,
      fetchImpl,
      body: {
        frozenGraph: editorial.graph,
        projectId: input.scriptPlanRequest.projectId,
        parentSnapshotDigest: editorial.sourceAuthoritySnapshotDigest,
        originalPrimaryRequiredClaimIds: firstPrimaryRequiredClaimIds,
        candidateSources: candidatePrimarySources,
        creatorProfile: input.creatorProfile ?? {},
      },
    });

    const retryReadiness = asRecord(augmentedEditorial.readiness);
    const retryReviewReasons = asArray(retryReadiness?.reviewReasons)
      .map((value) => clean(value, 120))
      .filter(Boolean);

    const retryPrimaryRequiredClaimIds = asArray(
      retryReadiness?.primarySourceRequiredClaimIds,
    )
      .map((value) => clean(value, 120))
      .filter(Boolean);

    const retryPrimaryCoveredClaimIds = new Set(
      asArray(retryReadiness?.primarySourceCoveredClaimIds)
        .map((value) => clean(value, 120))
        .filter(Boolean),
    );

    const retryExcludedPrimaryClaimIds = asArray(
      augmentedEditorial.excludedPrimaryClaimIds,
    )
      .map((value) => clean(value, 120))
      .filter(Boolean);
    const retryExcludedPrimaryClaimIdSet = new Set(
      retryExcludedPrimaryClaimIds,
    );

    const retryPrimaryCoverageResolved =
      retryExcludedPrimaryClaimIds.length ===
        retryExcludedPrimaryClaimIdSet.size &&
      retryExcludedPrimaryClaimIds.every((claimId) =>
        firstPrimaryRequiredClaimIds.includes(claimId)
      ) &&
      retryPrimaryRequiredClaimIds.every((claimId) =>
        firstPrimaryRequiredClaimIds.includes(claimId) &&
        retryPrimaryCoveredClaimIds.has(claimId)
      ) &&
      firstPrimaryRequiredClaimIds.every((claimId) =>
        retryPrimaryCoveredClaimIds.has(claimId) ||
        retryExcludedPrimaryClaimIdSet.has(claimId)
      ) &&
      [...retryPrimaryCoveredClaimIds].every(
        (claimId) => !retryExcludedPrimaryClaimIdSet.has(claimId),
      ) &&
      !retryReviewReasons.includes("PRIMARY_SOURCE_COVERAGE_REQUIRED");

    if (!retryPrimaryCoverageResolved) {
      throw new CreatorEditorialPipelineError({
        stage: "editorial_analysis",
        code: "EDITORIAL_PIPELINE_PRIMARY_SOURCE_UNRESOLVED",
        message: "Required primary-source evidence could not be verified.",
      });
    }

    editorial = augmentedEditorial;
    const augmentedGraph = asRecord(editorial.graph);
    if (Array.isArray(augmentedGraph?.sources)) {
      sources = augmentedGraph.sources;
    }
  }

  let scriptContext = asRecord(editorial.scriptContext);
  if (!scriptContext) {
    throw new CreatorEditorialPipelineError({
      stage: "editorial_analysis",
      code: "EDITORIAL_PIPELINE_CONTEXT_MISSING",
      message: "Editorial analysis did not return a grounded script context.",
    });
  }

  const projectId = clean(input.scriptPlanRequest.projectId, 200);
  const snapshotDigest = clean(editorial.sourceAuthoritySnapshotDigest, 64);
  const isCurrent = () => Boolean(input.operationIsCurrent?.()) && clean(input.scriptPlanRequest.projectId, 200) === projectId && clean(input.accessToken, 8_000) === accessToken;
  const stale = () => new CreatorEditorialPipelineError({ stage: "editorial_analysis", code: "EDITORIAL_REVIEW_STALE", message: "The project or research changed. Refresh the evidence review." });
  if (!projectId || !/^[0-9a-f]{64}$/.test(snapshotDigest) || !isCurrent()) throw new CreatorEditorialPipelineError({ stage: "editorial_analysis", code: "EDITORIAL_EVALUATION_UNAVAILABLE", message: "Verified evidence evaluation is unavailable. Save or reload the project and retry." });
  let revision: number | null = null;
  const evaluate = async (scopeDecision?: CounterEvidenceScopeDecision) => {
    if (!isCurrent()) throw stale();
    let result: JsonRecord;
    try {
      result = await postJson({ stage: "editorial_analysis", url: "/api/creator-evidence-evaluation", accessToken, fetchImpl, body: { projectId, snapshotDigest, ...(scopeDecision ? { scopeDecision } : {}) } });
    } catch {
      if (!isCurrent()) throw stale();
      throw new CreatorEditorialPipelineError({ stage: "editorial_analysis", code: "EDITORIAL_EVALUATION_UNAVAILABLE", message: "Verified evidence evaluation is unavailable. Refresh the project and retry." });
    }
    if (!isCurrent()) throw stale();
    const currentRevision = asPositiveInteger(result.researchRevision);
    if (result.projectId !== projectId || result.snapshotDigest !== snapshotDigest || currentRevision === null || (revision !== null && revision !== currentRevision)) throw stale();
    revision = currentRevision;
    const review = asRecord(result.review);
    if (!review || typeof review.snapshotFingerprint !== "string" || !Array.isArray(review.claims) || !Array.isArray(review.unresolvedClaimIds) || !Array.isArray(result.blockingReasons)) throw new CreatorEditorialPipelineError({ stage: "editorial_analysis", code: "EDITORIAL_EVALUATION_INVALID", message: "The verified evidence evaluation was incomplete. Retry the review." });
    return { result, review: review as unknown as ReturnType<typeof createCounterEvidenceReview> };
  };
  const initialEvaluation = await evaluate();
  const blockers = asArray(initialEvaluation.result.blockingReasons).map(value => clean(value, 120)).filter(code => code && code !== "MATERIAL_COUNTER_EVIDENCE_REVIEW");
  if (blockers.length) throw new CreatorEditorialPipelineError({ stage: "editorial_analysis", code: "EDITORIAL_EVIDENCE_BLOCKED", message: `Evidence review is blocked: ${blockers.join(", ")}. Resolve these requirements before generating.` });
  const counterReview = initialEvaluation.review;
  if (counterReview.unresolvedClaimIds.length) {
    if (!input.onCounterEvidenceReview) throw new CreatorEditorialPipelineError({ stage: "editorial_analysis", code: "EDITORIAL_REVIEW_UNRESOLVED", message: "Evidence review is required before generation." });
    const decision = await input.onCounterEvidenceReview(counterReview);
    if (!decision) throw new CreatorEditorialPipelineError({ stage: "editorial_analysis", code: "EDITORIAL_REVIEW_STOPPED", message: `Review stopped. Unresolved claims: ${counterReview.unresolvedClaimIds.join(", ")}.` });
    if (!isCurrent()) throw stale();
    const scoped = await evaluate(decision);
    const remaining = scoped.review.unresolvedClaimIds;
    const scopeBlockers = asArray(scoped.result.blockingReasons).map(value => clean(value, 120)).filter(Boolean);
    if (remaining.length || scopeBlockers.length || !asRecord(scoped.result.proposedScope)) throw new CreatorEditorialPipelineError({ stage: "editorial_analysis", code: "EDITORIAL_REVIEW_UNRESOLVED", message: `The reviewed scope remains blocked: ${[...remaining, ...scopeBlockers].join(", ") || "invalid scope"}.` });
    scriptContext = asRecord(scoped.result.proposedScope)!;
  }
  if (!isCurrent()) throw stale();

  const scriptPlan = await postJson({
    stage: "script_plan",
    url: "/api/creator-script-plan",
    accessToken,
    fetchImpl,
    body: {
      ...input.scriptPlanRequest,
      topic,
      topicAuthority,
      scriptContext,
    },
  });

  const readiness = asRecord(editorial.readiness);
  const readinessScore = Number(readiness?.editorialReadinessScore);
  return {
    productionPackage: scriptPlan.productionPackage,
    scriptPlan: scriptPlan.scriptPlan,
    creatorScript: scriptPlan.creatorScript,
    productionIntelligenceContexts: createProductionIntelligenceContexts({
      editorial,
      scriptPlan,
    }),
    editorialSummary: {
      researchSourceCount: sources.length,
      readinessStatus: clean(readiness?.status, 40) || null,
      editorialReadinessScore: Number.isFinite(readinessScore)
        ? readinessScore
        : null,
    },
  };
}
