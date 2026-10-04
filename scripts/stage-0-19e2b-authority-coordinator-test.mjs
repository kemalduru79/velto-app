import assert from "node:assert/strict";
import fs from "node:fs";

import {
  assertCreatorScriptBuildCheckpointIdentity,
  assertCreatorScriptBuildOperationTransition,
  assertCreatorScriptBuildTransition,
  createCreatorScriptBuildCheckpointId,
  createCreatorScriptBuildIdempotencyKey,
  createCreatorScriptBuildOperationId,
  createCreatorScriptBuildSnapshot,
} from "../lib/creator/creatorScriptBuild.ts";
import {
  CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_VERSION,
  CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
  createCreatorScriptBuildAuthoritySemanticFingerprint,
  createCreatorScriptBuildPrimaryAcquisitionInput,
  runCreatorScriptBuildAuthorityCoordinator,
} from "../lib/creator/creatorScriptBuildAuthorityCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
  CreatorScriptBuildStageExecutionError,
} from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import { resolveClaimAuthority } from "../lib/research/claimAuthorityResolver.ts";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import { createEditorialEvidenceSpanCatalog } from "../lib/research/editorialEvidenceSpanCatalog.ts";
import {
  applyEditorialPrimaryCoverageRepair,
  createEditorialPrimaryCoverageRepairContext,
} from "../lib/research/editorialPrimaryCoverageRepair.ts";
import { assessResearchSource, classifyResearchSourceDirectness } from "../lib/research/sourceAssessment.ts";

const ownerId = "00000000-0000-4000-8000-000000000002";
const otherOwnerId = "00000000-0000-4000-8000-000000000099";
const buildId = "10000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000001";
const revision = "2026-10-02T12:00:00.000Z";

const snapshot = createCreatorScriptBuildSnapshot({
  projectId,
  expectedProjectRevision: revision,
  strategyFingerprint: "strategy-fingerprint-e2b",
  language: "en",
  requestedDurationSeconds: 660,
  strategy: {
    topic: "Memory and identity",
    researchSubject: "How reconstructive memory shapes autobiographical identity",
    title: "The Memory That Made You",
    contentType: "documentary essay",
    format: "long-form",
    selectedDirectionId: "direction-a",
    selectedHook: "What if the memory defining you changed every time you recalled it?",
    approvedStrategy: { selectedDirectionId: "direction-a" },
  },
  creatorProfile: { audience: "educated general audience", voice: "documentary" },
  contractVersions: {
    canonicalEditorialGraph: "0.19A",
    editorialEvidenceSpanCatalog: "0.19B",
    claimAuthorityResolver: "0.19C",
    creatorScriptAcceptance: "0.19D",
    creatorScriptBuild: "0.19E1",
    creatorScriptResearchEditorialCoordinator: "0.19E2A-A2",
    creatorScriptBuildAuthorityCoordinator: "0.19E2B",
  },
});

function clone(value) {
  return structuredClone(value);
}

function source(overrides = {}) {
  return {
    sourceId: "web:https://secondary.example/memory",
    adapterId: "web",
    mediaKind: "article",
    externalId: null,
    title: "Memory in context",
    url: "https://secondary.example/memory",
    publisher: "Secondary Review",
    author: "A. Reporter",
    publishedAt: "2026-01-01",
    language: "en",
    summary: "Ada Researcher stated that autobiographical memory is reconstructed during recall. The account was discussed in relation to identity. A counter-reading remains possible.",
    thumbnailUrl: null,
    durationSec: null,
    metrics: {},
    sourceMetadata: {},
    ...overrides,
  };
}

