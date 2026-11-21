// Shared structural types moved unchanged from app/create/page.tsx. No runtime values.
import type { YoutubeThumbnailResult } from "@/components/create/createWorkspacePanelTypes";

export type CreatorThumbnailHistoryItem = {
  id: string;
  createdAt: number;
  label: string;
  result: YoutubeThumbnailResult;
};

export type CreatorThumbnailRefinementPreset =
  | "focus"
  | "contrast"
  | "title_space"
  | "cinematic"
  | "simplify_background";

export type YoutubeMetadataResult = {
  titleOptions: string[];
  recommendedTitle: string;
  description: string;
  hashtags: string[];
  firstComment: string;
  thumbnailTextIdeas: string[];
  seoKeywords: string[];
  audiencePromise: string;
  hookAlternatives: string[];
  chapters: string[];
  shortCaption: string;
  linkedInCaption: string;
  uploadChecklist: string[];
  publishingNotes: string[];
};
