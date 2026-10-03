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
  runCreatorScriptBuildScriptGenerationCoordinator,
} from "../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts";
import {
  runCreatorScriptBuildScriptRepairCoordinator,
} from "../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts";
import {
  CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_VERSION,
  CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION,
  normalizeCreatorScriptBuildAcceptedResultAuthority,
  runCreatorScriptBuildAcceptanceCoordinator,
} from "../lib/creator/creatorScriptBuildAcceptanceCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
} from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
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
const acceptanceNow = "2026-10-03T10:00:03.000Z";

function clone(value) {
  return structuredClone(value);
}

function createSnapshot(overrides = {}) {
  return createCreatorScriptBuildSnapshot({
    projectId,
    expectedProjectRevision: revision,
    strategyFingerprint: "strategy-fingerprint-e3c",
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
      creatorScriptBuildAcceptanceCoordinator:
        CREATOR_SCRIPT_BUILD_ACCEPTANCE_COORDINATOR_VERSION,
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
    assessResearchSource(
      source,
      classifyResearchSourceDirectness(source).directness,
    )
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

  async request() {
    throw new Error("unused");
  }

  async getForOwner(requestedBuildId, requestedOwnerId) {
    return requestedBuildId === this.build.buildId &&
        requestedOwnerId === this.build.ownerId
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
      resultAuthority: input.resultAuthority ?? null,
      updatedAt: acceptanceNow,
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
    if (
      !allowed &&
      JSON.stringify(previous) !== JSON.stringify(input.checkpoint)
    ) {
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
    assertCreatorScriptBuildOperationTransition(
      input.expectedState,
      input.nextState,
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
  if (shape === "accepted") return counts;
  const desiredTotal = shape === "repairable_short"
    ? minimum - 30
    : shape === "blocking_short"
      ? minimum - 40
      : totalTarget;
  const bodyIndex = input.sectionPlan.findIndex(
    (section) => section.kind === "body",
  );
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
      return {
        heading: section.kind === "opening"
          ? "Unsettled Beginning"
          : section.kind === "conclusion"
            ? "Identity Beyond Recall"
            : `Memory Mechanism ${bodyNumber}`,
        text: textWithWords(`${section.kind}${index}word`, counts[index]),
        claimIds: index === 1 ? [input.permittedClaimIds[0]] : [],
      };
    }),
  };
}

async function prepare(shape = "accepted") {
  const snapshot = createSnapshot();
  const repository = new MemoryRepository(buildRecord(snapshot));
  await runCreatorScriptBuildScriptGenerationCoordinator({
    ownerId,
    buildId,
    dependencies: {
      repository,
      getCurrentProjectRevision: async () => revision,
      executeScriptGeneration: async (input) => generationProposal(input, shape),
      now: () => generationNow,
    },
  });
  repository.transitions.length = 0;
  repository.requestedOperations.length = 0;
  repository.checkpointWrites.length = 0;
  return { repository, snapshot };
}

function repairProposal(input, gainMode = "full") {
  assert.equal(input.mode, "additive");
  return {
    version: "0.19E3B-script-repair-proposal-v1",
    mode: "additive",
    additions: input.expansionTargets.map((target, index) => ({
      placementAnchorId: target.availablePlacementAnchors[0].id,
      additionalText: textWithWords(
        `repair${input.attempt}${index}word`,
        gainMode === "small" ? 6 : target.requestedGainWords,
      ),
      claimIds: [],
    })),
  };
}

async function runRepair(repository, gainMode = "full") {
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: {
      repository,
      getCurrentProjectRevision: async () => revision,
      executeScriptRepair: async (input) => repairProposal(input, gainMode),
      now: () => repairNow,
    },
  });
  repository.transitions.length = 0;
  repository.requestedOperations.length = 0;
  repository.checkpointWrites.length = 0;
  return result;
}

function acceptanceDependencies(repository, options = {}) {
  let authorityCalls = 0;
  return {
    deps: {
      repository,
      getCurrentProjectRevision: async () => {
        authorityCalls += 1;
        return options.currentRevision || revision;
      },
      now: () => acceptanceNow,
    },
    counts: () => ({ authorityCalls }),
  };
}

async function expectBlocked(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CreatorScriptBuildCoordinatorBlockedError);
    assert.equal(error.code, code);
    return true;
  });
}

