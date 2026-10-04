import { createHash } from "node:crypto";

export const CREATOR_SCRIPT_BUILD_CONTRACT_VERSION = "0.19E1" as const;
export const CREATOR_SCRIPT_BUILD_SNAPSHOT_VERSION =
  "creator-script-build-snapshot-v1" as const;
export const CREATOR_SCRIPT_BUILD_IDEMPOTENCY_VERSION =
  "creator-script-build-idempotency-v1" as const;
export const CREATOR_SCRIPT_BUILD_CHECKPOINT_IDENTITY_VERSION =
  "creator-script-build-checkpoint-v1" as const;
export const CREATOR_SCRIPT_BUILD_OPERATION_IDENTITY_VERSION =
  "creator-script-build-operation-v1" as const;

export type CreatorScriptBuildState =
  | "REQUESTED"
  | "SNAPSHOTTED"
  | "RESEARCH_READY"
  | "EDITORIAL_COMPILED"
  | "AUTHORITY_RESOLVED"
  | "SCRIPT_GENERATED"
  | "REPAIRING"
  | "ACCEPTED"
  | "PERSISTED"
  | "FAILED"
  | "STALE";

export type CreatorScriptBuildFailureCategory =
  | "INPUT"
  | "AUTHORITY"
  | "RESEARCH"
  | "PROVIDER"
  | "MODEL_CONTRACT"
  | "GROUNDING"
  | "EDITORIAL_POLICY"
  | "SCRIPT_POLICY"
  | "INTERNAL";

export type CreatorScriptBuildCheckpointStage =
  | "research"
  | "editorial"
  | "authority"
  | "script_generation"
  | "repair"
  | "acceptance"
  | "persistence";

export type CreatorScriptBuildFailureStage =
  | "request"
  | "snapshot"
  | CreatorScriptBuildCheckpointStage;

export type CreatorScriptBuildCheckpointStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type CreatorScriptBuildOperationState =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "OUTCOME_UNCERTAIN";

export type CreatorScriptBuildJsonPrimitive = string | number | boolean | null;
export type CreatorScriptBuildJson =
  | CreatorScriptBuildJsonPrimitive
  | CreatorScriptBuildJson[]
  | { [key: string]: CreatorScriptBuildJson };

export type CreatorScriptBuildContractVersions = Readonly<Record<string, string>>;

export type CreatorScriptBuildSnapshot = Readonly<{
  snapshotVersion: typeof CREATOR_SCRIPT_BUILD_SNAPSHOT_VERSION;
  projectId: string;
  expectedProjectRevision: string;
  strategyFingerprint: string;
  language: "tr" | "en";
  requestedDurationSeconds: number;
  strategy: Readonly<{
    topic: string;
    researchSubject: string | null;
    title: string;
    contentType: string;
    format: string;
    selectedDirectionId: string;
    selectedHook: string;
    approvedStrategy: Readonly<Record<string, CreatorScriptBuildJson>>;
  }>;
  creatorProfile: Readonly<Record<string, CreatorScriptBuildJson>>;
  contractVersions: CreatorScriptBuildContractVersions;
}>;

export type CreatorScriptBuildFailure = Readonly<{
  category: CreatorScriptBuildFailureCategory;
  code: string;
  stage: CreatorScriptBuildFailureStage;
  retryability: "RETRYABLE" | "NON_RETRYABLE" | "UNKNOWN_OUTCOME";
  operationId: string | null;
  diagnostics: Readonly<Record<string, CreatorScriptBuildJsonPrimitive>>;
}>;

export type CreatorScriptBuildCheckpoint = Readonly<{
  checkpointId: string;
  stage: CreatorScriptBuildCheckpointStage;
  status: CreatorScriptBuildCheckpointStatus;
  contractVersion: string;
  operationId: string | null;
  outputReference: CreatorScriptBuildJson | null;
  diagnostics: Readonly<Record<string, CreatorScriptBuildJsonPrimitive>>;
  startedAt: string | null;
  completedAt: string | null;
}>;