const secondarySource = source();
const acquiredPrimarySource = source({
  sourceId: "primary:https://primary.example/ada-statement",
  adapterId: "primary",
  mediaKind: "document",
  title: "Ada Researcher statement",
  url: "https://primary.example/ada-statement",
  publisher: "Ada Researcher Archive",
  author: "Ada Researcher",
  summary: "Ada Researcher stated that autobiographical memory is reconstructed during recall. The statement describes how remembering can reshape a personal narrative.",
  sourceMetadata: {},
});
const acquisitionLaneOnlySource = source({
  sourceId: "primary:https://search.example/not-authoritative",
  adapterId: "primary",
  mediaKind: "webpage",
  title: "Search result about memory",
  url: "https://search.example/not-authoritative",
  publisher: "Unrelated Publisher",
  author: "Other Author",
  summary: "A secondary search result discusses autobiographical memory and identity.",
  sourceMetadata: {},
});
const verifiedPrimarySource = source({
  sourceId: "academic:paper-1",
  adapterId: "academic",
  mediaKind: "paper",
  externalId: "paper-1",
  title: "Original memory experiment",
  url: "https://academic.example/paper-1",
  publisher: "Journal of Memory",
  author: "Ada Researcher",
  summary: "The original experiment reports that autobiographical memory is reconstructed during recall.",
  sourceMetadata: {
    provenanceVerified: true,
    provenanceKind: "original_academic_paper",
  },
});

function assessments(sources) {
  return sources.map((item) =>
    assessResearchSource(item, classifyResearchSourceDirectness(item).directness)
  );
}

function graph({ coveredPrimary = false, includePrimaryClaim = true } = {}) {
  const primaryEvidenceSource = coveredPrimary ? verifiedPrimarySource : secondarySource;
  const sources = coveredPrimary
    ? [secondarySource, verifiedPrimarySource]
    : [secondarySource];
  const claims = [
    ...(includePrimaryClaim
      ? [{
          claimId: "claim-primary",
          claimType: "FACT",
          text: "Ada Researcher stated that autobiographical memory is reconstructed during recall.",
          propositionKind: "attributed_statement",
          origin: { attributedEntity: "Ada Researcher", referencedWork: null },
        }]
      : []),
    {
      claimId: "claim-safe",
      claimType: "FACT",
      text: "Autobiographical memory contributes to identity.",
      propositionKind: "world_state",
      origin: { attributedEntity: null, referencedWork: null },
    },
  ];
  const evidence = [
    ...(includePrimaryClaim
      ? [{
          evidenceId: "evidence-primary",
          sourceId: primaryEvidenceSource.sourceId,
          excerpt: primaryEvidenceSource.summary,
          contextNote: null,
          locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
        }]
      : []),
    {
      evidenceId: "evidence-safe",
      sourceId: secondarySource.sourceId,
      excerpt: "The account was discussed in relation to identity.",
      contextNote: "existing context",
      locator: { section: "discussion", page: null, timecodeStartSec: null, timecodeEndSec: null },
    },
    {
      evidenceId: "evidence-counter",
      sourceId: secondarySource.sourceId,
      excerpt: "A counter-reading remains possible.",
      contextNote: "counter context",
      locator: { section: "limits", page: null, timecodeStartSec: null, timecodeEndSec: null },
    },
  ];
  const links = [
    ...(includePrimaryClaim
      ? [{ claimId: "claim-primary", evidenceId: "evidence-primary", stance: "supports" }]
      : []),
    { claimId: "claim-safe", evidenceId: "evidence-safe", stance: "supports" },
    { claimId: "claim-safe", evidenceId: "evidence-counter", stance: "contradicts" },
    { claimId: "claim-safe", evidenceId: "evidence-primary", stance: "contextualizes" },
  ].filter((link) => evidence.some((item) => item.evidenceId === link.evidenceId));
  return createResearchClaimEvidenceGraph({ sources, claims, evidence, links });
}

function editorialResult(graphValue) {
  return {
    version: "0.19E2A-editorial-result-v1",
    graph: graphValue,
    sourceAssessments: assessments(graphValue.sources),
    spanCatalogVersion: "0.19B",
    segmentationVersion: "editorial-grounding-segmentation-v1",
    proposalOperationId: "operation-editorial",
  };
}

