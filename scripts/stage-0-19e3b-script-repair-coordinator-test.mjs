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
  createCreatorScriptBuildScriptGenerationInput,
  normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint,
  runCreatorScriptBuildScriptGenerationCoordinator,
} from "../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts";
import {
  CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS,
  CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION,
  CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
  CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
  createCreatorScriptBuildScriptRepairInput,
  createCreatorScriptBuildScriptRepairOperationId,
  createCreatorScriptBuildScriptRepairSemanticFingerprint,
  creatorScriptBuildRepairAllowsNextAttempt,
  runCreatorScriptBuildScriptRepairCoordinator,
} from "../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
} from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import {
  createCreatorScriptNarrationAuthority,
  normalizeCreatorScript,
} from "../lib/creator/creatorScript.ts";
import {
  evaluateCreatorScriptAcceptance,
} from "../lib/creator/creatorScriptAcceptance.ts";
import {
  normalizeCreatorScriptBuildAuthorityResultFromCheckpoint,
} from "../lib/creator/creatorScriptBuildAuthorityCoordinator.ts";
import { resolveClaimAuthority } from "../lib/research/claimAuthorityResolver.ts";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
} from "../lib/research/sourceAssessment.ts";

const ownerId = "00000000-0000-4000-8000-000000000003";
const otherOwnerId = "00000000-0000-4000-8000-000000000099";
const buildId = "30000000-0000-4000-8000-000000000003";
const projectId = "00000000-0000-4000-8000-000000000001";
const revision = "2026-10-03T10:00:00.000Z";
const generationNow = "2026-10-03T10:00:01.000Z";
const repairNow = "2026-10-03T10:00:02.000Z";

function clone(value) {
  return structuredClone(value);
}

function createSnapshot(overrides = {}) {
  return createCreatorScriptBuildSnapshot({
    projectId,
    expectedProjectRevision: revision,
    strategyFingerprint: "strategy-fingerprint-e3b",
    language: "en",
    requestedDurationSeconds: overrides.requestedDurationSeconds || 120,
    strategy: {
      topic: "Memory and identity",
      researchSubject: "How reconstructive memory shapes identity",
      title: "The Memory That Made You",
      contentType: "documentary essay",
      format: "short documentary",
      selectedDirectionId: "direction-a",
      selectedHook: "What if memory changes while identity depends on it?",
      approvedStrategy: {
        framing: "identity",
        selectedDirectionId: "direction-a",
      },
    },
    creatorProfile: {
      brandName: "",
      brandVoice: "documentary",
      defaultAudience: "educated general audience",
      defaultFormat: "youtube_video",
    },
    contractVersions: {
      canonicalEditorialGraph: "0.19A",
      editorialEvidenceSpanCatalog: "0.19B",
      claimAuthorityResolver: "0.19C",
      creatorScriptAcceptance: "0.19D",
      creatorScriptBuild: "0.19E1",
      creatorScriptResearchEditorialCoordinator: "0.19E2A",
      creatorScriptBuildAuthorityCoordinator: "0.19E2B",
      creatorScriptBuildScriptGenerationCoordinator: "0.19E3A",
      creatorScriptBuildScriptRepairCoordinator: "0.19E3B",
    },
  });
}

const secondarySource = {
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
  summary: "Memory contributes to identity while a grounded counter-reading remains possible.",
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
};

