import { withCreatorSourceMediaMetadata } from "../../creator/sourceMedia.ts";
import type { StockMediaCandidate } from "./types.ts";

export function createStockAssetMetadata(input: {
  candidate: StockMediaCandidate;
  renditionId: string;
  renditionWidth: number;
  renditionHeight: number;
  bytes: number;
  projectId: string;
  reuseIdentity: string;
  importedAt?: string;
}) {
  const importedAt = input.importedAt || new Date().toISOString();
  const { candidate } = input;
  const flatMetadata = {
    generated: false,
    source: "stock",
    provider: "Pexels",
    providerMediaId: candidate.providerMediaId,
    sourcePageUrl: candidate.sourcePageUrl,
    creatorName: candidate.creatorName,
    creatorProfileUrl: candidate.creatorProfileUrl,
    mediaType: candidate.mediaType,
    licenseId: candidate.license.id,
    licenseUrl: candidate.license.url,
    licenseSnapshotDate: candidate.license.snapshotDate,
    importedAt,
    attributionText: candidate.attributionText,
    originalWidth: candidate.width,
    originalHeight: candidate.height,
    durationSeconds: candidate.durationSeconds,
    renditionId: input.renditionId,
    renditionWidth: input.renditionWidth,
    renditionHeight: input.renditionHeight,
    downloadedBytes: input.bytes,
    projectId: input.projectId,
    reuseIdentity: input.reuseIdentity,
    metadataVersion: candidate.metadataVersion,
  };

  return withCreatorSourceMediaMetadata(flatMetadata, {
    sourceMediaKind: candidate.mediaType === "photo" ? "image" : "video",
    sourceUrl: candidate.sourcePageUrl,
    publisher: "Pexels",
    rightsholder: "",
    publishedAt: null,
    capturedAt: importedAt,
    licenseId: candidate.license.id,
    licenseUrl: candidate.license.url,
    licenseSnapshotDate: candidate.license.snapshotDate,
    attributionRequired: null,
    attributionText: candidate.attributionText,
    rightsState: "review_required",
    rightsReviewNote: "Stock license snapshot is recorded; publication rights require review.",
    sourceDurationSec: candidate.durationSeconds,
    timecodeStartSec: null,
    timecodeEndSec: null,
  });
}