function editorialCheckpoint(graphValue) {
  return {
    checkpointId: createCreatorScriptBuildCheckpointId({
      buildId,
      stage: "editorial",
      contractVersion: "creator-script-build-editorial-checkpoint-v1",
    }),
    stage: "editorial",
    status: "COMPLETED",
    contractVersion: "creator-script-build-editorial-checkpoint-v1",
    operationId: "operation-editorial",
    outputReference: {
      version: "0.19E2A-editorial-checkpoint-output-v1",
      result: editorialResult(graphValue),
    },
    diagnostics: {},
    startedAt: revision,
    completedAt: revision,
  };
}

function buildRecord(graphValue = graph(), overrides = {}) {
  return {
    buildId,
    ownerId,
    projectId,
    idempotencyKey: createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot }),
    state: "EDITORIAL_COMPILED",
    snapshot,
    checkpoints: { editorial: editorialCheckpoint(graphValue) },
    failure: null,
    resultAuthority: null,
    createdAt: revision,
    updatedAt: revision,
    ...overrides,
  };
}

class MemoryRepository {
  constructor(initialBuild = buildRecord(), operations = []) {
    this.build = clone(initialBuild);
    this.operations = new Map(operations.map((operation) => [operation.operationId, clone(operation)]));
    this.transitions = [];
    this.requestedOperations = [];
  }

  async request() { throw new Error("unused"); }
  async getForOwner(requestedBuildId, requestedOwnerId) {
    return requestedBuildId === this.build.buildId && requestedOwnerId === this.build.ownerId
      ? clone(this.build)
      : null;
  }
  async getByIdempotencyForOwner() { return null; }
  async transition(input) {
    assert.equal(input.ownerId, this.build.ownerId);
    assert.equal(input.buildId, this.build.buildId);
    assert.equal(input.expectedState, this.build.state);
    assertCreatorScriptBuildTransition(input.expectedState, input.nextState);
    if (
      input.resultAuthority != null &&
      input.nextState !== "ACCEPTED" &&
      input.nextState !== "PERSISTED"
    ) {
      throw new Error("RESULT_AUTHORITY_STATE_INVALID");
    }
    this.transitions.push(`${input.expectedState}->${input.nextState}`);
    this.build = {
      ...this.build,
      state: input.nextState,
      failure: input.failure || null,
      resultAuthority: input.resultAuthority ?? this.build.resultAuthority,
      updatedAt: "2026-10-02T12:00:10.000Z",
    };
    return clone(this.build);
  }
  async saveCheckpoint(input) {
    assert.equal(input.ownerId, this.build.ownerId);
    assert.equal(input.buildId, this.build.buildId);
    assert.equal(input.expectedBuildState, this.build.state);
    assertCreatorScriptBuildCheckpointIdentity({ buildId: input.buildId, checkpoint: input.checkpoint });
    const previous = this.build.checkpoints[input.checkpoint.stage] || null;
    const allowed = !previous
      ? ["PENDING", "RUNNING"].includes(input.checkpoint.status)
      : previous.status === "PENDING"
        ? ["RUNNING", "COMPLETED", "FAILED"].includes(input.checkpoint.status)
        : previous.status === "RUNNING"
          ? ["COMPLETED", "FAILED"].includes(input.checkpoint.status)
          : false;
    if (!allowed && JSON.stringify(previous) !== JSON.stringify(input.checkpoint)) {
      throw new Error("CHECKPOINT_TRANSITION_INVALID");
    }
    this.build = {
      ...this.build,
      checkpoints: { ...this.build.checkpoints, [input.checkpoint.stage]: clone(input.checkpoint) },
    };
    return clone(this.build);
  }
  async requestOperation(input) {
    this.requestedOperations.push(clone(input));
    const operationId = createCreatorScriptBuildOperationId(input);
    const existing = this.operations.get(operationId);
    if (existing) return { operation: clone(existing), created: false };
    const operation = {
      operationId,
      buildId: input.buildId,
      ownerId: input.ownerId,
      stage: input.stage,
      operationType: input.operationType,
      semanticFingerprint: input.semanticFingerprint,
      contractVersion: input.contractVersion,
      state: "PENDING",
      resultReference: null,
      failure: null,
      createdAt: revision,
      updatedAt: revision,
    };
    this.operations.set(operationId, operation);
    return { operation: clone(operation), created: true };
  }
  async getOperationForOwner(operationId, requestedBuildId, requestedOwnerId) {
    const operation = this.operations.get(operationId);
    if (!operation || operation.buildId !== requestedBuildId || operation.ownerId !== requestedOwnerId) return null;
    return clone(operation);
  }
  async transitionOperation(input) {
    const operation = this.operations.get(input.operationId);
    assert.ok(operation);
    assert.equal(operation.state, input.expectedState);
    assertCreatorScriptBuildOperationTransition(input.expectedState, input.nextState);
    const next = {
      ...operation,
      state: input.nextState,
      resultReference: input.resultReference ?? null,
      failure: input.failure || null,
      updatedAt: "2026-10-02T12:00:11.000Z",
    };
    this.operations.set(input.operationId, next);
    return clone(next);
  }
}