function authorityFixture() {
  const graph = createResearchClaimEvidenceGraph({
    sources: [secondarySource],
    claims: [
      {
        claimId: "claim-safe",
        claimType: "FACT",
        text: "Autobiographical memory contributes to identity.",
        propositionKind: "world_state",
        origin: { attributedEntity: null, referencedWork: null },
      },
      {
        claimId: "claim-excluded",
        claimType: "FACT",
        text: "An excluded researcher made a primary-source statement.",
        propositionKind: "attributed_statement",
        origin: { attributedEntity: "Excluded Researcher", referencedWork: null },
      },
    ],
    evidence: [
      {
        evidenceId: "evidence-safe",
        sourceId: secondarySource.sourceId,
        excerpt: "Memory contributes to identity.",
        contextNote: "Grounded contextual account.",
        locator: {
          section: "overview",
          page: null,
          timecodeStartSec: null,
          timecodeEndSec: null,
        },
      },
      {
        evidenceId: "evidence-excluded",
        sourceId: secondarySource.sourceId,
        excerpt: "A secondary account repeats an attributed statement.",
        contextNote: null,
        locator: {
          section: null,
          page: null,
          timecodeStartSec: null,
          timecodeEndSec: null,
        },
      },
    ],
    links: [
      { claimId: "claim-safe", evidenceId: "evidence-safe", stance: "supports" },
      {
        claimId: "claim-excluded",
        evidenceId: "evidence-excluded",
        stance: "supports",
      },
    ],
  });
  const sourceAssessments = graph.sources.map((source) =>
    assessResearchSource(source, classifyResearchSourceDirectness(source).directness)
  );
  const finalAuthority = resolveClaimAuthority({ graph, sourceAssessments });
  return {
    version: "0.19E2B-authority-result-v1",
    graph,
    sourceAssessments,
    initialAuthority: finalAuthority,
    finalAuthority,
    acquisitionPlan: [],
    acquisitionOperationId: null,
    selectionOperationId: null,
    repairedClaimIds: [],
    unresolvedClaimIds: [],
    excludedPrimaryClaimIds: ["claim-excluded"],
    permittedClaimIds: ["claim-safe"],
    spanCatalogVersion: "0.19B",
    segmentationVersion: "editorial-grounding-segmentation-v1",
  };
}

const authority = authorityFixture();

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

function buildRecord(snapshot, overrides = {}) {
  return {
    buildId,
    ownerId,
    projectId,
    idempotencyKey: createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot }),
    state: "AUTHORITY_RESOLVED",
    snapshot,
    checkpoints: { authority: authorityCheckpoint() },
    failure: null,
    resultAuthority: null,
    createdAt: revision,
    updatedAt: revision,
    ...overrides,
  };
}

class MemoryRepository {
  constructor(initialBuild, operations = []) {
    this.build = clone(initialBuild);
    this.operations = new Map(
      operations.map((operation) => [operation.operationId, clone(operation)]),
    );
    this.transitions = [];
    this.requestedOperations = [];
    this.checkpointWrites = [];
  }

  async request() { throw new Error("unused"); }
  async getForOwner(requestedBuildId, requestedOwnerId) {
    return requestedBuildId === this.build.buildId &&
        requestedOwnerId === this.build.ownerId
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
      input.nextState !== "ACCEPTED" && input.nextState !== "PERSISTED"
    ) throw new Error("RESULT_AUTHORITY_STATE_INVALID");
    this.transitions.push(`${input.expectedState}->${input.nextState}`);
    this.build = {
      ...this.build,
      state: input.nextState,
      failure: input.failure || null,
      resultAuthority: input.resultAuthority ?? this.build.resultAuthority,
      updatedAt: repairNow,
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
    this.checkpointWrites.push(clone(input.checkpoint));
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
      createdAt: repairNow,
      updatedAt: repairNow,
    };
    this.operations.set(operationId, operation);
    return { operation: clone(operation), created: true };
  }
  async getOperationForOwner(operationId, requestedBuildId, requestedOwnerId) {
    const operation = this.operations.get(operationId);
    if (
      !operation || operation.buildId !== requestedBuildId ||
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
      updatedAt: repairNow,
    };
    this.operations.set(input.operationId, next);
    return clone(next);
  }
}

function textWithWords(prefix, wordCount, suffix = "") {
  assert.ok(wordCount >= 6, `word count too small: ${wordCount}`);
  const words = Array.from({ length: wordCount }, (_, index) =>
    `${prefix}${index + 1}`
  );
  words[2] = `${words[2]}.`;
  if (suffix) words.splice(Math.max(3, words.length - 4), 1, suffix);
  words[words.length - 1] = `${words.at(-1)}.`;
  return words.join(" ");
}

