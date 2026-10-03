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
  runCreatorScriptBuildAcceptanceCoordinator,
} from "../lib/creator/creatorScriptBuildAcceptanceCoordinator.ts";
import {
  CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION,
  CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION,
  runCreatorScriptBuildPersistenceCoordinator,
} from "../lib/creator/creatorScriptBuildPersistenceCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
} from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import {
  attachCreatorProjectState,
  readCreatorProjectState,
} from "../lib/creator/projectState.ts";
import {
  normalizeCreatorScript,
} from "../lib/creator/creatorScript.ts";
import { resolveClaimAuthority } from "../lib/research/claimAuthorityResolver.ts";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
} from "../lib/research/sourceAssessment.ts";

const ownerId = "00000000-0000-4000-8000-000000000003";
const otherOwnerId = "00000000-0000-4000-8000-000000000099";
const buildId = "30000000-0000-4000-8000-000000000004";
const projectId = "00000000-0000-4000-8000-000000000001";
const revision = "2026-10-03T10:00:00.000Z";
const generationNow = "2026-10-03T10:00:01.000Z";
const acceptanceNow = "2026-10-03T10:00:02.000Z";
const persistenceNow = "2026-10-03T10:00:03.000Z";

function clone(value) {
  return structuredClone(value);
}

function serializable(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSnapshot() {
  return createCreatorScriptBuildSnapshot({
    projectId,
    expectedProjectRevision: revision,
    strategyFingerprint: "strategy-fingerprint-e4",
    language: "en",
    requestedDurationSeconds: 120,
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
      creatorScriptBuildAcceptanceCoordinator: "0.19E3C",
      creatorScriptBuildPersistenceCoordinator:
        CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION,
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
      contextNote: "Grounded contextual account.",
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
    excludedPrimaryClaimIds: [],
    permittedClaimIds: ["claim-safe"],
    spanCatalogVersion: "0.19B",
    segmentationVersion: "editorial-grounding-segmentation-v1",
  };
}

const authority = authorityFixture();

function authorityCheckpoint() {
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
      result: authority,
    },
    diagnostics: {},
    startedAt: revision,
    completedAt: revision,
  };
}

function buildRecord(snapshot) {
  return {
    buildId,
    ownerId,
    projectId,
    idempotencyKey: createCreatorScriptBuildIdempotencyKey({
      ownerId,
      snapshot,
    }),
    state: "AUTHORITY_RESOLVED",
    snapshot,
    checkpoints: { authority: authorityCheckpoint() },
    failure: null,
    resultAuthority: null,
    createdAt: revision,
    updatedAt: revision,
  };
}

function baseProject() {
  return {
    id: projectId,
    owner_user_id: ownerId,
    title: "Memory Project",
    input_prompt: "Memory and identity",
    story_premise: "",
    language: "en",
    flow_type: "creator_lab",
    scenes: [],
    refined_creator_scenes: [],
    creator_mentor_result: null,
    creator_production_package: null,
    youtube_metadata: null,
    youtube_thumbnail: null,
    exported_movie_url: null,
    exported_movie_result: null,
    export_signature: null,
    updated_at: revision,
  };
}

class MemoryRepository {
  constructor(initialBuild, project, options = {}) {
    this.build = clone(initialBuild);
    this.project = clone(project);
    this.options = options;
    this.operations = new Map();
    this.transitions = [];
    this.requestedOperations = [];
    this.checkpointWrites = [];
    this.persistCalls = [];
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
    assert.notEqual(input.nextState, "PERSISTED");
    assertCreatorScriptBuildTransition(input.expectedState, input.nextState);
    this.transitions.push(`${input.expectedState}->${input.nextState}`);
    this.build = {
      ...this.build,
      state: input.nextState,
      failure: input.failure || null,
      resultAuthority: input.resultAuthority ?? null,
      updatedAt: persistenceNow,
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
      createdAt: generationNow,
      updatedAt: generationNow,
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
      updatedAt: generationNow,
    };
    this.operations.set(input.operationId, next);
    return clone(next);
  }

