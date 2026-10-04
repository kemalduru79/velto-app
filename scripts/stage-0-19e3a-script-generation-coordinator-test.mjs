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
  CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_CHECKPOINT_VERSION,
  CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_TYPE,
  CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_VERSION,
  createCreatorScriptBuildScriptGenerationInput,
  createCreatorScriptBuildScriptGenerationOperationId,
  createCreatorScriptBuildScriptGenerationSemanticFingerprint,
  runCreatorScriptBuildScriptGenerationCoordinator,
} from "../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
  CreatorScriptBuildStageExecutionError,
} from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import { resolveClaimAuthority } from "../lib/research/claimAuthorityResolver.ts";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
} from "../lib/research/sourceAssessment.ts";

const ownerId = "00000000-0000-4000-8000-000000000003";
const otherOwnerId = "00000000-0000-4000-8000-000000000099";
const buildId = "30000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000001";
const revision = "2026-10-03T10:00:00.000Z";
const now = "2026-10-03T10:00:01.000Z";

function clone(value) {
  return structuredClone(value);
}

function createSnapshot(overrides = {}) {
  return createCreatorScriptBuildSnapshot({
    projectId,
    expectedProjectRevision: revision,
    strategyFingerprint: "strategy-fingerprint-e3a",
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
      approvedStrategy: { framing: "identity", selectedDirectionId: "direction-a" },
      ...(overrides.strategy || {}),
    },
    creatorProfile: {
      brandName: "",
      brandVoice: "documentary",
      defaultAudience: "educated general audience",
      defaultFormat: "youtube_video",
      ...(overrides.creatorProfile || {}),
    },
    contractVersions: {
      canonicalEditorialGraph: "0.19A",
      editorialEvidenceSpanCatalog: "0.19B",
      claimAuthorityResolver: "0.19C",
      creatorScriptAcceptance: "0.19D",
      creatorScriptBuild: "0.19E1",
      creatorScriptResearchEditorialCoordinator: "0.19E2A-A2",
      creatorScriptBuildAuthorityCoordinator: "0.19E2B",
      creatorScriptBuildScriptGenerationCoordinator: "0.19E3A",
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) =>
        key !== "strategy" && key !== "creatorProfile"
      ),
    ),
  });
}

const snapshot = createSnapshot();

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
    summary: "Memory contributes to identity, while a grounded counter-reading remains possible.",
    thumbnailUrl: null,
    durationSec: null,
    metrics: {},
    sourceMetadata: {},
    ...overrides,
  };
}

const secondarySource = source();
const primarySource = source({
  sourceId: "academic:memory-paper",
  adapterId: "academic",
  mediaKind: "paper",
  externalId: "memory-paper",
  title: "Original memory experiment",
  url: "https://academic.example/memory-paper",
  publisher: "Journal of Memory",
  author: "Ada Researcher",
  summary: "In the original experiment, 120 participants recalled an event and later reported changed details.",
  sourceMetadata: {
    provenanceVerified: true,
    provenanceKind: "original_academic_paper",
  },
});

function sourceAssessments(sources) {
  return sources.map((item) =>
    assessResearchSource(item, classifyResearchSourceDirectness(item).directness)
  );
}

