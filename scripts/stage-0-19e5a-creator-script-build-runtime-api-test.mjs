import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createCreatorScriptBuildIdempotencyKey,
  createCreatorScriptBuildSnapshot,
} from "../lib/creator/creatorScriptBuild.ts";
import {
  createCreatorScriptBuildRuntime,
} from "../lib/creator/creatorScriptBuildRuntime.server.ts";
import {
  CREATOR_SCRIPT_BUILD_CONTRACT_VERSIONS,
  CreatorScriptBuildSnapshotError,
  createCreatorScriptBuildSnapshotFromProject,
} from "../lib/creator/creatorScriptBuildSnapshot.server.ts";
import {
  createCreatorScriptBuildApiController,
  creatorScriptBuildV2Enabled,
} from "../lib/creator/creatorScriptBuildApi.server.ts";
import {
  parseCreatorScriptBuildModelJson,
  reconcileCreatorScriptBuildEditorialProposal,
} from "../lib/creator/creatorScriptBuildProviderContract.ts";
import {
  CreatorScriptBuildStageExecutionError,
} from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import { buildCreatorProjectState } from "../lib/creator/projectState.ts";

const ownerId = "00000000-0000-4000-8000-000000000001";
const otherOwnerId = "00000000-0000-4000-8000-000000000099";
const projectId = "10000000-0000-4000-8000-000000000001";
const revision = "2026-10-03T14:00:00.000Z";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const clone = (value) => structuredClone(value);

function canonicalState() {
  return buildCreatorProjectState({
    navigation: { workspaceStep: 2, productionSubstep: "setup" },
    brief: {
      topic: "Memory and identity",
      language: "en",
      country: "global",
      ageGroup: "professional_18",
      contentType: "educational_explainer",
      format: "youtube_video",
      durationPreset: "custom",
      durationSec: 660,
      customDurationSec: 660,
      qualityMode: "standard",
      targetPlatforms: ["youtube"],
    },
    strategy: {
      mentorResult: {
        audienceInsight: ["Viewers want evidence."],
        hookPatterns: ["What if memory changes?"],
        videoIdeas: [
          { title: "The Memory That Made You", concept: "Recommended duplicate" },
          { title: "Identity After Recall", concept: "Alternative framing" },
        ],
        recommendedIdea: {
          title: "The Memory That Made You",
          reason: "Follow reconstructive memory into identity.",
        },
        productionPlan: ["Ground claims."],
        strategySelection: {
          directionId: "alternative-1",
          hook: "What if your defining memory changed each time?",
        },
      },
      selectedDirectionId: "alternative-1",
      selectedHook: "What if your defining memory changed each time?",
      strategyFingerprint: "creator-strategy-v1-authoritative",
      profileSnapshot: {
        brandName: "",
        brandVoice: "premium documentary",
        defaultAudience: "educated general audience",
        defaultVisualStyle: "cinematic",
        defaultCountry: "global",
        defaultFormat: "youtube_video",
        defaultQualityMode: "standard",
        defaultCreditPreference: "balanced",
        editorialConstitution: {
          mission: "Explain carefully.",
          audiencePromise: "Grounded narration.",
          editorialPointOfView: "Evidence first.",
        },
      },
      script: null,
      pendingRefinement: null,
      revisionHistory: [],
    },
    production: {
      package: null,
      refinedScenes: [],
      backgroundMusic: null,
      projectContinuityMode: "independent",
      sceneContinuityModes: {},
      voicePreferences: null,
    },
    createReview: { scenes: [] },
    publish: {
      metadata: null,
      thumbnail: null,
      thumbnailDesign: null,
      confirmations: {},
      packageDownloaded: false,
      packageSignature: "",
      finalVideoUrl: "",
      finalVideoSignature: "",
    },
  });
}

function project(overrides = {}) {
  return {
    id: projectId,
    owner_user_id: ownerId,
    flow_type: "creator_lab",
    updated_at: revision,
    exported_movie_result: { creatorProjectState: canonicalState() },
    ...overrides,
  };
}

class ProjectRepository {
  constructor(value = project()) {
    this.project = clone(value);
    this.reads = 0;
  }

