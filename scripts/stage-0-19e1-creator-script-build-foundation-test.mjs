import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CREATOR_SCRIPT_BUILD_CONTRACT_VERSION,
  CREATOR_SCRIPT_BUILD_TRANSITIONS,
  assertCreatorScriptBuildCheckpointIdentity,
  assertCreatorScriptBuildOperationTransition,
  assertCreatorScriptBuildPersistenceAuthority,
  assertCreatorScriptBuildSnapshotUnchanged,
  assertCreatorScriptBuildTransition,
  canonicalCreatorScriptBuildJson,
  createCreatorScriptBuildCheckpointId,
  createCreatorScriptBuildFailure,
  createCreatorScriptBuildIdempotencyKey,
  createCreatorScriptBuildOperationId,
  createCreatorScriptBuildSnapshot,
  creatorScriptBuildCanTransition,
  creatorScriptBuildIsTerminal,
  creatorScriptBuildOperationIsReusable,
  resolveCreatorScriptBuildDuplicate,
  serializeCreatorScriptBuildFailure,
} from "../lib/creator/creatorScriptBuild.ts";

const repositorySource = fs.readFileSync(
  new URL("../lib/persistence/creatorScriptBuilds/repository.server.ts", import.meta.url),
  "utf8",
);
const migrationSource = fs.readFileSync(
  new URL("../supabase/migrations/20261002175339_stage_0_19e1_creator_script_build_foundation.sql", import.meta.url),
  "utf8",
);

const baseInput = {
  projectId: "00000000-0000-4000-8000-000000000001",
  expectedProjectRevision: "2026-10-02T12:00:00.000Z",
  strategyFingerprint: "strategy-fingerprint-a",
  language: "en",
  requestedDurationSeconds: 960,
  strategy: {
    topic: "Memory and identity",
    researchSubject: "Memory formation and autobiographical identity",
    title: "When Your Past Is Not What You Remember",
    contentType: "documentary essay",
    format: "long-form",
    selectedDirectionId: "direction-a",
    selectedHook: "What if the memory defining you never happened that way?",
    approvedStrategy: {
      selectedDirection: { id: "direction-a", title: "Memory and identity" },
      mentorAnalysis: { audienceInsight: "Curious general audience", score: 4 },
    },
  },
  creatorProfile: { voice: "premium documentary", audience: ["general", "curious"] },
  contractVersions: {
    creatorScriptAcceptance: "0.19D",
    claimAuthorityResolver: "0.19C",
    editorialEvidenceSpanCatalog: "0.19B",
    canonicalEditorialGraph: "0.19A",
    creatorScriptBuild: CREATOR_SCRIPT_BUILD_CONTRACT_VERSION,
  },
};

const snapshot = createCreatorScriptBuildSnapshot(baseInput);
const ownerId = "00000000-0000-4000-8000-000000000002";
const key = createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot });

// 1 and 8. Same authority and differently ordered input objects produce one key.
const reorderedSnapshot = createCreatorScriptBuildSnapshot({
  ...baseInput,
  strategy: {
    ...baseInput.strategy,
    approvedStrategy: {
      mentorAnalysis: { score: 4, audienceInsight: "Curious general audience" },
      selectedDirection: { title: "Memory and identity", id: "direction-a" },
    },
  },
  creatorProfile: { audience: ["general", "curious"], voice: "premium documentary" },
  contractVersions: Object.fromEntries(Object.entries(baseInput.contractVersions).reverse()),
});
assert.equal(createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot: reorderedSnapshot }), key);
assert.match(key, /^creator-script-build-idempotency-v1:[0-9a-f]{64}$/u);

function changedSnapshot(patch) {
  return createCreatorScriptBuildSnapshot({ ...baseInput, ...patch });
}

// 2-6. Every authoritative identity input rekeys the work.
assert.notEqual(createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot: changedSnapshot({ expectedProjectRevision: "2026-10-02T12:01:00.000Z" }) }), key);
assert.notEqual(createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot: changedSnapshot({ strategyFingerprint: "strategy-fingerprint-b" }) }), key);
assert.notEqual(createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot: changedSnapshot({ requestedDurationSeconds: 961 }) }), key);
assert.notEqual(createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot: changedSnapshot({ language: "tr" }) }), key);
assert.notEqual(createCreatorScriptBuildIdempotencyKey({
  ownerId,
  snapshot: changedSnapshot({
    contractVersions: { ...baseInput.contractVersions, creatorScriptAcceptance: "0.19D.1" },
  }),
}), key);

