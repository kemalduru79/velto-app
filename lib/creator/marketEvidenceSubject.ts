import { normalizeCreatorTopicAuthority } from "./creatorWorkflowAuthority.ts";

const MAX_MARKET_EVIDENCE_SUBJECT_LENGTH = 240;
const PROJECT_METADATA_MARKERS =
  /(?:^|\s)(?:project|brand|website|social|positioning|workflow|production instructions?)\s*[:\-]?/iu;

type MarketEvidenceDirection = {
  title?: unknown;
};

export type CreatorMarketEvidenceSubjectInput = {
  briefTopic: unknown;
  selectedDirectionId: unknown;
  recommendedIdea?: MarketEvidenceDirection | null;
  videoIdeas?: MarketEvidenceDirection[] | null;
};

function conciseSubject(value: unknown) {
  const normalized = normalizeCreatorTopicAuthority(value);
  return normalized.length <= MAX_MARKET_EVIDENCE_SUBJECT_LENGTH
    ? normalized
    : "";
}

export function resolveCreatorMarketEvidenceSubject(
  input: CreatorMarketEvidenceSubjectInput,
) {
  const recommendedTitle = conciseSubject(input.recommendedIdea?.title);
  const alternatives = (Array.isArray(input.videoIdeas) ? input.videoIdeas : [])
    .map((idea) => conciseSubject(idea?.title))
    .filter(Boolean)
    .filter(
      (title) =>
        !recommendedTitle ||
        title.toLocaleLowerCase() !== recommendedTitle.toLocaleLowerCase(),
    )
    .slice(0, 2);
  const selectedDirectionId = normalizeCreatorTopicAuthority(
    input.selectedDirectionId,
  );

  if (selectedDirectionId.startsWith("alternative-")) {
    const alternativeIndex = Number(selectedDirectionId.slice("alternative-".length)) - 1;
    if (Number.isInteger(alternativeIndex) && alternatives[alternativeIndex]) {
      return alternatives[alternativeIndex];
    }
  }

  if (recommendedTitle) return recommendedTitle;

  const legacyBrief = conciseSubject(input.briefTopic);
  return legacyBrief && !PROJECT_METADATA_MARKERS.test(legacyBrief)
    ? legacyBrief
    : "";
}