export type CreatorScriptBuildRecord = Readonly<{
  buildId: string;
  ownerId: string;
  projectId: string;
  idempotencyKey: string;
  state: CreatorScriptBuildState;
  snapshot: CreatorScriptBuildSnapshot;
  checkpoints: Readonly<Partial<Record<CreatorScriptBuildCheckpointStage, CreatorScriptBuildCheckpoint>>>;
  failure: CreatorScriptBuildFailure | null;
  resultAuthority: CreatorScriptBuildJson | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CreatorScriptBuildOperation = Readonly<{
  operationId: string;
  buildId: string;
  ownerId: string;
  stage: CreatorScriptBuildCheckpointStage;
  operationType: string;
  semanticFingerprint: string;
  contractVersion: string;
  state: CreatorScriptBuildOperationState;
  resultReference: CreatorScriptBuildJson | null;
  failure: CreatorScriptBuildFailure | null;
  createdAt: string;
  updatedAt: string;
}>;

const TERMINAL_BUILD_STATES = new Set<CreatorScriptBuildState>([
  "PERSISTED",
  "FAILED",
  "STALE",
]);

function freezeCreatorScriptBuildStates(
  ...states: CreatorScriptBuildState[]
): readonly CreatorScriptBuildState[] {
  return Object.freeze(states);
}

export const CREATOR_SCRIPT_BUILD_TRANSITIONS: Readonly<
  Record<CreatorScriptBuildState, readonly CreatorScriptBuildState[]>
> = Object.freeze({
  REQUESTED: freezeCreatorScriptBuildStates("SNAPSHOTTED", "FAILED", "STALE"),
  SNAPSHOTTED: freezeCreatorScriptBuildStates("RESEARCH_READY", "FAILED", "STALE"),
  RESEARCH_READY: freezeCreatorScriptBuildStates("EDITORIAL_COMPILED", "FAILED", "STALE"),
  EDITORIAL_COMPILED: freezeCreatorScriptBuildStates("AUTHORITY_RESOLVED", "FAILED", "STALE"),
  AUTHORITY_RESOLVED: freezeCreatorScriptBuildStates("SCRIPT_GENERATED", "FAILED", "STALE"),
  SCRIPT_GENERATED: freezeCreatorScriptBuildStates("REPAIRING", "ACCEPTED", "FAILED", "STALE"),
  REPAIRING: freezeCreatorScriptBuildStates("ACCEPTED", "FAILED", "STALE"),
  ACCEPTED: freezeCreatorScriptBuildStates("PERSISTED", "FAILED", "STALE"),
  PERSISTED: freezeCreatorScriptBuildStates(),
  FAILED: freezeCreatorScriptBuildStates(),
  STALE: freezeCreatorScriptBuildStates(),
});

function requireText(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`CREATOR_SCRIPT_BUILD_${field.toUpperCase()}_REQUIRED`);
  }
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length > max) {
    throw new Error(`CREATOR_SCRIPT_BUILD_${field.toUpperCase()}_TOO_LONG`);
  }
  return normalized;
}

function normalizeOptionalText(value: unknown, field: string, max: number) {
  if (value == null || value === "") return null;
  return requireText(value, field, max);
}

function normalizeJson(value: unknown, path = "value"): CreatorScriptBuildJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`CREATOR_SCRIPT_BUILD_JSON_INVALID:${path}`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeJson(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`CREATOR_SCRIPT_BUILD_JSON_INVALID:${path}`);
  }
  const output: Record<string, CreatorScriptBuildJson> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    if (!key.trim()) throw new Error(`CREATOR_SCRIPT_BUILD_JSON_KEY_INVALID:${path}`);
    output[key] = normalizeJson((value as Record<string, unknown>)[key], `${path}.${key}`);
  }
  return output;
}