function dependencies(repository, overrides = {}) {
  let acquisitionCalls = 0;
  let selectionCalls = 0;
  let lastAcquisitionInput = null;
  let lastSelectionInput = null;
  const deps = {
    repository,
    getCurrentProjectRevision: overrides.getCurrentProjectRevision ||
      (async () => revision),
    executePrimaryAcquisition: async (input) => {
      acquisitionCalls += 1;
      lastAcquisitionInput = clone(input);
      if (overrides.executePrimaryAcquisition) {
        return await overrides.executePrimaryAcquisition(input);
      }
      return {
        version: "0.19E2B-primary-acquisition-result-v1",
        sources: [acquiredPrimarySource],
      };
    },
    executePrimaryCoverageSelection: async (input) => {
      selectionCalls += 1;
      lastSelectionInput = clone(input);
      if (overrides.executePrimaryCoverageSelection) {
        return await overrides.executePrimaryCoverageSelection(input);
      }
      return {
        repairs: [{ claimId: "claim-primary", spanId: input.candidateSpans[0].spanId }],
      };
    },
    now: overrides.now || (() => "2026-10-02T12:00:12.000Z"),
  };
  return {
    deps,
    counts: () => ({ acquisitionCalls, selectionCalls }),
    inputs: () => ({ lastAcquisitionInput, lastSelectionInput }),
  };
}

// 1, 20, 26, 27, 29, 30. Central authority can advance without paid work.
{
  const graphValue = graph({ coveredPrimary: true });
  const repository = new MemoryRepository(buildRecord(graphValue));
  const { deps, counts } = dependencies(repository, {
    executePrimaryAcquisition: async () => { throw new Error("must not run"); },
    executePrimaryCoverageSelection: async () => { throw new Error("must not run"); },
  });
  const result = await runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps });
  assert.equal(result.build.state, "AUTHORITY_RESOLVED");
  assert.deepEqual(counts(), { acquisitionCalls: 0, selectionCalls: 0 });
  assert.equal(result.authority.finalAuthority.claims.find((item) => item.claimId === "claim-primary").status, "SUPPORTED_PRIMARY");
  assert.deepEqual(repository.transitions, ["EDITORIAL_COMPILED->AUTHORITY_RESOLVED"]);
  assert.equal(repository.build.resultAuthority, null);
  assert.equal(repository.requestedOperations.length, 0);
  assert.ok(!repository.transitions.some((value) => value.includes("SCRIPT_GENERATED") || value.includes("PERSISTED")));
}