// 1-5, 19-24, 45-50. Direct accepted path is server-owned and checkpointed.
let directAccepted;
{
  const { repository } = await prepare("accepted");
  const beforeScript = clone(
    repository.build.checkpoints.script_generation.outputReference.result.script,
  );
  const operationCountBefore = repository.operations.size;
  const result = await runCreatorScriptBuildAcceptanceCoordinator({
    ownerId,
    buildId,
    dependencies: acceptanceDependencies(repository).deps,
  });
  directAccepted = { repository, result };
  assert.equal(result.disposition, "ACCEPTED");
  assert.equal(result.build.state, "ACCEPTED");
  assert.equal(result.acceptance.outcome, "ACCEPTED");
  assert.equal(result.acceptance.report.version, "0.19D");
  assert.equal(result.acceptance.report.accepted, true);
  assert.equal(result.acceptance.sourceStage, "script_generation");
  assert.equal(result.build.failure, null);
  assert.ok(result.build.resultAuthority);
  assert.equal(repository.build.checkpoints.acceptance.status, "COMPLETED");
  assert.equal(
    repository.build.checkpoints.acceptance.contractVersion,
    CREATOR_SCRIPT_BUILD_ACCEPTANCE_CHECKPOINT_VERSION,
  );
  assert.equal(repository.build.checkpoints.acceptance.operationId, null);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.acceptance.script)),
    beforeScript,
  );
  assert.equal(result.acceptance.script.approval, null);
  assert.equal(result.acceptance.script.title, repository.build.snapshot.strategy.title);
  assert.equal(
    result.acceptance.script.targetDurationSec,
    repository.build.snapshot.requestedDurationSeconds,
  );
  assert.equal(
    result.acceptance.script.strategyFingerprint,
    repository.build.snapshot.strategyFingerprint,
  );
  assert.equal(repository.operations.size, operationCountBefore);
  assert.equal(repository.requestedOperations.length, 0);
  assert.deepEqual(repository.transitions, ["SCRIPT_GENERATED->ACCEPTED"]);

  const authority = normalizeCreatorScriptBuildAcceptedResultAuthority({
    value: result.build.resultAuthority,
    snapshot: result.build.snapshot,
  });
  assert.deepEqual(authority.acceptance, result.acceptance);
}

// 7-9. Repairable SCRIPT_GENERATED cannot bypass E3B.
{
  const { repository } = await prepare("repairable_short");
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId,
      buildId,
      dependencies: acceptanceDependencies(repository).deps,
    }),
    "CREATOR_SCRIPT_BUILD_REPAIR_PHASE_REQUIRED",
  );
  assert.equal(repository.build.state, "SCRIPT_GENERATED");
  assert.equal(repository.build.checkpoints.acceptance, undefined);
  assert.equal(repository.build.resultAuthority, null);
  assert.deepEqual(repository.transitions, []);
}

// 10-11. Non-repairable generation is deterministically rejected.
let directRejected;
{
  const { repository } = await prepare("blocking_short");
  const result = await runCreatorScriptBuildAcceptanceCoordinator({
    ownerId,
    buildId,
    dependencies: acceptanceDependencies(repository).deps,
  });
  directRejected = { repository, result };
  assert.equal(result.disposition, "REJECTED");
  assert.equal(result.acceptance.outcome, "REJECTED");
  assert.equal(result.build.state, "FAILED");
  assert.equal(result.build.resultAuthority, null);
  assert.equal(result.build.failure.category, "SCRIPT_POLICY");
  assert.equal(
    result.build.failure.code,
    "CREATOR_SCRIPT_DURATION_UNSATISFIED",
  );
  assert.equal(repository.build.checkpoints.acceptance.status, "COMPLETED");
  assert.deepEqual(repository.transitions, ["SCRIPT_GENERATED->FAILED"]);
}

// 12-16. REPAIRING requires a completed E3B checkpoint; completed repair is
// independently evaluated and may become ACCEPTED.
{
  const { repository } = await prepare("repairable_short");
  const repair = await runRepair(repository, "full");
  assert.equal(repair.build.state, "REPAIRING");
  assert.equal(repair.observedReport.accepted, true);
  const result = await runCreatorScriptBuildAcceptanceCoordinator({
    ownerId,
    buildId,
    dependencies: acceptanceDependencies(repository).deps,
  });
  assert.equal(result.disposition, "ACCEPTED");
  assert.equal(result.build.state, "ACCEPTED");
  assert.equal(result.acceptance.sourceStage, "repair");
  assert.deepEqual(result.acceptance.script, repair.repair.script);
  assert.equal(result.acceptance.report.accepted, true);
  assert.deepEqual(repository.transitions, ["REPAIRING->ACCEPTED"]);
}

