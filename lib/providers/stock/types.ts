export type StockMediaType = "photo" | "video";
export type StockOrientation = "landscape" | "portrait" | "square";

export type StockRendition = {
  id: string;
  url: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm";
  width: number;
  height: number;
  quality: "preview" | "production";
};

export type StockMediaCandidate = {
  sourceType: "stock";
  mediaType: StockMediaType;
  provider: "pexels";
  providerMediaId: string;
  sourcePageUrl: string;
  creatorName: string;
  creatorProfileUrl: string | null;
  license: { id: "pexels-license"; url: "https://www.pexels.com/license/"; snapshotDate: "2026-08-22" };
  width: number;
  height: number;
  orientation: StockOrientation;
  durationSeconds: number | null;
  previewUrl: string;
  previewPosterUrl?: string | null;
  renditions: StockRendition[];
  averageColor: string | null;
  attributionText: string;
  metadataVersion: "2026-08-22";
};

export type StockSearchInput = {
  query: string;
  mediaType: StockMediaType;
  orientation?: StockOrientation;
  page: number;
  perPage: number;
};

export type StockRateLimit = { limit: number | null; remaining: number | null; resetAt: string | null };
export type StockSearchResult = { candidates: StockMediaCandidate[]; page: number; perPage: number; totalResults: number; rateLimit: StockRateLimit };

export interface StockMediaProvider {
  search(input: StockSearchInput): Promise<StockSearchResult>;
  getMedia(mediaType: StockMediaType, providerMediaId: string): Promise<StockMediaCandidate>;
  resolveImportRendition(candidate: StockMediaCandidate, renditionId: string): StockRendition;
}

export class StockProviderError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
    this.name = "StockProviderError";
  }
}
