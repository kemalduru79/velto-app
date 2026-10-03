import {
  invalidateCreatorSceneAuthorityForScriptChange,
} from "./creatorScriptApproval.ts";
import {
  canonicalCreatorScriptBuildJson,
  createCreatorScriptBuildCheckpointId,
  createCreatorScriptBuildFailure,
  assertCreatorScriptBuildPersistenceAuthority,
  type CreatorScriptBuildCheckpoint,
  type CreatorScriptBuildFailureCategory,
  type CreatorScriptBuildJson,
  type CreatorScriptBuildRecord,
} from "./creatorScriptBuild.ts";
import {
  normalizeCreatorScriptBuildAcceptedResultAuthority,
  type CreatorScriptBuildAcceptedResultAuthority,
} from "./creatorScriptBuildAcceptanceCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
} from "./creatorScriptBuildResearchEditorialCoordinator.ts";
import {
  isValidCreatorProjectState,
  readCreatorProjectState,
  type CreatorProjectStateSnapshot,
} from "./projectState.ts";
import {
  creatorScriptTextChanged,
} from "./creatorScriptRevisions.ts";
import type {
  CreatorScriptBuildRepository,
} from "../persistence/creatorScriptBuilds/types.ts";
import type {
  ProjectRepository,
  VeltoProjectApiRecord,
} from "../persistence/projects/types.ts";

export const CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION =
  "0.19E4" as const;
export const CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION =
  "creator-script-build-persistence-checkpoint-v1" as const;

export type CreatorScriptBuildPersistenceStageResult = Readonly<{
  version: "0.19E4-persistence-result-v1";
  buildId: string;
  projectId: string;
  previousProjectRevision: string;
  installedProjectRevision: string;
  scriptRevision: number;
  strategyFingerprint: string;
  invalidatedProduction: boolean;
  acceptedAuthorityVersion: string;
  contractVersions: Readonly<{
    coordinator: typeof CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION;
    checkpoint: typeof CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION;
  }>;
}>;

export type CreatorScriptBuildPersistenceCoordinatorResult = Readonly<{
  version: typeof CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION;
  build: CreatorScriptBuildRecord;
  project: VeltoProjectApiRecord;
  persistence: CreatorScriptBuildPersistenceStageResult;
  disposition: "PERSISTED" | "RESUMED";
}>;

export type CreatorScriptBuildPersistenceCoordinatorDependencies = Readonly<{
  buildRepository: CreatorScriptBuildRepository;
  projectRepository: Pick<ProjectRepository, "getForOwner">;
  now?: () => string;
}>;

class CreatorScriptBuildPersistenceError extends Error {
  readonly category: CreatorScriptBuildFailureCategory;
  readonly code: string;

  constructor(category: CreatorScriptBuildFailureCategory, code: string) {
    super(code);
    this.name = "CreatorScriptBuildPersistenceError";
    this.category = category;
    this.code = code;
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

function serializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function buildJson(value: unknown): CreatorScriptBuildJson {
  const serialized = JSON.stringify(value);
  if (!serialized) throw new Error("CREATOR_SCRIPT_BUILD_JSON_INVALID");
  return JSON.parse(
    canonicalCreatorScriptBuildJson(JSON.parse(serialized)),
  ) as CreatorScriptBuildJson;
}

function equalCanonical(left: unknown, right: unknown) {
  return canonicalCreatorScriptBuildJson(serializable(left)) ===
    canonicalCreatorScriptBuildJson(serializable(right));
}

function sameInstant(left: string, right: string) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs;
}

function nextProjectRevision(nowValue: string, expectedRevision: string) {
  const nowMs = Date.parse(nowValue);
  const expectedMs = Date.parse(expectedRevision);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expectedMs)) {
    throw new CreatorScriptBuildPersistenceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_PROJECT_REVISION_INVALID",
    );
  }
  return new Date(Math.max(nowMs, expectedMs + 1)).toISOString();
}

