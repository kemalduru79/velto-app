import type { ResearchSource } from "./sourceContract.ts";

export type EditorialAnalysisRequest = {
  topic: string;
  sources: ResearchSource[];
  creatorProfile: unknown;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function normalizeSource(value: unknown, index: number): ResearchSource {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const sourceId = clean(raw.sourceId, 300);
  const title = clean(raw.title, 500);
  const url = clean(raw.url, 2_000);
  if (!sourceId) throw new Error(`EDITORIAL_SOURCE_ID_REQUIRED:${index + 1}`);
  if (!title) throw new Error(`EDITORIAL_SOURCE_TITLE_REQUIRED:${sourceId}`);
  if (!url) throw new Error(`EDITORIAL_SOURCE_URL_REQUIRED:${sourceId}`);

  const adapterIds = new Set(["youtube", "web", "primary", "academic", "news"]);
  const mediaKinds = new Set(["video", "article", "paper", "document", "webpage", "other"]);
  const adapterId = adapterIds.has(String(raw.adapterId))
    ? raw.adapterId as ResearchSource["adapterId"]
    : "web";
  const mediaKind = mediaKinds.has(String(raw.mediaKind))
    ? raw.mediaKind as ResearchSource["mediaKind"]
    : "webpage";

  return {
    sourceId,
    adapterId,
    mediaKind,
    externalId: clean(raw.externalId, 2_000) || null,
    title,
    url,
    publisher: clean(raw.publisher, 300),
    author: clean(raw.author, 500) || null,
    publishedAt: clean(raw.publishedAt, 100) || null,
    language: raw.language === "tr" || raw.language === "en" ? raw.language : null,
    summary: clean(raw.summary, 2_500) || null,
    thumbnailUrl: clean(raw.thumbnailUrl, 2_000) || null,
    durationSec: Number.isFinite(Number(raw.durationSec)) && Number(raw.durationSec) >= 0
      ? Number(raw.durationSec)
      : null,
    metrics: {},
    sourceMetadata: {},
  };
}

export function normalizeEditorialAnalysisRequest(value: unknown): EditorialAnalysisRequest {
  const body = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const topic = clean(body.topic, 800);
  if (!topic) throw new Error("EDITORIAL_TOPIC_REQUIRED");
  const rawSources = Array.isArray(body.sources) ? body.sources : [];
  if (rawSources.length === 0) throw new Error("EDITORIAL_SOURCES_REQUIRED");
  if (rawSources.length > 40) throw new Error("EDITORIAL_SOURCES_LIMIT_EXCEEDED");

  const sources = rawSources.map(normalizeSource);
  const sourceIds = new Set<string>();
  for (const source of sources) {
    if (sourceIds.has(source.sourceId)) {
      throw new Error(`EDITORIAL_SOURCE_ID_DUPLICATE:${source.sourceId}`);
    }
    sourceIds.add(source.sourceId);
  }

  return { topic, sources, creatorProfile: body.creatorProfile ?? {} };
}