// 2, 10-12. Plans come only from resolver-owned missing obligations and identity is semantic.
{
  const graphValue = graph();
  const authority = resolveClaimAuthority({ graph: graphValue, sourceAssessments: assessments(graphValue.sources) });
  const requestA = createCreatorScriptBuildPrimaryAcquisitionInput({ snapshot, graph: graphValue, authority });
  assert.deepEqual(requestA.targets.map((target) => target.claimId), ["claim-primary"]);
  assert.equal(requestA.targets[0].acquisitionClaimType, "PRIMARY_SOURCE_CLAIM");
  const fingerprintA = createCreatorScriptBuildAuthoritySemanticFingerprint(
    CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
    requestA,
  );
  const fingerprintB = createCreatorScriptBuildAuthoritySemanticFingerprint(
    CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
    clone(requestA),
  );
  assert.equal(fingerprintA, fingerprintB);
  const changed = { ...requestA, targets: requestA.targets.map((target) => ({ ...target, subject: `${target.subject} changed` })) };
  assert.notEqual(
    fingerprintA,
    createCreatorScriptBuildAuthoritySemanticFingerprint(
      CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
      changed,
    ),
  );
  const operationInput = (semanticFingerprint) => ({
    buildId,
    stage: "authority",
    operationType: "creator_script_build_primary_acquisition",
    semanticFingerprint,
    contractVersion: CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
  });
  assert.equal(
    createCreatorScriptBuildOperationId(operationInput(fingerprintA)),
    createCreatorScriptBuildOperationId(operationInput(fingerprintB)),
  );
  assert.notEqual(
    createCreatorScriptBuildOperationId(operationInput(fingerprintA)),
    createCreatorScriptBuildOperationId(operationInput(
      createCreatorScriptBuildAuthoritySemanticFingerprint(
        CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
        changed,
      ),
    )),
  );
  assert.equal(
    fingerprintA,
    createCreatorScriptBuildAuthoritySemanticFingerprint(
      CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
      requestA,
    ),
  );
  assert.equal("timestamp" in requestA, false);
  assert.equal("session" in requestA, false);
}

// Proposition-aware acquisition semantics retain original-result and legacy fallbacks.
for (const fixture of [
  {
    claim: {
      claimId: "claim-original-result",
      claimType: "RESEARCH_FINDING",
      text: "The original experiment reported a reconstructive recall effect.",
      propositionKind: "original_research_result",
      origin: { attributedEntity: null, referencedWork: "Original memory experiment" },
    },
    expectedAcquisitionType: "RESEARCH_FINDING",
  },
  {
    claim: {
      claimId: "claim-document",
      claimType: "FACT",
      text: "The archival document describes reconstructive recall.",
      propositionKind: "document_assertion",
      origin: { attributedEntity: null, referencedWork: "Memory archive" },
    },
    expectedAcquisitionType: "PRIMARY_SOURCE_CLAIM",
  },
  {
    claim: {
      claimId: "claim-legacy-primary",
      claimType: "PRIMARY_SOURCE_CLAIM",
      text: "A legacy graph attributes the statement to its original source.",
    },
    expectedAcquisitionType: "PRIMARY_SOURCE_CLAIM",
  },
]) {
  const graphValue = createResearchClaimEvidenceGraph({
    sources: [secondarySource],
    claims: [fixture.claim],
    evidence: [{
      evidenceId: `evidence-${fixture.claim.claimId}`,
      sourceId: secondarySource.sourceId,
      excerpt: secondarySource.summary,
      contextNote: null,
      locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
    }],
    links: [{
      claimId: fixture.claim.claimId,
      evidenceId: `evidence-${fixture.claim.claimId}`,
      stance: "supports",
    }],
  });
  const authority = resolveClaimAuthority({
    graph: graphValue,
    sourceAssessments: assessments(graphValue.sources),
  });
  const input = createCreatorScriptBuildPrimaryAcquisitionInput({
    snapshot,
    graph: graphValue,
    authority,
  });
  assert.equal(input.targets[0].acquisitionClaimType, fixture.expectedAcquisitionType);
}