  async getForOwner(requestedProjectId, requestedOwnerId) {
    this.reads += 1;
    return requestedProjectId === this.project.id && requestedOwnerId === ownerId
      ? clone(this.project)
      : null;
  }
}

function snapshot() {
  return createCreatorScriptBuildSnapshot({
    projectId,
    expectedProjectRevision: revision,
    strategyFingerprint: "fingerprint",
    language: "en",
    requestedDurationSeconds: 120,
    strategy: {
      topic: "Memory",
      researchSubject: "Memory research",
      title: "Memory",
      contentType: "educational_explainer",
      format: "youtube_video",
      selectedDirectionId: "recommended",
      selectedHook: "What if memory changes?",
      approvedStrategy: { selectedDirectionId: "recommended" },
    },
    creatorProfile: { brandVoice: "documentary" },
    contractVersions: CREATOR_SCRIPT_BUILD_CONTRACT_VERSIONS,
  });
}

function build(state = "REQUESTED") {
  const value = snapshot();
  return {
    buildId: `build-${state.toLowerCase()}`,
    ownerId,
    projectId,
    idempotencyKey: createCreatorScriptBuildIdempotencyKey({ ownerId, snapshot: value }),
    state,
    snapshot: value,
    checkpoints: {},
    failure: state === "FAILED"
      ? {
          category: "SCRIPT_POLICY",
          code: "BOUNDED_FAILURE",
          stage: "acceptance",
          retryability: "NON_RETRYABLE",
          operationId: null,
          diagnostics: {},
        }
      : null,
    resultAuthority: null,
    createdAt: revision,
    updatedAt: revision,
  };
}

class BuildRepository {
  constructor(value = build()) {
    this.build = clone(value);
    this.requestCalls = 0;
    this.mutationCalls = 0;
  }

  async request(input) {
    this.requestCalls += 1;
    const key = createCreatorScriptBuildIdempotencyKey(input);
    if (this.build?.idempotencyKey === key && this.build.ownerId === input.ownerId) {
      return { build: clone(this.build), created: false, resolution: "REUSE_IN_PROGRESS" };
    }
    this.build = {
      ...build("REQUESTED"),
      buildId: "build-created",
      snapshot: clone(input.snapshot),
      idempotencyKey: key,
    };
    return { build: clone(this.build), created: true, resolution: "CREATED" };
  }

  async getForOwner(buildId, requestedOwnerId) {
    return this.build?.buildId === buildId && this.build.ownerId === requestedOwnerId
      ? clone(this.build)
      : null;
  }

  setState(state) {
    this.mutationCalls += 1;
    this.build = { ...this.build, state };
    return clone(this.build);
  }
}

const zeroProviders = () => {
  const calls = { count: 0 };
  const execute = async () => {
    calls.count += 1;
    throw new Error("provider should not run in facade tests");
  };
  return {
    calls,
    value: {
      executeResearch: execute,
      executeEditorialProposal: execute,
      executePrimaryAcquisition: execute,
      executePrimaryCoverageSelection: execute,
      executeScriptGeneration: execute,
      executeScriptRepair: execute,
    },
  };
};

