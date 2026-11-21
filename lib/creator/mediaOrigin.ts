import {
  normalizeCreatorSourceMediaMetadata,
  type CreatorSourceMediaMetadata,
} from "./sourceMedia.ts";

export const CREATOR_MEDIA_ORIGIN_METADATA_VERSION = "0.10H-5D" as const;

export type CreatorMediaOrigin =
  | "synthetic"
  | "stock"
  | "source_media"
  | "uploaded"
  | "unknown";

export type CreatorMediaOriginMetadata = {
  version: typeof CREATOR_MEDIA_ORIGIN_METADATA_VERSION;
  origin: CreatorMediaOrigin;
};

export type CreatorMediaGovernanceProjection = {
  version: typeof CREATOR_MEDIA_ORIGIN_METADATA_VERSION;
  assetId: string;
  origin: CreatorMediaOrigin;
  originReviewRequired: boolean;
  syntheticDisclosureRequired: boolean;
  sourceRightsMetadataRequired: boolean;
  sourceRightsMetadataStatus: "available" | "required_missing" | "not_applicable";
  sourceMedia: CreatorSourceMediaMetadata | null;
};

const ORIGINS = new Set<CreatorMediaOrigin>([
  "synthetic",
  "stock",
  "source_media",
  "uploaded",
  "unknown",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown, maxLength = 240) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function explicitOrigin(metadata: Record<string, unknown>) {
  const originMetadata = record(metadata.creatorMediaOrigin);
  const origin = originMetadata?.origin;
  if (
    originMetadata?.version === CREATOR_MEDIA_ORIGIN_METADATA_VERSION &&
    ORIGINS.has(origin as CreatorMediaOrigin)
  ) {
    return origin as CreatorMediaOrigin;
  }
  return null;
}

/**
 * Resolves media origin without provider coupling. Explicit H-5D metadata wins;
 * older assets fall back to already-persisted generic provenance markers so no
 * database migration is required.
 */
export function inferCreatorMediaOrigin(metadataValue: unknown): CreatorMediaOrigin {
  const metadata = record(metadataValue) || {};
  const explicit = explicitOrigin(metadata);
  if (explicit) return explicit;

  if (metadata.generated === true) return "synthetic";
  if (clean(metadata.source, 80).toLowerCase() === "stock") return "stock";
  if (record(metadata.sourceMedia)) return "source_media";
  return "unknown";
}

/**
 * Adds provider-neutral media-origin metadata inside the existing persisted
 * asset metadata envelope. It does not create a second asset/provenance store.
 */
export function withCreatorMediaOriginMetadata(
  metadata: Record<string, unknown> | null | undefined,
  origin: CreatorMediaOrigin,
): Record<string, unknown> {
  return {
    ...(metadata || {}),
    creatorMediaOrigin: {
      version: CREATOR_MEDIA_ORIGIN_METADATA_VERSION,
      origin,
    } satisfies CreatorMediaOriginMetadata,
  };
}

function normalizedSourceMedia(metadata: Record<string, unknown>) {
  if (!record(metadata.sourceMedia)) return null;
  try {
    return normalizeCreatorSourceMediaMetadata(metadata.sourceMedia);
  } catch {
    return null;
  }
}

/**
 * Projects one existing stored asset into publish-governance signals. Unknown
 * provenance is intentionally review-required; synthetic assets require
 * disclosure rather than source-rights metadata; stock/source media require
 * canonical source-rights metadata before governance can evaluate them.
 */
export function createCreatorMediaGovernanceProjection(input: {
  assetId: string;
  metadata?: Record<string, unknown> | null;
}): CreatorMediaGovernanceProjection {
  const assetId = clean(input.assetId);
  if (!assetId) throw new Error("CREATOR_MEDIA_ASSET_ID_REQUIRED");

  const metadata = input.metadata || {};
  const origin = inferCreatorMediaOrigin(metadata);
  const sourceRightsMetadataRequired = origin === "stock" || origin === "source_media";
  const sourceMedia = sourceRightsMetadataRequired
    ? normalizedSourceMedia(metadata)
    : null;

  return {
    version: CREATOR_MEDIA_ORIGIN_METADATA_VERSION,
    assetId,
    origin,
    originReviewRequired:
      origin === "unknown" ||
      (origin === "uploaded" && record(metadata.creatorRightsConfirmation)?.confirmed !== true),
    syntheticDisclosureRequired: origin === "synthetic",
    sourceRightsMetadataRequired,
    sourceRightsMetadataStatus: sourceRightsMetadataRequired
      ? sourceMedia
        ? "available"
        : "required_missing"
      : "not_applicable",
    sourceMedia,
  };
}