function jsonObject(value: unknown, field: string) {
  const normalized = normalizeJson(value, field);
  if (!normalized || Array.isArray(normalized) || typeof normalized !== "object") {
    throw new Error(`CREATOR_SCRIPT_BUILD_${field.toUpperCase()}_INVALID`);
  }
  return normalized as Record<string, CreatorScriptBuildJson>;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function canonicalCreatorScriptBuildJson(value: unknown) {
  return JSON.stringify(normalizeJson(value));
}

function digest(identityVersion: string, value: unknown) {
  return `${identityVersion}:${createHash("sha256")
    .update(canonicalCreatorScriptBuildJson(value), "utf8")
    .digest("hex")}`;
}

function normalizeContractVersions(value: unknown): CreatorScriptBuildContractVersions {
  const source = jsonObject(value, "contractVersions");
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(source).sort()) {
    const normalizedKey = requireText(key, "contractVersionKey", 80);
    normalized[normalizedKey] = requireText(source[key], "contractVersion", 120);
  }
  if (Object.keys(normalized).length === 0) {
    throw new Error("CREATOR_SCRIPT_BUILD_CONTRACT_VERSIONS_REQUIRED");
  }
  return deepFreeze(normalized);
}

export const CREATOR_SCRIPT_BUILD_TOPIC_MAX_CHARS = 20_000 as const;

export function createCreatorScriptBuildSnapshot(input: {
  projectId: string;
  expectedProjectRevision: string;
  strategyFingerprint: string;
  language: "tr" | "en";
  requestedDurationSeconds: number;
  strategy: {
    topic: string;
    researchSubject?: string | null;
    title: string;
    contentType: string;
    format: string;
    selectedDirectionId: string;
    selectedHook: string;
    approvedStrategy: Record<string, unknown>;
  };
  creatorProfile: Record<string, unknown>;
  contractVersions: Record<string, string>;
}): CreatorScriptBuildSnapshot {
  if (input.language !== "tr" && input.language !== "en") {
    throw new Error("CREATOR_SCRIPT_BUILD_LANGUAGE_INVALID");
  }
  if (
    !Number.isInteger(input.requestedDurationSeconds)
    || input.requestedDurationSeconds < 1
    || input.requestedDurationSeconds > 86_400
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_DURATION_INVALID");
  }
  return deepFreeze({
    snapshotVersion: CREATOR_SCRIPT_BUILD_SNAPSHOT_VERSION,
    projectId: requireText(input.projectId, "projectId", 120),
    expectedProjectRevision: requireText(input.expectedProjectRevision, "expectedProjectRevision", 120),
    strategyFingerprint: requireText(input.strategyFingerprint, "strategyFingerprint", 256),
    language: input.language,
    requestedDurationSeconds: input.requestedDurationSeconds,
    strategy: {
      topic: requireText(
      input.strategy.topic,
      "topic",
      CREATOR_SCRIPT_BUILD_TOPIC_MAX_CHARS,
    ),
      researchSubject: normalizeOptionalText(input.strategy.researchSubject, "researchSubject", 2_000),
      title: requireText(input.strategy.title, "title", 1_000),
      contentType: requireText(input.strategy.contentType, "contentType", 160),
      format: requireText(input.strategy.format, "format", 160),
      selectedDirectionId: requireText(input.strategy.selectedDirectionId, "selectedDirectionId", 240),
      selectedHook: requireText(input.strategy.selectedHook, "selectedHook", 2_000),
      approvedStrategy: jsonObject(input.strategy.approvedStrategy, "approvedStrategy"),
    },
    creatorProfile: jsonObject(input.creatorProfile, "creatorProfile"),
    contractVersions: normalizeContractVersions(input.contractVersions),
  });
}

export function createCreatorScriptBuildIdempotencyKey(input: {
  ownerId: string;
  snapshot: CreatorScriptBuildSnapshot;
}) {
  return digest(CREATOR_SCRIPT_BUILD_IDEMPOTENCY_VERSION, {
    ownerId: requireText(input.ownerId, "ownerId", 120),
    snapshot: input.snapshot,
  });
}