for (const checkpointStatus of [null, "PENDING", "RUNNING"]) {
  const { repository } = await prepare("repairable_short");
  repository.build = { ...repository.build, state: "REPAIRING" };
  if (checkpointStatus) {
    repository.build.checkpoints.repair = {
      checkpointId: createCreatorScriptBuildCheckpointId({
        buildId,
        stage: "repair",
        contractVersion: "creator-script-build-script-repair-checkpoint-v1",
      }),
      stage: "repair",
      status: checkpointStatus,
      contractVersion: "creator-script-build-script-repair-checkpoint-v1",
      operationId: null,
      outputReference: null,
      diagnostics: {},
      startedAt: null,
      completedAt: null,
    };
  }
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId,
      buildId,
      dependencies: acceptanceDependencies(repository).deps,
    }),
    "CREATOR_SCRIPT_BUILD_REPAIR_PHASE_INCOMPLETE",
  );
  assert.equal(repository.build.state, "REPAIRING");
  assert.equal(repository.build.checkpoints.acceptance, undefined);
}

// 17-18. Bounded repair exhaustion is a final E3C rejection, not a third repair.
{
  const { repository } = await prepare("repairable_short");
  const repair = await runRepair(repository, "small");
  assert.equal(repair.build.state, "REPAIRING");
  assert.equal(repair.observedReport.accepted, false);
  const operationCountBefore = repository.operations.size;
  const result = await runCreatorScriptBuildAcceptanceCoordinator({
    ownerId,
    buildId,
    dependencies: acceptanceDependencies(repository).deps,
  });
  assert.equal(result.disposition, "REJECTED");
  assert.equal(result.build.state, "FAILED");
  assert.equal(result.build.resultAuthority, null);
  assert.equal(repository.operations.size, operationCountBefore);
  assert.equal(repository.requestedOperations.length, 0);
  assert.deepEqual(repository.transitions, ["REPAIRING->FAILED"]);
}

// 25-27. Current-project authority is checked for each final state.
for (const state of ["SCRIPT_GENERATED", "REPAIRING"]) {
  const { repository } = await prepare(
    state === "REPAIRING" ? "repairable_short" : "accepted",
  );
  if (state === "REPAIRING") await runRepair(repository, "full");
  const deps = acceptanceDependencies(repository, {
    currentRevision: "2026-10-03T12:00:00.000Z",
  }).deps;
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(repository.build.state, "STALE");
  assert.equal(repository.build.checkpoints.acceptance, undefined);
}

{
  const acceptedBuild = clone(directAccepted.repository.build);
  const repository = new MemoryRepository(acceptedBuild, [
    ...directAccepted.repository.operations.values(),
  ]);
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId,
      buildId,
      dependencies: acceptanceDependencies(repository, {
        currentRevision: "2026-10-03T12:00:00.000Z",
      }).deps,
    }),
    "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(repository.build.state, "STALE");
  assert.equal(repository.build.resultAuthority, null);
}

// 28. Crash after ACCEPTED checkpoint but before state transition resumes without
// another checkpoint identity.
{
  const crashed = clone(directAccepted.repository.build);
  crashed.state = "SCRIPT_GENERATED";
  crashed.resultAuthority = null;
  crashed.failure = null;
  const repository = new MemoryRepository(
    crashed,
    [...directAccepted.repository.operations.values()],
  );
  const result = await runCreatorScriptBuildAcceptanceCoordinator({
    ownerId,
    buildId,
    dependencies: acceptanceDependencies(repository).deps,
  });
  assert.equal(result.disposition, "ACCEPTED");
  assert.equal(result.build.state, "ACCEPTED");
  assert.equal(repository.checkpointWrites.length, 0);
  assert.deepEqual(repository.transitions, ["SCRIPT_GENERATED->ACCEPTED"]);
}

// 29. Crash after REJECTED checkpoint but before terminal transition is replayed.
{
  const crashed = clone(directRejected.repository.build);
  crashed.state = "SCRIPT_GENERATED";
  crashed.failure = null;
  crashed.resultAuthority = null;
  const repository = new MemoryRepository(
    crashed,
    [...directRejected.repository.operations.values()],
  );
  const result = await runCreatorScriptBuildAcceptanceCoordinator({
    ownerId,
    buildId,
    dependencies: acceptanceDependencies(repository).deps,
  });
  assert.equal(result.disposition, "REJECTED");
  assert.equal(result.build.state, "FAILED");
  assert.equal(repository.checkpointWrites.length, 0);
  assert.deepEqual(repository.transitions, ["SCRIPT_GENERATED->FAILED"]);
}

// 30-32. ACCEPTED re-entry validates both checkpoint and resultAuthority and is idempotent.
{
  const repository = new MemoryRepository(
    directAccepted.repository.build,
    [...directAccepted.repository.operations.values()],
  );
  const result = await runCreatorScriptBuildAcceptanceCoordinator({
    ownerId,
    buildId,
    dependencies: acceptanceDependencies(repository).deps,
  });
  assert.equal(result.disposition, "RESUMED");
  assert.equal(result.build.state, "ACCEPTED");
  assert.deepEqual(repository.transitions, []);
  assert.equal(repository.checkpointWrites.length, 0);
}

