import assert from "node:assert/strict";

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
  CreatorScriptBuildCoordinatorBlockedError,
  CreatorScriptBuildStageExecutionError,
  createCreatorScriptBuildResearchExecutionInput,
  runCreatorScriptBuildResearchEditorialCoordinator,
} from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";

const ownerId = "00000000-0000-4000-8000-000000000002";
const buildId = "10000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000001";
const revision = "2026-10-02T12:00:00.000Z";
const snapshot = createCreatorScriptBuildSnapshot({
  projectId,
  expectedProjectRevision: revision,
  strategyFingerprint: "strategy-fingerprint-e2a",
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
    creatorScriptResearchEditorialCoordinator: "0.19E2A",
  },
});

function clone(value) {
  return structuredClone(value);
}

function buildRecord(state = "REQUESTED") {
  return {
    buildId,
    ownerId,
    projectId,
    idempotencyKey: createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot }),
    state,
    snapshot,
    checkpoints: {},
    failure: null,
    resultAuthority: null,
    createdAt: revision,
    updatedAt: revision,
  };
}

class MemoryRepository {
  constructor(initialBuild = buildRecord()) {
    this.build = clone(initialBuild);
    this.operations = new Map();
  }

  async request() {
    throw new Error("unused");
  }

  async getForOwner(requestedBuildId, requestedOwnerId) {
    return requestedBuildId === this.build.buildId && requestedOwnerId === this.build.ownerId
      ? clone(this.build)
      : null;
  }

  async getByIdempotencyForOwner() {
    return null;
  }

  async transition(input) {
    assert.equal(input.ownerId, this.build.ownerId);
    assert.equal(input.buildId, this.build.buildId);
    assert.equal(input.expectedState, this.build.state);
    assertCreatorScriptBuildTransition(input.expectedState, input.nextState);
    this.build = {
      ...this.build,
      state: input.nextState,
      failure: input.failure || null,
      resultAuthority: input.resultAuthority ?? null,
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
      checkpoints: {
        ...this.build.checkpoints,
        [input.checkpoint.stage]: clone(input.checkpoint),
      },
    };
    return clone(this.build);
  }

  async requestOperation(input) {
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

const researchOutput = {
  sources: [
    {
      sourceId: "web:https://example.test/memory",
      adapterId: "web",
      mediaKind: "article",
      externalId: null,
      title: "Memory Reconstruction",
      url: "https://example.test/memory",
      publisher: "Example Research",
      author: "A. Researcher",
      publishedAt: "2026-01-01",
      language: "en",
      summary: "Remembering is reconstructive rather than a literal replay. Repeated recall can change details while preserving a coherent autobiographical story.",
      thumbnailUrl: null,
      durationSec: null,
      metrics: {},
      sourceMetadata: {},
    },
  ],
  lanes: [
    {
      laneId: "baseline",
      purpose: "baseline",
      required: true,
      status: "ready",
      sourceIds: ["web:https://example.test/memory"],
    },
    {
      laneId: "counter-evidence",
      purpose: "counter_evidence",
      required: true,
      status: "ready",
      sourceIds: ["web:https://example.test/memory"],
    },
  ],
};

function dependencies(repository, overrides = {}) {
  let researchCalls = 0;
  let editorialCalls = 0;
  const deps = {
    repository,
    getCurrentProjectRevision: async () => revision,
    executeResearch: async (input) => {
      researchCalls += 1;
      assert.deepEqual(input, createCreatorScriptBuildResearchExecutionInput(snapshot));
      return researchOutput;
    },
    executeEditorialProposal: async (input) => {
      editorialCalls += 1;
      assert.equal(input.sources.length, 1);
      assert.ok(input.candidateSpans.length > 0);
      assert.deepEqual(input.sourceResearchPurposes["web:https://example.test/memory"], ["baseline", "counter_evidence"]);
      const span = input.candidateSpans[0];
      return {
        proposal: {
          items: [
            {
              claim: {
                text: "Remembering is reconstructive rather than a literal replay.",
                claimType: "FACT",
                propositionKind: "world_state",
                origin: { attributedEntity: null, referencedWork: null },
              },
              evidenceSelections: [
                {
                  sourceId: span.sourceId,
                  spanId: span.spanId,
                  stance: "supports",
                  contextNote: "Direct support for the reconstructive-memory statement.",
                },
              ],
            },
          ],
        },
      };
    },
    now: () => "2026-10-02T12:00:05.000Z",
    ...overrides,
  };
  return {
    deps,
    counts: () => ({ researchCalls, editorialCalls }),
  };
}

// 1. Fresh work advances deterministically through snapshot, research and canonical editorial compilation.
{
  const repository = new MemoryRepository();
  const { deps, counts } = dependencies(repository);
  const result = await runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: deps });
  assert.equal(result.build.state, "EDITORIAL_COMPILED");
  assert.equal(result.disposition, "ADVANCED");
  assert.equal(result.research.sources.length, 1);
  assert.equal(result.editorial.graph.claims.length, 1);
  assert.equal(result.editorial.graph.evidence.length, 1);
  assert.equal(result.editorial.graph.links.length, 1);
  assert.match(result.editorial.graph.claims[0].claimId, /^claim:v2:[0-9a-f]{64}$/u);
  assert.match(result.editorial.graph.evidence[0].evidenceId, /^evidence:v2:[0-9a-f]{64}$/u);
  assert.equal(result.editorial.graph.links[0].claimId, result.editorial.graph.claims[0].claimId);
  assert.equal(result.editorial.graph.links[0].evidenceId, result.editorial.graph.evidence[0].evidenceId);
  assert.deepEqual(counts(), { researchCalls: 1, editorialCalls: 1 });
  assert.equal(repository.build.checkpoints.research.status, "COMPLETED");
  assert.equal(repository.build.checkpoints.editorial.status, "COMPLETED");
}

