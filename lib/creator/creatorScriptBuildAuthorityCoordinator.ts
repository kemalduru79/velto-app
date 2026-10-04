import { createHash } from "node:crypto";
import {
  canonicalCreatorScriptBuildJson,
  createCreatorScriptBuildCheckpointId,
  createCreatorScriptBuildFailure,
  creatorScriptBuildIsStale,
  creatorScriptBuildOperationIsReusable,
  type CreatorScriptBuildCheckpoint,
  type CreatorScriptBuildFailure,
  type CreatorScriptBuildFailureCategory,
  type CreatorScriptBuildJson,
  type CreatorScriptBuildRecord,
  type CreatorScriptBuildSnapshot,
} from "./creatorScriptBuild.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
  CreatorScriptBuildStageExecutionError,
  normalizeCreatorScriptBuildEditorialResultFromCheckpoint,
  type CreatorScriptBuildEditorialStageResult,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";
import type { CreatorScriptBuildRepository } from "../persistence/creatorScriptBuilds/types.ts";
import {
  resolveClaimAuthority,
  researchSourceQualifiesAsPrimaryForClaim,
  type ClaimAuthorityReport,
} from "../research/claimAuthorityResolver.ts";
import type {
  ResearchClaim,
  ResearchClaimEvidenceGraph,
  ResearchClaimType,
} from "../research/claimEvidenceGraph.ts";
import {
  applyEditorialPrimaryCoverageRepair,
  createEditorialPrimaryCoverageRepairContext,
  type EditorialPrimaryCoverageRepairContext,
  type EditorialPrimaryCoverageRepairResult,
} from "../research/editorialPrimaryCoverageRepair.ts";
import { createEditorialEvidenceSpanCatalog } from "../research/editorialEvidenceSpanCatalog.ts";
import { normalizeEditorialAnalysisRequest } from "../research/editorialAnalysisRequest.ts";
import { canonicalResearchUrl } from "../research/orchestratedResearch.ts";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
  type ResearchSourceAssessment,
} from "../research/sourceAssessment.ts";
import type { ResearchSource } from "../research/sourceContract.ts";

export const CREATOR_SCRIPT_BUILD_AUTHORITY_COORDINATOR_VERSION =
  "0.19E2B" as const;
export const CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_VERSION =
  "creator-script-build-authority-checkpoint-v1" as const;
export const CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION =
  "creator-script-build-primary-acquisition-operation-v1" as const;
export const CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_OPERATION_VERSION =
  "creator-script-build-primary-selection-operation-v1" as const;

const PRIMARY_ACQUISITION_OPERATION_TYPE =
  "creator_script_build_primary_acquisition" as const;
const PRIMARY_SELECTION_OPERATION_TYPE =
  "creator_script_build_primary_coverage_selection" as const;
const AUTHORITY_SEMANTIC_FINGERPRINT_VERSION =
  "creator-script-build-authority-semantic-v1" as const;
const MAX_PRIMARY_ACQUISITION_TARGETS = 30;

export type CreatorScriptBuildPrimaryAcquisitionTarget = Readonly<{
  claimId: string;
  canonicalClaimType: ResearchClaimType;
  acquisitionClaimType: "PRIMARY_SOURCE_CLAIM" | "RESEARCH_FINDING";
  propositionKind: ResearchClaim["propositionKind"] | null;
  subject: string;
}>;

export type CreatorScriptBuildPrimaryAcquisitionInput = Readonly<{
  version: "0.19E2B-primary-acquisition-request-v1";
  subject: string;
  language: "tr" | "en";
  targets: readonly CreatorScriptBuildPrimaryAcquisitionTarget[];
  maxResultsPerTarget: 5;
}>;

export type CreatorScriptBuildPrimarySelectionInput = Readonly<{
  version: "0.19E2B-primary-selection-request-v1";
  targetClaims: readonly Readonly<{
    claimId: string;
    claimType: ResearchClaimType;
    text: string;
    propositionKind: ResearchClaim["propositionKind"] | null;
    origin: ResearchClaim["origin"] | null;
  }>[];
  primarySources: readonly Readonly<{
    sourceId: string;
    title: string;
    publisher: string;
    author: string | null;
    publishedAt: string | null;
    mediaKind: ResearchSource["mediaKind"];
    directness: ResearchSourceAssessment["directness"];
  }>[];
  candidateSpans: readonly Readonly<{
    spanId: string;
    sourceId: string;
    text: string;
    evidenceSpecificity: "concrete_observation" | "abstract_or_conceptual";
  }>[];
}>;

export type CreatorScriptBuildAuthorityStageResult = Readonly<{
  version: "0.19E2B-authority-result-v1";
  graph: ResearchClaimEvidenceGraph;
  sourceAssessments: readonly ResearchSourceAssessment[];
  initialAuthority: ClaimAuthorityReport;
  finalAuthority: ClaimAuthorityReport;
  acquisitionPlan: readonly CreatorScriptBuildPrimaryAcquisitionTarget[];
  acquisitionOperationId: string | null;
  selectionOperationId: string | null;
  repairedClaimIds: readonly string[];
  unresolvedClaimIds: readonly string[];
  excludedPrimaryClaimIds: readonly string[];
  permittedClaimIds: readonly string[];
  spanCatalogVersion: string | null;
  segmentationVersion: string | null;
}>;

export type CreatorScriptBuildAuthorityCoordinatorResult = Readonly<{
  version: typeof CREATOR_SCRIPT_BUILD_AUTHORITY_COORDINATOR_VERSION;
  build: CreatorScriptBuildRecord;
  authority: CreatorScriptBuildAuthorityStageResult;
  disposition: "ADVANCED" | "RESUMED";
}>;