function sectionCounts(input, shape) {
  const counts = input.sectionPlan.map((section) => section.targetWords);
  const totalTarget = counts.reduce((sum, value) => sum + value, 0);
  const minimum = Math.ceil(totalTarget * 0.9);
  if (shape === "accepted" || shape === "distinctiveness") return counts;
  const desiredTotal = shape === "repairable_short" ? minimum - 30
    : shape === "blocking_short" ? minimum - 40
    : shape === "repairable_long" ? Math.floor(totalTarget * 1.1) + 10
    : totalTarget;
  const bodyIndex = input.sectionPlan.findIndex((section) => section.kind === "body");
  counts[bodyIndex] += desiredTotal - totalTarget;
  assert.ok(counts[bodyIndex] >= 6);
  return counts;
}

function generationProposal(input, shape) {
  const counts = sectionCounts(input, shape);
  let bodyNumber = 0;
  return {
    version: "0.19E3A-script-generation-proposal-v1",
    sections: input.sectionPlan.map((section, index) => {
      if (section.kind === "body") bodyNumber += 1;
      const heading = shape === "distinctiveness" && section.kind === "body"
        ? "Shared Memory Pattern"
        : section.kind === "opening"
          ? "Unsettled Beginning"
          : section.kind === "conclusion"
            ? "Identity Beyond Recall"
            : `Memory Mechanism ${bodyNumber}`;
      return {
        heading,
        text: textWithWords(`${section.kind}${index}word`, counts[index]),
        claimIds: index === 1 ? [input.permittedClaimIds[0]] : [],
      };
    }),
  };
}

async function prepare(shape = "repairable_short", options = {}) {
  const snapshot = createSnapshot({
    requestedDurationSeconds: options.requestedDurationSeconds ||
      (shape === "distinctiveness" ? 300 : 120),
  });
  const repository = new MemoryRepository(buildRecord(snapshot));
  let generationCalls = 0;
  await runCreatorScriptBuildScriptGenerationCoordinator({
    ownerId,
    buildId,
    dependencies: {
      repository,
      getCurrentProjectRevision: async () => revision,
      executeScriptGeneration: async (input) => {
        generationCalls += 1;
        return generationProposal(input, shape);
      },
      now: () => generationNow,
    },
  });
  assert.equal(generationCalls, 1);
  repository.transitions.length = 0;
  repository.requestedOperations.length = 0;
  repository.checkpointWrites.length = 0;
  return { repository, snapshot };
}

function loadSetup(repository) {
  const authorityResult = normalizeCreatorScriptBuildAuthorityResultFromCheckpoint(
    repository.build.checkpoints.authority.outputReference,
  );
  const generationInput = createCreatorScriptBuildScriptGenerationInput({
    snapshot: repository.build.snapshot,
    authority: authorityResult,
  });
  const generation = normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint({
    buildId,
    value: repository.build.checkpoints.script_generation.outputReference,
    authority: generationInput,
  });
  const report = evaluateCreatorScriptAcceptance({
    script: generation.script,
    sectionPlan: [...generation.sectionPlan],
    language: repository.build.snapshot.language,
    narrationAuthority: createCreatorScriptNarrationAuthority({
      editorialContext: generation.script.grounding.context,
      creatorProvidedText: [
        repository.build.snapshot.strategy.topic,
        repository.build.snapshot.strategy.title,
        repository.build.snapshot.strategy.approvedStrategy,
      ],
    }),
  });
  const repairInput = report.repairRequired
    ? createCreatorScriptBuildScriptRepairInput({
        snapshot: repository.build.snapshot,
        script: generation.script,
        sectionPlan: generation.sectionPlan,
        report,
        attempt: 1,
      })
    : null;
  return { generation, report, repairInput };
}

function wordsForTarget(prefix, targetWords, suffix = "") {
  return textWithWords(prefix, Math.max(6, targetWords), suffix);
}