  async persistAccepted(input) {
    this.persistCalls.push(clone(input));
    if (this.options.persistThrows) {
      throw new Error("simulated ambiguous RPC response");
    }
    if (this.options.beforePersist) {
      await this.options.beforePersist(this);
    }
    assert.equal(input.ownerId, this.build.ownerId);
    assert.equal(input.buildId, this.build.buildId);
    assert.equal(this.build.state, "ACCEPTED");
    assertCreatorScriptBuildCheckpointIdentity({
      buildId: input.buildId,
      checkpoint: input.checkpoint,
    });
    assert.equal(input.checkpoint.stage, "persistence");
    assert.equal(input.checkpoint.status, "COMPLETED");
    assert.equal(input.checkpoint.operationId, null);

    if (this.project.updated_at !== input.expectedProjectRevision) {
      this.build = {
        ...this.build,
        state: "STALE",
        failure: {
          category: "AUTHORITY",
          code: "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
          stage: "persistence",
          retryability: "NON_RETRYABLE",
          operationId: null,
          diagnostics: {},
        },
        resultAuthority: null,
      };
      return {
        status: "STALE",
        build: clone(this.build),
        project: clone(this.project),
      };
    }

    const expectedScript = this.build.resultAuthority.acceptance.script;
    assert.deepEqual(
      input.creatorProjectState.strategy.script,
      serializable(expectedScript),
    );

    this.project = {
      ...this.project,
      exported_movie_result: {
        ...(this.project.exported_movie_result || {}),
        creatorProjectState: clone(input.creatorProjectState),
      },
      ...(input.invalidateProduction
        ? {
            scenes: [],
            refined_creator_scenes: [],
            exported_movie_url: null,
            export_signature: null,
          }
        : {}),
      updated_at: input.installedProjectRevision,
    };
    this.build = {
      ...this.build,
      state: "PERSISTED",
      checkpoints: {
        ...this.build.checkpoints,
        persistence: clone(input.checkpoint),
      },
      failure: null,
      updatedAt: input.installedProjectRevision,
    };
    return {
      status: "PERSISTED",
      build: clone(this.build),
      project: clone(this.project),
    };
  }
}

class MemoryProjectRepository {
  constructor(memory) {
    this.memory = memory;
  }

  async getForOwner(requestedProjectId, requestedOwnerId) {
    if (
      requestedProjectId !== this.memory.project.id ||
      requestedOwnerId !== this.memory.project.owner_user_id
    ) return null;
    return clone(this.memory.project);
  }
}

function textWithWords(prefix, wordCount) {
  assert.ok(wordCount >= 6);
  const words = Array.from(
    { length: wordCount },
    (_, index) => `${prefix}${index + 1}`,
  );
  words[2] = `${words[2]}.`;
  words[words.length - 1] = `${words.at(-1)}.`;
  return words.join(" ");
}

function generationProposal(input) {
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
        text: textWithWords(`${section.kind}${index}word`, section.targetWords),
        claimIds: index === 1 ? [input.permittedClaimIds[0]] : [],
      };
    }),
  };
}

async function prepareAccepted(options = {}) {
  const snapshot = createSnapshot();
  const repository = new MemoryRepository(
    buildRecord(snapshot),
    baseProject(),
    options,
  );
  await runCreatorScriptBuildScriptGenerationCoordinator({
    ownerId,
    buildId,
    dependencies: {
      repository,
      getCurrentProjectRevision: async () => revision,
      executeScriptGeneration: async (input) => generationProposal(input),
      now: () => generationNow,
    },
  });
  await runCreatorScriptBuildAcceptanceCoordinator({
    ownerId,
    buildId,
    dependencies: {
      repository,
      getCurrentProjectRevision: async () => revision,
      now: () => acceptanceNow,
    },
  });
  assert.equal(repository.build.state, "ACCEPTED");
  repository.transitions.length = 0;
  repository.requestedOperations.length = 0;
  repository.checkpointWrites.length = 0;
  return {
    repository,
    projectRepository: new MemoryProjectRepository(repository),
  };
}

function persistenceDependencies(repository, projectRepository, now = persistenceNow) {
  return {
    buildRepository: repository,
    projectRepository,
    now: () => now,
  };
}

async function expectBlocked(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CreatorScriptBuildCoordinatorBlockedError);
    assert.equal(error.code, code);
    return true;
  });
}

