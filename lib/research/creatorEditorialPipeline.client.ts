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

export type CreatorEditorialPipelineResult = {
  productionPackage: unknown;
  scriptPlan: unknown;
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
      includeRecentContext: input.includeRecentContext !== false,
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
    editorialSummary: {
      researchSourceCount: sources.length,
      readinessStatus: clean(readiness?.status, 40) || null,
      editorialReadinessScore: Number.isFinite(readinessScore)
        ? readinessScore
        : null,
    },
  };
}