export function createCreatorScriptBuildCheckpointId(input: {
  buildId: string;
  stage: CreatorScriptBuildCheckpointStage;
  contractVersion: string;
}) {
  return digest(CREATOR_SCRIPT_BUILD_CHECKPOINT_IDENTITY_VERSION, {
    buildId: requireText(input.buildId, "buildId", 120),
    stage: input.stage,
    contractVersion: requireText(input.contractVersion, "checkpointContractVersion", 120),
  });
}

export function assertCreatorScriptBuildCheckpointIdentity(input: {
  buildId: string;
  checkpoint: Pick<
    CreatorScriptBuildCheckpoint,
    "checkpointId" | "stage" | "contractVersion"
  >;
}) {
  const expected = createCreatorScriptBuildCheckpointId({
    buildId: input.buildId,
    stage: input.checkpoint.stage,
    contractVersion: input.checkpoint.contractVersion,
  });
  if (input.checkpoint.checkpointId !== expected) {
    throw new Error("CREATOR_SCRIPT_BUILD_CHECKPOINT_IDENTITY_INVALID");
  }
}

export function createCreatorScriptBuildOperationId(input: {
  buildId: string;
  stage: CreatorScriptBuildCheckpointStage;
  operationType: string;
  semanticFingerprint: string;
  contractVersion: string;
}) {
  return digest(CREATOR_SCRIPT_BUILD_OPERATION_IDENTITY_VERSION, {
    buildId: requireText(input.buildId, "buildId", 120),
    stage: input.stage,
    operationType: requireText(input.operationType, "operationType", 160),
    semanticFingerprint: requireText(input.semanticFingerprint, "semanticFingerprint", 256),
    contractVersion: requireText(input.contractVersion, "operationContractVersion", 120),
  });
}

function freezeCreatorScriptBuildOperationStates(
  ...states: CreatorScriptBuildOperationState[]
): readonly CreatorScriptBuildOperationState[] {
  return Object.freeze(states);
}

export const CREATOR_SCRIPT_BUILD_OPERATION_TRANSITIONS: Readonly<
  Record<CreatorScriptBuildOperationState, readonly CreatorScriptBuildOperationState[]>
> = Object.freeze({
  PENDING: freezeCreatorScriptBuildOperationStates("COMPLETED", "FAILED", "OUTCOME_UNCERTAIN"),
  COMPLETED: freezeCreatorScriptBuildOperationStates(),
  FAILED: freezeCreatorScriptBuildOperationStates(),
  OUTCOME_UNCERTAIN: freezeCreatorScriptBuildOperationStates("COMPLETED", "FAILED"),
});

export function creatorScriptBuildOperationCanTransition(
  from: CreatorScriptBuildOperationState,
  to: CreatorScriptBuildOperationState,
) {
  return CREATOR_SCRIPT_BUILD_OPERATION_TRANSITIONS[from].includes(to);
}

export function assertCreatorScriptBuildOperationTransition(
  from: CreatorScriptBuildOperationState,
  to: CreatorScriptBuildOperationState,
) {
  if (!creatorScriptBuildOperationCanTransition(from, to)) {
    throw new Error(`CREATOR_SCRIPT_BUILD_OPERATION_TRANSITION_INVALID:${from}:${to}`);
  }
}

export function creatorScriptBuildCanTransition(
  from: CreatorScriptBuildState,
  to: CreatorScriptBuildState,
) {
  return CREATOR_SCRIPT_BUILD_TRANSITIONS[from].includes(to);
}

export function assertCreatorScriptBuildTransition(
  from: CreatorScriptBuildState,
  to: CreatorScriptBuildState,
) {
  if (!creatorScriptBuildCanTransition(from, to)) {
    throw new Error(`CREATOR_SCRIPT_BUILD_TRANSITION_INVALID:${from}:${to}`);
  }
}