// 2. An already compiled build is a no-op; paid operations are not repeated.
{
  const repository = new MemoryRepository();
  const first = dependencies(repository);
  await runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: first.deps });
  const second = dependencies(repository, {
    executeResearch: async () => { throw new Error("must not run"); },
    executeEditorialProposal: async () => { throw new Error("must not run"); },
  });
  const result = await runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: second.deps });
  assert.equal(result.disposition, "ALREADY_ADVANCED");
  assert.equal(result.build.state, "EDITORIAL_COMPILED");
}

// 3. Project authority is checked before paid work; stale work terminates without provider calls.
{
  const repository = new MemoryRepository();
  const { deps, counts } = dependencies(repository, {
    getCurrentProjectRevision: async () => "2026-10-02T12:00:01.000Z",
  });
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(repository.build.state, "STALE");
  assert.deepEqual(counts(), { researchCalls: 0, editorialCalls: 0 });
}

// 4. A pre-existing PENDING operation is never silently re-executed after an uncertain crash boundary.
{
  const repository = new MemoryRepository({ ...buildRecord(), state: "SNAPSHOTTED" });
  const researchInput = createCreatorScriptBuildResearchExecutionInput(snapshot);
  // Seed through the repository API so the operation identity matches coordinator semantics later.
  const { deps, counts } = dependencies(repository);
  const pendingBuild = await repository.saveCheckpoint({
    ownerId,
    buildId,
    expectedBuildState: "SNAPSHOTTED",
    checkpoint: {
      checkpointId: createCreatorScriptBuildCheckpointId({
        buildId,
        stage: "research",
        contractVersion: "creator-script-build-research-checkpoint-v1",
      }),
      stage: "research",
      status: "PENDING",
      contractVersion: "creator-script-build-research-checkpoint-v1",
      operationId: null,
      outputReference: null,
      diagnostics: {},
      startedAt: null,
      completedAt: null,
    },
  });
  assert.equal(pendingBuild.state, "SNAPSHOTTED");
  // Capture the operation identity by temporarily letting requestOperation create it, then keep it PENDING.
  const originalRequestOperation = repository.requestOperation.bind(repository);
  let captured = false;
  repository.requestOperation = async (input) => {
    const result = await originalRequestOperation(input);
    if (!captured) {
      captured = true;
      return { operation: result.operation, created: false };
    }
    return result;
  };
  assert.equal(researchInput.subject, snapshot.strategy.researchSubject);
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
  );
  assert.deepEqual(counts(), { researchCalls: 0, editorialCalls: 0 });
}