assert.notEqual(createCreatorScriptBuildIdempotencyKey({
  ownerId,
  snapshot: changedSnapshot({
    creatorProfile: { ...baseInput.creatorProfile, voice: "alternate documentary" },
  }),
}), key);
assert.notEqual(createCreatorScriptBuildIdempotencyKey({
  ownerId,
  snapshot: changedSnapshot({
    strategy: { ...baseInput.strategy, selectedHook: "A different approved hook" },
  }),
}), key);

// 7. Transient UI material is not in the canonical snapshot or identity.
const snapshotWithTransientInput = createCreatorScriptBuildSnapshot({
  ...baseInput,
  activeTab: "sources",
  browserSession: "temporary",
});
assert.equal(createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot: snapshotWithTransientInput }), key);
assert.equal("activeTab" in snapshotWithTransientInput, false);
assert.equal("browserSession" in snapshotWithTransientInput, false);
assert.equal(Object.isFrozen(snapshotWithTransientInput), true);
assert.equal(Object.isFrozen(snapshotWithTransientInput.strategy.approvedStrategy), true);

function build(state, overrides = {}) {
  return {
    buildId: "10000000-0000-4000-8000-000000000001",
    ownerId,
    projectId: snapshot.projectId,
    idempotencyKey: key,
    state,
    snapshot,
    checkpoints: {},
    failure: null,
    resultAuthority: null,
    createdAt: "2026-10-02T12:00:00.000Z",
    updatedAt: "2026-10-02T12:00:00.000Z",
    ...overrides,
  };
}

// 9-11. Duplicate requests reuse durable authority. E1 intentionally has no
// retry-generation escape hatch, so FAILED or STALE work keeps the same semantic key.
assert.equal(resolveCreatorScriptBuildDuplicate(build("RESEARCH_READY")), "REUSE_IN_PROGRESS");
assert.equal(resolveCreatorScriptBuildDuplicate(build("PERSISTED")), "REUSE_PERSISTED");
assert.equal(resolveCreatorScriptBuildDuplicate(build("FAILED")), "REUSE_FAILED");
assert.equal(resolveCreatorScriptBuildDuplicate(build("STALE")), "REUSE_STALE");
assert.equal(createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot }), key);
assert.doesNotMatch(repositorySource, /retryGeneration|retry_generation|p_retry_generation/u);

// 12-14. Stale and terminal builds fail closed; only explicit matrix edges exist.
assert.equal(creatorScriptBuildCanTransition("REQUESTED", "SNAPSHOTTED"), true);
assert.equal(creatorScriptBuildCanTransition("SCRIPT_GENERATED", "ACCEPTED"), true);
assert.equal(creatorScriptBuildCanTransition("SCRIPT_GENERATED", "REPAIRING"), true);
assert.equal(creatorScriptBuildCanTransition("REPAIRING", "ACCEPTED"), true);
assert.throws(() => assertCreatorScriptBuildTransition("REQUESTED", "SCRIPT_GENERATED"), /TRANSITION_INVALID/);
assert.throws(() => assertCreatorScriptBuildTransition("STALE", "PERSISTED"), /TRANSITION_INVALID/);
assert.throws(() => assertCreatorScriptBuildTransition("PERSISTED", "RESEARCH_READY"), /TRANSITION_INVALID/);
assert.equal(creatorScriptBuildIsTerminal("PERSISTED"), true);
assert.equal(creatorScriptBuildIsTerminal("FAILED"), true);
assert.equal(creatorScriptBuildIsTerminal("STALE"), true);
assert.deepEqual(CREATOR_SCRIPT_BUILD_TRANSITIONS.PERSISTED, []);
assert.throws(
  () => assertCreatorScriptBuildPersistenceAuthority({
    build: build("ACCEPTED"),
    currentProjectRevision: "2026-10-02T12:01:00.000Z",
  }),
  /CREATOR_SCRIPT_BUILD_STALE/,
);
assert.doesNotThrow(() => assertCreatorScriptBuildPersistenceAuthority({
  build: build("ACCEPTED"),
  currentProjectRevision: snapshot.expectedProjectRevision,
}));