// Snapshot authority: owner scope, flow, CAS and canonical persisted inputs.
{
  const projects = new ProjectRepository();
  const result = await createCreatorScriptBuildSnapshotFromProject({
    ownerId,
    projectId,
    expectedProjectUpdatedAt: revision,
    projectRepository: projects,
  });
  assert.equal(result.snapshot.strategy.topic, "Memory and identity");
  assert.equal(result.snapshot.requestedDurationSeconds, 660);
  assert.equal(result.snapshot.strategyFingerprint, "creator-strategy-v1-authoritative");
  assert.equal(result.snapshot.strategy.selectedDirectionId, "alternative-1");
  assert.equal(result.snapshot.strategy.title, "Identity After Recall");
  assert.equal(result.snapshot.strategy.selectedHook, "What if your defining memory changed each time?");
  assert.equal(result.snapshot.creatorProfile.brandVoice, "premium documentary");
  assert.deepEqual(result.snapshot.contractVersions, CREATOR_SCRIPT_BUILD_CONTRACT_VERSIONS);
  assert.equal(result.snapshot.strategy.researchSubject, "Identity After Recall");
  assert.equal(result.snapshot.strategy.approvedStrategy.selectedDirection.id, "alternative-1");
  assert.equal(result.snapshot.strategy.approvedStrategy.mentorAnalysis.recommendedIdea.title, "The Memory That Made You");

  await assert.rejects(
    createCreatorScriptBuildSnapshotFromProject({
      ownerId: otherOwnerId,
      projectId,
      expectedProjectUpdatedAt: revision,
      projectRepository: projects,
    }),
    (error) => error instanceof CreatorScriptBuildSnapshotError && error.status === 404,
  );
  await assert.rejects(
    createCreatorScriptBuildSnapshotFromProject({
      ownerId,
      projectId,
      expectedProjectUpdatedAt: "2026-10-03T14:00:01.000Z",
      projectRepository: projects,
    }),
    (error) => error instanceof CreatorScriptBuildSnapshotError && error.code === "PROJECT_STALE",
  );
  await assert.rejects(
    createCreatorScriptBuildSnapshotFromProject({
      ownerId,
      projectId,
      expectedProjectUpdatedAt: revision,
      projectRepository: new ProjectRepository(project({ flow_type: "storyverse" })),
    }),
    (error) => error instanceof CreatorScriptBuildSnapshotError && error.code === "CREATOR_SCRIPT_BUILD_PROJECT_FLOW_INVALID",
  );
}

// Durable-state routing. Each state has exactly one bounded owner; script phase
// intentionally composes repair then acceptance in the same advance.
for (const scenario of [
  ["REQUESTED", "researchEditorial"],
  ["SNAPSHOTTED", "researchEditorial"],
  ["RESEARCH_READY", "researchEditorial"],
  ["EDITORIAL_COMPILED", "authority"],
  ["AUTHORITY_RESOLVED", "generation"],
  ["ACCEPTED", "persistence"],
]) {
  const [state, expected] = scenario;
  const builds = new BuildRepository(build(state));
  const projects = new ProjectRepository();
  const providers = zeroProviders();
  const calls = [];
  const runner = (name, nextState) => async () => {
    calls.push(name);
    return { build: builds.setState(nextState) };
  };
  const runtime = createCreatorScriptBuildRuntime({
    buildRepository: builds,
    projectRepository: projects,
    providers: providers.value,
    runners: {
      researchEditorial: runner("researchEditorial", "EDITORIAL_COMPILED"),
      authority: runner("authority", "AUTHORITY_RESOLVED"),
      generation: runner("generation", "SCRIPT_GENERATED"),
      repair: runner("repair", "SCRIPT_GENERATED"),
      acceptance: runner("acceptance", "ACCEPTED"),
      persistence: runner("persistence", "FAILED"),
    },
  });
  await runtime.advance({ ownerId, buildId: builds.build.buildId });
  assert.deepEqual(calls, [expected], `${state} routes only to ${expected}`);
  assert.equal(providers.calls.count, 0);
}

for (const state of ["SCRIPT_GENERATED", "REPAIRING"]) {
  const builds = new BuildRepository(build(state));
  const calls = [];
  const providers = zeroProviders();
  const runtime = createCreatorScriptBuildRuntime({
    buildRepository: builds,
    projectRepository: new ProjectRepository(),
    providers: providers.value,
    runners: {
      repair: async () => {
        calls.push("repair");
        return { build: clone(builds.build) };
      },
      acceptance: async () => {
        calls.push("acceptance");
        return { build: builds.setState("ACCEPTED") };
      },
    },
  });
  const result = await runtime.advance({ ownerId, buildId: builds.build.buildId });
  assert.deepEqual(calls, ["repair", "acceptance"]);
  assert.equal(result.state, "ACCEPTED");
  assert.equal(providers.calls.count, 0);
}

for (const state of ["FAILED", "STALE"]) {
  const builds = new BuildRepository(build(state));
  const calls = [];
  const providers = zeroProviders();
  const runtime = createCreatorScriptBuildRuntime({
    buildRepository: builds,
    projectRepository: new ProjectRepository(),
    providers: providers.value,
    runners: {
      researchEditorial: async () => { calls.push("unexpected"); return { build: builds.build }; },
    },
  });
  const result = await runtime.advance({ ownerId, buildId: builds.build.buildId });
  assert.equal(result.state, state);
  assert.equal(result.disposition, "TERMINAL_NOOP");
  assert.deepEqual(calls, []);
  assert.equal(providers.calls.count, 0);
}

