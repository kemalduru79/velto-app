export const CREATOR_VISUAL_FIT_MODES = Object.freeze({
  contain: "contain",
  cover: "cover",
});

export function resolveCreatorVisualFitMode({
  productProfile,
  creatorFormat,
} = {}) {
  return productProfile === "creatorlab" && creatorFormat === "youtube_video"
    ? CREATOR_VISUAL_FIT_MODES.cover
    : CREATOR_VISUAL_FIT_MODES.contain;
}

export function buildCreatorVisualFitFilters({
  mode,
  outputWidth,
  outputHeight,
  padColor,
}) {
  const width = Number(outputWidth);
  const height = Number(outputHeight);

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("CREATOR_VISUAL_FIT_DIMENSIONS_INVALID");
  }

  if (mode === CREATOR_VISUAL_FIT_MODES.cover) {
    return [
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}:(iw-ow)/2:(ih-oh)/2`,
    ];
  }

  return [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2${padColor ? `:color=${padColor}` : ""}`,
  ];
}
