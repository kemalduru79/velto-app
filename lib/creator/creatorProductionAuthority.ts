import {
  canBuildScenesFromCreatorScript,
  CreatorScriptDurationUnsatisfiedError,
  getCreatorScriptDurationContractForScript,
  type CreatorScript,
} from "./creatorScript.ts";
import {
  isValidCreatorProjectState,
  readCreatorProjectState,
} from "./projectState.ts";

type PersistedProjectRecord = Record<string, unknown> & { id?: unknown };

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

/**
 * Resolves scene-build authority exclusively from an owner-scoped persisted
 * project record. The client supplies only the revision it intends to build.
 */
export function resolvePersistedCreatorScriptAuthority(input: {
  persistedProject: PersistedProjectRecord | null;
  requestedRevision: unknown;
}): CreatorScript {
  const project = input.persistedProject;
  if (!project || project.flow_type !== "creator_lab") {
    throw new Error("CREATOR_SCRIPT_PROJECT_NOT_FOUND");
  }
  const exportResult = record(project.exported_movie_result);
  const snapshot = exportResult?.creatorProjectState;
  if (!isValidCreatorProjectState(snapshot)) {
    throw new Error("CREATOR_SCRIPT_SNAPSHOT_INVALID");
  }
  const state = readCreatorProjectState(project);
  const persistedScript = state.strategy.script;
  if (!persistedScript) throw new Error("CREATOR_SCRIPT_APPROVAL_REQUIRED");
  if (!canBuildScenesFromCreatorScript(persistedScript, state.strategy.strategyFingerprint || persistedScript.strategyFingerprint)) {
    throw new Error("CREATOR_SCRIPT_APPROVAL_REQUIRED");
  }
  if (!Number.isInteger(input.requestedRevision) || Number(input.requestedRevision) !== persistedScript.revision) throw new Error("CREATOR_SCRIPT_APPROVAL_STALE");
  return persistedScript;
}

export function assertCreatorScriptSceneBuildDuration(input: {
  script: CreatorScript;
  language: "tr" | "en";
  requestedDurationSec: number;
}) {
  const diagnostics = getCreatorScriptDurationContractForScript(input.script, input.language);
  if (
    input.script.targetDurationSec !== input.requestedDurationSec
    || diagnostics.status !== "compliant"
  ) {
    throw new CreatorScriptDurationUnsatisfiedError(diagnostics);
  }
  return diagnostics;
}
