import {
  normalizeCreatorDocumentarySourcePlanningContext,
  normalizeCreatorEvidenceVisualPlanningContext,
} from "../creator/productionIntelligenceRequest.ts";
import { createCreatorSceneDocumentaryContext } from "../creator/sceneDocumentaryContext.ts";
import type {
  ResearchClaim,
  ResearchClaimEvidenceGraph,
} from "./claimEvidenceGraph.ts";
import type { ResearchSourceAssessment } from "./sourceAssessment.ts";
import { researchSourceIsPrimaryForClaim } from "./sourceAssessment.ts";
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

export type CreatorEditorialPipelineInput = {
  accessToken: string;
  topic: string;
  researchSubject?: string;
  creatorProfile?: unknown;
  scriptPlanRequest: Record<string, unknown>;
  includeRecentContext?: boolean;
  maxResultsPerLane?: number;
  fetchImpl?: typeof fetch;
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

    return researchSourceIsPrimaryForClaim(normalizedSource, claim)
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
    throw new CreatorEditorialPipelineError({
      stage: input.stage,
      status: response.status,
      code: clean(payload.code, 120) || null,
      message: responseMessage(payload, `Creator editorial ${input.stage} failed.`),
    });
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
      creatorProfile: input.creatorProfile ?? {},
    },
  });

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

    const candidatePrimarySources = new Map<string, JsonRecord>();

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
          !researchSourceIsPrimaryForClaim(normalizedSource, target.claim)
        ) continue;
        const key = canonicalResearchUrl(url) || sourceId;
        if (!key) continue;

        candidatePrimarySources.set(key, source);
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

    if (candidatePrimarySources.size === 0) {
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
      verifiedPrimarySourceIds: [...candidatePrimarySources.values()]
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
        originalPrimaryRequiredClaimIds: firstPrimaryRequiredClaimIds,
        candidateSources: [...candidatePrimarySources.values()],
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

  const scriptContext = asRecord(editorial.scriptContext);
  if (!scriptContext) {
    throw new CreatorEditorialPipelineError({
      stage: "editorial_analysis",
      code: "EDITORIAL_PIPELINE_CONTEXT_MISSING",
      message: "Editorial analysis did not return a grounded script context.",
    });
  }

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