export function creatorScriptBuildIsTerminal(state: CreatorScriptBuildState) {
  return TERMINAL_BUILD_STATES.has(state);
}

export function assertCreatorScriptBuildSnapshotUnchanged(input: {
  current: CreatorScriptBuildSnapshot;
  next: CreatorScriptBuildSnapshot;
}) {
  if (
    canonicalCreatorScriptBuildJson(input.current)
    !== canonicalCreatorScriptBuildJson(input.next)
  ) {
    throw new Error("CREATOR_SCRIPT_BUILD_SNAPSHOT_IMMUTABLE");
  }
}

export function creatorScriptBuildIsStale(input: {
  snapshot: CreatorScriptBuildSnapshot;
  currentProjectRevision: string;
}) {
  return input.snapshot.expectedProjectRevision !== input.currentProjectRevision.trim();
}

export function assertCreatorScriptBuildPersistenceAuthority(input: {
  build: Pick<CreatorScriptBuildRecord, "state" | "snapshot">;
  currentProjectRevision: string;
}) {
  if (input.build.state !== "ACCEPTED") {
    throw new Error("CREATOR_SCRIPT_BUILD_NOT_ACCEPTED");
  }
  if (creatorScriptBuildIsStale({
    snapshot: input.build.snapshot,
    currentProjectRevision: input.currentProjectRevision,
  })) {
    throw new Error("CREATOR_SCRIPT_BUILD_STALE");
  }
}

export type CreatorScriptBuildDuplicateResolution =
  | "REUSE_IN_PROGRESS"
  | "REUSE_PERSISTED"
  | "REUSE_FAILED"
  | "REUSE_STALE";

export function resolveCreatorScriptBuildDuplicate(
  build: Pick<CreatorScriptBuildRecord, "state">,
): CreatorScriptBuildDuplicateResolution {
  if (build.state === "PERSISTED") return "REUSE_PERSISTED";
  if (build.state === "FAILED") return "REUSE_FAILED";
  if (build.state === "STALE") return "REUSE_STALE";
  return "REUSE_IN_PROGRESS";
}

function normalizeBoundedDiagnostics(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const entries = Object.entries(source).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length > 24) throw new Error("CREATOR_SCRIPT_BUILD_DIAGNOSTICS_TOO_LARGE");
  const output: Record<string, CreatorScriptBuildJsonPrimitive> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = requireText(rawKey, "diagnosticKey", 64);
    if (rawValue == null || typeof rawValue === "boolean") output[key] = rawValue ?? null;
    else if (typeof rawValue === "number" && Number.isFinite(rawValue)) output[key] = rawValue;
    else if (typeof rawValue === "string") output[key] = rawValue.replace(/\s+/gu, " ").trim().slice(0, 240);
    else throw new Error(`CREATOR_SCRIPT_BUILD_DIAGNOSTIC_INVALID:${key}`);
  }
  return deepFreeze(output);
}

export function createCreatorScriptBuildFailure(input: {
  category: CreatorScriptBuildFailureCategory;
  code: string;
  stage: CreatorScriptBuildFailureStage;
  retryability: CreatorScriptBuildFailure["retryability"];
  operationId?: string | null;
  diagnostics?: Record<string, unknown>;
}): CreatorScriptBuildFailure {
  return deepFreeze({
    category: input.category,
    code: requireText(input.code, "failureCode", 120),
    stage: input.stage,
    retryability: input.retryability,
    operationId: normalizeOptionalText(input.operationId, "operationId", 160),
    diagnostics: normalizeBoundedDiagnostics(input.diagnostics),
  });
}

export function serializeCreatorScriptBuildFailure(failure: CreatorScriptBuildFailure) {
  return canonicalCreatorScriptBuildJson(failure);
}

export function creatorScriptBuildOperationIsReusable(
  operation: Pick<CreatorScriptBuildOperation, "state" | "resultReference">,
) {
  return operation.state === "COMPLETED" && operation.resultReference !== null;
}
