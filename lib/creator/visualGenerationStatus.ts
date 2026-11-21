export type CreatorVisualGenerationPhase = "idle" | "countdown" | "processing";

export function isCreatorSceneVisualCountdown(input: {
  sceneId: number;
  countdownSceneIds: readonly number[];
}) {
  return input.countdownSceneIds.includes(input.sceneId);
}

export function isCreatorSceneVisualGenerating(input: {
  sceneId: number;
  phase: CreatorVisualGenerationPhase;
  admittedSceneIds: readonly number[];
  processingSceneIds: readonly number[];
}) {
  if (input.phase !== "processing") return false;
  return input.admittedSceneIds.includes(input.sceneId) &&
    input.processingSceneIds.includes(input.sceneId);
}

export function isCreatorSceneVisualActionBlocked(input: {
  sceneId: number;
  countdownSceneIds: readonly number[];
  phase: CreatorVisualGenerationPhase;
  admittedSceneIds: readonly number[];
  processingSceneIds: readonly number[];
}) {
  return isCreatorSceneVisualCountdown(input) ||
    isCreatorSceneVisualGenerating(input);
}

export function getCreatorGeneratingSceneIds(input: {
  phase: CreatorVisualGenerationPhase;
  admittedSceneIds: readonly number[];
  processingSceneIds: readonly number[];
}) {
  return Object.freeze(input.admittedSceneIds.filter((sceneId) =>
    isCreatorSceneVisualGenerating({ sceneId, ...input })
  ));
}
