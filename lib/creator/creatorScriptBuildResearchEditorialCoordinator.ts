import { createCreatorScriptBuildEditorialRecoveryContext, type CreatorScriptBuildEditorialRecoveryContext } from "./creatorScriptBuildEditorialAdjudicationRecovery.ts";
import { createHash } from "node:crypto";
import {
  canonicalCreatorScriptBuildJson,
  createCreatorScriptBuildCheckpointId,
  createCreatorScriptBuildFailure,
  creatorScriptBuildIsTerminal,
  creatorScriptBuildIsStale,
  creatorScriptBuildOperationIsReusable,
  type CreatorScriptBuildCheckpoint,
  type CreatorScriptBuildFailure,
  type CreatorScriptBuildFailureCategory,
  type CreatorScriptBuildJson,
  type CreatorScriptBuildRecord,
  type CreatorScriptBuildSnapshot,
} from "./creatorScriptBuild.ts";
import type { CreatorScriptBuildRepository } from "../persistence/creatorScriptBuilds/types.ts";
import {
  compileCanonicalEditorialGraph,
} from "../research/canonicalEditorialGraphCompiler.ts";
import {
  createEditorialEvidenceSpanCatalog,
  type EditorialEvidenceSpanCatalog,
} from "../research/editorialEvidenceSpanCatalog.ts";
import {
  normalizeEditorialProposalV2,
  type EditorialProposalV2,
} from "../research/editorialProposalV2.ts";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
  type ResearchSourceAssessment,
} from "../research/sourceAssessment.ts";
import type {
  ResearchSource,
  ResearchSourceAdapterId,
  ResearchSourceLanguage,
  ResearchSourceMediaKind,
  ResearchSourceMetadataValue,
} from "../research/sourceContract.ts";
import type { ResearchClaimEvidenceGraph } from "../research/claimEvidenceGraph.ts";

export const CREATOR_SCRIPT_BUILD_RESEARCH_EDITORIAL_COORDINATOR_VERSION =
  "0.19E2A-A2" as const;
export const CREATOR_SCRIPT_BUILD_RESEARCH_OPERATION_CONTRACT_VERSION =
  "creator-script-build-research-v1" as const;
export const CREATOR_SCRIPT_BUILD_EDITORIAL_OPERATION_CONTRACT_VERSION =
  "creator-script-build-editorial-proposal-v3" as const;
export const CREATOR_SCRIPT_BUILD_RESEARCH_CHECKPOINT_VERSION =
  "creator-script-build-research-checkpoint-v1" as const;
export const CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_VERSION =
  "creator-script-build-editorial-checkpoint-v3" as const;
export const CREATOR_SCRIPT_BUILD_STAGE_SEMANTIC_VERSION =
  "creator-script-build-stage-semantic-v1" as const;

const RESEARCH_OPERATION_TYPE = "creator_research_orchestration_v2";
const EDITORIAL_OPERATION_TYPE = "creator_editorial_proposal_v2";
const DEFAULT_MAX_RESULTS_PER_LANE = 5;

const RESEARCH_LANE_PURPOSES = new Set([
  "baseline",
  "primary_source",
  "supporting_evidence",
  "counter_evidence",
  "recent_context",
]);
const SOURCE_ADAPTER_IDS = new Set<ResearchSourceAdapterId>([
  "youtube",
  "web",
  "primary",
  "academic",
  "news",
]);
const SOURCE_MEDIA_KINDS = new Set<ResearchSourceMediaKind>([
  "video",
  "article",
  "paper",
  "document",
  "webpage",
  "other",
]);
const BUILD_FAILURE_CATEGORIES = new Set<CreatorScriptBuildFailureCategory>([
  "INPUT",
  "AUTHORITY",
  "RESEARCH",
  "PROVIDER",
  "MODEL_CONTRACT",
  "GROUNDING",
  "EDITORIAL_POLICY",
  "SCRIPT_POLICY",
  "INTERNAL",
]);

export type CreatorScriptBuildResearchLaneResult = Readonly<{
  laneId: string;
  purpose:
    | "baseline"
    | "primary_source"
    | "supporting_evidence"
    | "counter_evidence"
    | "recent_context";
  required: boolean;
  status: "ready" | "failed";
  sourceIds: readonly string[];
}>;

export type CreatorScriptBuildResearchStageResult = Readonly<{
  version: "0.19E2A-research-result-v1";
  sources: readonly ResearchSource[];
  lanes: readonly CreatorScriptBuildResearchLaneResult[];
}>;

export type CreatorScriptBuildResearchExecutionInput = Readonly<{
  version: "0.19E2A-research-request-v1";
  subject: string;
  language: "tr" | "en";
  includeRecentContext: false;
  maxResultsPerLane: 5;
}>;

export type CreatorScriptBuildEditorialExecutionInput = Readonly<{
  version: "0.19E2A-editorial-request-v1";
  topic: string;
  creatorProfile: Readonly<Record<string, CreatorScriptBuildJson>>;
  sources: readonly ResearchSource[];
  sourceResearchPurposes: Readonly<Record<string, readonly string[]>>;
  candidateSpans: ReadonlyArray<Readonly<{
    spanId: string;
    sourceId: string;
    text: string;
    evidenceSpecificity: "concrete_observation" | "abstract_or_conceptual";
  }>>;
}>;

export type CreatorScriptBuildEditorialStageResult = Readonly<{
  version: "0.19E2A-editorial-result-v1";
  graph: ResearchClaimEvidenceGraph;
  sourceAssessments: readonly ResearchSourceAssessment[];
  spanCatalogVersion: string;
  segmentationVersion: string;
  proposalOperationId: string;
}>;

export type CreatorScriptBuildResearchEditorialCoordinatorResult = Readonly<{
  version: typeof CREATOR_SCRIPT_BUILD_RESEARCH_EDITORIAL_COORDINATOR_VERSION;
  build: CreatorScriptBuildRecord;
  research: CreatorScriptBuildResearchStageResult | null;
  editorial: CreatorScriptBuildEditorialStageResult | null;
  disposition: "ADVANCED" | "ALREADY_ADVANCED" | "TERMINAL";
}>;