function authorityFixture() {
  const graph = createResearchClaimEvidenceGraph({
    sources: [secondarySource, primarySource],
    claims: [
      {
        claimId: "claim-safe",
        claimType: "FACT",
        text: "Autobiographical memory contributes to identity.",
        propositionKind: "world_state",
        origin: { attributedEntity: null, referencedWork: null },
      },
      {
        claimId: "claim-primary",
        claimType: "FACT",
        text: "Ada Researcher described memory as reconstructive.",
        propositionKind: "attributed_statement",
        origin: { attributedEntity: "Ada Researcher", referencedWork: null },
      },
      {
        claimId: "claim-excluded",
        claimType: "FACT",
        text: "An excluded attributed claim lacks verified primary coverage.",
        propositionKind: "attributed_statement",
        origin: { attributedEntity: "Excluded Researcher", referencedWork: null },
      },
      {
        claimId: "claim-unsupported",
        claimType: "FACT",
        text: "An unsupported claim has no traceable evidence.",
        propositionKind: "world_state",
        origin: { attributedEntity: null, referencedWork: null },
      },
    ],
    evidence: [
      {
        evidenceId: "evidence-safe",
        sourceId: secondarySource.sourceId,
        excerpt: "Memory contributes to identity.",
        contextNote: "Grounded contextual account.",
        locator: { section: "overview", page: null, timecodeStartSec: null, timecodeEndSec: null },
      },
      {
        evidenceId: "evidence-counter",
        sourceId: secondarySource.sourceId,
        excerpt: "A grounded counter-reading remains possible.",
        contextNote: "Material counterview.",
        locator: { section: "limits", page: null, timecodeStartSec: null, timecodeEndSec: null },
      },
      {
        evidenceId: "evidence-primary",
        sourceId: primarySource.sourceId,
        excerpt: "In the original experiment, 120 participants recalled an event and later reported changed details.",
        contextNote: "Verified original source.",
        locator: { section: "results", page: 4, timecodeStartSec: null, timecodeEndSec: null },
      },
      {
        evidenceId: "evidence-excluded",
        sourceId: secondarySource.sourceId,
        excerpt: "A secondary account repeats the excluded attribution.",
        contextNote: null,
        locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null },
      },
    ],
    links: [
      { claimId: "claim-safe", evidenceId: "evidence-safe", stance: "supports" },
      { claimId: "claim-safe", evidenceId: "evidence-counter", stance: "contradicts" },
      { claimId: "claim-primary", evidenceId: "evidence-primary", stance: "supports" },
      { claimId: "claim-excluded", evidenceId: "evidence-excluded", stance: "supports" },
    ],
  });
  const assessments = sourceAssessments(graph.sources);
  const finalAuthority = resolveClaimAuthority({ graph, sourceAssessments: assessments });
  return {
    version: "0.19E2B-authority-result-v1",
    graph,
    sourceAssessments: assessments,
    initialAuthority: finalAuthority,
    finalAuthority,
    acquisitionPlan: [],
    acquisitionOperationId: null,
    selectionOperationId: null,
    repairedClaimIds: [],
    unresolvedClaimIds: ["claim-unsupported"],
    excludedPrimaryClaimIds: ["claim-excluded"],
    permittedClaimIds: ["claim-primary", "claim-safe"],
    spanCatalogVersion: "0.19B",
    segmentationVersion: "editorial-grounding-segmentation-v1",
  };
}

const authority = authorityFixture();

function longFormIneligibleAuthorityFixture() {
  const graph = createResearchClaimEvidenceGraph({
    sources: [secondarySource],
    claims: [{
      claimId: "claim-safe",
      claimType: "FACT",
      text: "Autobiographical memory contributes to identity.",
      propositionKind: "world_state",
      origin: { attributedEntity: null, referencedWork: null },
    }],
    evidence: [{
      evidenceId: "evidence-safe",
      sourceId: secondarySource.sourceId,
      excerpt: "Memory contributes to identity.",
      contextNote: "Conceptual grounding without a concrete demonstration.",
      locator: {
        section: "overview",
        page: null,
        timecodeStartSec: null,
        timecodeEndSec: null,
      },
    }],
    links: [{
      claimId: "claim-safe",
      evidenceId: "evidence-safe",
      stance: "supports",
    }],
  });
  const assessments = sourceAssessments(graph.sources);
  const finalAuthority = resolveClaimAuthority({ graph, sourceAssessments: assessments });
  return {
    version: "0.19E2B-authority-result-v1",
    graph,
    sourceAssessments: assessments,
    initialAuthority: finalAuthority,
    finalAuthority,
    acquisitionPlan: [],
    acquisitionOperationId: null,
    selectionOperationId: null,
    repairedClaimIds: [],
    unresolvedClaimIds: [],
    excludedPrimaryClaimIds: [],
    permittedClaimIds: ["claim-safe"],
    spanCatalogVersion: "0.19B",
    segmentationVersion: "editorial-grounding-segmentation-v1",
  };
}

function authorityCheckpoint(authorityValue = authority) {
  return {
    checkpointId: createCreatorScriptBuildCheckpointId({
      buildId,
      stage: "authority",
      contractVersion: "creator-script-build-authority-checkpoint-v1",
    }),
    stage: "authority",
    status: "COMPLETED",
    contractVersion: "creator-script-build-authority-checkpoint-v1",
    operationId: null,
    outputReference: {
      version: "0.19E2B-authority-checkpoint-output-v1",
      result: authorityValue,
    },
    diagnostics: {},
    startedAt: revision,
    completedAt: revision,
  };
}

