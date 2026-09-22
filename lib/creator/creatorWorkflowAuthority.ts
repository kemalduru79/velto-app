import type { CreatorScript } from "./creatorScript.ts";

export function normalizeCreatorTopicAuthority(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

export function getCreatorTopicAuthorityIdentity(value: unknown) {
  const normalized = normalizeCreatorTopicAuthority(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = Math.imul(hash ^ normalized.charCodeAt(index), 0x01000193);
  }
  return {
    length: normalized.length,
    hash: (hash >>> 0).toString(16).padStart(8, "0"),
  };
}

export type CreatorWorkflowLoadingState = {
  scriptGenerating: boolean;
  scenesBuilding: boolean;
};

export type CreatorScriptGenerationFlight = Readonly<{
  requestId: string;
  projectId: string;
  strategyFingerprint: string;
}>;

export type CreatorScriptGenerationFlightRef = {
  current: CreatorScriptGenerationFlight | null;
};

export function beginCreatorScriptGenerationFlight(
  ref: CreatorScriptGenerationFlightRef,
  flight: CreatorScriptGenerationFlight,
) {
  if (ref.current) return false;
  ref.current = Object.freeze({ ...flight });
  return true;
}

export function finishCreatorScriptGenerationFlight(
  ref: CreatorScriptGenerationFlightRef,
  requestId: string,
) {
  if (ref.current?.requestId !== requestId) return false;
  ref.current = null;
  return true;
}

export function shouldRestoreCreatorBriefDraft(input: {
  isCreatorLabFlow: boolean;
  currentProjectId: string;
  requestedProjectId: string;
}) {
  return input.isCreatorLabFlow
    && !input.currentProjectId.trim()
    && !input.requestedProjectId.trim();
}

export function startCreatorNewProjectLifecycle(input: {
  clearBriefDraft: () => void;
  clearProjectUrl: () => void;
  remountWorkspace: () => void;
}) {
  input.clearBriefDraft();
  input.clearProjectUrl();
  input.remountWorkspace();
}

export function classifyCreatorProjectSaveError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/changed|PROJECT_SAVE_CONFLICT/i.test(message)) return "cas_conflict" as const;
  if (/session|auth|Unauthorized/i.test(message)) return "authentication" as const;
  if (/not found|owned/i.test(message)) return "project_identity" as const;
  if (/required|zorunlu|invalid/i.test(message)) return "validation" as const;
  return "persistence_failure" as const;
}

export function assessCreatorScriptGenerationAuthority(input: {
  submitted: {
    projectId: string;
    expectedUpdatedAt: string;
    topic: string;
    language: "tr" | "en";
    durationSec: number;
    strategyFingerprint: string;
    selectedDirectionId: string;
    selectedHook: string;
  };
  persisted: {
    projectId: string;
    updatedAt: string;
    topic: string;
    language: "tr" | "en";
    durationSec: number;
    strategyFingerprint: string;
    selectedDirectionId: string;
    selectedHook: string;
  };
}) {
  const submittedTopic = normalizeCreatorTopicAuthority(input.submitted.topic);
  const persistedTopic = normalizeCreatorTopicAuthority(input.persisted.topic);
  const matches = {
    project: input.submitted.projectId === input.persisted.projectId,
    revision: input.submitted.expectedUpdatedAt === input.persisted.updatedAt,
    topic: submittedTopic === persistedTopic,
    language: input.submitted.language === input.persisted.language,
    duration: input.submitted.durationSec === input.persisted.durationSec,
    strategyFingerprint: input.submitted.strategyFingerprint === input.persisted.strategyFingerprint,
    selectedDirection: input.submitted.selectedDirectionId === input.persisted.selectedDirectionId,
    selectedHook: input.submitted.selectedHook === input.persisted.selectedHook,
  };
  return { current: Object.values(matches).every(Boolean), matches };
}

export type CreatorScriptReplacementState = {
  script: CreatorScript;
  productionPackage: null;
  refinedScenes: [];
  scenes: [];
  timelinePreviewPlan: null;
  editPlan: null;
  exportedMovieUrl: "";
  exportMovieResult: null;
  exportSignature: "";
  packageDownloaded: false;
  packageSignature: "";
  resetReleaseConfirmations: true;
};

export function createCreatorScriptReplacementState(
  script: CreatorScript,
): CreatorScriptReplacementState {
  return {
    script,
    productionPackage: null,
    refinedScenes: [],
    scenes: [],
    timelinePreviewPlan: null,
    editPlan: null,
    exportedMovieUrl: "",
    exportMovieResult: null,
    exportSignature: "",
    packageDownloaded: false,
    packageSignature: "",
    resetReleaseConfirmations: true,
  };
}

export async function persistCreatorScriptReplacement(input: {
  script: CreatorScript;
  persist: () => Promise<void>;
  advanceAuthority: () => boolean;
  isActive: () => boolean;
}) {
  await input.persist();
  if (!input.advanceAuthority() || !input.isActive()) return null;
  return createCreatorScriptReplacementState(input.script);
}

export async function persistCreatorStrategyAuthority(input: {
  persist: () => Promise<void>;
  advanceAuthority: () => boolean;
  isActive: () => boolean;
}) {
  await input.persist();
  return input.advanceAuthority() && input.isActive();
}

export function getCreatorWorkflowLoadingState(input: {
  operation: "idle" | "script" | "scenes";
}): CreatorWorkflowLoadingState {
  return {
    scriptGenerating: input.operation === "script",
    scenesBuilding: input.operation === "scenes",
  };
}