function repairProposal(input, options = {}) {
  const forged = {
    title: "provider title",
    targetDurationSec: 1,
    strategyFingerprint: "provider fingerprint",
    revision: 99,
    approval: { approvedRevision: 99 },
    grounding: { context: { provider: true } },
    generatedAt: "1900-01-01T00:00:00.000Z",
    updatedAt: "1900-01-01T00:00:00.000Z",
  };
  if (input.mode === "additive") {
    return {
      version: "0.19E3B-script-repair-proposal-v1",
      mode: "additive",
      ...forged,
      additions: input.expansionTargets.map((target, index) => ({
        id: "provider-target",
        kind: "conclusion",
        placementAnchorId: options.invalidAnchor
          ? "provider-anchor"
          : target.availablePlacementAnchors[0].id,
        additionalText: wordsForTarget(
          `addition${input.attempt}${index}word`,
          options.additionWords?.(target, input) ?? target.requestedGainWords,
          options.unsafeNarration ? "THYNEL" : "",
        ),
        claimIds: options.claimIds || [],
        humanVerification: { scriptRevision: 99 },
        evidenceReviewRequired: true,
      })),
    };
  }
  const currentById = new Map(
    input.currentScriptAuthority.sections.map((section) => [section.id, section]),
  );
  return {
    version: "0.19E3B-script-repair-proposal-v1",
    mode: "replacement",
    ...forged,
    sections: input.replacementTargets.map((target, index) => {
      const current = currentById.get(target.sectionId);
      const defaultWords = target.direction === "compress"
        ? target.requiredFinalMaxWords
        : target.requiredFinalTargetWords;
      return {
        id: "provider-section-id",
        kind: "conclusion",
        heading: options.sameHeading
          ? "Shared Memory Pattern"
          : `Distinct Repair ${index + 1} ${target.sectionId}`,
        text: wordsForTarget(
          `replacement${input.attempt}${index}word`,
          options.replacementWords?.(target, input) ?? defaultWords,
          options.unsafeNarration ? "this documentary explores" : "",
        ),
        claimIds: options.claimIds || current.claimIds,
        evidenceReviewRequired: true,
        humanVerification: { scriptRevision: 99 },
      };
    }),
  };
}

function dependencies(repository, options = {}) {
  let providerCalls = 0;
  let authorityCalls = 0;
  const repairInputs = [];
  return {
    deps: {
      repository,
      getCurrentProjectRevision: async () => {
        authorityCalls += 1;
        return options.currentRevision
          ? options.currentRevision(authorityCalls)
          : revision;
      },
      executeScriptRepair: async (input) => {
        providerCalls += 1;
        repairInputs.push(clone(input));
        if (options.executeScriptRepair) {
          return await options.executeScriptRepair(input, providerCalls);
        }
        return repairProposal(input, options.proposalOptions || {});
      },
      now: options.now || (() => repairNow),
    },
    counts: () => ({ providerCalls, authorityCalls }),
    inputs: () => clone(repairInputs),
  };
}

async function expectBlocked(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CreatorScriptBuildCoordinatorBlockedError);
    assert.equal(error.code, code);
    return true;
  });
}

function repairOperationFixture(repository, state, overrides = {}) {
  const { repairInput } = loadSetup(repository);
  assert.ok(repairInput);
  const semanticFingerprint =
    createCreatorScriptBuildScriptRepairSemanticFingerprint(repairInput);
  const operationId = createCreatorScriptBuildScriptRepairOperationId({
    buildId,
    repairInput,
  });
  return {
    operationId,
    buildId,
    ownerId,
    stage: "repair",
    operationType: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
    semanticFingerprint,
    contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
    state,
    resultReference: null,
    failure: state === "FAILED"
      ? {
          category: "PROVIDER",
          code: "CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_FAILED",
          stage: "repair",
          retryability: "NON_RETRYABLE",
          operationId,
          diagnostics: {},
        }
      : null,
    createdAt: repairNow,
    updatedAt: repairNow,
    ...overrides,
  };
}

// 1. Accepted generation is observed but E3B creates no repair authority.
{
  const { repository } = await prepare("accepted");
  const { deps, counts } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.disposition, "NO_REPAIR_REQUIRED");
  assert.equal(result.observedReport.accepted, true);
  assert.equal(result.build.state, "SCRIPT_GENERATED");
  assert.deepEqual(counts(), { providerCalls: 0, authorityCalls: 1 });
  assert.equal(repository.requestedOperations.length, 0);
  assert.equal(repository.build.checkpoints.repair, undefined);
}