function hardFailure(input: {
  category: CreatorScriptBuildFailureCategory;
  code: string;
}) {
  return createCreatorScriptBuildFailure({
    category: input.category,
    code: input.code,
    stage: "persistence",
    retryability: "NON_RETRYABLE",
    diagnostics: {},
  });
}

async function failAcceptedBuild(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
  category: CreatorScriptBuildFailureCategory;
  code: string;
}): Promise<never> {
  const failed = await input.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: "ACCEPTED",
    nextState: "FAILED",
    failure: hardFailure({
      category: input.category,
      code: input.code,
    }),
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: input.code,
    buildId: failed.buildId,
  });
}

async function staleAcceptedBuild(input: {
  repository: CreatorScriptBuildRepository;
  build: CreatorScriptBuildRecord;
}): Promise<never> {
  const failure = hardFailure({
    category: "AUTHORITY",
    code: "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  });
  const stale = await input.repository.transition({
    ownerId: input.build.ownerId,
    buildId: input.build.buildId,
    expectedState: "ACCEPTED",
    nextState: "STALE",
    failure,
  });
  throw new CreatorScriptBuildCoordinatorBlockedError({
    code: failure.code,
    buildId: stale.buildId,
  });
}

function normalizeAcceptedAuthority(build: CreatorScriptBuildRecord) {
  try {
    return normalizeCreatorScriptBuildAcceptedResultAuthority({
      value: build.resultAuthority,
      snapshot: build.snapshot,
    });
  } catch {
    throw new CreatorScriptBuildPersistenceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_INVALID",
    );
  }
}

function projectRevision(project: VeltoProjectApiRecord) {
  const revision = clean(project.updated_at, 120);
  if (!revision || !Number.isFinite(Date.parse(revision))) {
    throw new CreatorScriptBuildPersistenceError(
      "AUTHORITY",
      "CREATOR_SCRIPT_BUILD_PROJECT_REVISION_MISSING",
    );
  }
  return revision;
}

function assertCreatorProjectAuthority(input: {
  build: CreatorScriptBuildRecord;
  project: VeltoProjectApiRecord;
}) {
  if (input.project.id !== input.build.projectId) {
    throw new CreatorScriptBuildPersistenceError(
      "AUTHORITY",
      "CREATOR_SCRIPT_BUILD_PROJECT_ID_MISMATCH",
    );
  }
  if (input.project.flow_type !== "creator_lab") {
    throw new CreatorScriptBuildPersistenceError(
      "AUTHORITY",
      "CREATOR_SCRIPT_BUILD_PROJECT_FLOW_INVALID",
    );
  }
}

function createInstalledCreatorProjectState(input: {
  project: VeltoProjectApiRecord;
  build: CreatorScriptBuildRecord;
  authority: CreatorScriptBuildAcceptedResultAuthority;
}) {
  let current: CreatorProjectStateSnapshot;
  try {
    current = readCreatorProjectState(input.project);
  } catch {
    throw new CreatorScriptBuildPersistenceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_PROJECT_STATE_INVALID",
    );
  }

  const acceptedScript = input.authority.acceptance.script;
  const currentScript = current.strategy.script;
  const invalidateProduction = creatorScriptTextChanged(
    currentScript,
    acceptedScript,
  );

  let next: CreatorProjectStateSnapshot = {
    ...current,
    strategy: {
      ...current.strategy,
      selectedDirectionId: input.build.snapshot.strategy.selectedDirectionId,
      selectedHook: input.build.snapshot.strategy.selectedHook,
      strategyFingerprint: input.build.snapshot.strategyFingerprint,
      script: acceptedScript,
      pendingRefinement: null,
      revisionHistory: [],
    },
  };

  if (invalidateProduction) {
    next = invalidateCreatorSceneAuthorityForScriptChange(next);
  }

  if (!isValidCreatorProjectState(serializable(next))) {
    throw new CreatorScriptBuildPersistenceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_INSTALLED_PROJECT_STATE_INVALID",
    );
  }

  return {
    current,
    next: serializable(next),
    invalidateProduction,
  };
}