export type CreatorScriptBuildResearchExecutor = (
  input: CreatorScriptBuildResearchExecutionInput,
) => Promise<unknown>;

export type CreatorScriptBuildEditorialProposalExecutor = (
  input: CreatorScriptBuildEditorialExecutionInput,
  recovery?: CreatorScriptBuildEditorialRecoveryContext,
) => Promise<unknown>;

export type CreatorScriptBuildResearchEditorialCoordinatorDependencies = Readonly<{
  repository: CreatorScriptBuildRepository;
  getCurrentProjectRevision: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<string | null>;
  executeResearch: CreatorScriptBuildResearchExecutor;
  executeEditorialProposal: CreatorScriptBuildEditorialProposalExecutor;
  now?: () => string;
}>;

export class CreatorScriptBuildStageExecutionError extends Error {
  readonly category: CreatorScriptBuildFailureCategory;
  readonly code: string;
  readonly retryability: CreatorScriptBuildFailure["retryability"];
  readonly diagnostics: Readonly<Record<string, string | number | boolean | null>>;

  constructor(input: {
    category: CreatorScriptBuildFailureCategory;
    code: string;
    message?: string;
    retryability: CreatorScriptBuildFailure["retryability"];
    diagnostics?: Record<string, string | number | boolean | null>;
  }) {
    super(input.message || input.code);
    this.name = "CreatorScriptBuildStageExecutionError";
    this.category = input.category;
    this.code = input.code;
    this.retryability = input.retryability;
    this.diagnostics = Object.freeze({ ...(input.diagnostics || {}) });
  }
}

export class CreatorScriptBuildCoordinatorBlockedError extends Error {
  readonly code: string;
  readonly buildId: string;
  readonly operationId: string | null;

  constructor(input: {
    code: string;
    buildId: string;
    operationId?: string | null;
  }) {
    super(input.code);
    this.name = "CreatorScriptBuildCoordinatorBlockedError";
    this.code = input.code;
    this.buildId = input.buildId;
    this.operationId = input.operationId ?? null;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredText(value: unknown, code: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maxLength) throw new Error(code);
  return normalized;
}

function optionalText(value: unknown, maxLength: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error("CREATOR_SCRIPT_BUILD_SOURCE_TEXT_INVALID");
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length > maxLength) {
    throw new Error("CREATOR_SCRIPT_BUILD_SOURCE_TEXT_TOO_LONG");
  }
  return normalized || null;
}

function finiteMetric(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("CREATOR_SCRIPT_BUILD_RESEARCH_METRIC_INVALID");
  }
  return parsed;
}

function normalizeSourceMetadata(value: unknown) {
  const source = record(value) || {};
  const output: Record<string, ResearchSourceMetadataValue> = {};
  for (const key of Object.keys(source).sort()) {
    const item = source[key];
    if (
      item !== null &&
      typeof item !== "string" &&
      typeof item !== "number" &&
      typeof item !== "boolean"
    ) {
      throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_METADATA_INVALID:${key}`);
    }
    if (typeof item === "number" && !Number.isFinite(item)) {
      throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_METADATA_INVALID:${key}`);
    }
    output[key] = item as ResearchSourceMetadataValue;
  }
  return output;
}

function normalizeResearchSource(value: unknown, index: number): ResearchSource {
  const source = record(value);
  if (!source) {
    throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_INVALID:${index + 1}`);
  }
  const adapterId = source.adapterId;
  const mediaKind = source.mediaKind;
  const language = source.language;
  if (typeof adapterId !== "string" || !SOURCE_ADAPTER_IDS.has(adapterId as ResearchSourceAdapterId)) {
    throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_ADAPTER_INVALID:${index + 1}`);
  }
  if (typeof mediaKind !== "string" || !SOURCE_MEDIA_KINDS.has(mediaKind as ResearchSourceMediaKind)) {
    throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_KIND_INVALID:${index + 1}`);
  }
  if (language !== null && language !== "tr" && language !== "en") {
    throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_LANGUAGE_INVALID:${index + 1}`);
  }
  const metrics = record(source.metrics) || {};
  return {
    sourceId: requiredText(source.sourceId, `CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_ID_REQUIRED:${index + 1}`, 300),
    adapterId: adapterId as ResearchSourceAdapterId,
    mediaKind: mediaKind as ResearchSourceMediaKind,
    externalId: optionalText(source.externalId, 500),
    title: requiredText(source.title, `CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_TITLE_REQUIRED:${index + 1}`, 1_000),
    url: requiredText(source.url, `CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_URL_REQUIRED:${index + 1}`, 4_000),
    publisher: typeof source.publisher === "string"
      ? source.publisher.replace(/\s+/gu, " ").trim().slice(0, 500)
      : "",
    author: optionalText(source.author, 500),
    publishedAt: optionalText(source.publishedAt, 120),
    language: language as ResearchSourceLanguage,
    summary: optionalText(source.summary, 20_000),
    thumbnailUrl: optionalText(source.thumbnailUrl, 4_000),
    durationSec: source.durationSec == null ? null : finiteMetric(source.durationSec),
    metrics: {
      ...(Object.hasOwn(metrics, "views") ? { views: finiteMetric(metrics.views) } : {}),
      ...(Object.hasOwn(metrics, "likes") ? { likes: finiteMetric(metrics.likes) } : {}),
    },
    sourceMetadata: normalizeSourceMetadata(source.sourceMetadata),
  };
}