// 1-7. Accepted authority is installed through the dedicated atomic boundary.
let persistedFixture;
{
  const { repository, projectRepository } = await prepareAccepted();
  const acceptedAuthority = clone(repository.build.resultAuthority);
  const result = await runCreatorScriptBuildPersistenceCoordinator({
    ownerId,
    buildId,
    dependencies: persistenceDependencies(repository, projectRepository),
  });
  persistedFixture = { repository, projectRepository, result };
  assert.equal(result.disposition, "PERSISTED");
  assert.equal(result.build.state, "PERSISTED");
  assert.equal(result.build.failure, null);
  assert.deepEqual(result.build.resultAuthority, acceptedAuthority);
  assert.equal(repository.persistCalls.length, 1);
  assert.deepEqual(repository.transitions, []);
  assert.equal(repository.requestedOperations.length, 0);
  assert.equal(result.persistence.version, "0.19E4-persistence-result-v1");
  assert.equal(
    result.persistence.previousProjectRevision,
    revision,
  );
  assert.equal(
    result.persistence.installedProjectRevision,
    persistenceNow,
  );
  assert.equal(
    result.persistence.strategyFingerprint,
    "strategy-fingerprint-e4",
  );
  assert.equal(result.persistence.invalidatedProduction, false);
  assert.equal(
    result.build.checkpoints.persistence.status,
    "COMPLETED",
  );
  assert.equal(
    result.build.checkpoints.persistence.contractVersion,
    CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION,
  );
  assert.equal(result.build.checkpoints.persistence.operationId, null);
  const state = readCreatorProjectState(result.project);
  assert.deepEqual(
    serializable(state.strategy.script),
    serializable(acceptedAuthority.acceptance.script),
  );
  assert.equal(state.strategy.strategyFingerprint, "strategy-fingerprint-e4");
  assert.equal(state.strategy.pendingRefinement, null);
  assert.deepEqual(state.strategy.revisionHistory, []);
  assert.equal(result.project.updated_at, persistenceNow);
}

// 8. PERSISTED re-entry validates durable project/checkpoint authority and does no write.
{
  const repository = persistedFixture.repository;
  repository.persistCalls.length = 0;
  repository.transitions.length = 0;
  const resumed = await runCreatorScriptBuildPersistenceCoordinator({
    ownerId,
    buildId,
    dependencies: persistenceDependencies(
      repository,
      persistedFixture.projectRepository,
    ),
  });
  assert.equal(resumed.disposition, "RESUMED");
  assert.equal(resumed.build.state, "PERSISTED");
  assert.equal(repository.persistCalls.length, 0);
  assert.deepEqual(repository.transitions, []);
}