// 5. Unknown external outcome is persisted as OUTCOME_UNCERTAIN and is not retried automatically.
{
  const repository = new MemoryRepository();
  const first = dependencies(repository, {
    executeResearch: async () => {
      throw new CreatorScriptBuildStageExecutionError({
        category: "PROVIDER",
        code: "RESEARCH_PROVIDER_OUTCOME_UNKNOWN",
        retryability: "UNKNOWN_OUTCOME",
      });
    },
  });
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: first.deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
  );
  assert.equal(repository.build.state, "SNAPSHOTTED");
  assert.equal([...repository.operations.values()][0].state, "OUTCOME_UNCERTAIN");
  const second = dependencies(repository);
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: second.deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
  );
  assert.deepEqual(second.counts(), { researchCalls: 0, editorialCalls: 0 });
}

// 6. Known provider failure is durable and terminates the build rather than silently retrying.
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository, {
    executeResearch: async () => {
      throw new CreatorScriptBuildStageExecutionError({
        category: "PROVIDER",
        code: "RESEARCH_PROVIDER_FAILED",
        retryability: "RETRYABLE",
      });
    },
  });
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "RESEARCH_PROVIDER_FAILED",
  );
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.failure.code, "RESEARCH_PROVIDER_FAILED");
  assert.equal(repository.build.checkpoints.research.status, "FAILED");
  assert.equal([...repository.operations.values()][0].state, "FAILED");
}

// 7. Provider-authored relational IDs are rejected before canonical compilation and fail as MODEL_CONTRACT.
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository, {
    executeEditorialProposal: async (input) => ({
      proposal: {
        items: [
          {
            claim: {
              claimId: "provider-claim-1",
              text: "Remembering is reconstructive rather than a literal replay.",
              claimType: "FACT",
              propositionKind: "world_state",
              origin: { attributedEntity: null, referencedWork: null },
            },
            evidenceSelections: [{
              sourceId: input.candidateSpans[0].sourceId,
              spanId: input.candidateSpans[0].spanId,
              stance: "supports",
              contextNote: null,
            }],
          },
        ],
      },
    }),
  });
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: deps }),
    (error) => error instanceof CreatorScriptBuildCoordinatorBlockedError && error.code === "CREATOR_SCRIPT_BUILD_EDITORIAL_PROPOSAL_INVALID",
  );
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.failure.category, "MODEL_CONTRACT");
}

// 8. A deterministic post-response model-contract failure is durable, does
// not become OUTCOME_UNCERTAIN, and cannot execute the provider twice.
{
  const repository = new MemoryRepository();
  const knownFailureCode =
    "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID";
  let modelContractCalls = 0;
  const first = dependencies(repository, {
    executeEditorialProposal: async () => {
      modelContractCalls += 1;
      throw new CreatorScriptBuildStageExecutionError({
        category: "MODEL_CONTRACT",
        code: knownFailureCode,
        retryability: "NON_RETRYABLE",
      });
    },
  });
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({
      ownerId,
      buildId,
      dependencies: first.deps,
    }),
    (error) =>
      error instanceof CreatorScriptBuildCoordinatorBlockedError &&
      error.code === knownFailureCode,
  );
  assert.equal(modelContractCalls, 1);
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.failure.category, "MODEL_CONTRACT");
  assert.equal(repository.build.failure.retryability, "NON_RETRYABLE");
  const editorialOperation = [...repository.operations.values()].find(
    (operation) => operation.stage === "editorial",
  );
  assert.equal(editorialOperation.state, "FAILED");
  assert.equal(
    [...repository.operations.values()].some(
      (operation) => operation.state === "OUTCOME_UNCERTAIN",
    ),
    false,
  );
  assert.deepEqual(first.counts(), { researchCalls: 1, editorialCalls: 0 });

  const second = dependencies(repository, {
    executeResearch: async () => { throw new Error("must not rerun research"); },
    executeEditorialProposal: async () => {
      modelContractCalls += 1;
      throw new Error("must not rerun editorial");
    },
  });
  const terminal = await runCreatorScriptBuildResearchEditorialCoordinator({
    ownerId,
    buildId,
    dependencies: second.deps,
  });
  assert.equal(terminal.build.state, "FAILED");
  assert.deepEqual(second.counts(), { researchCalls: 0, editorialCalls: 0 });
  assert.equal(modelContractCalls, 1);
}