// 2. Non-repairable policy failure is left for E3C without failing the build.
{
  const { repository } = await prepare("blocking_short");
  const { deps, counts } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.disposition, "NOT_REPAIRABLE");
  assert.equal(result.observedReport.accepted, false);
  assert.equal(result.observedReport.repairRequired, false);
  assert.equal(result.build.state, "SCRIPT_GENERATED");
  assert.equal(result.build.failure, null);
  assert.deepEqual(counts(), { providerCalls: 0, authorityCalls: 1 });
}

// 3, 6-21, 39, 42, 47-51. One canonical additive repair is server assembled.
let successful;
{
  const { repository } = await prepare("repairable_short");
  const before = loadSetup(repository);
  assert.equal(before.report.repairRequired, true);
  const { deps, counts, inputs } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  successful = { repository, result };
  assert.equal(result.disposition, "REPAIR_PHASE_COMPLETED");
  assert.equal(result.build.state, "REPAIRING");
  assert.equal(result.observedReport.accepted, true);
  assert.equal(result.repair.attemptCount, 1);
  assert.deepEqual(counts(), { providerCalls: 1, authorityCalls: 2 });
  assert.deepEqual(repository.transitions, ["SCRIPT_GENERATED->REPAIRING"]);
  assert.equal(repository.requestedOperations.length, 1);
  assert.equal(repository.requestedOperations[0].stage, "repair");
  assert.equal(
    repository.requestedOperations[0].operationType,
    CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
  );
  assert.deepEqual(inputs()[0].repairSectionIds, before.report.repairSectionIds);
  assert.equal(inputs()[0].mode, "additive");
  assert.ok(inputs()[0].expansionTargets.every((target) =>
    target.availablePlacementAnchors.length === 1 &&
    target.availablePlacementAnchors[0].placementMode === "server_exact_offset"
  ));
  assert.equal(result.repair.script.revision, 2);
  assert.equal(result.repair.script.title, before.generation.script.title);
  assert.equal(
    result.repair.script.targetDurationSec,
    before.generation.script.targetDurationSec,
  );
  assert.equal(
    result.repair.script.strategyFingerprint,
    before.generation.script.strategyFingerprint,
  );
  assert.deepEqual(
    result.repair.script.grounding.context,
    before.generation.script.grounding.context,
  );
  assert.equal(result.repair.script.generatedAt, before.generation.script.generatedAt);
  assert.equal(result.repair.script.updatedAt, repairNow);
  assert.equal(result.repair.script.approval, null);
  assert.deepEqual(
    result.repair.script.sections.map((section) => [section.id, section.kind]),
    before.generation.script.sections.map((section) => [section.id, section.kind]),
  );
  assert.ok(result.repair.script.sections.every((section) =>
    !section.humanVerification && !section.evidenceReviewRequired
  ));
  const targets = new Set(inputs()[0].repairSectionIds);
  before.generation.script.sections.forEach((section, index) => {
    if (!targets.has(section.id)) {
      assert.deepEqual(result.repair.script.sections[index], section);
    }
  });
  assert.equal(repository.build.resultAuthority, null);
  assert.equal(repository.build.checkpoints.acceptance, undefined);
  assert.equal(repository.build.checkpoints.persistence, undefined);
  assert.ok(!repository.transitions.some((value) =>
    value.includes("ACCEPTED") || value.includes("PERSISTED")
  ));
  assert.equal(CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS, 2);
}

// 22-23, 29, 45. Operation and completed-checkpoint reuse are timestamp stable.
{
  const completedBuild = clone(successful.repository.build);
  const storedScript = clone(successful.result.repair.script);
  const completedRepair = completedBuild.checkpoints.repair;
  completedBuild.checkpoints.repair = {
    ...completedRepair,
    status: "RUNNING",
    outputReference: null,
    completedAt: null,
  };
  const repository = new MemoryRepository(
    completedBuild,
    [...successful.repository.operations.values()],
  );
  const { deps, counts } = dependencies(repository, {
    now: () => "2026-10-03T11:00:00.000Z",
  });
  const reused = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(reused.repair.script.revision, 2);
  assert.equal(reused.repair.script.updatedAt, storedScript.updatedAt);
  assert.deepEqual(reused.repair.script, storedScript);
  assert.equal(counts().providerCalls, 0);

  const resumeDependencies = dependencies(successful.repository);
  const resumed = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: resumeDependencies.deps,
  });
  assert.equal(resumed.disposition, "RESUMED");
  assert.deepEqual(resumed.repair.script, storedScript);
  assert.equal(resumeDependencies.counts().providerCalls, 0);
}