export type CreatorScriptBuildPrimaryAcquisitionExecutor = (
  input: CreatorScriptBuildPrimaryAcquisitionInput,
) => Promise<unknown>;

export type CreatorScriptBuildPrimarySelectionExecutor = (
  input: CreatorScriptBuildPrimarySelectionInput,
) => Promise<unknown>;

export type CreatorScriptBuildAuthorityCoordinatorDependencies = Readonly<{
  repository: CreatorScriptBuildRepository;
  getCurrentProjectRevision: (input: {
    ownerId: string;
    projectId: string;
  }) => Promise<string | null>;
  executePrimaryAcquisition: CreatorScriptBuildPrimaryAcquisitionExecutor;
  executePrimaryCoverageSelection: CreatorScriptBuildPrimarySelectionExecutor;
  now?: () => string;
}>;

type AuthorityOperationKind = "acquisition" | "selection";

const PRIMARY_SELECTION_PROVIDER_CORRELATION = Symbol.for(
  "velto.creatorScriptBuild.primarySelectionProviderCorrelation",
);

type BoundedDiagnostics = Record<string, string | number | boolean | null>;

export class CreatorScriptBuildPrimarySelectionNormalizationError extends Error {
  readonly diagnostics: Readonly<BoundedDiagnostics>;

  constructor(diagnostics: BoundedDiagnostics) {
    super("CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_RESULT_INVALID");
    this.name = "CreatorScriptBuildPrimarySelectionNormalizationError";
    this.diagnostics = Object.freeze({ ...diagnostics });
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim().slice(0, maxLength)
    : "";
}

function valueType(value: unknown) {
  return value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
}

function safeDiagnosticToken(value: string, maxLength: number) {
  const normalized = clean(value, maxLength);
  return /^[A-Za-z0-9][A-Za-z0-9:._/-]*$/u.test(normalized)
    ? normalized
    : `sha256:${createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16)}`;
}

function boundedKeys(value: Record<string, unknown> | null) {
  return value
    ? Object.keys(value).slice(0, 20).map((key) => safeDiagnosticToken(key, 80)).join(",").slice(0, 500)
    : "";
}

function boundedUnexpectedKeys(value: Record<string, unknown>, allowedKeys: string[]) {
  const allowed = new Set(allowedKeys);
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .slice(0, 20)
    .map((key) => safeDiagnosticToken(key, 80))
    .join(",")
    .slice(0, 500);
}

function primarySelectionStructuralSummary(
  value: unknown,
  input: CreatorScriptBuildPrimarySelectionInput,
): BoundedDiagnostics {
  const raw = record(value);
  const repairs = raw && Array.isArray(raw.repairs) ? raw.repairs : null;
  const allowedClaimIds = new Set(input.targetClaims.map((claim) => claim.claimId));
  const allowedSpanIds = new Set(input.candidateSpans.map((span) => span.spanId));
  const claimIndexes = new Map<string, number>();
  const duplicateClaimIndexes: string[] = [];
  let claimIdsMatchAll = true;
  let spanIdsMatchAll = true;
  const itemKeys = repairs?.slice(0, 20).map((item, index) => {
    const repair = record(item);
    const claimId = clean(repair?.claimId, 120);
    const spanId = clean(repair?.spanId, 300);
    if (!repair || !allowedClaimIds.has(claimId)) claimIdsMatchAll = false;
    if (!repair || !allowedSpanIds.has(spanId)) spanIdsMatchAll = false;
    if (repair && claimIndexes.has(claimId)) {
      duplicateClaimIndexes.push(`${claimIndexes.get(claimId)}:${index}`);
    } else if (repair) {
      claimIndexes.set(claimId, index);
    }
    return `${index}:${boundedKeys(repair)}`;
  }).join(";").slice(0, 1_000) || "";
  return {
    normalizationRootType: valueType(value),
    normalizationRootKeys: boundedKeys(raw),
    normalizationRepairsCount: repairs?.length ?? -1,
    normalizationItemKeys: itemKeys,
    normalizationDuplicateClaimIndexes: duplicateClaimIndexes.join(",").slice(0, 300),
    normalizationClaimIdsMatchAll: claimIdsMatchAll,
    normalizationSpanIdsMatchAll: spanIdsMatchAll,
  };
}

function primarySelectionProviderDiagnostics(value: unknown): BoundedDiagnostics {
  if (!value || typeof value !== "object") return {};
  const correlation = (value as Record<PropertyKey, unknown>)[PRIMARY_SELECTION_PROVIDER_CORRELATION];
  const raw = record(correlation);
  return {
    ...(typeof raw?.requestId === "string"
      ? { providerRequestId: clean(raw.requestId, 160) }
      : {}),
    ...(typeof raw?.responseId === "string"
      ? { providerResponseId: clean(raw.responseId, 160) }
      : {}),
  };
}

function buildJson(value: unknown): CreatorScriptBuildJson {
  return JSON.parse(canonicalCreatorScriptBuildJson(value)) as CreatorScriptBuildJson;
}

export function createCreatorScriptBuildAuthoritySemanticFingerprint(
  contractVersion: string,
  value: unknown,
) {
  return `${AUTHORITY_SEMANTIC_FINGERPRINT_VERSION}:${createHash("sha256")
    .update(canonicalCreatorScriptBuildJson({ contractVersion, value }), "utf8")
    .digest("hex")}`;
}

function acquisitionClaimType(claim: ResearchClaim) {
  if (claim.propositionKind === "original_research_result") {
    return "RESEARCH_FINDING" as const;
  }
  if (
    claim.propositionKind === "attributed_statement" ||
    claim.propositionKind === "document_assertion" ||
    (!claim.propositionKind && claim.claimType === "PRIMARY_SOURCE_CLAIM")
  ) {
    return "PRIMARY_SOURCE_CLAIM" as const;
  }
  throw new Error(
    `CREATOR_SCRIPT_BUILD_PRIMARY_TARGET_AUTHORITY_INVALID:${claim.claimId}`,
  );
}

function acquisitionSubject(claim: ResearchClaim, fallback: string) {
  const authoritySubject = clean(
    claim.origin?.attributedEntity || claim.origin?.referencedWork,
    320,
  );
  const claimSubject = clean(claim.text, 600) || clean(fallback, 600);
  return authoritySubject
    ? `${authoritySubject}: ${claimSubject}`.slice(0, 600)
    : claimSubject;
}

/**
 * Target derivation consumes only central resolver output. It does not infer
 * obligation from claim type, proposition shape, or acquisition lane.
 */
export function createCreatorScriptBuildPrimaryAcquisitionInput(input: {
  snapshot: CreatorScriptBuildSnapshot;
  graph: ResearchClaimEvidenceGraph;
  authority: ClaimAuthorityReport;
}): CreatorScriptBuildPrimaryAcquisitionInput {
  const claimById = new Map(
    input.graph.claims.map((claim) => [claim.claimId, claim]),
  );
  const targets = input.authority.claims
    .filter((resolution) =>
      resolution.requiresPrimary &&
      resolution.qualifyingPrimaryEvidenceIds.length === 0
    )
    .map((resolution): CreatorScriptBuildPrimaryAcquisitionTarget => {
      const claim = claimById.get(resolution.claimId);
      if (!claim) {
        throw new Error(
          `CREATOR_SCRIPT_BUILD_PRIMARY_TARGET_CLAIM_MISSING:${resolution.claimId}`,
        );
      }
      return Object.freeze({
        claimId: claim.claimId,
        canonicalClaimType: claim.claimType,
        acquisitionClaimType: acquisitionClaimType(claim),
        propositionKind: claim.propositionKind || null,
        subject: acquisitionSubject(
          claim,
          input.snapshot.strategy.researchSubject || input.snapshot.strategy.topic,
        ),
      });
    })
    .toSorted((left, right) => left.claimId.localeCompare(right.claimId));
  if (targets.length > MAX_PRIMARY_ACQUISITION_TARGETS) {
    throw new Error("CREATOR_SCRIPT_BUILD_PRIMARY_TARGET_LIMIT_EXCEEDED");
  }
  return Object.freeze({
    version: "0.19E2B-primary-acquisition-request-v1" as const,
    subject: input.snapshot.strategy.researchSubject || input.snapshot.strategy.topic,
    language: input.snapshot.language,
    targets,
    maxResultsPerTarget: 5 as const,
  });
}

function normalizeAcquisitionResult(value: unknown, topic: string) {
  const raw = record(value);
  if (
    !raw ||
    raw.version !== "0.19E2B-primary-acquisition-result-v1" ||
    !Array.isArray(raw.sources)
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_RESULT_INVALID");
  }
  if (raw.sources.length === 0) return [];
  try {
    return normalizeEditorialAnalysisRequest({
      topic,
      sources: raw.sources,
    }).sources.toSorted((left, right) => left.sourceId.localeCompare(right.sourceId));
  } catch {
    throw new Error("CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_RESULT_INVALID");
  }
}

export function deduplicateAcquiredSources(input: {
  frozenGraph: ResearchClaimEvidenceGraph;
  targets: readonly CreatorScriptBuildPrimaryAcquisitionTarget[];
  acquiredSources: ResearchSource[];
}) {
  const targetIds = new Set(input.targets.map((target) => target.claimId));
  const targetClaims = input.frozenGraph.claims.filter((claim) =>
    targetIds.has(claim.claimId)
  );
  const frozenById = new Map(
    input.frozenGraph.sources.map((source) => [source.sourceId, source]),
  );
  const frozenByUrl = new Map(
    input.frozenGraph.sources.flatMap((source) => {
      const canonicalUrl = canonicalResearchUrl(source.url);
      return canonicalUrl ? [[canonicalUrl, source] as const] : [];
    }),
  );
  const selectedByUrlOrId = new Map<string, ResearchSource>();

  for (const acquired of input.acquiredSources) {
    const frozenBySameId = frozenById.get(acquired.sourceId);
    const canonicalUrl = canonicalResearchUrl(acquired.url);
    if (frozenBySameId) {
      const frozenCanonicalUrl = canonicalResearchUrl(frozenBySameId.url);
      if (
        !canonicalUrl ||
        !frozenCanonicalUrl ||
        canonicalUrl !== frozenCanonicalUrl
      ) {
        throw new Error(
          `CREATOR_SCRIPT_BUILD_PRIMARY_SOURCE_ID_CONFLICT:${acquired.sourceId}`,
        );
      }
    }
    // The editorial graph is the frozen source authority. Retrieval can return
    // a different query-dependent summary/snippet for the same source identity;
    // never replace frozen source content during primary acquisition.
    const source = frozenBySameId ||
      (canonicalUrl ? frozenByUrl.get(canonicalUrl) : null) ||
      acquired;
    const assessment = assessResearchSource(
      source,
      classifyResearchSourceDirectness(source).directness,
    );
    const qualifies = targetClaims.some((claim) =>
      researchSourceQualifiesAsPrimaryForClaim({
        source,
        claim,
        sourceAssessment: assessment,
      })
    );
    if (!qualifies) continue;
    const key = canonicalResearchUrl(source.url) || `source:${source.sourceId}`;
    if (!selectedByUrlOrId.has(key)) selectedByUrlOrId.set(key, source);
  }
  return [...selectedByUrlOrId.values()].toSorted((left, right) =>
    left.sourceId.localeCompare(right.sourceId)
  );
}

function createSelectionInput(
  context: EditorialPrimaryCoverageRepairContext,
): CreatorScriptBuildPrimarySelectionInput {
  const targetClaimIds = new Set(context.targetClaimIds);
  return Object.freeze({
    version: "0.19E2B-primary-selection-request-v1" as const,
    targetClaims: context.frozenGraph.claims
      .filter((claim) => targetClaimIds.has(claim.claimId))
      .toSorted((left, right) => left.claimId.localeCompare(right.claimId))
      .map((claim) => Object.freeze({
        claimId: claim.claimId,
        claimType: claim.claimType,
        text: claim.text,
        propositionKind: claim.propositionKind || null,
        origin: claim.origin || null,
      })),
    primarySources: context.candidatePrimarySources.map((source) =>
      Object.freeze({
        sourceId: source.sourceId,
        title: source.title,
        publisher: source.publisher,
        author: source.author,
        publishedAt: source.publishedAt,
        mediaKind: source.mediaKind,
        directness: classifyResearchSourceDirectness(source).directness,
      })
    ),
    candidateSpans: context.candidateSpans.map((span) =>
      Object.freeze({
        spanId: span.spanId,
        sourceId: span.sourceId,
        text: span.text,
        evidenceSpecificity: span.evidenceSpecificity,
      })
    ),
  });
}

export function normalizePrimarySelection(
  value: unknown,
  input: CreatorScriptBuildPrimarySelectionInput,
) {
  const reject = (reason: string, diagnostics: BoundedDiagnostics = {}): never => {
    throw new CreatorScriptBuildPrimarySelectionNormalizationError({
      normalizationReason: reason,
      ...primarySelectionStructuralSummary(value, input),
      ...diagnostics,
    });
  };
  const raw = record(value);
  if (!raw) return reject("ROOT_INVALID", { normalizationPath: "$", normalizationValueType: valueType(value) });
  if (Object.keys(raw).join(",") !== "repairs") {
    reject("ROOT_KEYS_INVALID", {
      normalizationPath: "$",
      normalizationUnexpectedKeys: boundedUnexpectedKeys(raw, ["repairs"]),
    });
  }
  if (!Array.isArray(raw.repairs)) {
    return reject("REPAIRS_NOT_ARRAY", { normalizationPath: "$.repairs", normalizationValueType: valueType(raw.repairs) });
  }
  const repairs = raw.repairs;
  if (repairs.length > input.targetClaims.length) {
    reject("REPAIRS_OVER_MAX", {
      normalizationPath: "$.repairs",
      normalizationArrayLength: repairs.length,
      normalizationAllowedMaximum: input.targetClaims.length,
    });
  }
  const allowedClaimIds = new Set(input.targetClaims.map((claim) => claim.claimId));
  const allowedSpanIds = new Set(input.candidateSpans.map((span) => span.spanId));
  const selectedClaimIds = new Set<string>();
  const normalizedRepairs: Array<{ claimId: string; spanId: string }> = [];
  repairs.forEach((item, itemIndex) => {
      const repair = record(item);
      if (!repair) {
        return reject("ITEM_INVALID", {
          normalizationPath: `$.repairs[${itemIndex}]`,
          normalizationItemIndex: itemIndex,
          normalizationValueType: valueType(item),
        });
      }
      if (Object.keys(repair).sort().join(",") !== "claimId,spanId") {
        reject("ITEM_KEYS_INVALID", {
          normalizationPath: `$.repairs[${itemIndex}]`,
          normalizationItemIndex: itemIndex,
          normalizationUnexpectedKeys: boundedUnexpectedKeys(repair, ["claimId", "spanId"]),
        });
      }
      const claimId = clean(repair.claimId, 120);
      const spanId = clean(repair.spanId, 300);
      if (!allowedClaimIds.has(claimId)) {
        reject("CLAIM_ID_INVALID", {
          normalizationPath: `$.repairs[${itemIndex}].claimId`,
          normalizationItemIndex: itemIndex,
          normalizationClaimIdMatch: false,
          normalizationValueType: valueType(repair.claimId),
          normalizationIdentifier: safeDiagnosticToken(claimId, 120),
        });
      }
      if (!allowedSpanIds.has(spanId)) {
        reject("SPAN_ID_INVALID", {
          normalizationPath: `$.repairs[${itemIndex}].spanId`,
          normalizationItemIndex: itemIndex,
          normalizationSpanIdMatch: false,
          normalizationValueType: valueType(repair.spanId),
          normalizationIdentifier: safeDiagnosticToken(spanId, 300),
        });
      }
      if (selectedClaimIds.has(claimId)) {
        return;
      }
      selectedClaimIds.add(claimId);
      normalizedRepairs.push({ claimId, spanId });
    });
  return { repairs: normalizedRepairs };
}

function checkpoint(input: {
  buildId: string;
  status: CreatorScriptBuildCheckpoint["status"];
  operationId: string | null;
  outputReference: CreatorScriptBuildJson | null;
  diagnostics: Record<string, string | number | boolean | null>;
  previous?: CreatorScriptBuildCheckpoint | null;
  now: () => string;
}): CreatorScriptBuildCheckpoint {
  const startedAt = input.previous?.startedAt ||
    (input.status === "RUNNING" ? input.now() : null);
  const completedAt = input.status === "COMPLETED" || input.status === "FAILED"
    ? input.now()
    : null;
  return {
    checkpointId: createCreatorScriptBuildCheckpointId({
      buildId: input.buildId,
      stage: "authority",
      contractVersion: CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_VERSION,
    }),
    stage: "authority",
    status: input.status,
    contractVersion: CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_VERSION,
    operationId: input.operationId,
    outputReference: input.outputReference,
    diagnostics: Object.freeze({ ...input.diagnostics }),
    startedAt,
    completedAt,
  };
}

function authorityFailure(input: {
  category: CreatorScriptBuildFailureCategory;
  code: string;
  retryability?: CreatorScriptBuildFailure["retryability"];
  operationId?: string | null;
  diagnostics?: Record<string, string | number | boolean | null>;
}) {
  return createCreatorScriptBuildFailure({
    category: input.category,
    code: input.code,
    stage: "authority",
    retryability: input.retryability || "NON_RETRYABLE",
    operationId: input.operationId || null,
    diagnostics: input.diagnostics || {},
  });
}

async function ensureAuthorityCheckpoint(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  now: () => string;
}) {
  const existing = input.build.checkpoints.authority || null;
  if (
    existing &&
    existing.contractVersion !== CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_CONTRACT_MISMATCH");
  }
  if (existing) return input.build;
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: "EDITORIAL_COMPILED",
    checkpoint: checkpoint({
      buildId: input.build.buildId,
      status: "PENDING",
      operationId: null,
      outputReference: null,
      diagnostics: {},
      now: input.now,
    }),
  });
}