// 33-44. Missing or tampered durable acceptance authority fails closed.
{
  const broken = clone(directAccepted.repository.build);
  broken.resultAuthority = null;
  const repository = new MemoryRepository(broken);
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId,
      buildId,
      dependencies: acceptanceDependencies(repository).deps,
    }),
    "CREATOR_SCRIPT_BUILD_ACCEPTED_AUTHORITY_INCOMPLETE",
  );
  assert.equal(repository.build.state, "FAILED");
}

{
  const broken = clone(directAccepted.repository.build);
  broken.resultAuthority.acceptance.report.version = "0.19D-tampered";
  const repository = new MemoryRepository(broken);
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId,
      buildId,
      dependencies: acceptanceDependencies(repository).deps,
    }),
    "CREATOR_SCRIPT_BUILD_ACCEPTANCE_REPORT_MISMATCH",
  );
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.resultAuthority, null);
}

{
  const broken = clone(directAccepted.repository.build);
  broken.checkpoints.acceptance.outputReference.result.script.strategyFingerprint =
    "tampered-fingerprint";
  const repository = new MemoryRepository(broken);
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId,
      buildId,
      dependencies: acceptanceDependencies(repository).deps,
    }),
    "CREATOR_SCRIPT_BUILD_ACCEPTANCE_SCRIPT_AUTHORITY_INVALID",
  );
  assert.equal(repository.build.state, "FAILED");
}

{
  const broken = clone(directAccepted.repository.build);
  broken.checkpoints.acceptance.outputReference.result.outcome = "REJECTED";
  const repository = new MemoryRepository(broken);
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId,
      buildId,
      dependencies: acceptanceDependencies(repository).deps,
    }),
    "CREATOR_SCRIPT_BUILD_ACCEPTANCE_OUTCOME_INVALID",
  );
  assert.equal(repository.build.state, "FAILED");
}

// 45. resultAuthority is invalid before ACCEPTED.
{
  const { repository } = await prepare("accepted");
  repository.build.resultAuthority = {
    version: "premature-authority",
  };
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId,
      buildId,
      dependencies: acceptanceDependencies(repository).deps,
    }),
    "CREATOR_SCRIPT_BUILD_RESULT_AUTHORITY_PREMATURE",
  );
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.resultAuthority, null);
}

// 48. Owner scoping prevents cross-owner acceptance.
{
  const { repository } = await prepare("accepted");
  await assert.rejects(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId: otherOwnerId,
      buildId,
      dependencies: acceptanceDependencies(repository).deps,
    }),
    /CREATOR_SCRIPT_BUILD_NOT_FOUND/u,
  );
  assert.equal(repository.build.state, "SCRIPT_GENERATED");
}

// Unrelated states fail closed.
for (const state of [
  "REQUESTED",
  "SNAPSHOTTED",
  "RESEARCH_READY",
  "EDITORIAL_COMPILED",
  "AUTHORITY_RESOLVED",
  "PERSISTED",
  "FAILED",
  "STALE",
]) {
  const { repository } = await prepare("accepted");
  repository.build = { ...repository.build, state };
  await expectBlocked(
    runCreatorScriptBuildAcceptanceCoordinator({
      ownerId,
      buildId,
      dependencies: acceptanceDependencies(repository).deps,
    }),
    "CREATOR_SCRIPT_BUILD_ACCEPTANCE_STATE_INVALID",
  );
}

// Static architecture guard: deterministic acceptance has no provider operation,
// persistence installation, repair execution, route, queue, or human approval.
{
  const moduleText = fs.readFileSync(
    new URL("../lib/creator/creatorScriptBuildAcceptanceCoordinator.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    moduleText,
    /requestOperation|transitionOperation|executeScriptRepair|genericQueue|queue\.add/u,
  );
  assert.doesNotMatch(
    moduleText,
    /save-project|creator-script-plan\/route|nextState:\s*"PERSISTED"/u,
  );
  assert.doesNotMatch(moduleText, /approveCreatorScript/u);
  assert.match(moduleText, /evaluateCreatorScriptAcceptance/u);
  assert.match(moduleText, /getCreatorScriptAcceptanceFailure/u);
  assert.match(moduleText, /nextState:\s*"ACCEPTED"/u);
  assert.match(moduleText, /resultAuthority:\s*buildJson\(authority\)/u);
}

console.log("stage-0-19e3c-acceptance-coordinator-test: PASS");
