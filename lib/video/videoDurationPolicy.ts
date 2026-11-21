export type VideoQualityTier =
  | "lite"
  | "draft"
  | "standard"
  | "pro"
  | "cinematic";

function normalizePositiveNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

export function normalizeVideoClipDuration(
  requestedDuration: unknown,
  qualityTier: VideoQualityTier = "standard",
) {
  const fallbackDuration = qualityTier === "cinematic" ? 10 : 5;
  const requested = normalizePositiveNumber(
    requestedDuration,
    fallbackDuration,
    3,
    12,
  );

  if (requested <= 5) {
    return {
      durationSec: 5 as const,
      reason: "Requested duration fits a compact 5-second visual block.",
    };
  }

  if (requested <= 7 && qualityTier !== "cinematic") {
    return {
      durationSec: 7 as const,
      reason:
        "Requested duration fits the available mid-length visual block.",
    };
  }

  return {
    durationSec: 10 as const,
    reason:
      "Longer speech or premium mode should use a 10-second visual block when the selected video model supports it.",
  };
}
