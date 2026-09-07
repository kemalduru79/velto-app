import {
  canBuildScenesFromCreatorScript,
  normalizeCreatorScript,
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

const scriptIdentity = (script: CreatorScript) => JSON.stringify({
  version: script.version,
  revision: script.revision,
  strategyFingerprint: script.strategyFingerprint,
  approval: script.approval,
  sections: script.sections.map((section) => ({
    id: section.id,
    kind: section.kind,
    heading: section.heading || "",
    text: section.text,
    claimIds: section.claimIds,
    evidenceReviewRequired: section.evidenceReviewRequired,
  })),
});

/**
 * Resolves scene-build authority exclusively from an owner-scoped persisted
 * project record. The submitted script is only a concurrency/content assertion.
 */
export function resolvePersistedCreatorScriptAuthority(input: {
  persistedProject: PersistedProjectRecord | null;
  submittedScript: unknown;
  submittedStrategyFingerprint: unknown;
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
  const persistedScript = readCreatorProjectState(project).strategy.script;
  if (!persistedScript) throw new Error("CREATOR_SCRIPT_APPROVAL_REQUIRED");
  const fingerprint = typeof input.submittedStrategyFingerprint === "string"
    ? input.submittedStrategyFingerprint.trim()
    : "";
  if (!canBuildScenesFromCreatorScript(persistedScript, fingerprint)) {
    throw new Error("CREATOR_SCRIPT_APPROVAL_REQUIRED");
  }
  const submittedScript = normalizeCreatorScript(input.submittedScript);
  if (scriptIdentity(submittedScript) !== scriptIdentity(persistedScript)) {
    throw new Error("CREATOR_SCRIPT_PERSISTED_MISMATCH");
  }
  return persistedScript;
}
