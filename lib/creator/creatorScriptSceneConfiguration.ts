import { validateCreatorScriptGenerationDuration } from "./creatorScript.ts";

// Retained legacy adapter bounds, now explicit refusals rather than clamps.
// These are NOT platform or independently qualified provider capabilities.
export const CREATOR_SOURCE_SCENE_ADAPTER_MAX_SCENES = 36;

export class CreatorSourceSceneConfigurationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "CreatorSourceSceneConfigurationError";
  }
}

export function resolveCreatorSourceSceneConfiguration(input: {
  requestedDurationSec: unknown;
  packageDurationSec: unknown;
  requestedSceneCount: unknown;
  sourceSceneCount: number;
  format: string;
}) {
  const count = input.requestedSceneCount === undefined
    ? (input.sourceSceneCount || 1)
    : input.requestedSceneCount;
  if (
    typeof count !== "number" || !Number.isSafeInteger(count) || count < 1 ||
    count > CREATOR_SOURCE_SCENE_ADAPTER_MAX_SCENES ||
    input.sourceSceneCount > CREATOR_SOURCE_SCENE_ADAPTER_MAX_SCENES
  ) {
    throw new CreatorSourceSceneConfigurationError(
      "CREATOR_SCENE_COUNT_OUTSIDE_ADAPTER_BOUNDARY",
      "This legacy source-scene adapter supports 1–36 scenes. The request was not truncated; no provider was called.",
    );
  }
  if (input.sourceSceneCount > 0 && count !== input.sourceSceneCount) {
    throw new CreatorSourceSceneConfigurationError(
      "CREATOR_SOURCE_SCENE_COUNT_MISMATCH",
      "Requested scene count must preserve the complete supplied source sequence.",
    );
  }
  const requested = input.requestedDurationSec === undefined
    ? (input.packageDurationSec === undefined ? count * 10 : input.packageDurationSec)
    : input.requestedDurationSec;
  let durationSec: number;
  try {
    durationSec = validateCreatorScriptGenerationDuration(requested);
  } catch {
    throw new CreatorSourceSceneConfigurationError(
      "CREATOR_SCRIPT_DURATION_INVALID",
      "Requested duration exceeds the existing generation contract or is invalid. It was not clamped.",
    );
  }
  const minimumSceneDuration = input.format === "youtube_video" ? 7 : 3;
  const maximumSceneDuration = 30;
  if (
    durationSec < count * minimumSceneDuration ||
    durationSec > count * maximumSceneDuration
  ) {
    throw new CreatorSourceSceneConfigurationError(
      "CREATOR_SOURCE_SCENE_TIMING_UNREPRESENTABLE",
      "This duration and scene count cannot fit the legacy adapter's current scene timing envelope. No duration was shortened. This is an adapter constraint, not a platform duration limit.",
    );
  }
  return { durationSec, sceneCount: count };
}

/** Remove rounding drift without changing the requested total or scene bounds. */
export function reconcileCreatorSceneDurations(
  values: number[], target: number, minimum: number, maximum: number,
) {
  const result = [...values];
  let difference = target - result.reduce((a, b) => a + b, 0);
  for (let i = result.length - 1; i >= 0 && Math.abs(difference) > 1e-8; i--) {
    const adjustment = difference > 0
      ? Math.min(difference, maximum - result[i])
      : Math.max(difference, minimum - result[i]);
    result[i] += adjustment;
    difference -= adjustment;
  }
  if (
    result.some(n => !Number.isFinite(n) || n < minimum - 1e-8 || n > maximum + 1e-8) ||
    Math.abs(target - result.reduce((a, b) => a + b, 0)) > 1e-7
  ) {
    throw new CreatorSourceSceneConfigurationError(
      "CREATOR_SOURCE_SCENE_TIMING_UNREPRESENTABLE",
      "The existing scene allocator cannot preserve the requested timing. No provider was called.",
    );
  }
  return result;
}