function createPersistenceResult(input: {
  build: CreatorScriptBuildRecord;
  authority: CreatorScriptBuildAcceptedResultAuthority;
  previousProjectRevision: string;
  installedProjectRevision: string;
  invalidatedProduction: boolean;
}): CreatorScriptBuildPersistenceStageResult {
  return Object.freeze({
    version: "0.19E4-persistence-result-v1" as const,
    buildId: input.build.buildId,
    projectId: input.build.projectId,
    previousProjectRevision: input.previousProjectRevision,
    installedProjectRevision: input.installedProjectRevision,
    scriptRevision: input.authority.acceptance.script.revision,
    strategyFingerprint: input.build.snapshot.strategyFingerprint,
    invalidatedProduction: input.invalidatedProduction,
    acceptedAuthorityVersion: input.authority.version,
    contractVersions: Object.freeze({
      coordinator: CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION,
      checkpoint: CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION,
    }),
  });
}

function createPersistenceCheckpoint(input: {
  build: CreatorScriptBuildRecord;
  result: CreatorScriptBuildPersistenceStageResult;
}): CreatorScriptBuildCheckpoint {
  const timestamp = input.result.installedProjectRevision;
  return {
    checkpointId: createCreatorScriptBuildCheckpointId({
      buildId: input.build.buildId,
      stage: "persistence",
      contractVersion: CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION,
    }),
    stage: "persistence",
    status: "COMPLETED",
    contractVersion: CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION,
    operationId: null,
    outputReference: buildJson({
      version: "0.19E4-persistence-checkpoint-output-v1",
      result: input.result,
    }),
    diagnostics: Object.freeze({
      projectId: input.result.projectId,
      scriptRevision: input.result.scriptRevision,
      invalidatedProduction: input.result.invalidatedProduction,
      acceptedAuthorityVersion: input.result.acceptedAuthorityVersion,
    }),
    startedAt: timestamp,
    completedAt: timestamp,
  };
}

function normalizePersistenceCheckpoint(input: {
  build: CreatorScriptBuildRecord;
  authority: CreatorScriptBuildAcceptedResultAuthority;
}) {
  const checkpoint = input.build.checkpoints.persistence || null;
  if (
    !checkpoint ||
    checkpoint.stage !== "persistence" ||
    checkpoint.status !== "COMPLETED" ||
    checkpoint.contractVersion !==
      CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION ||
    checkpoint.operationId !== null ||
    checkpoint.checkpointId !== createCreatorScriptBuildCheckpointId({
      buildId: input.build.buildId,
      stage: "persistence",
      contractVersion: CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION,
    })
  ) {
    throw new CreatorScriptBuildPersistenceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_INVALID",
    );
  }

  const envelope = record(checkpoint.outputReference);
  const raw = record(envelope?.result);
  const contracts = record(raw?.contractVersions);
  const invalidatedProduction = raw?.invalidatedProduction;
  const scriptRevision = Number(raw?.scriptRevision);
  const previousProjectRevision = clean(raw?.previousProjectRevision, 120);
  const installedProjectRevision = clean(raw?.installedProjectRevision, 120);

  if (
    envelope?.version !== "0.19E4-persistence-checkpoint-output-v1" ||
    raw?.version !== "0.19E4-persistence-result-v1" ||
    raw?.buildId !== input.build.buildId ||
    raw?.projectId !== input.build.projectId ||
    !previousProjectRevision ||
    !sameInstant(
      previousProjectRevision,
      input.build.snapshot.expectedProjectRevision,
    ) ||
    !installedProjectRevision ||
    !Number.isFinite(Date.parse(installedProjectRevision)) ||
    !Number.isInteger(scriptRevision) ||
    scriptRevision !== input.authority.acceptance.script.revision ||
    raw?.strategyFingerprint !== input.build.snapshot.strategyFingerprint ||
    typeof invalidatedProduction !== "boolean" ||
    raw?.acceptedAuthorityVersion !== input.authority.version ||
    contracts?.coordinator !== CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION ||
    contracts?.checkpoint !== CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_VERSION
  ) {
    throw new CreatorScriptBuildPersistenceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_INVALID",
    );
  }

  const normalized = createPersistenceResult({
    build: input.build,
    authority: input.authority,
    previousProjectRevision,
    installedProjectRevision,
    invalidatedProduction,
  });
  if (!equalCanonical(raw, normalized)) {
    throw new CreatorScriptBuildPersistenceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_PERSISTENCE_CHECKPOINT_INVALID",
    );
  }
  return normalized;
}

