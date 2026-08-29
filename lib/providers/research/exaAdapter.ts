import {
  createResearchSourceId,
  type ResearchSource,
  type ResearchSourceAdapterId,
} from "../../research/sourceContract.ts";
import type {
  ResearchSearchCategory,
  ResearchSearchResult,
} from "./types.ts";

export type ExaSearchResultItem = {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  publishedDate?: unknown;
  author?: unknown;
  image?: unknown;
  text?: unknown;
  highlights?: unknown;
  summary?: unknown;
};

export type ExaSearchResponse = {
  results?: unknown;
  requestId?: unknown;
  costDollars?: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function sourceAdapterId(category: ResearchSearchCategory): ResearchSourceAdapterId {
  return category;
}

function sourceMediaKind(category: ResearchSearchCategory): ResearchSource["mediaKind"] {
  if (category === "academic") return "paper";
  if (category === "news") return "article";
  return "webpage";
}

function publisherFromUrl(rawUrl: string) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "").slice(0, 300);
  } catch {
    return "";
  }
}

function summaryFromItem(item: ExaSearchResultItem) {
  const directSummary = clean(item.summary, 2_500);
  if (directSummary) return directSummary;

  const highlights = Array.isArray(item.highlights)
    ? item.highlights.map((value) => clean(value, 1_200)).filter(Boolean).slice(0, 4)
    : [];
  if (highlights.length) return highlights.join(" … ").slice(0, 2_500);

  return clean(item.text, 2_500) || null;
}

function adaptItem(
  item: ExaSearchResultItem,
  category: ResearchSearchCategory,
): ResearchSource | null {
  const title = clean(item.title, 500);
  const url = clean(item.url, 2_000);
  const rawExternalId = clean(item.id, 2_000);
  const externalId = rawExternalId || url;

  if (!title || !url || !externalId) return null;

  const adapterId = sourceAdapterId(category);
  const publisher = publisherFromUrl(url);
  const author = clean(item.author, 500) || null;
  const publishedAt = clean(item.publishedDate, 100) || null;
  const thumbnailUrl = clean(item.image, 2_000) || null;
  const highlights = Array.isArray(item.highlights)
    ? item.highlights.map((value) => clean(value, 1_200)).filter(Boolean)
    : [];

  return {
    sourceId: createResearchSourceId(adapterId, externalId),
    adapterId,
    mediaKind: sourceMediaKind(category),
    externalId,
    title,
    url,
    publisher,
    author,
    publishedAt,
    language: null,
    summary: summaryFromItem(item),
    thumbnailUrl,
    durationSec: null,
    metrics: {},
    sourceMetadata: {
      provider: "exa",
      resultId: rawExternalId || null,
      highlightCount: highlights.length,
    },
  };
}

export function adaptExaSearchResponse(
  response: ExaSearchResponse,
  category: ResearchSearchCategory,
): ResearchSearchResult {
  const rawResults = Array.isArray(response.results)
    ? response.results as ExaSearchResultItem[]
    : [];
  const sources = rawResults
    .map((item) => adaptItem(item, category))
    .filter((source): source is ResearchSource => source !== null);
  const requestId = clean(response.requestId, 300) || null;
  const rawCost = response.costDollars && typeof response.costDollars === "object"
    ? (response.costDollars as Record<string, unknown>).total
    : null;

  return {
    sources,
    providerRequestId: requestId,
    providerCostUsd: numeric(rawCost),
  };
}