// 9-11. A stale project before installation is terminally STALE with no install.
{
  const { repository, projectRepository } = await prepareAccepted();
  repository.project.updated_at = "2026-10-03T10:00:05.000Z";
  await expectBlocked(
    runCreatorScriptBuildPersistenceCoordinator({
      ownerId,
      buildId,
      dependencies: persistenceDependencies(repository, projectRepository),
    }),
    "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(repository.build.state, "STALE");
  assert.equal(repository.build.resultAuthority, null);
  assert.equal(repository.persistCalls.length, 0);
  assert.equal(repository.build.checkpoints.persistence, undefined);
}

// 12-14. A race after the project read is caught by the atomic CAS boundary.
{
  const prepared = await prepareAccepted({
    beforePersist: async (memory) => {
      memory.project.updated_at = "2026-10-03T10:00:04.000Z";
    },
  });
  await expectBlocked(
    runCreatorScriptBuildPersistenceCoordinator({
      ownerId,
      buildId,
      dependencies: persistenceDependencies(
        prepared.repository,
        prepared.projectRepository,
      ),
    }),
    "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(prepared.repository.build.state, "STALE");
  assert.equal(prepared.repository.persistCalls.length, 1);
  assert.equal(prepared.repository.build.resultAuthority, null);
}

// 15-18. Ambiguous transport outcome remains reconcilable and does not falsely fail.
{
  const prepared = await prepareAccepted({ persistThrows: true });
  await expectBlocked(
    runCreatorScriptBuildPersistenceCoordinator({
      ownerId,
      buildId,
      dependencies: persistenceDependencies(
        prepared.repository,
        prepared.projectRepository,
      ),
    }),
    "CREATOR_SCRIPT_BUILD_PERSISTENCE_RECONCILIATION_REQUIRED",
  );
  assert.equal(prepared.repository.build.state, "ACCEPTED");
  assert.ok(prepared.repository.build.resultAuthority);
  assert.equal(prepared.repository.persistCalls.length, 1);
  assert.equal(prepared.repository.build.checkpoints.persistence, undefined);
}

// 19-24. Script replacement invalidates stale production in canonical + legacy state.
{
  const { repository, projectRepository } = await prepareAccepted();
  const acceptedScript = repository.build.resultAuthority.acceptance.script;
  const previousScript = normalizeCreatorScript({
    ...acceptedScript,
    sections: acceptedScript.sections.map((section, index) =>
      index === 0
        ? { ...section, text: `${section.text} priorword.` }
        : section
    ),
  });
  const current = readCreatorProjectState(repository.project);
  const previousState = {
    ...current,
    strategy: {
      ...current.strategy,
      strategyFingerprint: previousScript.strategyFingerprint,
      script: previousScript,
    },
    production: {
      ...current.production,
      refinedScenes: [{ id: "refined-1" }],
    },
    createReview: {
      scenes: [{ id: "scene-1" }],
    },
    publish: {
      ...current.publish,
      packageDownloaded: true,
      packageSignature: "pkg",
      finalVideoUrl: "https://media.example/final.mp4",
      finalVideoSignature: "sig",
    },
  };
  repository.project.exported_movie_result = attachCreatorProjectState(
    {},
    previousState,
  );
  repository.project.scenes = [{ id: "legacy-scene" }];
  repository.project.refined_creator_scenes = [{ id: "legacy-refined" }];
  repository.project.exported_movie_url = "https://media.example/final.mp4";
  repository.project.export_signature = "sig";

  const result = await runCreatorScriptBuildPersistenceCoordinator({
    ownerId,
    buildId,
    dependencies: persistenceDependencies(repository, projectRepository),
  });
  assert.equal(result.persistence.invalidatedProduction, true);
  const installed = readCreatorProjectState(result.project);
  assert.deepEqual(installed.createReview.scenes, []);
  assert.deepEqual(installed.production.refinedScenes, []);
  assert.equal(installed.publish.packageDownloaded, false);
  assert.equal(installed.publish.packageSignature, "");
  assert.equal(installed.publish.finalVideoUrl, "");
  assert.equal(installed.publish.finalVideoSignature, "");
  assert.deepEqual(result.project.scenes, []);
  assert.deepEqual(result.project.refined_creator_scenes, []);
  assert.equal(result.project.exported_movie_url, null);
  assert.equal(result.project.export_signature, null);
}

// 25. Same script text does not destroy current production.
{
  const { repository, projectRepository } = await prepareAccepted();
  const acceptedScript = repository.build.resultAuthority.acceptance.script;
  const current = readCreatorProjectState(repository.project);
  repository.project.exported_movie_result = attachCreatorProjectState(
    {},
    {
      ...current,
      strategy: {
        ...current.strategy,
        strategyFingerprint: acceptedScript.strategyFingerprint,
        script: acceptedScript,
      },
      createReview: { scenes: [{ id: "scene-keep" }] },
    },
  );
  repository.project.scenes = [{ id: "legacy-keep" }];
  const result = await runCreatorScriptBuildPersistenceCoordinator({
    ownerId,
    buildId,
    dependencies: persistenceDependencies(repository, projectRepository),
  });
  assert.equal(result.persistence.invalidatedProduction, false);
  assert.deepEqual(result.project.scenes, [{ id: "legacy-keep" }]);
  assert.deepEqual(
    readCreatorProjectState(result.project).createReview.scenes,
    [{ id: "scene-keep" }],
  );
}

// 26-29. Corrupt accepted authority fails before persistence.
{
  const { repository, projectRepository } = await prepareAccepted();
  repository.build.resultAuthority.acceptance.script.strategyFingerprint =
    "tampered";
  await expectBlocked(
    runCreatorScriptBuildPersistenceCoordinator({
      ownerId,
      buildId,
      dependencies: persistenceDependencies(repository, projectRepository),
    }),
    "CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_INVALID",
  );
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.persistCalls.length, 0);
}

// 30. Cross-owner access cannot install another owner's build.
{
  const { repository, projectRepository } = await prepareAccepted();
  await assert.rejects(
    runCreatorScriptBuildPersistenceCoordinator({
      ownerId: otherOwnerId,
      buildId,
      dependencies: persistenceDependencies(repository, projectRepository),
    }),
    /CREATOR_SCRIPT_BUILD_NOT_FOUND/u,
  );
  assert.equal(repository.persistCalls.length, 0);
}

// 31-32. Only ACCEPTED or PERSISTED are valid E4 entry states.
for (const state of [
  "REQUESTED",
  "SNAPSHOTTED",
  "RESEARCH_READY",
  "EDITORIAL_COMPILED",
  "AUTHORITY_RESOLVED",
  "SCRIPT_GENERATED",
  "REPAIRING",
  "FAILED",
  "STALE",
]) {
  const { repository, projectRepository } = await prepareAccepted();
  repository.build = { ...repository.build, state };
  await expectBlocked(
    runCreatorScriptBuildPersistenceCoordinator({
      ownerId,
      buildId,
      dependencies: persistenceDependencies(repository, projectRepository),
    }),
    "CREATOR_SCRIPT_BUILD_PERSISTENCE_STATE_INVALID",
  );
  assert.equal(repository.persistCalls.length, 0);
}

// 33-36. PERSISTED resume rejects tampered checkpoint/project authority.
{
  const build = clone(persistedFixture.repository.build);
  build.checkpoints.persistence.outputReference.result.scriptRevision += 1;
  const repository = new MemoryRepository(
    build,
    persistedFixture.repository.project,
  );
  await expectBlocked(
    runCreatorScriptBuildPersistenceCoordinator({
      ownerId,
      buildId,
      dependencies: persistenceDependencies(
        repository,
        new MemoryProjectRepository(repository),
      ),
    }),
    "CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_INVALID",
  );
}

{
  const build = clone(persistedFixture.repository.build);
  const project = clone(persistedFixture.repository.project);
  project.updated_at = "2026-10-03T10:00:09.000Z";
  const repository = new MemoryRepository(build, project);
  await expectBlocked(
    runCreatorScriptBuildPersistenceCoordinator({
      ownerId,
      buildId,
      dependencies: persistenceDependencies(
        repository,
        new MemoryProjectRepository(repository),
      ),
    }),
    "CREATOR_SCRIPT_BUILD_PERSISTED_PROJECT_REVISION_MISMATCH",
  );
}

// Static architecture/migration guards.
{
  const coordinatorSource = fs.readFileSync(
    new URL(
      "../lib/creator/creatorScriptBuildPersistenceCoordinator.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const typesSource = fs.readFileSync(
    new URL("../lib/persistence/creatorScriptBuilds/types.ts", import.meta.url),
    "utf8",
  );
  const repositorySource = fs.readFileSync(
    new URL(
      "../lib/persistence/creatorScriptBuilds/repository.server.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const migrationSource = fs.readFileSync(
    new URL(
      "../supabase/migrations/20261003133000_stage_0_19e4_creator_script_build_persistence.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    typesSource,
    /nextState:\s*Exclude<CreatorScriptBuildState,\s*"PERSISTED">/u,
  );
  assert.match(typesSource, /persistAccepted/u);
  assert.match(
    repositorySource,
    /velto_creator_script_build_persist/u,
  );
  assert.doesNotMatch(
    coordinatorSource,
    /requestOperation|transitionOperation|executeScriptRepair|executeScriptGeneration/u,
  );
  assert.doesNotMatch(
    coordinatorSource,
    /nextState:\s*"PERSISTED"/u,
  );
  assert.match(
    coordinatorSource,
    /assertCreatorScriptBuildPersistenceAuthority/u,
  );
  assert.match(
    coordinatorSource,
    /normalizeCreatorScriptBuildAcceptedResultAuthority/u,
  );

  assert.match(
    migrationSource,
    /where id = p_build_id[\s\S]*?owner_user_id = p_owner_user_id[\s\S]*?for update/iu,
  );
  assert.match(
    migrationSource,
    /where id = v_build\.project_id[\s\S]*?owner_user_id = p_owner_user_id[\s\S]*?for update/iu,
  );
  assert.match(
    migrationSource,
    /v_project\.updated_at is distinct from p_expected_project_revision/u,
  );
  assert.match(
    migrationSource,
    /updated_at = p_installed_project_revision/u,
  );
  assert.match(
    migrationSource,
    /p_creator_project_state #> '\{strategy,script\}' is distinct from v_accepted_script/u,
  );
  assert.match(
    migrationSource,
    /set checkpoints = jsonb_set\([\s\S]*?state = 'PERSISTED'/u,
  );
  assert.match(
    migrationSource,
    /state = 'STALE'[\s\S]*?result_authority = null/u,
  );
  assert.match(
    migrationSource,
    /velto_creator_production_snapshots/u,
  );
  assert.match(
    migrationSource,
    /creator-script-build-persist-v1:/u,
  );
  assert.match(
    migrationSource,
    /grant execute on function public\.velto_creator_script_build_persist[\s\S]*?to service_role/u,
  );
  assert.doesNotMatch(
    migrationSource,
    /grant execute[\s\S]*?to authenticated/u,
  );
}

console.log("stage-0-19e4-creator-script-build-persistence-test: PASS");
