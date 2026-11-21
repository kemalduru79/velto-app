import type { StockOrientation, StockRendition } from "./types";

export type CreatorStockFormat = "youtube_video" | "short_form";

const POLICIES = {
  youtube_video: { orientation: "landscape", minimumWidth: 1280, minimumHeight: 720, preferredWidth: 1920, preferredHeight: 1080 },
  short_form: { orientation: "portrait", minimumWidth: 720, minimumHeight: 1280, preferredWidth: 1080, preferredHeight: 1920 },
} as const satisfies Record<CreatorStockFormat, { orientation: StockOrientation; minimumWidth: number; minimumHeight: number; preferredWidth: number; preferredHeight: number }>;

export function getCreatorStockFormatPolicy(format: CreatorStockFormat) {
  return POLICIES[format];
}

function dimensionsMatchCreatorFormat(
  widthValue: unknown,
  heightValue: unknown,
  format: CreatorStockFormat,
) {
  const width = Number(widthValue);
  const height = Number(heightValue);

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return false;
  }

  const policy = POLICIES[format];
  const orientation =
    width === height ? "square" : width > height ? "landscape" : "portrait";

  return (
    orientation === policy.orientation &&
    width >= policy.minimumWidth &&
    height >= policy.minimumHeight
  );
}

export function isRenditionCompatibleWithCreatorFormat(
  rendition: StockRendition,
  format: CreatorStockFormat,
) {
  return (
    rendition.quality === "production" &&
    dimensionsMatchCreatorFormat(rendition.width, rendition.height, format)
  );
}

export function isStoredStockRenditionReusable(
  metadata: unknown,
  requestedRenditionId: string,
  automaticFormat?: CreatorStockFormat,
) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }

  const stored = metadata as Record<string, unknown>;

  // Legacy imports could persist a different actual rendition than the
  // rendition ID used to construct reuseIdentity. Exact rendition identity
  // is now authoritative for both manual and automatic reuse.
  if (stored.renditionId !== requestedRenditionId) {
    return false;
  }

  // Manual selection preserves the exact user-selected rendition.
  if (!automaticFormat) {
    return true;
  }

  // Automatic reuse must additionally satisfy the current project format.
  // Missing legacy dimensions fail closed and force a fresh provider resolve.
  return dimensionsMatchCreatorFormat(
    stored.renditionWidth,
    stored.renditionHeight,
    automaticFormat,
  );
}

export function rankCreatorFormatRenditions(renditions: readonly StockRendition[], format: CreatorStockFormat) {
  const policy = POLICIES[format];
  const targetRatio = policy.preferredWidth / policy.preferredHeight;
  return renditions.filter((item) => isRenditionCompatibleWithCreatorFormat(item, format)).sort((a, b) => {
    const ratioDelta = Math.abs(a.width / a.height - targetRatio) - Math.abs(b.width / b.height - targetRatio);
    if (ratioDelta !== 0) return ratioDelta;
    const aDistance = Math.abs(a.width - policy.preferredWidth) + Math.abs(a.height - policy.preferredHeight);
    const bDistance = Math.abs(b.width - policy.preferredWidth) + Math.abs(b.height - policy.preferredHeight);
    return aDistance - bDistance || a.id.localeCompare(b.id);
  });
}