function validatePersistedProject(input: {
  build: CreatorScriptBuildRecord;
  project: VeltoProjectApiRecord;
  authority: CreatorScriptBuildAcceptedResultAuthority;
  persistence: CreatorScriptBuildPersistenceStageResult;
}) {
  assertCreatorProjectAuthority({
    build: input.build,
    project: input.project,
  });
  const revision = projectRevision(input.project);
  if (!sameInstant(revision, input.persistence.installedProjectRevision)) {
    throw new CreatorScriptBuildPersistenceError(
      "AUTHORITY",
      "CREATOR_SCRIPT_BUILD_PERSISTED_PROJECT_REVISION_MISMATCH",
    );
  }

  let state: CreatorProjectStateSnapshot;
  try {
    state = readCreatorProjectState(input.project);
  } catch {
    throw new CreatorScriptBuildPersistenceError(
      "INPUT",
      "CREATOR_SCRIPT_BUILD_PERSISTED_PROJECT_STATE_INVALID",
    );
  }
  if (
    state.strategy.strategyFingerprint !== input.build.snapshot.strategyFingerprint ||
    !state.strategy.script ||
    !equalCanonical(state.strategy.script, input.authority.acceptance.script) ||
    state.strategy.pendingRefinement != null ||
    (state.strategy.revisionHistory || []).length !== 0
  ) {
    throw new CreatorScriptBuildPersistenceError(
      "AUTHORITY",
      "CREATOR_SCRIPT_BUILD_PERSISTED_SCRIPT_MISMATCH",
    );
  }

  if (input.persistence.invalidatedProduction) {
    const legacyScenes = Array.isArray(input.project.scenes)
      ? input.project.scenes
      : [];
    const legacyRefinedScenes = Array.isArray(input.project.refined_creator_scenes)
      ? input.project.refined_creator_scenes
      : [];
    if (
      state.production.refinedScenes.length !== 0 ||
      state.createReview.scenes.length !== 0 ||
      state.publish.packageDownloaded ||
      state.publish.packageSignature !== "" ||
      state.publish.finalVideoUrl !== "" ||
      state.publish.finalVideoSignature !== "" ||
      legacyScenes.length !== 0 ||
      legacyRefinedScenes.length !== 0 ||
      clean(input.project.exported_movie_url, 10_000) !== "" ||
      clean(input.project.export_signature, 10_000) !== ""
    ) {
      throw new CreatorScriptBuildPersistenceError(
        "AUTHORITY",
        "CREATOR_SCRIPT_BUILD_PRODUCTION_INVALIDATION_INCOMPLETE",
      );
    }
  }
}

function assertCoordinatorContract(build: CreatorScriptBuildRecord) {
  if (
    build.snapshot.contractVersions.creatorScriptBuildPersistenceCoordinator !==
      CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_PERSISTENCE_CONTRACT_MISMATCH");
  }
}

