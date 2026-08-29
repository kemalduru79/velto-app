import {
  normalizeCreatorSourceMediaMetadata,
  type CreatorSourceMediaKind,
  type CreatorSourceMediaMetadata,
} from "../creator/sourceMedia.ts";
import type {
  ResearchSource,
  ResearchSourceAdapterId,
  ResearchSourceMediaKind,
} from "./sourceContract.ts";

export const RESEARCH_SOURCE_MEDIA_REFERENCE_VERSION = "0.10H-3D" as const;

export type ResearchSourceMediaReference = {
  version: typeof RESEARCH_SOURCE_MEDIA_REFERENCE_VERSION;
  researchSourceId: string;
  adapterId: ResearchSourceAdapterId;
  title: string;
  author: string | null;
  thumbnailUrl: string | null;
  sourceMedia: CreatorSourceMediaMetadata;
};

function sourceMediaKind(kind: ResearchSourceMediaKind): CreatorSourceMediaKind {
  if (kind === "video") return "video";
  if (
    kind === "article" ||
    kind === "paper" ||
    kind === "document" ||
    kind === "webpage"
  ) {
    return "document";
  }
  return "other";
}

/**
 * Converts a grounded editorial source into a provider-neutral Source Media
 * reference. This is reference/provenance only: it does not download media and
 * never infers usage rights from the existence of a public URL.
 */
export function createResearchSourceMediaReference(
  source: ResearchSource,
  options: { capturedAt?: string } = {},
): ResearchSourceMediaReference {
  const capturedAt = options.capturedAt || new Date().toISOString();

  return {
    version: RESEARCH_SOURCE_MEDIA_REFERENCE_VERSION,
    researchSourceId: source.sourceId,
    adapterId: source.adapterId,
    title: source.title,
    author: source.author,
    thumbnailUrl: source.thumbnailUrl,
    sourceMedia: normalizeCreatorSourceMediaMetadata({
      sourceMediaKind: sourceMediaKind(source.mediaKind),
      sourceUrl: source.url,
      publisher: source.publisher,
      rightsholder: "",
      publishedAt: source.publishedAt,
      capturedAt,
      licenseId: "",
      licenseUrl: null,
      licenseSnapshotDate: null,
      attributionRequired: null,
      attributionText: "",
      rightsState: "review_required",
      rightsReviewNote: "Research source media requires rights review before media use.",
      sourceDurationSec: source.durationSec,
      timecodeStartSec: null,
      timecodeEndSec: null,
    }),
  };
}