function buildRecord(overrides = {}) {
  const buildSnapshot = overrides.snapshot || snapshot;
  return {
    buildId,
    ownerId,
    projectId,
    idempotencyKey: createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot: buildSnapshot }),
    state: "AUTHORITY_RESOLVED",
    snapshot: buildSnapshot,
    checkpoints: { authority: authorityCheckpoint() },
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
    this.operations = new Map(
      operations.map((operation) => [operation.operationId, clone(operation)]),
    );
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
      updatedAt: now,
    };
    return clone(this.build);
  }
  async saveCheckpoint(input) {
    assert.equal(input.ownerId, this.build.ownerId);
    assert.equal(input.buildId, this.build.buildId);
    assert.equal(input.expectedBuildState, this.build.state);
    assertCreatorScriptBuildCheckpointIdentity({
      buildId: input.buildId,
      checkpoint: input.checkpoint,
    });
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
    if (
      !operation ||
      operation.buildId !== requestedBuildId ||
      operation.ownerId !== requestedOwnerId
    ) return null;
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
      updatedAt: now,
    };
    this.operations.set(input.operationId, next);
    return clone(next);
  }
}

function generationInput(buildSnapshot = snapshot, authorityValue = authority) {
  return createCreatorScriptBuildScriptGenerationInput({
    snapshot: buildSnapshot,
    authority: authorityValue,
  });
}

function generatedProposal(input, mutate = (value) => value) {
  const proposal = {
    version: "0.19E3A-script-generation-proposal-v1",
    sections: input.sectionPlan.map((section, index) => ({
      heading: `${section.kind} ${index + 1}`,
      text: `Grounded narration for ${section.id} advances its assigned role without deciding final acceptance.`,
      claimIds: index === 1 ? [input.permittedClaimIds[0]] : [],
    })),
  };
  return mutate(clone(proposal));
}

function canonicalStoredScript(input, timestamp = "2026-10-03T09:30:00.000Z") {
  return {
    version: 1,
    title: input.title,
    sections: input.sectionPlan.map((section, index) => ({
      id: section.id,
      kind: section.kind,
      heading: `${section.kind} ${index + 1}`,
      text: `Grounded narration for ${section.id} advances its assigned role without deciding final acceptance.`,
      claimIds: index === 1 ? [input.permittedClaimIds[0]] : [],
      evidenceReviewRequired: false,
    })),
    targetDurationSec: input.requestedDurationSeconds,
    strategyFingerprint: input.strategyFingerprint,
    revision: 1,
    grounding: { context: input.editorialContext },
    generatedAt: timestamp,
    updatedAt: timestamp,
    approval: null,
  };
}

function dependencies(repository, overrides = {}) {
  let providerCalls = 0;
  let lastInput = null;
  return {
    deps: {
      repository,
      getCurrentProjectRevision: overrides.getCurrentProjectRevision ||
        (async () => revision),
      executeScriptGeneration: async (input) => {
        providerCalls += 1;
        lastInput = clone(input);
        if (overrides.executeScriptGeneration) {
          return await overrides.executeScriptGeneration(input);
        }
        return generatedProposal(input);
      },
      now: () => now,
    },
    counts: () => ({ providerCalls }),
    input: () => lastInput,
  };
}

function operationIdentity(input = generationInput()) {
  const semanticFingerprint =
    createCreatorScriptBuildScriptGenerationSemanticFingerprint(input);
  const request = {
    buildId,
    stage: "script_generation",
    operationType: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_TYPE,
    semanticFingerprint,
    contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_VERSION,
  };
  return {
    semanticFingerprint,
    operationId: createCreatorScriptBuildScriptGenerationOperationId({
      buildId,
      generationInput: input,
    }),
    request,
  };
}