// 3, 5, 21-23. A primary search lane grants nothing; zero valid spans excludes safely.
{
  const graphValue = graph();
  const repository = new MemoryRepository(buildRecord(graphValue));
  const originalCounterLink = graphValue.links.find((link) => link.stance === "contradicts");
  const { deps, counts } = dependencies(repository, {
    executePrimaryAcquisition: async () => ({
      version: "0.19E2B-primary-acquisition-result-v1",
      sources: [acquisitionLaneOnlySource],
    }),
    executePrimaryCoverageSelection: async () => { throw new Error("must not run"); },
  });
  const result = await runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps });
  assert.deepEqual(counts(), { acquisitionCalls: 1, selectionCalls: 0 });
  assert.deepEqual(result.authority.excludedPrimaryClaimIds, ["claim-primary"]);
  assert.deepEqual(result.authority.unresolvedClaimIds, ["claim-primary"]);
  assert.ok(!result.authority.graph.claims.some((claim) => claim.claimId === "claim-primary"));
  assert.deepEqual(result.authority.graph.links.find((link) => link.stance === "contradicts"), originalCounterLink);
  assert.equal(result.authority.finalAuthority.claims.find((item) => item.claimId === "claim-safe").status, "SUPPORTED");
}

// 4, 8, 9, 20. Claim-relative primary authority plus stable V2 span selection succeeds.
let successfulOperations;
let successfulCheckpoint;
{
  const repository = new MemoryRepository();
  const { deps, counts, inputs } = dependencies(repository);
  const result = await runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps });
  assert.deepEqual(counts(), { acquisitionCalls: 1, selectionCalls: 1 });
  assert.equal(result.authority.finalAuthority.claims.find((item) => item.claimId === "claim-primary").status, "SUPPORTED_PRIMARY");
  assert.deepEqual(result.authority.repairedClaimIds, ["claim-primary"]);
  assert.ok(inputs().lastSelectionInput.candidateSpans.every((span) => /^span:v2:[0-9a-f]{64}$/u.test(span.spanId)));
  assert.equal(inputs().lastSelectionInput.targetClaims[0].claimId, "claim-primary");
  assert.equal("evidenceId" in inputs().lastSelectionInput.targetClaims[0], false);
  assert.equal(result.authority.graph.claims.find((claim) => claim.claimId === "claim-primary").text, graph().claims[0].text);
  successfulOperations = [...repository.operations.values()].map(clone);
  successfulCheckpoint = clone(repository.build.checkpoints.authority);
}

// 6. Non-allowlisted claim ids are rejected and classified as model contract failures.
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository, {
    executePrimaryCoverageSelection: async (input) => ({
      repairs: [{ claimId: "claim-invented", spanId: input.candidateSpans[0].spanId }],
    }),
  });
  await assert.rejects(
    runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_RESULT_INVALID",
  );
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.failure.category, "MODEL_CONTRACT");
}

// 7. Non-allowlisted stable span ids are rejected.
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository, {
    executePrimaryCoverageSelection: async () => ({
      repairs: [{ claimId: "claim-primary", spanId: "span:v2:not-allowlisted" }],
    }),
  });
  await assert.rejects(
    runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_RESULT_INVALID",
  );
}

// 8. Provider output cannot author evidence or link structure.
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository, {
    executePrimaryCoverageSelection: async (input) => ({
      repairs: [{
        claimId: "claim-primary",
        spanId: input.candidateSpans[0].spanId,
        evidenceId: "provider-evidence",
      }],
    }),
  });
  await assert.rejects(
    runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_PRIMARY_SELECTION_RESULT_INVALID",
  );
}

// 13. Confirmed COMPLETED operations are reused without another provider call.
{
  const repository = new MemoryRepository(buildRecord(), successfulOperations);
  const { deps, counts } = dependencies(repository, {
    executePrimaryAcquisition: async () => { throw new Error("must not run"); },
    executePrimaryCoverageSelection: async () => { throw new Error("must not run"); },
  });
  const result = await runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps });
  assert.equal(result.build.state, "AUTHORITY_RESOLVED");
  assert.deepEqual(counts(), { acquisitionCalls: 0, selectionCalls: 0 });
}

