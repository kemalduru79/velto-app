import type { SaveVeltoProjectInput } from "./types";

export function projectPayload(input: SaveVeltoProjectInput, includeFlowType = true) {
  const payload: Record<string, unknown> = {
    owner_user_id: input.ownerUserId,
    child_id: input.childId,
  };
  if (includeFlowType) payload.flow_type = input.flowType;
  const fields: Array<[keyof SaveVeltoProjectInput, string]> = [
    ["title", "title"], ["inputPrompt", "input_prompt"], ["storyPremise", "story_premise"],
    ["language", "language"], ["visualBible", "visual_bible"],
    ["characters", "characters"], ["scenes", "scenes"],
    ["exportedMovieUrl", "exported_movie_url"], ["exportedMovieResult", "exported_movie_result"],
    ["exportSignature", "export_signature"], ["creatorMentorResult", "creator_mentor_result"],
    ["creatorProductionPackage", "creator_production_package"], ["youtubeMetadataResult", "youtube_metadata"],
    ["youtubeThumbnailResult", "youtube_thumbnail"], ["sceneOptimizationResult", "scene_optimization"],
    ["sceneOptimizationSummary", "scene_optimization_summary"], ["refinedCreatorScenes", "refined_creator_scenes"],
  ];
  for (const [inputKey, column] of fields) {
    if (Object.prototype.hasOwnProperty.call(input, inputKey)) payload[column] = input[inputKey];
  }
  return payload;
}

export function assertExistingProjectFlow(
  persistedFlowType: "creator_lab" | "storyverse",
  requestedFlowType: "creator_lab" | "storyverse",
  expectedUpdatedAt?: string | null,
) {
  if (persistedFlowType !== requestedFlowType) {
    throw new Error("PROJECT_FLOW_TYPE_MISMATCH");
  }
  if (persistedFlowType === "creator_lab" && !expectedUpdatedAt) {
    throw new Error("PROJECT_REVISION_REQUIRED");
  }
}

export function assertProjectUpdateMatched(data: unknown, expectedUpdatedAt?: string | null) {
  if (!data && expectedUpdatedAt) throw new Error("PROJECT_SAVE_CONFLICT");
  if (!data) throw new Error("Project was not found or is not owned by this user.");
}