function operationFixture(state, input = generationInput(), overrides = {}) {
  const identity = operationIdentity(input);
  return {
    operationId: identity.operationId,
    buildId,
    ownerId,
    stage: "script_generation",
    operationType: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_TYPE,
    semanticFingerprint: identity.semanticFingerprint,
    contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_OPERATION_VERSION,
    state,
    resultReference: state === "COMPLETED"
      ? {
          version: "0.19E3A-script-generation-operation-result-v1",
          script: canonicalStoredScript(input),
        }
      : null,
    failure: state === "FAILED"
      ? {
          category: "PROVIDER",
          code: "CREATOR_SCRIPT_BUILD_SCRIPT_PROVIDER_FAILED",
          stage: "script_generation",
          retryability: "NON_RETRYABLE",
          operationId: identity.operationId,
          diagnostics: {},
        }
      : null,
    createdAt: revision,
    updatedAt: revision,
    ...overrides,
  };
}

async function expectBlocked(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CreatorScriptBuildCoordinatorBlockedError);
    assert.equal(error.code, code);
    return true;
  });
}

// 1, 3-7, 27-32, 34-35. The canonical E2B projection advances only to SCRIPT_GENERATED.
let successfulRepository;
{
  const repository = new MemoryRepository();
  successfulRepository = repository;
  const { deps, counts, input } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptGenerationCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.build.state, "SCRIPT_GENERATED");
  assert.equal(result.disposition, "ADVANCED");
  assert.deepEqual(counts(), { providerCalls: 1 });
  assert.deepEqual(repository.transitions, ["AUTHORITY_RESOLVED->SCRIPT_GENERATED"]);
  assert.equal(repository.build.resultAuthority, null);
  assert.equal(repository.build.checkpoints.script_generation.status, "COMPLETED");
  assert.equal(
    repository.build.checkpoints.script_generation.contractVersion,
    CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_CHECKPOINT_VERSION,
  );
  assert.deepEqual(input().permittedClaimIds, ["claim-primary", "claim-safe"]);
  assert.equal(input().topic, snapshot.strategy.topic);
  assert.equal(input().researchSubject, snapshot.strategy.researchSubject);
  assert.equal(input().title, snapshot.strategy.title);
  assert.equal(input().requestedDurationSeconds, snapshot.requestedDurationSeconds);
  assert.equal(input().strategyFingerprint, snapshot.strategyFingerprint);
  assert.equal(input().creatorProfile.defaultAudience, "educated general audience");
  assert.equal(input().sectionNative, true);
  assert.equal(input().longFormEvidenceReadiness.eligible, true);
  const immutableInput = generationInput();
  assert.equal(Object.isFrozen(immutableInput), true);
  assert.equal(Object.isFrozen(immutableInput.sectionPlan), true);
  assert.equal(Object.isFrozen(immutableInput.editorialContext), true);
  assert.deepEqual(
    input().editorialContext.claims.map((claim) => claim.claimId),
    ["claim-primary", "claim-safe"],
  );
  assert.ok(!input().editorialContext.claims.some((claim) =>
    claim.claimId === "claim-excluded" || claim.claimId === "claim-unsupported"
  ));
  assert.ok(!repository.transitions.some((transition) =>
    transition.includes("REPAIRING") ||
    transition.includes("ACCEPTED") ||
    transition.includes("PERSISTED")
  ));
}

// Production long-form evidence readiness is enforced before paid operation creation.
{
  const weakAuthority = longFormIneligibleAuthorityFixture();
  const repository = new MemoryRepository(buildRecord({
    checkpoints: { authority: authorityCheckpoint(weakAuthority) },
  }));
  const { deps, counts } = dependencies(repository);
  await expectBlocked(
    runCreatorScriptBuildScriptGenerationCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_LONG_FORM_EVIDENCE_NOT_READY",
  );
  assert.deepEqual(counts(), { providerCalls: 0 });
  assert.equal(repository.requestedOperations.length, 0);
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.failure.category, "GROUNDING");
  // E6K/E6P adapt unsupported demonstration/uncertainty roles before readiness.
  // The final plan remains blocked by four sections sharing one claim/evidence.
  const diagnostics = repository.build.failure.diagnostics;
  assert.equal(diagnostics.reasonCodes, "collapsed_body_authority");
  assert.equal(diagnostics.reasonCount, 1);
  assert.equal(diagnostics.sectionNative, true);
  assert.equal(diagnostics.readinessApplicable, true);
  assert.equal(diagnostics.collapsedBodySectionCount, 4);
  assert.equal(diagnostics.fallbackBodySectionCount, 3);
}

