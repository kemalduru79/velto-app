import { buildCreatorVisualFitFilters } from "./creatorVisualFit.js";

export function buildStaticImageFilter({
  durationSec, outputWidth = 1280, outputHeight = 720, fps = 25,
  visualFitMode = "contain",
}) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error("STATIC_IMAGE_DURATION_INVALID");
  }
  return [
    ...buildCreatorVisualFitFilters({
      mode: visualFitMode, outputWidth, outputHeight, padColor: "black",
    }),
    "setsar=1",
    `fps=${fps}`,
    `trim=start=0:duration=${durationSec.toFixed(3)}`,
    "settb=AVTB",
    `setpts=N/(${fps}*TB)`,
    "format=yuv420p",
  ].join(",");
}
