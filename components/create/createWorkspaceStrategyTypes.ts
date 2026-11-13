// Shared structural types moved unchanged from app/create/page.tsx. No runtime values.


export type CreatorAgeGroup = "broad_18" | "mainstream_18" | "niche_18" | "professional_18";

export type CreatorStrategyDirection = {
  id: string;
  title: string;
  concept: string;
  source: "recommended" | "alternative";
};

export type CreatorWorkspaceIconName = "insights" | "ideas" | "safety" | "package";

export type YoutubePatternSummary = {
  topTitlePatterns: string[];
  hookPatterns: string[];
  recommendedDurationSec: number;
  opportunityScore: number;
  competitionLevel: "low" | "medium" | "high";
  recommendedContentAngle: string;
  reasoning: string[];
};

export type YoutubeResearchVideo = {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  views: number;
  likes: number;
  durationSec: number;
  thumbnail: string;
  url: string;
  relevanceScore?: number;
  relevanceReason?: string;
};
