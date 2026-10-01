import type { ResearchClaim } from "./claimEvidenceGraph.ts";
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

export type ResearchSourceDirectnessClassification = {
  directness: ResearchSourceDirectness;
  reason:
    | "verified_first_party_provenance"
    | "academic_publication"
    | "primary_search_intent_unverified"
    | "third_party_commentary"
    | "unclassified_source";
};

const VERIFIED_PRIMARY_PROVENANCE_KINDS = new Set([
  "official_company_announcement",
  "government_publication",
  "official_statistics",
  "official_product_documentation",
  "direct_transcript",
  "official_filing",
  "official_speech",
  "original_dataset",
  "original_academic_paper",
]);

export function classifyResearchSourceDirectness(
  source: ResearchSource,
): ResearchSourceDirectnessClassification {
  if (source.adapterId === "academic" && source.mediaKind === "paper") {
    return { directness: "primary", reason: "academic_publication" };
  }
  const provenanceKind = typeof source.sourceMetadata.provenanceKind === "string"
    ? source.sourceMetadata.provenanceKind
    : "";
  if (
    source.sourceMetadata.provenanceVerified === true &&
    VERIFIED_PRIMARY_PROVENANCE_KINDS.has(provenanceKind)
  ) {
    return { directness: "primary", reason: "verified_first_party_provenance" };
  }
  if (source.adapterId === "primary") {
    return { directness: "secondary", reason: "primary_search_intent_unverified" };
  }
  if (source.adapterId === "web" || source.adapterId === "news") {
    return { directness: "secondary", reason: "third_party_commentary" };
  }
  return { directness: "unknown", reason: "unclassified_source" };
}

function normalizeAuthorityText(value: unknown) {
  return typeof value === "string"
    ? value
        .normalize("NFKC")
        .toLocaleLowerCase("en-US")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function authorityTextMatches(expected: unknown, actual: unknown) {
  const left = normalizeAuthorityText(expected);
  const right = normalizeAuthorityText(actual);

  if (!left || !right) return false;
  if (left === right) return true;

  // Conservative containment is allowed only for sufficiently specific names
  // or work titles. Short/generic strings never establish primary authority.
  return (
    Math.min(left.length, right.length) >= 24 &&
    (left.includes(right) || right.includes(left))
  );
}

function canonicalWorkReferenceMatches(
  referencedWork: unknown,
  source: ResearchSource,
) {
  if (typeof referencedWork !== "string") return false;

  const reference = referencedWork.trim();
  if (!reference) return false;

  // Strongest authority: the canonical claim origin points at this exact
  // research source.
  if (reference === source.sourceId || reference === source.url) {
    return true;
  }

  // Persisted canonical work references can contain the adapter prefix,
  // e.g. "web:https://publisher.example/article".
  const prefixedUrl = reference.match(
    /^(?:web|academic|primary|news):((?:https?:\/\/).+)$/i,
  )?.[1];

  if (prefixedUrl && prefixedUrl === source.url) {
    return true;
  }

  return authorityTextMatches(reference, source.title);
}

/**
 * Primary-source authority is sometimes claim-relative.
 *
 * A source with globally verified first-party provenance remains primary.
 * Otherwise we allow only conservative identity matches between the canonical
 * claim origin and the source itself:
 *
 * - attributed_statement -> named author/publisher
 * - document_assertion/original_research_result -> originating work title
 *
 * Retrieval lane alone never establishes primary authority.
 */
export function researchSourceIsPrimaryForClaim(
  source: ResearchSource,
  claim: ResearchClaim | null | undefined,
) {
  if (classifyResearchSourceDirectness(source).directness === "primary") {
    return true;
  }

  if (!claim?.propositionKind || !claim.origin) {
    return false;
  }

  if (claim.propositionKind === "attributed_statement") {
    return (
      authorityTextMatches(claim.origin.attributedEntity, source.author) ||
      authorityTextMatches(claim.origin.attributedEntity, source.publisher)
    );
  }

  if (
    claim.propositionKind === "document_assertion" ||
    claim.propositionKind === "original_research_result"
  ) {
    return canonicalWorkReferenceMatches(
      claim.origin.referencedWork,
      source,
    );
  }

  return false;
}

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