async function markAuthorityRunning(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  operationId: string;
  now: () => string;
}) {
  const previous = input.build.checkpoints.authority || null;
  if (previous?.status === "RUNNING") return input.build;
  if (previous?.status !== "PENDING") {
    throw new Error("CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_NOT_PENDING");
  }
  return await input.repository.saveCheckpoint({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedBuildState: "EDITORIAL_COMPILED",
    checkpoint: checkpoint({
      buildId: input.build.buildId,
      status: "RUNNING",
      operationId: input.operationId,
      outputReference: null,
      diagnostics: {},
      previous,
      now: input.now,
    }),
  });
}

async function failAuthorityBuild(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  failure: CreatorScriptBuildFailure;
  now: () => string;
}): Promise<never> {
  const previous = input.build.checkpoints.authority || null;
  let build = input.build;
  if (previous?.status !== "FAILED") {
    if (previous?.status === "COMPLETED") {
      throw new Error("CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_ALREADY_COMPLETED");
    }
    build = await input.repository.saveCheckpoint({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedBuildState: "EDITORIAL_COMPILED",
      checkpoint: checkpoint({
        buildId: build.buildId,
        status: "FAILED",
        operationId: input.failure.operationId,
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
  const failed = await input.repository.transition({
    ownerId: build.ownerId,
    buildId: build.buildId,
    expectedState: "EDITORIAL_COMPILED",
    nextState: "FAILED",
    failure: input.failure,
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: input.failure.code,
    buildId: failed.buildId,
    operationId: input.failure.operationId,
  });
}

async function assertCurrentProjectAuthority(input: {
  dependencies: CreatorScriptBuildAuthorityCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
}) {
  const currentProjectRevision = await input.dependencies.getCurrentProjectRevision({
    ownerId: input.build.ownerId,
    projectId: input.build.projectId,
  });
  if (
    currentProjectRevision &&
    !creatorScriptBuildIsStale({
      snapshot: input.build.snapshot,
      currentProjectRevision,
    })
  ) return;

  const failure = authorityFailure({
    category: "AUTHORITY",
    code: currentProjectRevision
      ? "CREATOR_SCRIPT_BUILD_PROJECT_STALE"
      : "CREATOR_SCRIPT_BUILD_PROJECT_AUTHORITY_MISSING",
  });
  const nextState = currentProjectRevision ? "STALE" as const : "FAILED" as const;
  const build = await input.dependencies.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: "EDITORIAL_COMPILED",
    nextState,
    failure,
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: failure.code,
    buildId: build.buildId,
  });
}

function operationContract(kind: AuthorityOperationKind) {
  return kind === "acquisition"
    ? {
        operationType: PRIMARY_ACQUISITION_OPERATION_TYPE,
        contractVersion: CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
      }
    : {
        operationType: PRIMARY_SELECTION_OPERATION_TYPE,
        contractVersion: CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_OPERATION_VERSION,
      };
}

async function executeAuthorityOperation(input: {
  dependencies: CreatorScriptBuildAuthorityCoordinatorDependencies;
  build: CreatorScriptBuildRecord;
  kind: AuthorityOperationKind;
  semanticInput: unknown;
  execute: () => Promise<unknown>;
  normalize: (value: unknown) => unknown;
  now: () => string;
}) {
  await assertCurrentProjectAuthority({
    dependencies: input.dependencies,
    build: input.build,
  });
  const contract = operationContract(input.kind);
  const semanticFingerprint = createCreatorScriptBuildAuthoritySemanticFingerprint(
    contract.contractVersion,
    input.semanticInput,
  );
  const requested = await input.dependencies.repository.requestOperation({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    stage: "authority",
    operationType: contract.operationType,
    semanticFingerprint,
    contractVersion: contract.contractVersion,
  });
  const operation = requested.operation;
  if (operation.state === "FAILED") {
    const failure = operation.failure || authorityFailure({
      category: "INTERNAL",
      code: "CREATOR_SCRIPT_BUILD_AUTHORITY_OPERATION_FAILED_WITHOUT_FAILURE",
      operationId: operation.operationId,
    });
    return await failAuthorityBuild({
      repository: input.dependencies.repository,
      build: input.build,
      failure,
      now: input.now,
    });
  }
  if (
    operation.state === "OUTCOME_UNCERTAIN" ||
    (operation.state === "PENDING" && !requested.created)
  ) {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
      buildId: input.build.buildId,
      operationId: operation.operationId,
    });
  }
  if (creatorScriptBuildOperationIsReusable(operation)) {
    const raw = record(operation.resultReference);
    const expectedVersion = input.kind === "acquisition"
      ? "0.19E2B-primary-acquisition-operation-result-v1"
      : "0.19E2B-primary-selection-operation-result-v1";
    if (raw?.version !== expectedVersion) {
      throw new Error("CREATOR_SCRIPT_BUILD_AUTHORITY_OPERATION_RESULT_INVALID");
    }
    return {
      build: input.build,
      operationId: operation.operationId,
      value: input.normalize(
        input.kind === "acquisition" ? raw.result : raw.selection,
      ),
    };
  }

  const build = await markAuthorityRunning({
    repository: input.dependencies.repository,
    build: input.build,
    operationId: operation.operationId,
    now: input.now,
  });
  let rawResult: unknown;
  try {
    rawResult = await input.execute();
  } catch (error) {
    const executionError = error instanceof CreatorScriptBuildStageExecutionError
      ? error
      : new CreatorScriptBuildStageExecutionError({
          category: "PROVIDER",
          code: "CREATOR_SCRIPT_BUILD_AUTHORITY_EXECUTOR_OUTCOME_UNCLASSIFIED",
          retryability: "UNKNOWN_OUTCOME",
        });
    const failure = authorityFailure({
      category: executionError.category,
      code: executionError.code,
      retryability: executionError.retryability,
      operationId: operation.operationId,
      diagnostics: { ...executionError.diagnostics },
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
    return await failAuthorityBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now: input.now,
    });
  }

  let value: unknown;
  try {
    value = input.normalize(rawResult);
  } catch (error) {
    const normalizationDiagnostics =
      input.kind === "selection" &&
        error instanceof CreatorScriptBuildPrimarySelectionNormalizationError
        ? error.diagnostics
        : {};
    const failure = authorityFailure({
      category: "MODEL_CONTRACT",
      code: input.kind === "acquisition"
        ? "CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_RESULT_INVALID"
        : "CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_RESULT_INVALID",
      operationId: operation.operationId,
      diagnostics: input.kind === "selection"
        ? {
            ...normalizationDiagnostics,
            ...primarySelectionProviderDiagnostics(rawResult),
            operationId: operation.operationId,
          }
        : {},
    });
    await input.dependencies.repository.transitionOperation({
      ownerId: build.ownerId,
      buildId: build.buildId,
      operationId: operation.operationId,
      expectedState: "PENDING",
      nextState: "FAILED",
      failure,
    });
    return await failAuthorityBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now: input.now,
    });
  }

  await input.dependencies.repository.transitionOperation({
    ownerId: build.ownerId,
    buildId: build.buildId,
    operationId: operation.operationId,
    expectedState: "PENDING",
    nextState: "COMPLETED",
    resultReference: buildJson(input.kind === "acquisition"
      ? {
          version: "0.19E2B-primary-acquisition-operation-result-v1",
          result: rawResult,
        }
      : {
          version: "0.19E2B-primary-selection-operation-result-v1",
          selection: rawResult,
        }),
  });
  return { build, operationId: operation.operationId, value };
}