// PERSISTED is terminal before project projection; even a missing persisted
// project cannot cause a coordinator or provider to run.
{
  const builds = new BuildRepository(build("PERSISTED"));
  const calls = [];
  const providers = zeroProviders();
  const runtime = createCreatorScriptBuildRuntime({
    buildRepository: builds,
    projectRepository: new ProjectRepository(),
    providers: providers.value,
    runners: {
      persistence: async () => {
        calls.push("unexpected");
        return { build: builds.build };
      },
    },
  });
  await assert.rejects(
    runtime.advance({ ownerId, buildId: builds.build.buildId }),
    /CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_INVALID/,
  );
  assert.deepEqual(calls, []);
  assert.equal(providers.calls.count, 0);
}

// A provider response that was received but cannot satisfy the deterministic
// JSON/origin contract is a known non-retryable MODEL_CONTRACT result.
assert.throws(
  () => parseCreatorScriptBuildModelJson("not-json"),
  (error) => {
    assert.ok(error instanceof CreatorScriptBuildStageExecutionError);
    assert.equal(error.category, "MODEL_CONTRACT");
    assert.equal(
      error.code,
      "CREATOR_SCRIPT_BUILD_PROVIDER_STRUCTURED_RESPONSE_INVALID",
    );
    assert.equal(error.retryability, "NON_RETRYABLE");
    return true;
  },
);
assert.throws(
  () => reconcileCreatorScriptBuildEditorialProposal({
    proposal: { items: [] },
    items: [{
      claim: {
        text: "A named study reported a memory result.",
        claimType: "FACT",
        propositionKind: "original_research_result",
        origin: { attributedEntity: null, referencedWork: "Study A" },
      },
      evidenceSelections: [],
    }],
    initialClaims: [{
      claimId: "proposal-item-1",
      text: "A named study reported a memory result.",
      claimType: "FACT",
      propositionKind: "original_research_result",
      origin: { attributedEntity: null, referencedWork: "Study A" },
    }],
    adjudication: {
      claims: [{
        claimId: "proposal-item-1",
        propositionKind: "attributed_statement",
        origin: { attributedEntity: "Researcher A", referencedWork: "Study A" },
      }],
    },
  }),
  (error) => {
    assert.ok(error instanceof CreatorScriptBuildStageExecutionError);
    assert.equal(error.category, "MODEL_CONTRACT");
    assert.equal(
      error.code,
      "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID",
    );
    assert.equal(error.retryability, "NON_RETRYABLE");
    return true;
  },
);

// Request identity belongs to the immutable snapshot. A repeated semantic
// start reuses exactly the same durable build instead of creating a retry id.
{
  const builds = new BuildRepository(null);
  const providers = zeroProviders();
  const runtime = createCreatorScriptBuildRuntime({
    buildRepository: builds,
    projectRepository: new ProjectRepository(),
    providers: providers.value,
  });
  const first = await runtime.request({ ownerId, snapshot: snapshot() });
  const second = await runtime.request({ ownerId, snapshot: snapshot() });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.build.buildId, second.build.buildId);
  assert.equal(builds.requestCalls, 2);
  assert.equal(providers.calls.count, 0);
}