async function resumePersisted(input: {
  build: CreatorScriptBuildRecord;
  dependencies: CreatorScriptBuildPersistenceCoordinatorDependencies;
}): Promise<CreatorScriptBuildPersistenceCoordinatorResult> {
  let authority: CreatorScriptBuildAcceptedResultAuthority;
  let persistence: CreatorScriptBuildPersistenceStageResult;
  try {
    authority = normalizeAcceptedAuthority(input.build);
    persistence = normalizePersistenceCheckpoint({
      build: input.build,
      authority,
    });
  } catch (error) {
    const code = error instanceof CreatorScriptBuildPersistenceError
      ? error.code
      : "CREATOR_SCRIPT_BUILD_PERSISTED_AUTHORITY_INVALID";
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code,
      buildId: input.build.buildId,
    });
  }

  const project = await input.dependencies.projectRepository.getForOwner(
    input.build.projectId,
    input.build.ownerId,
  );
  if (!project) {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_PERSISTED_PROJECT_MISSING",
      buildId: input.build.buildId,
    });
  }

  try {
    validatePersistedProject({
      build: input.build,
      project,
      authority,
      persistence,
    });
  } catch (error) {
    const code = error instanceof CreatorScriptBuildPersistenceError
      ? error.code
      : "CREATOR_SCRIPT_BUILD_PERSISTED_PROJECT_INVALID";
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code,
      buildId: input.build.buildId,
    });
  }

  return {
    version: CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION,
    build: input.build,
    project,
    persistence,
    disposition: "RESUMED",
  };
}