// 9. A genuinely ambiguous editorial provider execution retains the existing
// reconciliation-required path and is not automatically executed again.
{
  const repository = new MemoryRepository();
  let ambiguousCalls = 0;
  const first = dependencies(repository, {
    executeEditorialProposal: async () => {
      ambiguousCalls += 1;
      throw new Error("simulated ambiguous provider transport");
    },
  });
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({
      ownerId,
      buildId,
      dependencies: first.deps,
    }),
    (error) =>
      error instanceof CreatorScriptBuildCoordinatorBlockedError &&
      error.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
  );
  assert.equal(ambiguousCalls, 1);
  const editorialOperation = [...repository.operations.values()].find(
    (operation) => operation.stage === "editorial",
  );
  assert.equal(editorialOperation.state, "OUTCOME_UNCERTAIN");
  assert.equal(repository.build.state, "RESEARCH_READY");

  const second = dependencies(repository, {
    executeResearch: async () => { throw new Error("must not rerun research"); },
    executeEditorialProposal: async () => {
      ambiguousCalls += 1;
      throw new Error("must not rerun editorial");
    },
  });
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({
      ownerId,
      buildId,
      dependencies: second.deps,
    }),
    (error) =>
      error instanceof CreatorScriptBuildCoordinatorBlockedError &&
      error.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
  );
  assert.equal(ambiguousCalls, 1);
  assert.deepEqual(second.counts(), { researchCalls: 0, editorialCalls: 0 });
}

// 10. Owner scoping stays at the repository boundary.
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository);
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({
      ownerId: "00000000-0000-4000-8000-000000000099",
      buildId,
      dependencies: deps,
    }),
    /CREATOR_SCRIPT_BUILD_NOT_FOUND/u,
  );
}

// 11. A confirmed completed paid operation is reused after a crash before checkpoint completion.
{
  const repository = new MemoryRepository();
  const originalSaveCheckpoint = repository.saveCheckpoint.bind(repository);
  let crashInjected = false;
  repository.saveCheckpoint = async (input) => {
    if (
      !crashInjected &&
      input.checkpoint.stage === "research" &&
      input.checkpoint.status === "COMPLETED"
    ) {
      crashInjected = true;
      throw new Error("SIMULATED_PROCESS_CRASH_AFTER_OPERATION_COMPLETION");
    }
    return await originalSaveCheckpoint(input);
  };
  const first = dependencies(repository);
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: first.deps }),
    /SIMULATED_PROCESS_CRASH_AFTER_OPERATION_COMPLETION/u,
  );
  assert.equal([...repository.operations.values()][0].state, "COMPLETED");
  assert.equal(repository.build.state, "SNAPSHOTTED");
  assert.equal(repository.build.checkpoints.research.status, "RUNNING");

  repository.saveCheckpoint = originalSaveCheckpoint;
  const second = dependencies(repository, {
    executeResearch: async () => { throw new Error("research must be reused"); },
  });
  const resumed = await runCreatorScriptBuildResearchEditorialCoordinator({
    ownerId,
    buildId,
    dependencies: second.deps,
  });
  assert.equal(resumed.build.state, "EDITORIAL_COMPILED");
  assert.deepEqual(second.counts(), { researchCalls: 0, editorialCalls: 1 });
}

// 10. The coordinator contract participates in immutable build authority.
{
  const incompatibleSnapshot = createCreatorScriptBuildSnapshot({
    ...snapshot,
    strategy: {
      ...snapshot.strategy,
      approvedStrategy: { ...snapshot.strategy.approvedStrategy },
    },
    creatorProfile: { ...snapshot.creatorProfile },
    contractVersions: {
      ...snapshot.contractVersions,
      creatorScriptResearchEditorialCoordinator: "0.19E2B",
    },
  });
  const repository = new MemoryRepository({
    ...buildRecord(),
    snapshot: incompatibleSnapshot,
    idempotencyKey: createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot: incompatibleSnapshot }),
  });
  const { deps, counts } = dependencies(repository);
  await assert.rejects(
    runCreatorScriptBuildResearchEditorialCoordinator({ ownerId, buildId, dependencies: deps }),
    /RESEARCH_EDITORIAL_CONTRACT_MISMATCH/u,
  );
  assert.deepEqual(counts(), { researchCalls: 0, editorialCalls: 0 });
}

console.log("Stage 0.19E2A research/editorial coordinator regression passed.");