// The shared readiness helper remains non-applicable for short/non-section-native work.
{
  const shortSnapshot = createSnapshot({ requestedDurationSeconds: 120 });
  const weakAuthority = longFormIneligibleAuthorityFixture();
  const repository = new MemoryRepository(buildRecord({
    snapshot: shortSnapshot,
    checkpoints: { authority: authorityCheckpoint(weakAuthority) },
  }));
  const { deps, counts, input } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptGenerationCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.build.state, "SCRIPT_GENERATED");
  assert.deepEqual(counts(), { providerCalls: 1 });
  assert.equal(input().sectionNative, false);
  assert.equal(input().longFormEvidenceReadiness.applicable, false);
  assert.equal(input().longFormEvidenceReadiness.eligible, true);
}

// 2. Every entry state other than AUTHORITY_RESOLVED fails before provider execution.
for (const state of [
  "REQUESTED",
  "SNAPSHOTTED",
  "RESEARCH_READY",
  "EDITORIAL_COMPILED",
  "SCRIPT_GENERATED",
  "REPAIRING",
  "ACCEPTED",
  "FAILED",
  "STALE",
]) {
  const repository = new MemoryRepository(buildRecord({ state }));
  const { deps, counts } = dependencies(repository);
  await expectBlocked(
    runCreatorScriptBuildScriptGenerationCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_SCRIPT_GENERATION_STATE_INVALID",
  );
  assert.deepEqual(counts(), { providerCalls: 0 });
}

// 7, 15-18. Section planning and paid-operation identity are deterministic and semantic.
{
  const inputA = generationInput();
  const inputB = generationInput(clone(snapshot), clone(authority));
  assert.deepEqual(inputA.sectionPlan, inputB.sectionPlan);
  assert.equal(operationIdentity(inputA).operationId, operationIdentity(inputB).operationId);
  assert.equal(
    createCreatorScriptBuildScriptGenerationSemanticFingerprint(inputA),
    createCreatorScriptBuildScriptGenerationSemanticFingerprint(clone(inputA)),
  );
  const reordered = {
    ...clone(inputA),
    approvedStrategy: {
      selectedDirectionId: inputA.approvedStrategy.selectedDirectionId,
      framing: inputA.approvedStrategy.framing,
    },
  };
  assert.equal(operationIdentity(inputA).operationId, operationIdentity(reordered).operationId);
  const changedDuration = { ...clone(inputA), requestedDurationSeconds: 661 };
  assert.notEqual(
    operationIdentity(inputA).operationId,
    operationIdentity(changedDuration).operationId,
  );
  assert.equal("timestamp" in inputA, false);
  assert.equal("requestId" in inputA, false);
  assert.equal("provider" in inputA, false);
}

// Provider proposal fields are content-only; server authority wins deterministically.
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository, {
    executeScriptGeneration: async (input) => generatedProposal(input, (proposal) => {
      proposal.title = "Provider title";
      proposal.strategyFingerprint = "provider-fingerprint";
      proposal.targetDurationSec = 1;
      proposal.revision = 99;
      proposal.approval = { approvedRevision: 99 };
      proposal.generatedAt = "1900-01-01T00:00:00.000Z";
      proposal.updatedAt = "1900-01-01T00:00:00.000Z";
      proposal.grounding = { context: { provider: true } };
      proposal.sections = proposal.sections.map((section, index) => ({
        ...section,
        id: `provider-section-${index}`,
        kind: index === 0 ? "conclusion" : "opening",
        evidenceReviewRequired: true,
        humanVerification: {
          scriptRevision: 99,
          verifiedAt: "1900-01-01T00:00:00.000Z",
        },
      }));
      return proposal;
    }),
  });
  const result = await runCreatorScriptBuildScriptGenerationCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  const canonicalInput = generationInput();
  assert.equal(result.generation.script.title, snapshot.strategy.title);
  assert.equal(
    result.generation.script.strategyFingerprint,
    snapshot.strategyFingerprint,
  );
  assert.equal(
    result.generation.script.targetDurationSec,
    snapshot.requestedDurationSeconds,
  );
  assert.equal(result.generation.script.revision, 1);
  assert.equal(result.generation.script.approval, null);
  assert.equal(result.generation.script.generatedAt, now);
  assert.equal(result.generation.script.updatedAt, now);
  assert.deepEqual(
    result.generation.script.grounding.context,
    canonicalInput.editorialContext,
  );
  assert.deepEqual(
    result.generation.script.sections.map((section) => [section.id, section.kind]),
    canonicalInput.sectionPlan.map((section) => [section.id, section.kind]),
  );
  assert.ok(result.generation.script.sections.every((section) =>
    section.evidenceReviewRequired === false && section.humanVerification === undefined
  ));
}