export function normalizeCreatorScriptBuildAuthorityResultFromCheckpoint(
  value: CreatorScriptBuildJson | null,
) {
  const raw = record(value);
  const result = record(raw?.result);
  if (
    raw?.version !== "0.19E2B-authority-checkpoint-output-v1" ||
    result?.version !== "0.19E2B-authority-result-v1"
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_OUTPUT_INVALID");
  }
  return result as unknown as CreatorScriptBuildAuthorityStageResult;
}

function createAuthorityResult(input: {
  editorial: CreatorScriptBuildEditorialStageResult;
  initialAuthority: ClaimAuthorityReport;
  acquisitionPlan: readonly CreatorScriptBuildPrimaryAcquisitionTarget[];
  acquisitionOperationId: string | null;
  selectionOperationId: string | null;
  repair: EditorialPrimaryCoverageRepairResult | null;
  spanCatalogVersion: string | null;
  segmentationVersion: string | null;
}): CreatorScriptBuildAuthorityStageResult {
  const graph = input.repair?.graph || input.editorial.graph;
  const sourceAssessments = input.repair?.sourceAssessments ||
    [...input.editorial.sourceAssessments];
  const finalAuthority = resolveClaimAuthority({ graph, sourceAssessments });
  return Object.freeze({
    version: "0.19E2B-authority-result-v1" as const,
    graph,
    sourceAssessments,
    initialAuthority: input.initialAuthority,
    finalAuthority,
    acquisitionPlan: [...input.acquisitionPlan],
    acquisitionOperationId: input.acquisitionOperationId,
    selectionOperationId: input.selectionOperationId,
    repairedClaimIds: [...(input.repair?.repairedClaimIds || [])],
    unresolvedClaimIds: [...(input.repair?.unresolvedClaimIds || [])],
    excludedPrimaryClaimIds: [
      ...(input.repair?.excludedPrimaryClaimIds || []),
    ],
    permittedClaimIds: finalAuthority.claims
      .filter((claim) =>
        claim.status === "SUPPORTED" || claim.status === "SUPPORTED_PRIMARY"
      )
      .map((claim) => claim.claimId),
    spanCatalogVersion: input.spanCatalogVersion,
    segmentationVersion: input.segmentationVersion,
  });
}