function acquisitionOperation(state) {
  const graphValue = graph();
  const authority = resolveClaimAuthority({ graph: graphValue, sourceAssessments: assessments(graphValue.sources) });
  const executionInput = createCreatorScriptBuildPrimaryAcquisitionInput({ snapshot, graph: graphValue, authority });
  const semanticFingerprint = createCreatorScriptBuildAuthoritySemanticFingerprint(
    CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
    executionInput,
  );
  const input = {
    ownerId,
    buildId,
    stage: "authority",
    operationType: "creator_script_build_primary_acquisition",
    semanticFingerprint,
    contractVersion: CREATOR_SCRIPT_BUILD_PRIMARY_ACQUISITION_OPERATION_VERSION,
  };
  return {
    operationId: createCreatorScriptBuildOperationId(input),
    buildId,
    ownerId,
    stage: "authority",
    operationType: input.operationType,
    semanticFingerprint,
    contractVersion: input.contractVersion,
    state,
    resultReference: null,
    failure: state === "FAILED"
      ? {
          category: "RESEARCH",
          code: "PRIMARY_ACQUISITION_FAILED",
          stage: "authority",
          retryability: "NON_RETRYABLE",
          operationId: null,
          diagnostics: {},
        }
      : null,
    createdAt: revision,
    updatedAt: revision,
  };
}

// 14-16. Existing pending/uncertain/failed paid identities are never re-executed.
for (const state of ["PENDING", "OUTCOME_UNCERTAIN", "FAILED"]) {
  const operation = acquisitionOperation(state);
  if (operation.failure) operation.failure.operationId = operation.operationId;
  const repository = new MemoryRepository(buildRecord(), [operation]);
  const { deps, counts } = dependencies(repository);
  await assert.rejects(
    runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && (
      state === "FAILED"
        ? error.code === "PRIMARY_ACQUISITION_FAILED"
        : error.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED"
    ),
  );
  assert.deepEqual(counts(), { acquisitionCalls: 0, selectionCalls: 0 });
  assert.equal(repository.operations.size, 1);
}

// 17-18. Stale authority terminates before provider work and never advances.
{
  const repository = new MemoryRepository();
  const { deps, counts } = dependencies(repository, {
    getCurrentProjectRevision: async () => "2026-10-02T12:30:00.000Z",
  });
  await assert.rejects(
    runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(repository.build.state, "STALE");
  assert.deepEqual(counts(), { acquisitionCalls: 0, selectionCalls: 0 });
  assert.deepEqual(repository.transitions, ["EDITORIAL_COMPILED->STALE"]);
}

// 19. Owner isolation prevents access to another owner's build and operations.
{
  const repository = new MemoryRepository();
  const { deps, counts } = dependencies(repository);
  await assert.rejects(
    runCreatorScriptBuildAuthorityCoordinator({ ownerId: otherOwnerId, buildId, dependencies: deps }),
    /CREATOR_SCRIPT_BUILD_NOT_FOUND/u,
  );
  assert.deepEqual(counts(), { acquisitionCalls: 0, selectionCalls: 0 });
}

// 24-25. Checkpoint identity is deterministic and completed authority resumes.
{
  assert.equal(successfulCheckpoint.checkpointId, createCreatorScriptBuildCheckpointId({
    buildId,
    stage: "authority",
    contractVersion: CREATOR_SCRIPT_BUILD_AUTHORITY_CHECKPOINT_VERSION,
  }));
  const resumedBuild = buildRecord(graph(), {
    checkpoints: {
      editorial: editorialCheckpoint(graph()),
      authority: successfulCheckpoint,
    },
  });
  const repository = new MemoryRepository(resumedBuild);
  const { deps, counts } = dependencies(repository, {
    executePrimaryAcquisition: async () => { throw new Error("must not run"); },
    executePrimaryCoverageSelection: async () => { throw new Error("must not run"); },
  });
  const result = await runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps });
  assert.equal(result.disposition, "RESUMED");
  assert.equal(result.build.state, "AUTHORITY_RESOLVED");
  assert.equal(repository.build.resultAuthority, null);
  assert.deepEqual(counts(), { acquisitionCalls: 0, selectionCalls: 0 });
}