// 24-28. Semantic repair operation identity is deterministic and excludes timestamps.
{
  const { repository } = await prepare("repairable_short");
  const { generation, report, repairInput } = loadSetup(repository);
  assert.ok(repairInput);
  const same = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: clone(generation.script),
    sectionPlan: clone(generation.sectionPlan),
    report: clone(report),
    attempt: 1,
  });
  const baseId = createCreatorScriptBuildScriptRepairOperationId({
    buildId,
    repairInput,
  });
  assert.equal(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: same }),
  );
  const timestampOnly = normalizeCreatorScript({
    ...generation.script,
    generatedAt: "2026-10-03T12:00:00.000Z",
    updatedAt: "2026-10-03T12:00:01.000Z",
  });
  const timestampInput = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: timestampOnly,
    sectionPlan: generation.sectionPlan,
    report,
    attempt: 1,
  });
  assert.equal(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({
      buildId,
      repairInput: timestampInput,
    }),
  );
  const changedScript = normalizeCreatorScript({
    ...generation.script,
    sections: generation.script.sections.map((section, index) =>
      index === 0 ? { ...section, text: `${section.text} changedword.` } : section
    ),
  });
  const changedInput = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: changedScript,
    sectionPlan: generation.sectionPlan,
    report,
    attempt: 1,
  });
  assert.notEqual(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: changedInput }),
  );
  const changedReport = clone(report);
  changedReport.repairableViolations[0].diagnostics.distanceWords += 1;
  const reportInput = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: generation.script,
    sectionPlan: generation.sectionPlan,
    report: changedReport,
    attempt: 1,
  });
  assert.notEqual(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: reportInput }),
  );
  const attempt2 = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: generation.script,
    sectionPlan: generation.sectionPlan,
    report,
    attempt: 2,
  });
  assert.notEqual(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: attempt2 }),
  );
  assert.equal("generatedAt" in repairInput.currentScriptAuthority, false);
  assert.equal("updatedAt" in repairInput.currentScriptAuthority, false);
}

// 30-32. Durable pending/uncertain/failed identities never re-execute.
for (const state of ["PENDING", "OUTCOME_UNCERTAIN", "FAILED"]) {
  const { repository } = await prepare("repairable_short");
  const operation = repairOperationFixture(repository, state);
  repository.operations.set(operation.operationId, clone(operation));
  const { deps, counts } = dependencies(repository);
  const expectedCode = state === "FAILED"
    ? "CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_FAILED"
    : "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED";
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    expectedCode,
  );
  assert.equal(counts().providerCalls, 0);
  assert.equal(repository.requestedOperations.length, 1);
  assert.equal(repository.requestedOperations[0].semanticFingerprint, operation.semanticFingerprint);
  assert.equal(repository.operations.size, 2); // E3A generation + the one repair identity.
}