function assertCoordinatorContractAuthority(snapshot: CreatorScriptBuildSnapshot) {
  if (
    snapshot.contractVersions.creatorScriptBuildAuthorityCoordinator !==
      CREATOR_SCRIPT_BUILD_AUTHORITY_COORDINATOR_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_AUTHORITY_CONTRACT_MISMATCH");
  }
}

export async function runCreatorScriptBuildAuthorityCoordinator(input: {
  ownerId: string;
  buildId: string;
  dependencies: CreatorScriptBuildAuthorityCoordinatorDependencies;
}): Promise<CreatorScriptBuildAuthorityCoordinatorResult> {
  const now = input.dependencies.now || (() => new Date().toISOString());
  let build = await input.dependencies.repository.getForOwner(
    input.buildId,
    input.ownerId,
  );
  if (!build) throw new Error("CREATOR_SCRIPT_BUILD_NOT_FOUND");
  assertCoordinatorContractAuthority(build.snapshot);
  if (build.state !== "EDITORIAL_COMPILED") {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_AUTHORITY_STATE_INVALID",
      buildId: build.buildId,
    });
  }
  await assertCurrentProjectAuthority({ dependencies: input.dependencies, build });
  build = await ensureAuthorityCheckpoint({
    repository: input.dependencies.repository,
    build,
    now,
  });
  const existingCheckpoint = build.checkpoints.authority || null;
  if (existingCheckpoint?.status === "COMPLETED") {
    const authority = normalizeCreatorScriptBuildAuthorityResultFromCheckpoint(
      existingCheckpoint.outputReference,
    );
    build = await input.dependencies.repository.transition({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedState: "EDITORIAL_COMPILED",
      nextState: "AUTHORITY_RESOLVED",
    });
    return {
      version: CREATOR_SCRIPT_BUILD_AUTHORITY_COORDINATOR_VERSION,
      build,
      authority,
      disposition: "RESUMED",
    };
  }
  if (existingCheckpoint?.status === "FAILED") {
    const failure = authorityFailure({
      category: typeof existingCheckpoint.diagnostics.failureCategory === "string"
        ? existingCheckpoint.diagnostics.failureCategory as CreatorScriptBuildFailureCategory
        : "INTERNAL",
      code: typeof existingCheckpoint.diagnostics.failureCode === "string"
        ? existingCheckpoint.diagnostics.failureCode
        : "CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_FAILED",
      retryability:
        existingCheckpoint.diagnostics.retryability === "RETRYABLE" ||
          existingCheckpoint.diagnostics.retryability === "UNKNOWN_OUTCOME"
          ? existingCheckpoint.diagnostics.retryability
          : "NON_RETRYABLE",
      operationId: existingCheckpoint.operationId,
    });
    return await failAuthorityBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now,
    });
  }

  const editorialCheckpoint = build.checkpoints.editorial || null;
  if (!editorialCheckpoint || editorialCheckpoint.status !== "COMPLETED") {
    const failure = authorityFailure({
      category: "INPUT",
      code: "CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_REQUIRED",
    });
    return await failAuthorityBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now,
    });
  }
  let editorial: CreatorScriptBuildEditorialStageResult;
  try {
    editorial = normalizeCreatorScriptBuildEditorialResultFromCheckpoint(
      editorialCheckpoint.outputReference,
    );
  } catch {
    const failure = authorityFailure({
      category: "INPUT",
      code: "CREATOR_SCRIPT_BUILD_EDITORIAL_CHECKPOINT_INVALID",
    });
    return await failAuthorityBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now,
    });
  }

  let initialAuthority: ClaimAuthorityReport;
  let acquisitionInput: CreatorScriptBuildPrimaryAcquisitionInput;
  try {
    initialAuthority = resolveClaimAuthority({
      graph: editorial.graph,
      sourceAssessments: [...editorial.sourceAssessments],
    });
    acquisitionInput = createCreatorScriptBuildPrimaryAcquisitionInput({
      snapshot: build.snapshot,
      graph: editorial.graph,
      authority: initialAuthority,
    });
  } catch {
    const failure = authorityFailure({
      category: "AUTHORITY",
      code: "CREATOR_SCRIPT_BUILD_INITIAL_AUTHORITY_INVALID",
    });
    return await failAuthorityBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now,
    });
  }

  let acquisitionOperationId: string | null = null;
  let selectionOperationId: string | null = null;
  let repair: EditorialPrimaryCoverageRepairResult | null = null;
  let spanCatalogVersion: string | null = null;
  let segmentationVersion: string | null = null;

  if (acquisitionInput.targets.length > 0) {
    const acquired = await executeAuthorityOperation({
      dependencies: input.dependencies,
      build,
      kind: "acquisition",
      semanticInput: acquisitionInput,
      execute: () => input.dependencies.executePrimaryAcquisition(acquisitionInput),
      normalize: (value) => normalizeAcquisitionResult(value, acquisitionInput.subject),
      now,
    });
    build = acquired.build;
    acquisitionOperationId = acquired.operationId;
    let candidateSources: ResearchSource[];
    try {
      candidateSources = deduplicateAcquiredSources({
        frozenGraph: editorial.graph,
        targets: acquisitionInput.targets,
        acquiredSources: acquired.value as ResearchSource[],
      });
    } catch {
      const failure = authorityFailure({
        category: "GROUNDING",
        code: "CREATOR_SCRIPT_BUILD_PRIMARY_SOURCE_INGESTION_INVALID",
        operationId: acquisitionOperationId,
      });
      return await failAuthorityBuild({
        repository: input.dependencies.repository,
        build,
        failure,
        now,
      });
    }

    let context: EditorialPrimaryCoverageRepairContext;
    try {
      context = createEditorialPrimaryCoverageRepairContext({
        frozenGraph: editorial.graph,
        originalPrimaryRequiredClaimIds: initialAuthority.claims
          .filter((claim) => claim.requiresPrimary)
          .map((claim) => claim.claimId),
        candidateSources,
        creatorProfile: build.snapshot.creatorProfile,
      });
      const catalog = createEditorialEvidenceSpanCatalog(
        context.candidatePrimarySources,
      );
      spanCatalogVersion = catalog.version;
      segmentationVersion = catalog.segmentationVersion;
      const contextSpanIds = context.candidateSpans.map((span) => span.spanId);
      const catalogSpanIds = catalog.spans.map((span) => span.spanId);
      if (
        canonicalCreatorScriptBuildJson(contextSpanIds) !==
          canonicalCreatorScriptBuildJson(catalogSpanIds)
      ) {
        throw new Error("CREATOR_SCRIPT_BUILD_PRIMARY_SPAN_CATALOG_MISMATCH");
      }
    } catch {
      const failure = authorityFailure({
        category: "GROUNDING",
        code: "CREATOR_SCRIPT_BUILD_PRIMARY_REPAIR_CONTEXT_INVALID",
        operationId: acquisitionOperationId,
      });
      return await failAuthorityBuild({
        repository: input.dependencies.repository,
        build,
        failure,
        now,
      });
    }

    let selection: unknown = { repairs: [] };
    if (context.candidateSpans.length > 0) {
      const selectionInput = createSelectionInput(context);
      const selected = await executeAuthorityOperation({
        dependencies: input.dependencies,
        build,
        kind: "selection",
        semanticInput: selectionInput,
        execute: () => input.dependencies.executePrimaryCoverageSelection(
          selectionInput,
        ),
        normalize: (value) => normalizePrimarySelection(value, selectionInput),
        now,
      });
      build = selected.build;
      selectionOperationId = selected.operationId;
      selection = selected.value;
    }

    try {
      try {
        repair = applyEditorialPrimaryCoverageRepair({ context, selection });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.startsWith(
            "EDITORIAL_PRIMARY_COVERAGE_SOURCE_NOT_PRIMARY:",
          )
        ) {
          repair = applyEditorialPrimaryCoverageRepair({
            context,
            selection: { repairs: [] },
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : "";
      const category: CreatorScriptBuildFailureCategory =
        diagnostic.includes("TARGET_NOT_ALLOWED") ||
          diagnostic.includes("SPAN_NOT_ALLOWED") ||
          diagnostic.includes("SELECTION_")
          ? "MODEL_CONTRACT"
          : diagnostic.includes("NO_SAFE_CLAIMS")
            ? "EDITORIAL_POLICY"
            : "GROUNDING";
      const failure = authorityFailure({
        category,
        code: category === "MODEL_CONTRACT"
          ? "CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_INVALID"
          : category === "EDITORIAL_POLICY"
            ? "CREATOR_SCRIPT_BUILD_PRIMARY_COVERAGE_UNRESOLVED"
            : "CREATOR_SCRIPT_BUILD_PRIMARY_REPAIR_INVALID",
        operationId: selectionOperationId || acquisitionOperationId,
      });
      return await failAuthorityBuild({
        repository: input.dependencies.repository,
        build,
        failure,
        now,
      });
    }
  }

  let authority: CreatorScriptBuildAuthorityStageResult;
  try {
    authority = createAuthorityResult({
      editorial,
      initialAuthority,
      acquisitionPlan: acquisitionInput.targets,
      acquisitionOperationId,
      selectionOperationId,
      repair,
      spanCatalogVersion,
      segmentationVersion,
    });
  } catch {
    const failure = authorityFailure({
      category: "AUTHORITY",
      code: "CREATOR_SCRIPT_BUILD_FINAL_AUTHORITY_INVALID",
      operationId: selectionOperationId || acquisitionOperationId,
    });
    return await failAuthorityBuild({
      repository: input.dependencies.repository,
      build,
      failure,
      now,
    });
  }

  const previous = build.checkpoints.authority || null;
  build = await input.dependencies.repository.saveCheckpoint({
    ownerId: build.ownerId,
    buildId: build.buildId,
    expectedBuildState: "EDITORIAL_COMPILED",
    checkpoint: checkpoint({
      buildId: build.buildId,
      status: "COMPLETED",
      operationId: selectionOperationId || acquisitionOperationId,
      outputReference: buildJson({
        version: "0.19E2B-authority-checkpoint-output-v1",
        result: authority,
      }),
      diagnostics: {
        targetClaimCount: acquisitionInput.targets.length,
        permittedClaimCount: authority.permittedClaimIds.length,
        excludedClaimCount: authority.excludedPrimaryClaimIds.length,
      },
      previous,
      now,
    }),
  });
  build = await input.dependencies.repository.transition({
    ownerId: build.ownerId,
    buildId: build.buildId,
    expectedState: "EDITORIAL_COMPILED",
    nextState: "AUTHORITY_RESOLVED",
  });
  return {
    version: CREATOR_SCRIPT_BUILD_AUTHORITY_COORDINATOR_VERSION,
    build,
    authority,
    disposition: "ADVANCED",
  };
}
