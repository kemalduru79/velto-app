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
} from "../../lib/creator/creatorScriptBuild.ts";
import {
  createCreatorScriptBuildScriptGenerationInput,
  normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint,
  runCreatorScriptBuildScriptGenerationCoordinator,
} from "../../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts";
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
} from "../../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
} from "../../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import {
  createCreatorScriptNarrationAuthority,
  normalizeCreatorScript,
} from "../../lib/creator/creatorScript.ts";
import {
  evaluateCreatorScriptAcceptance,
} from "../../lib/creator/creatorScriptAcceptance.ts";
import {
  normalizeCreatorScriptBuildAuthorityResultFromCheckpoint,
} from "../../lib/creator/creatorScriptBuildAuthorityCoordinator.ts";
import { resolveClaimAuthority } from "../../lib/research/claimAuthorityResolver.ts";
import { createResearchClaimEvidenceGraph } from "../../lib/research/claimEvidenceGraph.ts";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
} from "../../lib/research/sourceAssessment.ts";

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
      creatorScriptResearchEditorialCoordinator: "0.19E2A-A2",
      creatorScriptBuildAuthorityCoordinator: "0.19E2B",
      creatorScriptBuildScriptGenerationCoordinator: "0.19E3A",
      creatorScriptBuildScriptRepairCoordinator: "0.19E3B-S3",
      creatorScriptBuildAcceptanceCoordinator: "0.19E3C",
      creatorScriptBuildPersistenceCoordinator: "0.19E4",
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
    const expectsResult = input.nextState === "COMPLETED";
    const expectsFailure =
      input.nextState === "FAILED" || input.nextState === "OUTCOME_UNCERTAIN";
    assert.equal(
      input.resultReference != null,
      expectsResult,
      "repair test repository must match production resultReference contract",
    );
    assert.equal(
      Boolean(input.failure),
      expectsFailure,
      "repair test repository must match production failure contract",
    );
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
  const desiredTotal =
    shape === "repairable_short" || shape === "distinctiveness_short"
      ? minimum - 30
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
      const heading =
        (shape === "distinctiveness" || shape === "distinctiveness_short") &&
          section.kind === "body"
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
      (
        shape === "distinctiveness" || shape === "distinctiveness_short"
          ? 300
          : 120
      ),
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
      version: "0.19E3B-script-repair-proposal-v2",
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
    version: "0.19E3B-script-repair-proposal-v2",
    mode: "replacement",
    ...forged,
    section: input.replacementTargets.map((target, index) => {
      const current = currentById.get(target.sectionId);
      const defaultWords = target.direction === "compress"
        ? target.requiredFinalMaxWords
        : target.requiredFinalTargetWords;
      return {
        sectionId: target.sectionId,
        kind: "conclusion",
        heading: options.heading
          ? options.heading(target, input, current)
          : options.sameHeading
            ? "Shared Memory Pattern"
            : `Recovered${target.sectionId.replace(/\W/g, "")} Distinction${target.sectionId.replace(/\W/g, "")}`,
        text: wordsForTarget(
          `replacement${input.attempt}${target.sectionId.replace(/\W/g, "")}word`,
          options.replacementWords?.(target, input) ?? defaultWords,
          options.unsafeNarration ? "this documentary explores" : "",
        ),
        claimIds: options.claimIds || current.claimIds,
        evidenceReviewRequired: true,
        humanVerification: { scriptRevision: 99 },
      };
    })[0],
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

export { ownerId, otherOwnerId, buildId, projectId, revision, generationNow, repairNow, clone,
  createSnapshot, buildRecord, authorityFixture, MemoryRepository, textWithWords, generationProposal, prepare,
  loadSetup, repairProposal, dependencies, expectBlocked, repairOperationFixture };