// 15. Once snapshot authority is established, it is immutable.
assert.throws(
  () => assertCreatorScriptBuildSnapshotUnchanged({
    current: snapshot,
    next: changedSnapshot({ requestedDurationSeconds: 961 }),
  }),
  /CREATOR_SCRIPT_BUILD_SNAPSHOT_IMMUTABLE/,
);
assert.doesNotThrow(() => assertCreatorScriptBuildSnapshotUnchanged({
  current: snapshot,
  next: reorderedSnapshot,
}));
assert.match(migrationSource, /CREATOR_SCRIPT_BUILD_SNAPSHOT_IMMUTABLE/u);

// 16-17. Repository reads are owner-scoped and storage structurally prevents
// duplicate authoritative work identities.
assert.match(repositorySource, /\.eq\("id", buildId\)[\s\S]*?\.eq\("owner_user_id", ownerId\)/u);
assert.match(repositorySource, /\.eq\("idempotency_key", idempotencyKey\)[\s\S]*?\.eq\("owner_user_id", ownerId\)/u);
assert.match(repositorySource, /\.eq\("operation_identity", operationId\)[\s\S]*?\.eq\("build_id", buildId\)[\s\S]*?\.eq\("owner_user_id", ownerId\)/u);
assert.match(repositorySource, /p_owner_user_id: input\.ownerId/u);
assert.match(repositorySource, /\.eq\("owner_user_id", input\.ownerId\)[\s\S]*?\.eq\("state", input\.expectedState\)/u);
assert.match(migrationSource, /unique \(owner_user_id, idempotency_key\)/u);
assert.match(migrationSource, /foreign key \(build_id, owner_user_id\)[\s\S]*?references public\.velto_creator_script_builds\(id, owner_user_id\)/u);
assert.match(migrationSource, /using \(\(select auth\.uid\(\)\) = owner_user_id\)/u);
assert.match(migrationSource, /revoke all on table public\.velto_creator_script_builds from public, anon, authenticated/u);
assert.match(migrationSource, /CREATOR_SCRIPT_BUILD_PROJECT_NOT_OWNED/u);

// 18. Failure data is bounded and canonicalized deterministically.
const failureA = createCreatorScriptBuildFailure({
  category: "PROVIDER",
  code: "CREATOR_SCRIPT_PROVIDER_UNCERTAIN",
  stage: "research",
  retryability: "UNKNOWN_OUTCOME",
  operationId: "operation-a",
  diagnostics: { z: true, a: "x".repeat(400), count: 2 },
});
const failureB = createCreatorScriptBuildFailure({
  category: "PROVIDER",
  code: "CREATOR_SCRIPT_PROVIDER_UNCERTAIN",
  stage: "research",
  retryability: "UNKNOWN_OUTCOME",
  operationId: "operation-a",
  diagnostics: { count: 2, a: "x".repeat(400), z: true },
});
assert.equal(serializeCreatorScriptBuildFailure(failureA), serializeCreatorScriptBuildFailure(failureB));
assert.equal(failureA.diagnostics.a.length, 240);
assert.doesNotMatch(serializeCreatorScriptBuildFailure(failureA), /prompt|source body|full script/iu);

// 19 and 22. Checkpoint identity is stable and contract-version sensitive.
const checkpointId = createCreatorScriptBuildCheckpointId({
  buildId: build("SNAPSHOTTED").buildId,
  stage: "research",
  contractVersion: "research-v1",
});
assert.equal(createCreatorScriptBuildCheckpointId({
  contractVersion: "research-v1",
  stage: "research",
  buildId: build("SNAPSHOTTED").buildId,
}), checkpointId);
assert.notEqual(createCreatorScriptBuildCheckpointId({
  buildId: build("SNAPSHOTTED").buildId,
  stage: "research",
  contractVersion: "research-v2",
}), checkpointId);

