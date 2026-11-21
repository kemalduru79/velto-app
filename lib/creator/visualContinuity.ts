export const CREATOR_VISUAL_CONTINUITY_STORAGE_KEY =
  "velto:creator-visual-continuity:v1";

export type CreatorProjectContinuityMode =
  | "independent"
  | "consistent"
  | "selective";

export type CreatorSceneContinuityMode =
  | "project"
  | "independent"
  | "consistent"
  | "previous";

export type CreatorResolvedContinuityMode =
  | "independent"
  | "consistent"
  | "previous";

export type CreatorVisualContinuitySettings = {
  projectMode: CreatorProjectContinuityMode;
  sceneModes: Record<string, CreatorSceneContinuityMode>;
};

const PROJECT_MODES = new Set<CreatorProjectContinuityMode>([
  "independent",
  "consistent",
  "selective",
]);

const SCENE_MODES = new Set<CreatorSceneContinuityMode>([
  "project",
  "independent",
  "consistent",
  "previous",
]);

export function normalizeCreatorProjectContinuityMode(
  value: unknown,
): CreatorProjectContinuityMode {
  return PROJECT_MODES.has(value as CreatorProjectContinuityMode)
    ? (value as CreatorProjectContinuityMode)
    : "independent";
}

export function normalizeCreatorSceneContinuityMode(
  value: unknown,
): CreatorSceneContinuityMode {
  return SCENE_MODES.has(value as CreatorSceneContinuityMode)
    ? (value as CreatorSceneContinuityMode)
    : "project";
}

export function normalizeCreatorVisualContinuitySettings(
  value: unknown,
): CreatorVisualContinuitySettings {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const rawSceneModes =
    source.sceneModes && typeof source.sceneModes === "object"
      ? (source.sceneModes as Record<string, unknown>)
      : {};

  const sceneModes = Object.fromEntries(
    Object.entries(rawSceneModes).map(([sceneId, mode]) => [
      String(sceneId),
      normalizeCreatorSceneContinuityMode(mode),
    ]),
  );

  return {
    projectMode: normalizeCreatorProjectContinuityMode(source.projectMode),
    sceneModes,
  };
}

export function resolveCreatorVisualContinuityMode(input: {
  projectMode: CreatorProjectContinuityMode;
  sceneMode?: CreatorSceneContinuityMode;
  isFirstScene?: boolean;
}): CreatorResolvedContinuityMode {
  const sceneMode = normalizeCreatorSceneContinuityMode(input.sceneMode);

  if (sceneMode === "previous") {
    return input.isFirstScene ? "independent" : "previous";
  }

  if (sceneMode === "consistent") return "consistent";
  if (sceneMode === "independent") return "independent";

  return input.projectMode === "consistent"
    ? "consistent"
    : "independent";
}
