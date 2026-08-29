import type { ResearchSource } from "./sourceContract.ts";

export type ResearchSourceDirectness =
  | "primary"
  | "secondary"
  | "tertiary"
  | "unknown";

export type ResearchSourceProvenanceStatus =
  | "complete"
  | "partial"
  | "unknown";

export type ResearchSourceReviewStatus =
  | "usable"
  | "review"
  | "insufficient";

export type ResearchSourceAssessment = {
  sourceId: string;
  directness: ResearchSourceDirectness;
  provenanceStatus: ResearchSourceProvenanceStatus;
  reviewStatus: ResearchSourceReviewStatus;
  reviewReasons: string[];
};

function hasText(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

/**
 * Assesses source handling quality without assigning an ideological or universal
 * "truth score". Directness describes the source relationship; provenance is
 * based on traceable metadata; reviewStatus indicates editorial work required.
 */
export function assessResearchSource(
  source: ResearchSource,
  directness: ResearchSourceDirectness = "unknown",
): ResearchSourceAssessment {
  const reviewReasons: string[] = [];
  const hasCoreProvenance =
    hasText(source.url) &&
    hasText(source.title) &&
    hasText(source.publisher);
  const hasExtendedProvenance =
    hasCoreProvenance &&
    Boolean(source.externalId || source.publishedAt || source.author);

  const provenanceStatus: ResearchSourceProvenanceStatus = hasExtendedProvenance
    ? "complete"
    : hasCoreProvenance
      ? "partial"
      : "unknown";

  if (!hasText(source.url)) reviewReasons.push("SOURCE_URL_MISSING");
  if (!hasText(source.title)) reviewReasons.push("SOURCE_TITLE_MISSING");
  if (!hasText(source.publisher)) reviewReasons.push("SOURCE_PUBLISHER_MISSING");
  if (directness === "unknown") reviewReasons.push("SOURCE_DIRECTNESS_REVIEW");
  if (provenanceStatus !== "complete") reviewReasons.push("SOURCE_PROVENANCE_REVIEW");

  const reviewStatus: ResearchSourceReviewStatus =
    !hasText(source.url) || !hasText(source.title)
      ? "insufficient"
      : reviewReasons.length > 0
        ? "review"
        : "usable";

  return {
    sourceId: source.sourceId,
    directness,
    provenanceStatus,
    reviewStatus,
    reviewReasons,
  };
}