// Status is a read-only durable projection and owner scoping is mandatory.
{
  const builds = new BuildRepository(build("FAILED"));
  const providers = zeroProviders();
  const runtime = createCreatorScriptBuildRuntime({
    buildRepository: builds,
    projectRepository: new ProjectRepository(),
    providers: providers.value,
  });
  const mutationsBefore = builds.mutationCalls;
  const status = await runtime.status({ ownerId, buildId: builds.build.buildId });
  assert.equal(status.failure.code, "BOUNDED_FAILURE");
  assert.deepEqual(Object.keys(status.failure).sort(), ["category", "code", "retryability"]);
  assert.equal(builds.mutationCalls, mutationsBefore);
  assert.equal(providers.calls.count, 0);
  await assert.rejects(
    runtime.status({ ownerId: otherOwnerId, buildId: builds.build.buildId }),
    /CREATOR_SCRIPT_BUILD_NOT_FOUND/,
  );
  await assert.rejects(
    runtime.advance({ ownerId: otherOwnerId, buildId: builds.build.buildId }),
    /CREATOR_SCRIPT_BUILD_NOT_FOUND/,
  );
}
{
  const controller = createCreatorScriptBuildApiController({
    authenticate: async () => ({ ownerId }),
    featureEnabled: () => true,
    createSnapshot: async () => snapshot(),
    createRuntime: async () => ({
      request: async () => { throw new Error("raw database secret"); },
      status: async () => { throw new Error("raw provider secret"); },
      advance: async () => { throw new Error("raw provider secret"); },
    }),
  });
  const result = await controller.get(new Request("http://test/api?buildId=api-build"));
  assert.equal(result.status, 500);
  assert.equal(result.body.code, "CREATOR_SCRIPT_BUILD_INTERNAL");
  assert.equal(JSON.stringify(result.body).includes("raw provider secret"), false);
}

function apiProjection(state = "REQUESTED", overrides = {}) {
  return {
    success: true,
    version: "0.19E5A",
    buildId: "api-build",
    state,
    terminal: ["PERSISTED", "FAILED", "STALE"].includes(state),
    disposition: null,
    failure: null,
    ...overrides,
  };
}

function apiHarness({ enabled = true, authenticated = true } = {}) {
  const calls = { auth: 0, snapshot: 0, request: 0, advance: 0, status: 0, runtime: 0 };
  let persistedSnapshot = null;
  const runtime = {
    request: async ({ snapshot: value }) => {
      calls.request += 1;
      persistedSnapshot = value;
      return {
        build: { buildId: "api-build" },
        created: calls.request === 1,
        resolution: calls.request === 1 ? "CREATED" : "REUSE_IN_PROGRESS",
      };
    },
    status: async ({ disposition }) => {
      calls.status += 1;
      return apiProjection("REQUESTED", { disposition: disposition || null });
    },
    advance: async () => {
      calls.advance += 1;
      return apiProjection("EDITORIAL_COMPILED", { disposition: "ADVANCED" });
    },
  };
  const controller = createCreatorScriptBuildApiController({
    authenticate: async () => {
      calls.auth += 1;
      if (!authenticated) throw new Error("AUTH_REQUIRED");
      return { ownerId };
    },
    featureEnabled: () => enabled,
    createSnapshot: async () => {
      calls.snapshot += 1;
      return snapshot();
    },
    createRuntime: async () => {
      calls.runtime += 1;
      return runtime;
    },
  });
  return { calls, controller, getSnapshot: () => persistedSnapshot };
}

// Flag defaults off, authentication is mandatory, and disabled mode performs
// zero snapshot/build/provider work.
assert.equal(creatorScriptBuildV2Enabled(undefined), false);
assert.equal(creatorScriptBuildV2Enabled("false"), false);
assert.equal(creatorScriptBuildV2Enabled("true"), true);
{
  const harness = apiHarness({ enabled: false });
  const result = await harness.controller.post(new Request("http://test/api", {
    method: "POST",
    body: JSON.stringify({ action: "start", projectId, expectedProjectUpdatedAt: revision }),
  }));
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "CREATOR_SCRIPT_BUILD_V2_DISABLED");
  assert.equal(harness.calls.auth, 1);
  assert.equal(harness.calls.snapshot, 0);
  assert.equal(harness.calls.runtime, 0);
  assert.equal(harness.calls.request, 0);
}
{
  const harness = apiHarness({ authenticated: false });
  const result = await harness.controller.get(new Request("http://test/api?buildId=x"));
  assert.equal(result.status, 401);
  assert.equal(result.body.code, "AUTH_REQUIRED");
  assert.equal(harness.calls.runtime, 0);
}