// Canonical repair output must not depend on provider repair-array ordering.
{
  const secondClaim = {
    claimId: "claim-primary-second",
    claimType: "FACT",
    text: "Ada Researcher stated that remembering can reshape a personal narrative.",
    propositionKind: "attributed_statement",
    origin: { attributedEntity: "Ada Researcher", referencedWork: null },
  };
  const graphValue = createResearchClaimEvidenceGraph({
    sources: [secondarySource],
    claims: [graph().claims[0], secondClaim, graph().claims[1]],
    evidence: [
      ...graph().evidence,
      {
        evidenceId: "evidence-primary-second",
        sourceId: secondarySource.sourceId,
        excerpt: secondarySource.summary,
        contextNote: null,
        locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
      },
    ],
    links: [
      ...graph().links,
      { claimId: secondClaim.claimId, evidenceId: "evidence-primary-second", stance: "supports" },
    ],
  });
  const context = createEditorialPrimaryCoverageRepairContext({
    frozenGraph: graphValue,
    originalPrimaryRequiredClaimIds: ["claim-primary", "claim-primary-second"],
    candidateSources: [acquiredPrimarySource],
    creatorProfile: {},
  });
  const spans = context.candidateSpans.filter((span) =>
    span.sourceId === acquiredPrimarySource.sourceId
  );
  assert.ok(spans.length >= 2);
  const forward = applyEditorialPrimaryCoverageRepair({
    context,
    selection: {
      repairs: [
        { claimId: "claim-primary", spanId: spans[0].spanId },
        { claimId: "claim-primary-second", spanId: spans[1].spanId },
      ],
    },
  });
  const reversed = applyEditorialPrimaryCoverageRepair({
    context,
    selection: {
      repairs: [
        { claimId: "claim-primary-second", spanId: spans[1].spanId },
        { claimId: "claim-primary", spanId: spans[0].spanId },
      ],
    },
  });
  assert.deepEqual(reversed.graph, forward.graph);
  assert.deepEqual(reversed.repairedClaimIds, forward.repairedClaimIds);
}

// 28. Provider failure taxonomy is bounded and deterministic.
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository, {
    executePrimaryAcquisition: async () => {
      throw new CreatorScriptBuildStageExecutionError({
        category: "RESEARCH",
        code: "CREATOR_SCRIPT_BUILD_PRIMARY_PROVIDER_UNAVAILABLE",
        retryability: "NON_RETRYABLE",
        diagnostics: { laneCount: 1 },
      });
    },
  });
  await assert.rejects(
    runCreatorScriptBuildAuthorityCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_PRIMARY_PROVIDER_UNAVAILABLE",
  );
  assert.equal(repository.build.failure.category, "RESEARCH");
  assert.deepEqual(repository.build.failure.diagnostics, { laneCount: 1 });
}

// Static safeguards: no generic queue, route, persistence, or script-generation coupling.
const coordinatorSource = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildAuthorityCoordinator.ts", import.meta.url),
  "utf8",
);
const e1MigrationSource = fs.readFileSync(
  new URL("../supabase/migrations/20261002175339_stage_0_19e1_creator_script_build_foundation.sql", import.meta.url),
  "utf8",
);
assert.doesNotMatch(coordinatorSource, /genericQueue|enqueue|SCRIPT_GENERATED|PERSISTED/u);
assert.doesNotMatch(coordinatorSource, /fetch\(|NextResponse|supabase/u);
assert.match(
  e1MigrationSource,
  /result_authority is null or state in \('ACCEPTED', 'PERSISTED'\)/u,
);
assert.match(coordinatorSource, /resolveClaimAuthority\(/u);
assert.match(coordinatorSource, /createEditorialEvidenceSpanCatalog\(/u);
assert.match(coordinatorSource, /applyEditorialPrimaryCoverageRepair\(/u);

// Stage 0.19B identity remains stable for the accepted primary source fixture.
const firstCatalog = createEditorialEvidenceSpanCatalog([acquiredPrimarySource]);
const secondCatalog = createEditorialEvidenceSpanCatalog([clone(acquiredPrimarySource)]);
assert.deepEqual(firstCatalog.spans.map((span) => span.spanId), secondCatalog.spans.map((span) => span.spanId));

console.log("Stage 0.19E2B authority coordinator regression passed.");
