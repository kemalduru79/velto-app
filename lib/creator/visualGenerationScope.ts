export type CreatorVisualGenerationMode = "single" | "selected" | "project";

export class CreatorVisualGenerationScopeError extends Error {
  constructor(message = "CREATOR_VISUAL_GENERATION_SCOPE_INVALID") {
    super(message);
    this.name = "CreatorVisualGenerationScopeError";
  }
}

export function resolveCreatorVisualGenerationScope(input: {
  mode: CreatorVisualGenerationMode;
  requestedSceneIds: readonly number[];
  availableSceneIds: readonly number[];
}) {
  const available = new Set(input.availableSceneIds);
  const requested = input.requestedSceneIds.map(Number);
  if (
    requested.length === 0 ||
    requested.some((id) => !Number.isInteger(id) || !available.has(id)) ||
    new Set(requested).size !== requested.length
  ) {
    throw new CreatorVisualGenerationScopeError();
  }
  if (input.mode === "single" && requested.length !== 1) {
    throw new CreatorVisualGenerationScopeError("CREATOR_SINGLE_VISUAL_SCOPE_INVALID");
  }
  return Object.freeze({
    mode: input.mode,
    sceneIds: Object.freeze([...requested]),
  });
}

export function assertCreatorVisualExecutionScope(input: {
  admission: ReturnType<typeof resolveCreatorVisualGenerationScope>;
  executionSceneIds: readonly number[];
}) {
  const execution = input.executionSceneIds.map(Number);
  if (
    execution.length !== input.admission.sceneIds.length ||
    execution.some((id, index) => id !== input.admission.sceneIds[index])
  ) {
    throw new CreatorVisualGenerationScopeError();
  }
  if (input.admission.mode === "single" && execution.length !== 1) {
    throw new CreatorVisualGenerationScopeError("CREATOR_SINGLE_VISUAL_SCOPE_INVALID");
  }
  return true;
}