// Start ignores every browser-authored authority field and requests only the
// exact snapshot returned by the server builder.
{
  const harness = apiHarness();
  const browserOverrides = {
    topic: "forged topic",
    durationSec: 1,
    strategyFingerprint: "forged",
    selectedDirectionId: "forged",
    selectedHook: "forged",
    creatorProfile: { brandVoice: "forged" },
    contractVersions: { creatorScriptBuildRuntime: "forged" },
  };
  const request = () => new Request("http://test/api", {
    method: "POST",
    body: JSON.stringify({
      action: "start",
      projectId,
      expectedProjectUpdatedAt: revision,
      ...browserOverrides,
    }),
  });
  const first = await harness.controller.post(request());
  assert.equal(first.status, 200);
  assert.equal(first.body.disposition, "CREATED");
  assert.equal(harness.getSnapshot().strategy.topic, "Memory");
  assert.equal(harness.getSnapshot().requestedDurationSeconds, 120);
  assert.equal(harness.getSnapshot().strategyFingerprint, "fingerprint");
  assert.equal(harness.getSnapshot().strategy.selectedDirectionId, "recommended");
  assert.equal(harness.getSnapshot().strategy.selectedHook, "What if memory changes?");
  assert.equal(harness.getSnapshot().creatorProfile.brandVoice, "documentary");
  assert.deepEqual(harness.getSnapshot().contractVersions, CREATOR_SCRIPT_BUILD_CONTRACT_VERSIONS);
  const second = await harness.controller.post(request());
  assert.equal(second.status, 200);
  assert.equal(harness.calls.snapshot, 2);
  assert.equal(harness.calls.request, 2);
}

// Advance is one semantic command and status never advances.
{
  const harness = apiHarness();
  const advanced = await harness.controller.post(new Request("http://test/api", {
    method: "POST",
    body: JSON.stringify({ action: "advance", buildId: "api-build" }),
  }));
  assert.equal(advanced.status, 200);
  assert.equal(advanced.body.state, "EDITORIAL_COMPILED");
  assert.equal(harness.calls.advance, 1);
  const status = await harness.controller.get(new Request("http://test/api?buildId=api-build"));
  assert.equal(status.status, 200);
  assert.equal(harness.calls.advance, 1);
  assert.equal(harness.calls.status, 1);
}

// Terminal API semantics are bounded and raw internals/errors never escape.
{
  const failure = apiProjection("FAILED", {
    failure: { category: "PROVIDER", code: "SAFE_CODE", retryability: "NON_RETRYABLE" },
  });
  const controller = createCreatorScriptBuildApiController({
    authenticate: async () => ({ ownerId }),
    featureEnabled: () => true,
    createSnapshot: async () => snapshot(),
    createRuntime: async () => ({
      request: async () => { throw new Error("raw database secret"); },
      status: async () => failure,
      advance: async () => failure,
    }),
  });
  const result = await controller.get(new Request("http://test/api?buildId=api-build"));
  assert.equal(result.status, 422);
  assert.equal(result.body.code, "BUILD_FAILED");
  assert.equal(JSON.stringify(result.body).includes("raw database secret"), false);
  assert.equal("checkpoints" in result.body, false);
  assert.equal("operations" in result.body, false);
  assert.equal("resultAuthority" in result.body, false);
  assert.equal("prompt" in result.body, false);
}
{
  const persisted = apiProjection("PERSISTED", {
    creatorScript: { title: "authoritative persisted script" },
    persistence: { installedProjectRevision: "new-revision" },
  });
  const controller = createCreatorScriptBuildApiController({
    authenticate: async () => ({ ownerId }),
    featureEnabled: () => true,
    createSnapshot: async () => snapshot(),
    createRuntime: async () => ({
      request: async () => { throw new Error("unused"); },
      status: async () => persisted,
      advance: async () => persisted,
    }),
  });
  const result = await controller.get(new Request("http://test/api?buildId=api-build"));
  assert.equal(result.status, 200);
  assert.equal(result.body.creatorScript.title, "authoritative persisted script");
}
{
  const controller = createCreatorScriptBuildApiController({
    authenticate: async () => ({ ownerId }),
    featureEnabled: () => true,
    createSnapshot: async () => snapshot(),
    createRuntime: async () => ({
      request: async () => { throw new Error("unused"); },
      status: async () => { throw new Error("unused"); },
      advance: async () => {
        const error = new Error(
          "CREATOR_SCRIPT_BUILD_PERSISTENCE_RECONCILIATION_REQUIRED",
        );
        error.code = "CREATOR_SCRIPT_BUILD_PERSISTENCE_RECONCILIATION_REQUIRED";
        throw error;
      },
    }),
  });
  const result = await controller.post(new Request("http://test/api", {
    method: "POST",
    body: JSON.stringify({ action: "advance", buildId: "api-build" }),
  }));
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "BUILD_STATE_CONFLICT");
  assert.equal(
    JSON.stringify(result.body).includes(
      "CREATOR_SCRIPT_BUILD_PERSISTENCE_RECONCILIATION_REQUIRED",
    ),
    false,
  );
}