// 5-6, 10, 14, 33. Malformed content and forbidden claim bindings fail closed.
const invalidCases = [
  {
    code: "CREATOR_SCRIPT_BUILD_GENERATED_SECTION_COUNT_MISMATCH",
    category: "MODEL_CONTRACT",
    mutate: (proposal) => { proposal.sections.pop(); return proposal; },
  },
  {
    code: "CREATOR_SCRIPT_BUILD_GENERATED_CLAIM_NOT_PERMITTED",
    category: "GROUNDING",
    mutate: (proposal) => { proposal.sections[1].claimIds = ["claim-excluded"]; return proposal; },
  },
  {
    code: "CREATOR_SCRIPT_BUILD_GENERATED_CLAIM_NOT_PERMITTED",
    category: "GROUNDING",
    mutate: (proposal) => { proposal.sections[1].claimIds = ["claim-unsupported"]; return proposal; },
  },
  {
    code: "CREATOR_SCRIPT_BUILD_GENERATED_CLAIM_NOT_PERMITTED",
    category: "GROUNDING",
    mutate: (proposal) => { proposal.sections[1].claimIds = ["claim-unknown"]; return proposal; },
  },
];
for (const fixture of invalidCases) {
  const repository = new MemoryRepository();
  const { deps, counts } = dependencies(repository, {
    executeScriptGeneration: async (input) => generatedProposal(input, fixture.mutate),
  });
  await expectBlocked(
    runCreatorScriptBuildScriptGenerationCoordinator({ ownerId, buildId, dependencies: deps }),
    fixture.code,
  );
  assert.deepEqual(counts(), { providerCalls: 1 });
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.failure.category, fixture.category);
  assert.equal(repository.build.failure.code, fixture.code);
  assert.equal(repository.build.checkpoints.script_generation.status, "FAILED");
}

// 19. A completed operation with the same semantic identity is reused for free.
{
  const input = generationInput();
  const repository = new MemoryRepository(buildRecord(), [operationFixture("COMPLETED", input)]);
  const { deps, counts } = dependencies(repository, {
    executeScriptGeneration: async () => { throw new Error("must not run"); },
  });
  const result = await runCreatorScriptBuildScriptGenerationCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.build.state, "SCRIPT_GENERATED");
  assert.deepEqual(counts(), { providerCalls: 0 });
  assert.equal(repository.requestedOperations.length, 1);
  assert.equal(result.generation.script.generatedAt, "2026-10-03T09:30:00.000Z");
  assert.equal(result.generation.script.updatedAt, "2026-10-03T09:30:00.000Z");
}

// 20-22. Existing non-reusable operation states never trigger a second execution or identity.
for (const state of ["PENDING", "OUTCOME_UNCERTAIN", "FAILED"]) {
  const input = generationInput();
  const operation = operationFixture(state, input);
  const repository = new MemoryRepository(buildRecord(), [operation]);
  const { deps, counts } = dependencies(repository, {
    executeScriptGeneration: async () => { throw new Error("must not run"); },
  });
  const expectedCode = state === "FAILED"
    ? "CREATOR_SCRIPT_BUILD_SCRIPT_PROVIDER_FAILED"
    : "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED";
  await expectBlocked(
    runCreatorScriptBuildScriptGenerationCoordinator({ ownerId, buildId, dependencies: deps }),
    expectedCode,
  );
  assert.deepEqual(counts(), { providerCalls: 0 });
  assert.equal(repository.requestedOperations.length, 1);
  assert.equal(repository.requestedOperations[0].semanticFingerprint, operation.semanticFingerprint);
  assert.equal(repository.operations.size, 1);
}