// 33. Stale authority before attempt one prevents any repair operation/provider call.
{
  const { repository } = await prepare("repairable_short");
  const { deps, counts } = dependencies(repository, {
    currentRevision: () => "2026-10-03T12:00:00.000Z",
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(repository.build.state, "STALE");
  assert.equal(counts().providerCalls, 0);
  assert.equal(repository.requestedOperations.length, 0);
}

// 34-35. Stale authority between attempts prevents the second paid call.
{
  const { repository } = await prepare("repairable_short");
  const { deps, counts } = dependencies(repository, {
    currentRevision: (call) => call < 3 ? revision : "2026-10-03T12:00:00.000Z",
    proposalOptions: { additionWords: () => 10 },
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(counts().providerCalls, 1);
  assert.equal(repository.build.state, "STALE");
  assert.equal(repository.requestedOperations.length, 1);
}

// 27, 36-37, 40. A materially improving attempt permits exactly one second attempt.
{
  const { repository } = await prepare("repairable_short");
  const { deps, counts, inputs } = dependencies(repository, {
    proposalOptions: {
      additionWords: (target, input) => input.attempt === 1
        ? 10
        : target.requestedGainWords,
    },
  });
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(counts().providerCalls, 2);
  assert.equal(result.repair.attemptCount, 2);
  assert.equal(result.repair.script.revision, 3);
  assert.equal(result.observedReport.accepted, true);
  assert.equal(result.build.state, "REPAIRING");
  assert.notEqual(
    createCreatorScriptBuildScriptRepairOperationId({
      buildId,
      repairInput: inputs()[0],
    }),
    createCreatorScriptBuildScriptRepairOperationId({
      buildId,
      repairInput: inputs()[1],
    }),
  );
}

// 36, 41. Bounded repair exhaustion completes without a third call or false failure.
{
  const { repository } = await prepare("repairable_short");
  const { deps, counts } = dependencies(repository, {
    proposalOptions: { additionWords: () => 1 },
  });
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(counts().providerCalls, 2);
  assert.equal(result.repair.attemptCount, 2);
  assert.equal(result.observedReport.accepted, false);
  assert.equal(result.build.state, "REPAIRING");
  assert.equal(result.build.failure, null);
  assert.equal(repository.requestedOperations.length, 2);
}

// 38. A valid candidate that introduces a blocker is not granted a second call.
{
  const { repository } = await prepare("distinctiveness");
  const { deps, counts } = dependencies(repository, {
    proposalOptions: { unsafeNarration: true },
  });
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(counts().providerCalls, 1);
  assert.equal(result.repair.attemptCount, 1);
  assert.equal(result.observedReport.repairRequired, false);
  assert.ok(result.observedReport.blockingViolations.some((violation) =>
    violation.code === "NARRATION_SAFETY"
  ));
  assert.equal(result.build.state, "REPAIRING");
  assert.equal(result.build.failure, null);
}

// 38. A valid additive result may become policy-blocked without failing the paid
// operation or the build; material improvement only gates a second attempt.
{
  const { repository } = await prepare("repairable_short");
  const { deps, counts, inputs } = dependencies(repository, {
    proposalOptions: { unsafeNarration: true },
  });
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(counts().providerCalls, 1);
  assert.equal(result.repair.attemptCount, 1);
  assert.equal(result.build.state, "REPAIRING");
  assert.equal(result.build.failure, null);
  assert.equal(result.observedReport.accepted, false);
  assert.equal(result.observedReport.repairRequired, false);
  assert.ok(result.observedReport.blockingViolations.some((violation) =>
    violation.code === "NARRATION_SAFETY"
  ));
  assert.equal(repository.requestedOperations.length, 1);
  const operationId = createCreatorScriptBuildScriptRepairOperationId({
    buildId,
    repairInput: inputs()[0],
  });
  assert.equal(repository.operations.get(operationId)?.state, "COMPLETED");
  assert.equal(repository.build.checkpoints.repair?.status, "COMPLETED");
  assert.ok(!repository.transitions.some((value) =>
    value.includes("ACCEPTED") || value.includes("PERSISTED")
  ));
}

// 37-38. The explicit second-attempt gate rejects unchanged policy reports.
{
  const { repository } = await prepare("repairable_short");
  const { report } = loadSetup(repository);
  assert.equal(creatorScriptBuildRepairAllowsNextAttempt({
    completedAttempt: 1,
    previous: report,
    current: clone(report),
  }), false);
  const blocking = clone(report);
  blocking.repairRequired = false;
  blocking.blockingViolations = [clone(blocking.repairableViolations[0])];
  assert.equal(creatorScriptBuildRepairAllowsNextAttempt({
    completedAttempt: 1,
    previous: report,
    current: blocking,
  }), false);
  assert.equal(creatorScriptBuildRepairAllowsNextAttempt({
    completedAttempt: 2,
    previous: report,
    current: report,
  }), false);
}

// 7-16. Content-only proposal metadata cannot override server target/control authority.
{
  const { repository } = await prepare("repairable_short");
  const { deps } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.repair.script.title, repository.build.snapshot.strategy.title);
  assert.equal(result.repair.script.revision, 2);
  assert.equal(result.repair.script.approval, null);
  assert.equal(result.repair.script.generatedAt, generationNow);
  assert.equal(result.repair.script.updatedAt, repairNow);
  assert.ok(result.repair.script.sections.every((section) =>
    !section.id.startsWith("provider") && section.kind !== "provider"
  ));
  assert.ok(result.repair.script.sections.every((section) =>
    section.evidenceReviewRequired === false && section.humanVerification == null
  ));
}

// 9-10. Unknown and E2B-excluded claims are both rejected as grounding violations.
for (const forbiddenClaimId of ["claim-unknown", "claim-excluded"]) {
  const { repository } = await prepare("repairable_short");
  const { deps, counts } = dependencies(repository, {
    proposalOptions: { claimIds: [forbiddenClaimId] },
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_REPAIR_CLAIM_NOT_PERMITTED",
  );
  assert.equal(counts().providerCalls, 1);
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.failure.category, "GROUNDING");
}

// 43. Compression must move toward the existing canonical envelope.
{
  const { repository } = await prepare("repairable_long");
  const { deps, counts } = dependencies(repository, {
    proposalOptions: {
      replacementWords: (target) => target.beforeWords,
    },
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_REPAIR_WRONG_DIRECTION",
  );
  assert.equal(counts().providerCalls, 1);
  assert.equal(repository.build.state, "FAILED");
}

// 44. A distinctiveness proposal cannot retain/reintroduce the same failure.
{
  const { repository } = await prepare("distinctiveness");
  const { deps, counts } = dependencies(repository, {
    proposalOptions: { sameHeading: true },
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_REPAIR_DISTINCTIVENESS_REGRESSION",
  );
  assert.equal(counts().providerCalls, 1);
  assert.equal(repository.build.state, "FAILED");
}

// 4-5. REPAIRING is the only resume state and unrelated states fail closed.
for (const state of [
  "REQUESTED",
  "SNAPSHOTTED",
  "RESEARCH_READY",
  "EDITORIAL_COMPILED",
  "AUTHORITY_RESOLVED",
  "ACCEPTED",
  "PERSISTED",
  "FAILED",
  "STALE",
]) {
  const { repository } = await prepare("repairable_short");
  repository.build = { ...repository.build, state };
  const { deps, counts } = dependencies(repository);
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_STATE_INVALID",
  );
  assert.equal(counts().providerCalls, 0);
}

// 46. Owner authority applies to both build and operation reads.
{
  const { repository } = await prepare("repairable_short");
  const operation = repairOperationFixture(repository, "PENDING");
  repository.operations.set(operation.operationId, operation);
  await assert.rejects(
    runCreatorScriptBuildScriptRepairCoordinator({
      ownerId: otherOwnerId,
      buildId,
      dependencies: dependencies(repository).deps,
    }),
    /CREATOR_SCRIPT_BUILD_NOT_FOUND/u,
  );
  assert.equal(
    await repository.getOperationForOwner(operation.operationId, buildId, otherOwnerId),
    null,
  );
}

// Static architecture guard: no queue, project persistence, acceptance transition, or API route.
{
  const moduleText = fs.readFileSync(
    new URL("../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(moduleText, /genericQueue|queue\.add|save-project|creator-script-plan\/route/u);
  assert.doesNotMatch(moduleText, /nextState:\s*"ACCEPTED"|nextState:\s*"PERSISTED"/u);
  assert.doesNotMatch(moduleText, /resultAuthority\s*:/u);
  assert.match(moduleText, /evaluateCreatorScriptAcceptance/u);
  assert.match(moduleText, /creatorScriptAcceptanceMateriallyImproved/u);
  assert.match(moduleText, /attempt <= CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS/u);
}

console.log("stage-0-19e3b-script-repair-coordinator-test: PASS");