function normalizeResearchResult(value: unknown): CreatorScriptBuildResearchStageResult {
  const raw = record(value);
  if (!raw || !Array.isArray(raw.sources) || !Array.isArray(raw.lanes)) {
    throw new Error("CREATOR_SCRIPT_BUILD_RESEARCH_RESULT_INVALID");
  }
  if (raw.sources.length === 0 || raw.sources.length > 80) {
    throw new Error("CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_COUNT_INVALID");
  }
  const sources = raw.sources
    .map((source, index) => normalizeResearchSource(source, index))
    .toSorted((left, right) => left.sourceId.localeCompare(right.sourceId));
  const sourceIds = new Set<string>();
  for (const source of sources) {
    if (sourceIds.has(source.sourceId)) {
      throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_SOURCE_DUPLICATE:${source.sourceId}`);
    }
    sourceIds.add(source.sourceId);
  }
  if (raw.lanes.length === 0 || raw.lanes.length > 12) {
    throw new Error("CREATOR_SCRIPT_BUILD_RESEARCH_LANE_COUNT_INVALID");
  }
  const seenLaneIds = new Set<string>();
  const lanes = raw.lanes.map((value, index) => {
    const lane = record(value);
    if (!lane) throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_LANE_INVALID:${index + 1}`);
    const laneId = requiredText(lane.laneId, `CREATOR_SCRIPT_BUILD_RESEARCH_LANE_ID_REQUIRED:${index + 1}`, 160);
    if (seenLaneIds.has(laneId)) {
      throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_LANE_DUPLICATE:${laneId}`);
    }
    seenLaneIds.add(laneId);
    const purpose = lane.purpose;
    if (typeof purpose !== "string" || !RESEARCH_LANE_PURPOSES.has(purpose)) {
      throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_LANE_PURPOSE_INVALID:${laneId}`);
    }
    if (typeof lane.required !== "boolean") {
      throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_LANE_REQUIRED_INVALID:${laneId}`);
    }
    if (lane.status !== "ready" && lane.status !== "failed") {
      throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_LANE_STATUS_INVALID:${laneId}`);
    }
    const rawSourceIds = Array.isArray(lane.sourceIds) ? lane.sourceIds : [];
    const normalizedSourceIds = [...new Set(rawSourceIds.map((sourceId) =>
      requiredText(sourceId, `CREATOR_SCRIPT_BUILD_RESEARCH_LANE_SOURCE_ID_INVALID:${laneId}`, 300)
    ))].toSorted();
    for (const sourceId of normalizedSourceIds) {
      if (!sourceIds.has(sourceId)) {
        throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_LANE_SOURCE_MISSING:${laneId}:${sourceId}`);
      }
    }
    if (lane.status === "failed" && normalizedSourceIds.length > 0) {
      throw new Error(`CREATOR_SCRIPT_BUILD_RESEARCH_FAILED_LANE_HAS_SOURCES:${laneId}`);
    }
    return {
      laneId,
      purpose: purpose as CreatorScriptBuildResearchLaneResult["purpose"],
      required: lane.required,
      status: lane.status as CreatorScriptBuildResearchLaneResult["status"],
      sourceIds: normalizedSourceIds,
    };
  }).toSorted((left, right) => left.laneId.localeCompare(right.laneId));

  return Object.freeze({
    version: "0.19E2A-research-result-v1" as const,
    sources,
    lanes,
  });
}

function buildJson(value: unknown): CreatorScriptBuildJson {
  return JSON.parse(canonicalCreatorScriptBuildJson(value)) as CreatorScriptBuildJson;
}

function stageFingerprint(contractVersion: string, value: unknown) {
  return `${CREATOR_SCRIPT_BUILD_STAGE_SEMANTIC_VERSION}:${createHash("sha256")
    .update(canonicalCreatorScriptBuildJson({ contractVersion, value }), "utf8")
    .digest("hex")}`;
}

export function createCreatorScriptBuildResearchExecutionInput(
  snapshot: CreatorScriptBuildSnapshot,
): CreatorScriptBuildResearchExecutionInput {
  return Object.freeze({
    version: "0.19E2A-research-request-v1" as const,
    subject: snapshot.strategy.researchSubject || snapshot.strategy.topic,
    language: snapshot.language,
    includeRecentContext: false as const,
    maxResultsPerLane: DEFAULT_MAX_RESULTS_PER_LANE,
  });
}

function createSourceResearchPurposes(
  research: CreatorScriptBuildResearchStageResult,
) {
  const purposes = new Map<string, Set<string>>();
  for (const lane of research.lanes) {
    for (const sourceId of lane.sourceIds) {
      const current = purposes.get(sourceId) || new Set<string>();
      current.add(lane.purpose);
      purposes.set(sourceId, current);
    }
  }
  return Object.fromEntries(
    [...purposes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceId, values]) => [sourceId, [...values].sort()]),
  );
}

function createEditorialExecutionMaterial(input: {
  snapshot: CreatorScriptBuildSnapshot;
  research: CreatorScriptBuildResearchStageResult;
}) {
  const spanCatalog = createEditorialEvidenceSpanCatalog(input.research.sources);
  const executionInput: CreatorScriptBuildEditorialExecutionInput = Object.freeze({
    version: "0.19E2A-editorial-request-v1" as const,
    topic: input.snapshot.strategy.researchSubject || input.snapshot.strategy.topic,
    creatorProfile: input.snapshot.creatorProfile,
    sources: input.research.sources,
    sourceResearchPurposes: createSourceResearchPurposes(input.research),
    candidateSpans: spanCatalog.spans.map((span) => ({
      spanId: span.spanId,
      sourceId: span.sourceId,
      text: span.text,
      evidenceSpecificity: span.evidenceSpecificity,
    })),
  });
  return { executionInput, spanCatalog };
}

function normalizedEditorialProposalFromExecution(value: unknown): EditorialProposalV2 {
  const raw = record(value);
  if (!raw || !Object.hasOwn(raw, "proposal")) {
    throw new Error("CREATOR_SCRIPT_BUILD_EDITORIAL_PROVIDER_RESULT_INVALID");
  }
  return normalizeEditorialProposalV2(raw.proposal);
}

function normalizedEditorialProposalFromOperation(value: CreatorScriptBuildJson | null) {
  const raw = record(value);
  if (!raw || raw.version !== "0.19E2A-editorial-operation-result-v1") {
    throw new Error("CREATOR_SCRIPT_BUILD_EDITORIAL_OPERATION_RESULT_INVALID");
  }
  return normalizeEditorialProposalV2(raw.proposal);
}

function normalizeResearchResultFromOperation(value: CreatorScriptBuildJson | null) {
  const raw = record(value);
  if (!raw || raw.version !== "0.19E2A-research-operation-result-v1") {
    throw new Error("CREATOR_SCRIPT_BUILD_RESEARCH_OPERATION_RESULT_INVALID");
  }
  return normalizeResearchResult(raw.result);
}

function normalizeResearchResultFromCheckpoint(value: CreatorScriptBuildJson | null) {
  const raw = record(value);
  if (!raw || raw.version !== "0.19E2A-research-checkpoint-output-v1") {
    throw new Error("CREATOR_SCRIPT_BUILD_RESEARCH_CHECKPOINT_OUTPUT_INVALID");
  }
  return normalizeResearchResult(raw.result);
}

export function normalizeCreatorScriptBuildEditorialResultFromCheckpoint(
  value: CreatorScriptBuildJson | null,
) {
  const raw = record(value);
  if (!raw || raw.version !== "0.19E2A-editorial-checkpoint-output-v1") {
    throw new Error("CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_OUTPUT_INVALID");
  }
  return raw.result as unknown as CreatorScriptBuildEditorialStageResult;
}

function createSourceAssessments(sources: readonly ResearchSource[]) {
  return sources
    .map((source) => {
      const classification = classifyResearchSourceDirectness(source);
      return assessResearchSource(source, classification.directness);
    })
    .toSorted((left, right) => left.sourceId.localeCompare(right.sourceId));
}

function compileEditorialResult(input: {
  proposal: EditorialProposalV2;
  research: CreatorScriptBuildResearchStageResult;
  spanCatalog: EditorialEvidenceSpanCatalog;
  operationId: string;
}): CreatorScriptBuildEditorialStageResult {
  const graph = compileCanonicalEditorialGraph({
    proposal: input.proposal,
    sources: input.research.sources,
    spanCatalog: input.spanCatalog.spans,
  });
  return Object.freeze({
    version: "0.19E2A-editorial-result-v1" as const,
    graph,
    sourceAssessments: createSourceAssessments(input.research.sources),
    spanCatalogVersion: input.spanCatalog.version,
    segmentationVersion: input.spanCatalog.segmentationVersion,
    proposalOperationId: input.operationId,
  });
}

function checkpoint(input: {
  buildId: string;
  stage: "research" | "editorial";
  status: CreatorScriptBuildCheckpoint["status"];
  contractVersion: string;
  operationId: string | null;
  outputReference: CreatorScriptBuildJson | null;
  diagnostics: Record<string, string | number | boolean | null>;
  previous?: CreatorScriptBuildCheckpoint | null;
  now: () => string;
}): CreatorScriptBuildCheckpoint {
  const startedAt = input.previous?.startedAt || (input.status === "RUNNING" ? input.now() : null);
  const completedAt = input.status === "COMPLETED" || input.status === "FAILED"
    ? input.now()
    : null;
  return {
    checkpointId: createCreatorScriptBuildCheckpointId({
      buildId: input.buildId,
      stage: input.stage,
      contractVersion: input.contractVersion,
    }),
    stage: input.stage,
    status: input.status,
    contractVersion: input.contractVersion,
    operationId: input.operationId,
    outputReference: input.outputReference,
    diagnostics: Object.freeze({ ...input.diagnostics }),
    startedAt,
    completedAt,
  };
}

function stageFailure(input: {
  category: CreatorScriptBuildFailureCategory;
  code: string;
  stage: "research" | "editorial";
  retryability?: CreatorScriptBuildFailure["retryability"];
  operationId?: string | null;
  diagnostics?: Record<string, string | number | boolean | null>;
}) {
  return createCreatorScriptBuildFailure({
    category: input.category,
    code: input.code,
    stage: input.stage,
    retryability: input.retryability || "NON_RETRYABLE",
    operationId: input.operationId || null,
    diagnostics: input.diagnostics || {},
  });
}

async function failBuild(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  failure: CreatorScriptBuildFailure;
}) {
  return await input.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: input.build.state,
    nextState: "FAILED",
    failure: input.failure,
  });
}

async function markStale(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  stage: "snapshot" | "research" | "editorial";
  currentProjectRevision: string | null;
}) {
  const failure = createCreatorScriptBuildFailure({
    category: "AUTHORITY",
    code: input.currentProjectRevision
      ? "CREATOR_SCRIPT_BUILD_PROJECT_STALE"
      : "CREATOR_SCRIPT_BUILD_PROJECT_AUTHORITY_MISSING",
    stage: input.stage,
    retryability: "NON_RETRYABLE",
    diagnostics: {},
  });
  return await input.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: input.build.state,
    nextState: input.currentProjectRevision ? "STALE" : "FAILED",
    failure,
  });
}

function assertCoordinatorContractAuthority(snapshot: CreatorScriptBuildSnapshot) {
  if (
    snapshot.contractVersions.creatorScriptResearchEditorialCoordinator !==
      CREATOR_SCRIPT_BUILD_RESEARCH_EDITORIAL_COORDINATOR_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_RESEARCH_EDITORIAL_CONTRACT_MISMATCH");
  }
}

function assertCheckpointContract(input: {
  checkpoint: CreatorScriptBuildCheckpoint | null;
  expectedContractVersion: string;
  stage: "research" | "editorial";
}) {
  if (
    input.checkpoint &&
    input.checkpoint.contractVersion !== input.expectedContractVersion
  ) {
    throw new Error(
      `CREATOR_SCRIPT_BUILD_${input.stage.toUpperCase()}_CHECKPOINT_CONTRACT_MISMATCH`,
    );
  }
}

async function assertCurrentProjectAuthority(input: {
  dependencies: CreatorScriptBuildResearchEditorialCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
  stage: "snapshot" | "research" | "editorial";
}) {
  const currentProjectRevision = await input.dependencies.getCurrentProjectRevision({
    ownerId: input.build.ownerId,
    projectId: input.build.projectId,
  });
  if (
    !currentProjectRevision ||
    creatorScriptBuildIsStale({
      snapshot: input.build.snapshot,
      currentProjectRevision,
    })
  ) {
    const build = await markStale({
      repository: input.dependencies.repository,
      build: input.build,
      stage: input.stage,
      currentProjectRevision,
    });
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: build.state === "STALE"
        ? "CREATOR_SCRIPT_BUILD_PROJECT_STALE"
        : "CREATOR_SCRIPT_BUILD_PROJECT_AUTHORITY_MISSING",
      buildId: build.buildId,
    });
  }
}

async function saveFailedCheckpoint(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  stage: "research" | "editorial";
  contractVersion: string;
  operationId: string | null;
  failure: CreatorScriptBuildFailure;
  now: () => string;
}) {
  const previous = input.build.checkpoints[input.stage] || null;
  if (previous?.status === "FAILED") return input.build;
  if (previous?.status === "COMPLETED") {
    throw new Error(`CREATOR_SCRIPT_BUILD_${input.stage.toUpperCase()}_CHECKPOINT_ALREADY_COMPLETED`);
  }
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: input.build.state,
    checkpoint: checkpoint({
      buildId: input.build.buildId,
      stage: input.stage,
      status: "FAILED",
      contractVersion: input.contractVersion,
      operationId: input.operationId,
      outputReference: null,
      diagnostics: {
        failureCategory: input.failure.category,
        failureCode: input.failure.code,
        retryability: input.failure.retryability,
      },
      previous,
      now: input.now,
    }),
  });
}

async function ensurePendingCheckpoint(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  stage: "research" | "editorial";
  contractVersion: string;
  now: () => string;
}) {
  const existing = input.build.checkpoints[input.stage] || null;
  assertCheckpointContract({
    checkpoint: existing,
    expectedContractVersion: input.contractVersion,
    stage: input.stage,
  });
  if (existing) return input.build;
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: input.build.state,
    checkpoint: checkpoint({
      buildId: input.build.buildId,
      stage: input.stage,
      status: "PENDING",
      contractVersion: input.contractVersion,
      operationId: null,
      outputReference: null,
      diagnostics: {},
      now: input.now,
    }),
  });
}

function failureFromExecutionError(input: {
  error: CreatorScriptBuildStageExecutionError;
  stage: "research" | "editorial";
  operationId: string;
}) {
  return stageFailure({
    category: input.error.category,
    code: input.error.code,
    stage: input.stage,
    retryability: input.error.retryability,
    operationId: input.operationId,
    diagnostics: { ...input.error.diagnostics },
  });
}

async function handleExistingFailedOperation(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  stage: "research" | "editorial";
  contractVersion: string;
  operationId: string;
  failure: CreatorScriptBuildFailure | null;
  now: () => string;
}): Promise<never> {
  const failure = input.failure || stageFailure({
    category: "INTERNAL",
    code: "CREATOR_SCRIPT_BUILD_OPERATION_FAILED_WITHOUT_FAILURE",
    stage: input.stage,
    operationId: input.operationId,
  });
  const withCheckpoint = await saveFailedCheckpoint({
    repository: input.repository,
    build: input.build,
    stage: input.stage,
    contractVersion: input.contractVersion,
    operationId: input.operationId,
    failure,
    now: input.now,
  });
  const failed = await failBuild({ repository: input.repository, build: withCheckpoint, failure });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: failure.code,
    buildId: failed.buildId,
    operationId: input.operationId,
  });
}

function failureFromFailedCheckpoint(input: {
  checkpoint: CreatorScriptBuildCheckpoint;
  stage: "research" | "editorial";
}) {
  const diagnostics = input.checkpoint.diagnostics;
  const category = typeof diagnostics.failureCategory === "string" &&
      BUILD_FAILURE_CATEGORIES.has(
        diagnostics.failureCategory as CreatorScriptBuildFailureCategory,
      )
    ? diagnostics.failureCategory as CreatorScriptBuildFailureCategory
    : "INTERNAL";
  const retryability = diagnostics.retryability === "RETRYABLE" ||
      diagnostics.retryability === "UNKNOWN_OUTCOME" ||
      diagnostics.retryability === "NON_RETRYABLE"
    ? diagnostics.retryability
    : "NON_RETRYABLE";
  return stageFailure({
    category,
    code: typeof diagnostics.failureCode === "string" && diagnostics.failureCode.trim()
      ? diagnostics.failureCode
      : `CREATOR_SCRIPT_BUILD_${input.stage.toUpperCase()}_CHECKPOINT_FAILED`,
    stage: input.stage,
    retryability,
    operationId: input.checkpoint.operationId,
  });
}

async function failFromFailedCheckpoint(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  stage: "research" | "editorial";
  checkpoint: CreatorScriptBuildCheckpoint;
}): Promise<never> {
  let failure = failureFromFailedCheckpoint({
    checkpoint: input.checkpoint,
    stage: input.stage,
  });
  if (input.checkpoint.operationId) {
    const operation = await input.repository.getOperationForOwner(
      input.checkpoint.operationId,
      input.build.buildId,
      input.build.ownerId,
    );
    if (operation?.failure) failure = operation.failure;
  }
  const failed = await failBuild({
    repository: input.repository,
    build: input.build,
    failure,
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: failure.code,
    buildId: failed.buildId,
    operationId: input.checkpoint.operationId,
  });
}

async function runResearchStage(input: {
  dependencies: CreatorScriptBuildResearchEditorialCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
  now: () => string;
}) {
  await assertCurrentProjectAuthority({ dependencies: input.dependencies, build: input.build, stage: "research" });
  let build = await ensurePendingCheckpoint({
    repository: input.dependencies.repository,
    build: input.build,
    stage: "research",
    contractVersion: CREATOR_SCRIPT_BUILD_RESEARCH_CHECKPOINT_VERSION,
    now: input.now,
  });
  const existingCheckpoint = build.checkpoints.research || null;
  if (existingCheckpoint?.status === "COMPLETED") {
    const research = normalizeResearchResultFromCheckpoint(existingCheckpoint.outputReference);
    build = await input.dependencies.repository.transition({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedState: "SNAPSHOTTED",
      nextState: "RESEARCH_READY",
    });
    return { build, research };
  }
  if (existingCheckpoint?.status === "FAILED") {
    return await failFromFailedCheckpoint({
      repository: input.dependencies.repository,
      build,
      stage: "research",
      checkpoint: existingCheckpoint,
    });
  }

  const executionInput = createCreatorScriptBuildResearchExecutionInput(build.snapshot);
  const semanticFingerprint = stageFingerprint(
    CREATOR_SCRIPT_BUILD_RESEARCH_OPERATION_CONTRACT_VERSION,
    executionInput,
  );
  const requested = await input.dependencies.repository.requestOperation({
    ownerId: build.ownerId,
    buildId: build.buildId,
    stage: "research",
    operationType: RESEARCH_OPERATION_TYPE,
    semanticFingerprint,
    contractVersion: CREATOR_SCRIPT_BUILD_RESEARCH_OPERATION_CONTRACT_VERSION,
  });
  const operation = requested.operation;

  if (operation.state === "FAILED") {
    return await handleExistingFailedOperation({
      repository: input.dependencies.repository,
      build,
      stage: "research",
      contractVersion: CREATOR_SCRIPT_BUILD_RESEARCH_CHECKPOINT_VERSION,
      operationId: operation.operationId,
      failure: operation.failure,
      now: input.now,
    });
  }
  if (operation.state === "OUTCOME_UNCERTAIN" || (operation.state === "PENDING" && !requested.created)) {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
      buildId: build.buildId,
      operationId: operation.operationId,
    });
  }

  let research: CreatorScriptBuildResearchStageResult;
  if (creatorScriptBuildOperationIsReusable(operation)) {
    research = normalizeResearchResultFromOperation(operation.resultReference);
  } else {
    const previous = build.checkpoints.research || null;
    build = await input.dependencies.repository.saveCheckpoint({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedBuildState: build.state,
      checkpoint: checkpoint({
        buildId: build.buildId,
        stage: "research",
        status: "RUNNING",
        contractVersion: CREATOR_SCRIPT_BUILD_RESEARCH_CHECKPOINT_VERSION,
        operationId: operation.operationId,
        outputReference: null,
        diagnostics: {},
        previous,
        now: input.now,
      }),
    });
    let rawResearch: unknown;
    try {
      rawResearch = await input.dependencies.executeResearch(executionInput);
    } catch (error) {
      const executionError = error instanceof CreatorScriptBuildStageExecutionError
        ? error
        : new CreatorScriptBuildStageExecutionError({
            category: "PROVIDER",
            code: "CREATOR_SCRIPT_BUILD_RESEARCH_EXECUTOR_OUTCOME_UNCLASSIFIED",
            retryability: "UNKNOWN_OUTCOME",
          });
      const failure = failureFromExecutionError({
        error: executionError,
        stage: "research",
        operationId: operation.operationId,
      });
      if (executionError.retryability === "UNKNOWN_OUTCOME") {
        await input.dependencies.repository.transitionOperation({
          ownerId: build.ownerId,
          buildId: build.buildId,
          operationId: operation.operationId,
          expectedState: "PENDING",
          nextState: "OUTCOME_UNCERTAIN",
          failure,
        });
        throw new CreatorScriptBuildCoordinatorBlockedError({
          code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
          buildId: build.buildId,
          operationId: operation.operationId,
        });
      }
      await input.dependencies.repository.transitionOperation({
        ownerId: build.ownerId,
        buildId: build.buildId,
        operationId: operation.operationId,
        expectedState: "PENDING",
        nextState: "FAILED",
        failure,
      });
      build = await saveFailedCheckpoint({
        repository: input.dependencies.repository,
        build,
        stage: "research",
        contractVersion: CREATOR_SCRIPT_BUILD_RESEARCH_CHECKPOINT_VERSION,
        operationId: operation.operationId,
        failure,
        now: input.now,
      });
      const failed = await failBuild({ repository: input.dependencies.repository, build, failure });
      throw new CreatorScriptBuildCoordinatorBlockedError({
        code: failure.code,
        buildId: failed.buildId,
        operationId: operation.operationId,
      });
    }
    try {
      research = normalizeResearchResult(rawResearch);
    } catch {
      const failure = stageFailure({
        category: "MODEL_CONTRACT",
        code: "CREATOR_SCRIPT_BUILD_RESEARCH_RESULT_INVALID",
        stage: "research",
        operationId: operation.operationId,
      });
      await input.dependencies.repository.transitionOperation({
        ownerId: build.ownerId,
        buildId: build.buildId,
        operationId: operation.operationId,
        expectedState: "PENDING",
        nextState: "FAILED",
        failure,
      });
      build = await saveFailedCheckpoint({
        repository: input.dependencies.repository,
        build,
        stage: "research",
        contractVersion: CREATOR_SCRIPT_BUILD_RESEARCH_CHECKPOINT_VERSION,
        operationId: operation.operationId,
        failure,
        now: input.now,
      });
      const failed = await failBuild({ repository: input.dependencies.repository, build, failure });
      throw new CreatorScriptBuildCoordinatorBlockedError({
        code: failure.code,
        buildId: failed.buildId,
        operationId: operation.operationId,
      });
    }
    await input.dependencies.repository.transitionOperation({
      ownerId: build.ownerId,
      buildId: build.buildId,
      operationId: operation.operationId,
      expectedState: "PENDING",
      nextState: "COMPLETED",
      resultReference: buildJson({
        version: "0.19E2A-research-operation-result-v1",
        result: research,
      }),
    });
  }

  const previous = build.checkpoints.research || null;
  if (previous?.status !== "COMPLETED") {
    build = await input.dependencies.repository.saveCheckpoint({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedBuildState: build.state,
      checkpoint: checkpoint({
        buildId: build.buildId,
        stage: "research",
        status: "COMPLETED",
        contractVersion: CREATOR_SCRIPT_BUILD_RESEARCH_CHECKPOINT_VERSION,
        operationId: operation.operationId,
        outputReference: buildJson({
          version: "0.19E2A-research-checkpoint-output-v1",
          result: research,
        }),
        diagnostics: {
          sourceCount: research.sources.length,
          laneCount: research.lanes.length,
        },
        previous,
        now: input.now,
      }),
    });
  }
  build = await input.dependencies.repository.transition({
    ownerId: build.ownerId,
    buildId: build.buildId,
    expectedState: "SNAPSHOTTED",
    nextState: "RESEARCH_READY",
  });
  return { build, research };
}

async function runEditorialStage(input: {
  dependencies: CreatorScriptBuildResearchEditorialCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
  research: CreatorScriptBuildResearchStageResult;
  now: () => string;
}) {
  await assertCurrentProjectAuthority({ dependencies: input.dependencies, build: input.build, stage: "editorial" });
  let build = await ensurePendingCheckpoint({
    repository: input.dependencies.repository,
    build: input.build,
    stage: "editorial",
    contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_VERSION,
    now: input.now,
  });
  const existingCheckpoint = build.checkpoints.editorial || null;
  if (existingCheckpoint?.status === "COMPLETED") {
    const editorial = normalizeCreatorScriptBuildEditorialResultFromCheckpoint(
      existingCheckpoint.outputReference,
    );
    build = await input.dependencies.repository.transition({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedState: "RESEARCH_READY",
      nextState: "EDITORIAL_COMPILED",
    });
    return { build, editorial };
  }
  if (existingCheckpoint?.status === "FAILED") {
    return await failFromFailedCheckpoint({
      repository: input.dependencies.repository,
      build,
      stage: "editorial",
      checkpoint: existingCheckpoint,
    });
  }

  let executionMaterial: ReturnType<typeof createEditorialExecutionMaterial>;
  try {
    executionMaterial = createEditorialExecutionMaterial({ snapshot: build.snapshot, research: input.research });
  } catch {
    const failure = stageFailure({
      category: "GROUNDING",
      code: "CREATOR_SCRIPT_BUILD_EVIDENCE_CATALOG_INVALID",
      stage: "editorial",
    });
    build = await saveFailedCheckpoint({
      repository: input.dependencies.repository,
      build,
      stage: "editorial",
      contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_VERSION,
      operationId: null,
      failure,
      now: input.now,
    });
    const failed = await failBuild({ repository: input.dependencies.repository, build, failure });
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: failure.code,
      buildId: failed.buildId,
    });
  }

  const semanticFingerprint = stageFingerprint(
    CREATOR_SCRIPT_BUILD_EDITORIAL_OPERATION_CONTRACT_VERSION,
    executionMaterial.executionInput,
  );
  const requested = await input.dependencies.repository.requestOperation({
    ownerId: build.ownerId,
    buildId: build.buildId,
    stage: "editorial",
    operationType: EDITORIAL_OPERATION_TYPE,
    semanticFingerprint,
    contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_OPERATION_CONTRACT_VERSION,
  });
  const operation = requested.operation;
  const recovery = createCreatorScriptBuildEditorialRecoveryContext({
    repository: input.dependencies.repository, build, parentOperationId: operation.operationId,
    assertAuthority: () => assertCurrentProjectAuthority({ dependencies: input.dependencies, build, stage: "editorial" }),
  });

  if (operation.state === "FAILED") {
    return await handleExistingFailedOperation({
      repository: input.dependencies.repository,
      build,
      stage: "editorial",
      contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_VERSION,
      operationId: operation.operationId,
      failure: operation.failure,
      now: input.now,
    });
  }
  if (operation.state === "OUTCOME_UNCERTAIN" || (operation.state === "PENDING" && !requested.created &&
      !await recovery.canResume(buildJson(executionMaterial.executionInput)))) {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
      buildId: build.buildId,
      operationId: operation.operationId,
    });
  }

  let proposal: EditorialProposalV2;
  if (creatorScriptBuildOperationIsReusable(operation)) {
    proposal = normalizedEditorialProposalFromOperation(operation.resultReference);
  } else {
    const previous = build.checkpoints.editorial || null;
    build = await input.dependencies.repository.saveCheckpoint({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedBuildState: build.state,
      checkpoint: checkpoint({
        buildId: build.buildId,
        stage: "editorial",
        status: "RUNNING",
        contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_VERSION,
        operationId: operation.operationId,
        outputReference: null,
        diagnostics: {
          candidateSpanCount: executionMaterial.spanCatalog.spans.length,
        },
        previous,
        now: input.now,
      }),
    });
    let rawProposal: unknown;
    try {
      rawProposal = await input.dependencies.executeEditorialProposal(executionMaterial.executionInput, recovery.context);
    } catch (error) {
      if (error instanceof CreatorScriptBuildCoordinatorBlockedError) throw error;
      const executionError = error instanceof CreatorScriptBuildStageExecutionError
        ? error
        : new CreatorScriptBuildStageExecutionError({
            category: "PROVIDER",
            code: "CREATOR_SCRIPT_BUILD_EDITORIAL_EXECUTOR_OUTCOME_UNCLASSIFIED",
            retryability: "UNKNOWN_OUTCOME",
          });
      const failure = failureFromExecutionError({
        error: executionError,
        stage: "editorial",
        operationId: operation.operationId,
      });
      if (executionError.retryability === "UNKNOWN_OUTCOME") {
        await input.dependencies.repository.transitionOperation({
          ownerId: build.ownerId,
          buildId: build.buildId,
          operationId: operation.operationId,
          expectedState: "PENDING",
          nextState: "OUTCOME_UNCERTAIN",
          failure,
        });
        throw new CreatorScriptBuildCoordinatorBlockedError({
          code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
          buildId: build.buildId,
          operationId: operation.operationId,
        });
      }
      await input.dependencies.repository.transitionOperation({
        ownerId: build.ownerId,
        buildId: build.buildId,
        operationId: operation.operationId,
        expectedState: "PENDING",
        nextState: "FAILED",
        failure,
      });
      build = await saveFailedCheckpoint({
        repository: input.dependencies.repository,
        build,
        stage: "editorial",
        contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_VERSION,
        operationId: operation.operationId,
        failure,
        now: input.now,
      });
      const failed = await failBuild({ repository: input.dependencies.repository, build, failure });
      throw new CreatorScriptBuildCoordinatorBlockedError({
        code: failure.code,
        buildId: failed.buildId,
        operationId: operation.operationId,
      });
    }
    try {
      proposal = normalizedEditorialProposalFromExecution(rawProposal);
    } catch {
      const failure = stageFailure({
        category: "MODEL_CONTRACT",
        code: "CREATOR_SCRIPT_BUILD_EDITORIAL_PROPOSAL_INVALID",
        stage: "editorial",
        operationId: operation.operationId,
      });
      await input.dependencies.repository.transitionOperation({
        ownerId: build.ownerId,
        buildId: build.buildId,
        operationId: operation.operationId,
        expectedState: "PENDING",
        nextState: "FAILED",
        failure,
      });
      build = await saveFailedCheckpoint({
        repository: input.dependencies.repository,
        build,
        stage: "editorial",
        contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_VERSION,
        operationId: operation.operationId,
        failure,
        now: input.now,
      });
      const failed = await failBuild({ repository: input.dependencies.repository, build, failure });
      throw new CreatorScriptBuildCoordinatorBlockedError({
        code: failure.code,
        buildId: failed.buildId,
        operationId: operation.operationId,
      });
    }
    await input.dependencies.repository.transitionOperation({
      ownerId: build.ownerId,
      buildId: build.buildId,
      operationId: operation.operationId,
      expectedState: "PENDING",
      nextState: "COMPLETED",
      resultReference: buildJson({
        version: "0.19E2A-editorial-operation-result-v1",
        proposal,
      }),
    });
  }

  let editorial: CreatorScriptBuildEditorialStageResult;
  try {
    editorial = compileEditorialResult({
      proposal,
      research: input.research,
      spanCatalog: executionMaterial.spanCatalog,
      operationId: operation.operationId,
    });
  } catch {
    const failure = stageFailure({
      category: "MODEL_CONTRACT",
      code: "CREATOR_SCRIPT_BUILD_EDITORIAL_COMPILE_INVALID",
      stage: "editorial",
      operationId: operation.operationId,
    });
    build = await saveFailedCheckpoint({
      repository: input.dependencies.repository,
      build,
      stage: "editorial",
      contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_VERSION,
      operationId: operation.operationId,
      failure,
      now: input.now,
    });
    const failed = await failBuild({ repository: input.dependencies.repository, build, failure });
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: failure.code,
      buildId: failed.buildId,
      operationId: operation.operationId,
    });
  }

  const previous = build.checkpoints.editorial || null;
  if (previous?.status !== "COMPLETED") {
    build = await input.dependencies.repository.saveCheckpoint({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedBuildState: build.state,
      checkpoint: checkpoint({
        buildId: build.buildId,
        stage: "editorial",
        status: "COMPLETED",
        contractVersion: CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_VERSION,
        operationId: operation.operationId,
        outputReference: buildJson({
          version: "0.19E2A-editorial-checkpoint-output-v1",
          result: editorial,
        }),
        diagnostics: {
          claimCount: editorial.graph.claims.length,
          evidenceCount: editorial.graph.evidence.length,
          linkCount: editorial.graph.links.length,
        },
        previous,
        now: input.now,
      }),
    });
  }
  build = await input.dependencies.repository.transition({
    ownerId: build.ownerId,
    buildId: build.buildId,
    expectedState: "RESEARCH_READY",
    nextState: "EDITORIAL_COMPILED",
  });
  return { build, editorial };
}

const E2A_ALREADY_ADVANCED_STATES = new Set([
  "EDITORIAL_COMPILED",
  "AUTHORITY_RESOLVED",
  "SCRIPT_GENERATED",
  "REPAIRING",
  "ACCEPTED",
  "PERSISTED",
]);

export async function runCreatorScriptBuildResearchEditorialCoordinator(input: {
  ownerId: string;
  buildId: string;
  dependencies: CreatorScriptBuildResearchEditorialCoordinatorDependencies;
}): Promise<CreatorScriptBuildResearchEditorialCoordinatorResult> {
  const now = input.dependencies.now || (() => new Date().toISOString());
  let build = await input.dependencies.repository.getForOwner(input.buildId, input.ownerId);
  if (!build) throw new Error("CREATOR_SCRIPT_BUILD_NOT_FOUND");
  assertCoordinatorContractAuthority(build.snapshot);
  if (creatorScriptBuildIsTerminal(build.state)) {
    return {
      version: CREATOR_SCRIPT_BUILD_RESEARCH_EDITORIAL_COORDINATOR_VERSION,
      build,
      research: null,
      editorial: null,
      disposition: "TERMINAL",
    };
  }
  if (E2A_ALREADY_ADVANCED_STATES.has(build.state)) {
    return {
      version: CREATOR_SCRIPT_BUILD_RESEARCH_EDITORIAL_COORDINATOR_VERSION,
      build,
      research: null,
      editorial: null,
      disposition: "ALREADY_ADVANCED",
    };
  }

  await assertCurrentProjectAuthority({ dependencies: input.dependencies, build, stage: "snapshot" });
  if (build.state === "REQUESTED") {
    build = await input.dependencies.repository.transition({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedState: "REQUESTED",
      nextState: "SNAPSHOTTED",
    });
  }

  let research: CreatorScriptBuildResearchStageResult | null = null;
  if (build.state === "SNAPSHOTTED") {
    const result = await runResearchStage({ dependencies: input.dependencies, build, now });
    build = result.build;
    research = result.research;
  }
  if (build.state === "RESEARCH_READY") {
    if (!research) {
      const checkpointValue = build.checkpoints.research;
      if (!checkpointValue || checkpointValue.status !== "COMPLETED") {
        throw new Error("CREATOR_SCRIPT_BUILD_RESEARCH_CHECKPOINT_REQUIRED");
      }
      research = normalizeResearchResultFromCheckpoint(checkpointValue.outputReference);
    }
    const result = await runEditorialStage({
      dependencies: input.dependencies,
      build,
      research,
      now,
    });
    build = result.build;
    return {
      version: CREATOR_SCRIPT_BUILD_RESEARCH_EDITORIAL_COORDINATOR_VERSION,
      build,
      research,
      editorial: result.editorial,
      disposition: "ADVANCED",
    };
  }

  return {
    version: CREATOR_SCRIPT_BUILD_RESEARCH_EDITORIAL_COORDINATOR_VERSION,
    build,
    research,
    editorial: null,
    disposition: "ADVANCED",
  };
}
