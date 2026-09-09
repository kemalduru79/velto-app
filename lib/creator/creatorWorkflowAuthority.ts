import type { CreatorScript } from "./creatorScript.ts";

export type CreatorWorkflowLoadingState = {
  scriptGenerating: boolean;
  scenesBuilding: boolean;
};

export function shouldRestoreCreatorBriefDraft(input: {
  isCreatorLabFlow: boolean;
  currentProjectId: string;
  requestedProjectId: string;
}) {
  return input.isCreatorLabFlow
    && !input.currentProjectId.trim()
    && !input.requestedProjectId.trim();
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

export function getCreatorWorkflowLoadingState(input: {
  operation: "idle" | "script" | "scenes";
}): CreatorWorkflowLoadingState {
  return {
    scriptGenerating: input.operation === "script",
    scenesBuilding: input.operation === "scenes",
  };
}