assert.doesNotThrow(() => assertCreatorScriptBuildCheckpointIdentity({
  buildId: build("SNAPSHOTTED").buildId,
  checkpoint: {
    checkpointId,
    stage: "research",
    contractVersion: "research-v1",
  },
}));
assert.throws(
  () => assertCreatorScriptBuildCheckpointIdentity({
    buildId: build("SNAPSHOTTED").buildId,
    checkpoint: {
      checkpointId,
      stage: "research",
      contractVersion: "research-v2",
    },
  }),
  /CHECKPOINT_IDENTITY_INVALID/,
);

// 20-25. Only a confirmed completed semantic operation with a durable result is
// reusable, and provider-operation identity depends only on semantic authority.
const operationInput = {
  buildId: build("SNAPSHOTTED").buildId,
  stage: "research",
  operationType: "creator_research",
  semanticFingerprint: "research-semantic-a",
  contractVersion: "provider-operation-v1",
};
const operationId = createCreatorScriptBuildOperationId(operationInput);
assert.match(operationId, /^creator-script-build-operation-v1:[0-9a-f]{64}$/u);
assert.equal(createCreatorScriptBuildOperationId({
  contractVersion: operationInput.contractVersion,
  semanticFingerprint: operationInput.semanticFingerprint,
  operationType: operationInput.operationType,
  stage: operationInput.stage,
  buildId: operationInput.buildId,
}), operationId);
assert.notEqual(createCreatorScriptBuildOperationId({
  ...operationInput,
  semanticFingerprint: "research-semantic-b",
}), operationId);
assert.notEqual(createCreatorScriptBuildOperationId({
  ...operationInput,
  contractVersion: "provider-operation-v2",
}), operationId);
assert.equal(createCreatorScriptBuildOperationId({
  ...operationInput,
  startedAt: "2026-10-02T12:00:00.000Z",
  completedAt: "2026-10-02T12:00:01.000Z",
}), operationId);
assert.equal(creatorScriptBuildOperationIsReusable({ state: "COMPLETED", resultReference: { ref: "result-a" } }), true);
assert.equal(creatorScriptBuildOperationIsReusable({ state: "COMPLETED", resultReference: null }), false);
assert.equal(creatorScriptBuildOperationIsReusable({ state: "PENDING", resultReference: null }), false);
assert.equal(creatorScriptBuildOperationIsReusable({ state: "OUTCOME_UNCERTAIN", resultReference: null }), false);
assert.doesNotThrow(() => assertCreatorScriptBuildOperationTransition("PENDING", "OUTCOME_UNCERTAIN"));
assert.doesNotThrow(() => assertCreatorScriptBuildOperationTransition("OUTCOME_UNCERTAIN", "COMPLETED"));
assert.throws(() => assertCreatorScriptBuildOperationTransition("COMPLETED", "FAILED"), /OPERATION_TRANSITION_INVALID/);

// Persistence remains additive, operation-aware, and does not turn the generic
// queue into build authority or expose writes to authenticated clients.
assert.match(migrationSource, /create table public\.velto_creator_script_builds/u);
assert.match(migrationSource, /create table public\.velto_creator_script_build_operations/u);
assert.match(migrationSource, /CREATOR_SCRIPT_BUILD_SNAPSHOT_IMMUTABLE/u);
assert.match(migrationSource, /CREATOR_SCRIPT_BUILD_TRANSITION_INVALID/u);
assert.match(migrationSource, /CREATOR_SCRIPT_BUILD_IDEMPOTENCY_COLLISION/u);
assert.match(migrationSource, /CREATOR_SCRIPT_BUILD_OPERATION_IDENTITY_COLLISION/u);
assert.match(migrationSource, /creator-script-build-checkpoint-v1:\[0-9a-f\]\{64\}/u);
assert.doesNotMatch(migrationSource, /retry_generation|p_retry_generation/u);
assert.doesNotMatch(migrationSource, /grant (insert|update|delete|all).*authenticated/iu);
assert.doesNotMatch(repositorySource, /velto_jobs/u);
assert.equal(canonicalCreatorScriptBuildJson({ b: 2, a: 1 }), '{"a":1,"b":2}');

console.log("Stage 0.19E1 Creator Script Build foundation regression passed.");
