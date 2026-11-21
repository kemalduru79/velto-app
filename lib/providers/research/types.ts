import type { ResearchSource } from "../../research/sourceContract.ts";

export type ResearchSearchCategory =
  | "web"
  | "primary"
  | "academic"
  | "news";

export type ResearchSearchInput = {
  query: string;
  category: ResearchSearchCategory;
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string | null;
  endPublishedDate?: string | null;
};

export type ResearchSearchResult = {
  sources: ResearchSource[];
  providerRequestId: string | null;
  providerCostUsd: number | null;
};

export interface ResearchSearchProvider {
  search(input: ResearchSearchInput): Promise<ResearchSearchResult>;
}

export class ResearchProviderError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ResearchProviderError";
  }
}