export async function runCreatorScriptBuildPersistenceCoordinator(input: {
  ownerId: string;
  buildId: string;
  dependencies: CreatorScriptBuildPersistenceCoordinatorDependencies;
}): Promise<CreatorScriptBuildPersistenceCoordinatorResult> {
  const now = input.dependencies.now || (() => new Date().toISOString());
  let build = await input.dependencies.buildRepository.getForOwner(
    input.buildId,
    input.ownerId,
  );
  if (!build) throw new Error("CREATOR_SCRIPT_BUILD_NOT_FOUND");
  assertCoordinatorContract(build);

  if (build.state === "PERSISTED") {
    return await resumePersisted({
      build,
      dependencies: input.dependencies,
    });
  }
  if (build.state !== "ACCEPTED") {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_PERSISTENCE_STATE_INVALID",
      buildId: build.buildId,
    });
  }

  let authority: CreatorScriptBuildAcceptedResultAuthority;
  try {
    authority = normalizeAcceptedAuthority(build);
  } catch (error) {
    const persistenceError = error instanceof CreatorScriptBuildPersistenceError
      ? error
      : new CreatorScriptBuildPersistenceError(
          "INPUT",
          "CREATOR_SCRIPT_BUILD_ACCEPTED_RESULT_AUTHORITY_INVALID",
        );
    return await failAcceptedBuild({
      repository: input.dependencies.buildRepository,
      build,
      category: persistenceError.category,
      code: persistenceError.code,
    });
  }

  const project = await input.dependencies.projectRepository.getForOwner(
    build.projectId,
    build.ownerId,
  );
  if (!project) {
    return await failAcceptedBuild({
      repository: input.dependencies.buildRepository,
      build,
      category: "AUTHORITY",
      code: "CREATOR_SCRIPT_BUILD_PROJECT_MISSING",
    });
  }

  try {
    assertCreatorProjectAuthority({ build, project });
  } catch (error) {
    const persistenceError = error instanceof CreatorScriptBuildPersistenceError
      ? error
      : new CreatorScriptBuildPersistenceError(
          "AUTHORITY",
          "CREATOR_SCRIPT_BUILD_PROJECT_AUTHORITY_INVALID",
        );
    return await failAcceptedBuild({
      repository: input.dependencies.buildRepository,
      build,
      category: persistenceError.category,
      code: persistenceError.code,
    });
  }

  let currentProjectRevision: string;
  try {
    currentProjectRevision = projectRevision(project);
  } catch (error) {
    const persistenceError = error instanceof CreatorScriptBuildPersistenceError
      ? error
      : new CreatorScriptBuildPersistenceError(
          "AUTHORITY",
          "CREATOR_SCRIPT_BUILD_PROJECT_REVISION_MISSING",
        );
    return await failAcceptedBuild({
      repository: input.dependencies.buildRepository,
      build,
      category: persistenceError.category,
      code: persistenceError.code,
    });
  }

  try {
    assertCreatorScriptBuildPersistenceAuthority({
      build,
      currentProjectRevision,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CREATOR_SCRIPT_BUILD_STALE"
    ) {
      return await staleAcceptedBuild({
        repository: input.dependencies.buildRepository,
        build,
      });
    }
    return await failAcceptedBuild({
      repository: input.dependencies.buildRepository,
      build,
      category: "AUTHORITY",
      code: "CREATOR_SCRIPT_BUILD_PERSISTENCE_AUTHORITY_INVALID",
    });
  }

  let installation: ReturnType<typeof createInstalledCreatorProjectState>;
  try {
    installation = createInstalledCreatorProjectState({
      project,
      build,
      authority,
    });
  } catch (error) {
    const persistenceError = error instanceof CreatorScriptBuildPersistenceError
      ? error
      : new CreatorScriptBuildPersistenceError(
          "INPUT",
          "CREATOR_SCRIPT_BUILD_PROJECT_INSTALLATION_INVALID",
        );
    return await failAcceptedBuild({
      repository: input.dependencies.buildRepository,
      build,
      category: persistenceError.category,
      code: persistenceError.code,
    });
  }

  let installedProjectRevision: string;
  try {
    installedProjectRevision = nextProjectRevision(
      now(),
      currentProjectRevision,
    );
  } catch (error) {
    const persistenceError = error instanceof CreatorScriptBuildPersistenceError
      ? error
      : new CreatorScriptBuildPersistenceError(
          "INPUT",
          "CREATOR_SCRIPT_BUILD_PROJECT_REVISION_INVALID",
        );
    return await failAcceptedBuild({
      repository: input.dependencies.buildRepository,
      build,
      category: persistenceError.category,
      code: persistenceError.code,
    });
  }

  const persistence = createPersistenceResult({
    build,
    authority,
    previousProjectRevision: currentProjectRevision,
    installedProjectRevision,
    invalidatedProduction: installation.invalidateProduction,
  });
  const checkpoint = createPersistenceCheckpoint({
    build,
    result: persistence,
  });

  let persisted;
  try {
    persisted = await input.dependencies.buildRepository.persistAccepted({
      ownerId: build.ownerId,
      buildId: build.buildId,
      expectedProjectRevision: currentProjectRevision,
      installedProjectRevision,
      creatorProjectState: buildJson(installation.next),
      invalidateProduction: installation.invalidateProduction,
      checkpoint,
    });
  } catch {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_PERSISTENCE_RECONCILIATION_REQUIRED",
      buildId: build.buildId,
    });
  }

  if (persisted.status === "STALE") {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
      buildId: persisted.build.buildId,
    });
  }

  build = persisted.build;
  if (
    build.state !== "PERSISTED" ||
    build.failure !== null ||
    build.resultAuthority === null
  ) {
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code: "CREATOR_SCRIPT_BUILD_PERSISTENCE_RESULT_INVALID",
      buildId: build.buildId,
    });
  }

  let normalizedAuthority: CreatorScriptBuildAcceptedResultAuthority;
  let normalizedPersistence: CreatorScriptBuildPersistenceStageResult;
  try {
    normalizedAuthority = normalizeAcceptedAuthority(build);
    normalizedPersistence = normalizePersistenceCheckpoint({
      build,
      authority: normalizedAuthority,
    });
    if (!equalCanonical(normalizedPersistence, persistence)) {
      throw new CreatorScriptBuildPersistenceError(
        "INPUT",
        "CREATOR_SCRIPT_BUILD_PERSISTENCE_RESULT_MISMATCH",
      );
    }
    validatePersistedProject({
      build,
      project: persisted.project,
      authority: normalizedAuthority,
      persistence: normalizedPersistence,
    });
  } catch (error) {
    const code = error instanceof CreatorScriptBuildPersistenceError
      ? error.code
      : "CREATOR_SCRIPT_BUILD_PERSISTENCE_RESULT_INVALID";
    throw new CreatorScriptBuildCoordinatorBlockedError({
      code,
      buildId: build.buildId,
    });
  }

  return {
    version: CREATOR_SCRIPT_BUILD_PERSISTENCE_COORDINATOR_VERSION,
    build,
    project: persisted.project,
    persistence: normalizedPersistence,
    disposition: "PERSISTED",
  };
}
