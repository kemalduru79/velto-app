import {
  normalizeCreatorDocumentarySourcePlanningContext,
  normalizeCreatorEvidenceVisualPlanningContext,
} from "../creator/productionIntelligenceRequest.ts";
import { createCreatorSceneDocumentaryContext } from "../creator/sceneDocumentaryContext.ts";
import type { ResearchClaimEvidenceGraph } from "./claimEvidenceGraph.ts";
import type { ResearchSourceAssessment } from "./sourceAssessment.ts";
import { createResearchSourceMediaReference } from "./sourceMediaReference.ts";
import type { ScriptEvidenceBindingMap } from "./scriptEvidenceBinding.ts";

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

function asPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
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
  const topic = clean(input.topic, 600);
  if (!topic) {
    throw new CreatorEditorialPipelineError({
      stage: "research",
      code: "EDITORIAL_PIPELINE_TOPIC_REQUIRED",
      message: "A topic is required for grounded editorial production.",
    });
  }
  const fetchImpl = input.fetchImpl || fetch;

  const research = await postJson({
    stage: "research",
    url: "/api/creator-research",
    accessToken,
    fetchImpl,
    body: {
      mode: "orchestrated",
      subject: topic,
      includeRecentContext: input.includeRecentContext === true,
      maxResultsPerLane: input.maxResultsPerLane ?? 5,
    },
  });
  const sources = Array.isArray(research.sources) ? research.sources : [];
  if (sources.length === 0) {
    throw new CreatorEditorialPipelineError({
      stage: "research",
      code: "EDITORIAL_PIPELINE_NO_SOURCES",
      message: "Grounded research returned no usable sources.",
    });
  }

  const editorial = await postJson({
    stage: "editorial_analysis",
    url: "/api/creator-editorial-analysis",
    accessToken,
    fetchImpl,
    body: {
      topic,
      sources,
      creatorProfile: input.creatorProfile ?? {},
    },
  });
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
      scriptContext,
    },
  });

  const readiness = asRecord(editorial.readiness);
  const readinessScore = Number(readiness?.editorialReadinessScore);
  return {
    productionPackage: scriptPlan.productionPackage,
    scriptPlan: scriptPlan.scriptPlan,
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
