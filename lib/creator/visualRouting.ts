import {
  getCreatorMediaRoute,
  normalizeCreatorQualityMode,
  type CreatorQualityMode,
} from "./mediaRouting";

export type CreatorVisualFormat = "short_form" | "youtube_video";
export type CreatorImageUseCase = "scene" | "thumbnail" | "hook";

export type CreatorVisualRoute = {
  qualityMode: CreatorQualityMode;
  format: CreatorVisualFormat;
  imageUseCase: CreatorImageUseCase;
  generationAllowed: boolean;
  imageQuality: "medium" | "high";
  imageSize: "1024x1536" | "1536x1024";
  targetAspectRatio: "9:16" | "16:9";
  composition:
    | "vertical_mobile_safe"
    | "wide_creator_safe"
    | "wide_thumbnail_safe";
  continuityStrength: "balanced" | "strong" | "maximum";
  frameRole: "scene_asset" | "video_reference_frame" | "cinematic_reference_frame";
};

export function normalizeCreatorVisualFormat(
  value: unknown,
): CreatorVisualFormat {
  return value === "youtube_video" ? "youtube_video" : "short_form";
}

export function getCreatorVisualRoute({
  qualityMode,
  format,
  imageUseCase,
}: {
  qualityMode: unknown;
  format: unknown;
  imageUseCase: CreatorImageUseCase;
}): CreatorVisualRoute {
  const normalizedQualityMode = normalizeCreatorQualityMode(
    qualityMode,
    "standard",
  );
  const normalizedFormat = normalizeCreatorVisualFormat(format);
  const mediaRoute = getCreatorMediaRoute(normalizedQualityMode);
  const isWide =
    imageUseCase === "thumbnail" || normalizedFormat === "youtube_video";

  return {
    qualityMode: normalizedQualityMode,
    format: normalizedFormat,
    imageUseCase,
    generationAllowed: mediaRoute.actions.visuals,
    imageQuality:
      normalizedQualityMode === "pro" ||
      normalizedQualityMode === "cinematic"
        ? "high"
        : "medium",
    imageSize: isWide ? "1536x1024" : "1024x1536",
    targetAspectRatio: isWide ? "16:9" : "9:16",
    composition:
      imageUseCase === "thumbnail"
        ? "wide_thumbnail_safe"
        : isWide
          ? "wide_creator_safe"
          : "vertical_mobile_safe",
    continuityStrength:
      normalizedQualityMode === "cinematic"
        ? "maximum"
        : normalizedQualityMode === "pro"
          ? "strong"
          : "balanced",
    frameRole:
      normalizedQualityMode === "cinematic"
        ? "cinematic_reference_frame"
        : normalizedQualityMode === "pro"
          ? "video_reference_frame"
          : "scene_asset",
  };
}