// 23-24. Stale project authority transitions to STALE before any operation/provider work.
{
  const repository = new MemoryRepository();
  const { deps, counts } = dependencies(repository, {
    getCurrentProjectRevision: async () => "2026-10-03T11:00:00.000Z",
  });
  await expectBlocked(
    runCreatorScriptBuildScriptGenerationCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.deepEqual(counts(), { providerCalls: 0 });
  assert.equal(repository.build.state, "STALE");
  assert.deepEqual(repository.transitions, ["AUTHORITY_RESOLVED->STALE"]);
  assert.equal(repository.requestedOperations.length, 0);
}

// 25. Owner isolation prevents access to another owner's build or operations.
{
  const repository = new MemoryRepository();
  const { deps, counts } = dependencies(repository);
  await assert.rejects(
    runCreatorScriptBuildScriptGenerationCoordinator({
      ownerId: otherOwnerId,
      buildId,
      dependencies: deps,
    }),
    /CREATOR_SCRIPT_BUILD_NOT_FOUND/u,
  );
  assert.deepEqual(counts(), { providerCalls: 0 });
  assert.equal(repository.requestedOperations.length, 0);
}

// 26-31. A completed durable checkpoint resumes directly to SCRIPT_GENERATED.
{
  const resumedBuild = {
    ...clone(successfulRepository.build),
    state: "AUTHORITY_RESOLVED",
    failure: null,
  };
  const repository = new MemoryRepository(resumedBuild);
  const { deps, counts } = dependencies(repository, {
    executeScriptGeneration: async () => { throw new Error("must not run"); },
  });
  const result = await runCreatorScriptBuildScriptGenerationCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.disposition, "RESUMED");
  assert.equal(result.build.state, "SCRIPT_GENERATED");
  assert.deepEqual(counts(), { providerCalls: 0 });
  assert.deepEqual(repository.transitions, ["AUTHORITY_RESOLVED->SCRIPT_GENERATED"]);
  assert.equal(repository.build.resultAuthority, null);
}

// 33. Malformed model output and classified provider uncertainty remain distinct.
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository, {
    executeScriptGeneration: async () => ({ malformed: true }),
  });
  await expectBlocked(
    runCreatorScriptBuildScriptGenerationCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_SCRIPT_PROPOSAL_INVALID",
  );
  assert.equal(repository.build.failure.category, "MODEL_CONTRACT");
}
{
  const repository = new MemoryRepository();
  const { deps } = dependencies(repository, {
    executeScriptGeneration: async () => {
      throw new CreatorScriptBuildStageExecutionError({
        category: "PROVIDER",
        code: "CREATOR_SCRIPT_BUILD_SCRIPT_PROVIDER_TIMEOUT",
        retryability: "UNKNOWN_OUTCOME",
      });
    },
  });
  await expectBlocked(
    runCreatorScriptBuildScriptGenerationCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED",
  );
  assert.equal([...repository.operations.values()][0].state, "OUTCOME_UNCERTAIN");
  assert.equal(repository.build.state, "AUTHORITY_RESOLVED");
}

// 28-35. Static scope proof: no repair, acceptance, persistence, HTTP, or queue authority.
{
  const coordinatorSource = fs.readFileSync(
    new URL("../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(coordinatorSource, /evaluateCreatorScriptAcceptance/u);
  assert.doesNotMatch(coordinatorSource, /nextState:\s*["']REPAIRING["']/u);
  assert.doesNotMatch(coordinatorSource, /nextState:\s*["']ACCEPTED["']/u);
  assert.doesNotMatch(coordinatorSource, /nextState:\s*["']PERSISTED["']/u);
  assert.doesNotMatch(coordinatorSource, /resultAuthority\s*:/u);
  assert.doesNotMatch(coordinatorSource, /fetch\s*\(/u);
  assert.doesNotMatch(coordinatorSource, /queue/u);
  assert.match(coordinatorSource, /executeScriptGeneration/u);
  assert.match(coordinatorSource, /createCreatorLongFormEvidenceReadiness\s*\(/u);
  assert.match(coordinatorSource, /shouldUseCreatorScriptSectionNativeGeneration\s*\(/u);
}

console.log("Stage 0.19E3A script-generation coordinator checks passed.");
