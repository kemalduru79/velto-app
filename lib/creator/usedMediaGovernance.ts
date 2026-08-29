import {
  createCreatorMediaGovernanceProjection,
  type CreatorMediaGovernanceProjection,
} from "./mediaOrigin.ts";
import { createCreatorProjectEvidenceGovernanceReport } from "./projectEvidenceGovernance.ts";
import type { CreatorEvidenceGovernanceReport } from "./evidenceGovernance.ts";

export const CREATOR_USED_MEDIA_GOVERNANCE_VERSION = "0.10H-5E" as const;

export type CreatorUsedMediaReferenceType = "scene_image" | "scene_video";

export type CreatorUsedMediaAsset = {
  id: string;
  lifecycleState: "active" | "trashed" | "purged";
  metadata?: Record<string, unknown>;
};

export type CreatorUsedMediaResolution = {
  referenceType: CreatorUsedMediaReferenceType;
  referenceKey: string;
  asset: CreatorUsedMediaAsset | null;
};

export type CreatorUsedMediaGovernanceResult = {
  version: typeof CREATOR_USED_MEDIA_GOVERNANCE_VERSION;
  governance: CreatorEvidenceGovernanceReport;
  summary: {
    referencedMediaCount: number;
    resolvedActiveMediaCount: number;
    syntheticMediaCount: number;
    sourceRightsMediaCount: number;
    rightsReviewMediaCount: number;
  };
};

function clean(value: unknown, maxLength = 240) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function uniqueResolutions(values: readonly CreatorUsedMediaResolution[]) {
  const seen = new Set<string>();
  const result: CreatorUsedMediaResolution[] = [];
  for (const value of values.slice(0, 160)) {
    const referenceKey = clean(value.referenceKey);
    if (!referenceKey) continue;
    const key = `${value.referenceType}:${referenceKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...value, referenceKey });
  }
  return result;
}

/**
 * Projects only media actually referenced by current CreatorLab scenes into the
 * existing H-5 project governance contract. Asset metadata stays backstage;
 * provider-specific fields are never returned by this result.
 */
export function createCreatorUsedMediaGovernanceResult(input: {
  productionPackage: unknown;
  media: readonly CreatorUsedMediaResolution[];
  syntheticDisclosurePresent?: boolean;
}): CreatorUsedMediaGovernanceResult {
  const media = uniqueResolutions(input.media);
  const projections: CreatorMediaGovernanceProjection[] = [];
  const rightsReviewRequiredIds: string[] = [];

  for (const item of media) {
    const asset = item.asset;
    if (!asset || asset.lifecycleState !== "active") {
      rightsReviewRequiredIds.push(`media:${item.referenceType}:${item.referenceKey}`);
      continue;
    }

    const projection = createCreatorMediaGovernanceProjection({
      assetId: asset.id,
      metadata: asset.metadata,
    });
    projections.push(projection);
    if (
      projection.originReviewRequired ||
      projection.sourceRightsMetadataStatus === "required_missing"
    ) {
      rightsReviewRequiredIds.push(asset.id);
    }
  }

  const sourceMedia = projections
    .filter((projection) => projection.sourceMedia !== null)
    .map((projection) => ({
      sourceId: projection.assetId,
      sourceMedia: projection.sourceMedia!,
    }));
  const syntheticMediaCount = projections.filter(
    (projection) => projection.syntheticDisclosureRequired,
  ).length;
  const sourceRightsMediaCount = projections.filter(
    (projection) => projection.sourceRightsMetadataRequired,
  ).length;
  const rightsReviewMediaCount = new Set(rightsReviewRequiredIds).size;

  return {
    version: CREATOR_USED_MEDIA_GOVERNANCE_VERSION,
    governance: createCreatorProjectEvidenceGovernanceReport({
      productionPackage: input.productionPackage,
      sourceMedia,
      rightsReviewRequiredIds,
      syntheticMediaUsed: syntheticMediaCount > 0,
      syntheticDisclosurePresent: input.syntheticDisclosurePresent === true,
    }),
    summary: {
      referencedMediaCount: media.length,
      resolvedActiveMediaCount: projections.length,
      syntheticMediaCount,
      sourceRightsMediaCount,
      rightsReviewMediaCount,
    },
  };
}