// Source-level architectural guards complement behavior assertions without
// executing routes, providers, Supabase, migrations, or live network work.
const runtimeSource = read("lib/creator/creatorScriptBuildRuntime.server.ts");
const snapshotSource = read("lib/creator/creatorScriptBuildSnapshot.server.ts");
const providerSource = read("lib/creator/creatorScriptBuildProviders.server.ts");
const apiSource = read("lib/creator/creatorScriptBuildApi.server.ts");
const routeSource = read("app/api/creator-script-build/route.ts");
const persistenceSource = read("lib/creator/creatorScriptBuildPersistenceCoordinator.ts");
const clientSource = read("lib/research/creatorEditorialPipeline.client.ts");
const createPageSource = read("app/create/page.tsx");

assert.match(runtimeSource, /switch \(initial\.state\)/);
assert.doesNotMatch(runtimeSource, /researchComplete|scriptReady|repairDone/);
assert.match(runtimeSource, /runCreatorScriptBuildResearchEditorialCoordinator/);
assert.match(runtimeSource, /runCreatorScriptBuildAuthorityCoordinator/);
assert.match(runtimeSource, /runCreatorScriptBuildScriptGenerationCoordinator/);
assert.match(runtimeSource, /runCreatorScriptBuildScriptRepairCoordinator/);
assert.match(runtimeSource, /runCreatorScriptBuildAcceptanceCoordinator/);
assert.match(runtimeSource, /runCreatorScriptBuildPersistenceCoordinator/);
assert.match(runtimeSource, /case "PERSISTED"|creatorScriptBuildIsTerminal/);
assert.doesNotMatch(runtimeSource, /fetch\s*\(/);
assert.doesNotMatch(runtimeSource, /jobQueue|queueRepository/);
assert.match(persistenceSource, /persistAccepted\s*\(/);
assert.doesNotMatch(persistenceSource, /nextState:\s*"PERSISTED"/);
assert.match(snapshotSource, /readCreatorProjectState/);
assert.match(snapshotSource, /strategyFingerprint/);
assert.match(snapshotSource, /profileSnapshot/);
assert.match(snapshotSource, /CREATOR_SCRIPT_BUILD_CONTRACT_VERSIONS/);
assert.match(providerSource, /requestOperation|operation ledger|CreatorScriptBuildProviderExecutors/);
assert.doesNotMatch(providerSource, /fetch\s*\(\s*["'`]\/api\//);
assert.match(providerSource, /recordOpenAITextEconomics/);
assert.match(providerSource, /persistEconomicOperationBestEffort/);
assert.match(apiSource, /value\?\.trim\(\)\.toLowerCase\(\) === "true"/);
assert.match(apiSource, /terminalStatus/);
assert.match(routeSource, /authenticateRequest\(request\)/);
assert.match(routeSource, /creatorScriptBuildV2Enabled/);
assert.match(routeSource, /getPersistenceServices/);
assert.doesNotMatch(routeSource, /creatorScriptBuildV2Enabled\("true"\)/);
assert.match(clientSource, /runCreatorEditorialScriptPipeline/);
assert.match(createPageSource, /handleCreatorProductionPackage/);
assert.doesNotMatch(createPageSource, /api\/creator-script-build/);

const migrationSource = read("supabase/migrations/20261003133000_stage_0_19e4_creator_script_build_persistence.sql");
assert.ok(migrationSource.length > 0);

console.log("stage-0-19e5a-creator-script-build-runtime-api-test: PASS");
