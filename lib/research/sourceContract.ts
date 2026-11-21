export type ResearchSourceAdapterId =
  | "youtube"
  | "web"
  | "primary"
  | "academic"
  | "news";

export type ResearchSourceMediaKind =
  | "video"
  | "article"
  | "paper"
  | "document"
  | "webpage"
  | "other";

export type ResearchSourceLanguage = "tr" | "en" | null;

export type ResearchSourceMetricValue = number | null;

export type ResearchSourceMetrics = {
  views?: ResearchSourceMetricValue;
  likes?: ResearchSourceMetricValue;
};

export type ResearchSourceMetadataValue =
  | string
  | number
  | boolean
  | null;

/**
 * Canonical research-source shape used by CreatorLab editorial intelligence.
 *
 * Provider-specific details stay in sourceMetadata. Editorial layers should
 * depend on this contract rather than on YouTube, web-search, academic, or news
 * provider response shapes directly.
 */
export type ResearchSource = {
  sourceId: string;
  adapterId: ResearchSourceAdapterId;
  mediaKind: ResearchSourceMediaKind;
  externalId: string | null;
  title: string;
  url: string;
  publisher: string;
  author: string | null;
  publishedAt: string | null;
  language: ResearchSourceLanguage;
  summary: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  metrics: ResearchSourceMetrics;
  sourceMetadata: Record<string, ResearchSourceMetadataValue>;
};

export function createResearchSourceId(
  adapterId: ResearchSourceAdapterId,
  externalId: string,
) {
  return `${adapterId}:${externalId.trim()}`;
}
