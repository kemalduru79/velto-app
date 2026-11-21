import type { ResearchSource } from "./sourceContract.ts";
import type { ResearchSourceMetadataValue } from "./sourceContract.ts";
import type { ResearchSearchLanePurpose } from "./researchOrchestration.ts";

export type EditorialAnalysisRequest = {
  topic: string;
  sources: ResearchSource[];
  creatorProfile: unknown;
  sourceResearchPurposes: Record<string, ResearchSearchLanePurpose[]>;
};

const RESEARCH_PURPOSES = new Set<ResearchSearchLanePurpose>([
  "baseline",
  "primary_source",
  "supporting_evidence",
  "counter_evidence",
  "recent_context",
]);

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
  const rawMetadata = raw.sourceMetadata && typeof raw.sourceMetadata === "object" && !Array.isArray(raw.sourceMetadata)
    ? raw.sourceMetadata as Record<string, unknown>
    : {};
  const provenanceKind = clean(rawMetadata.provenanceKind, 100);
  const sourceMetadata: Record<string, ResearchSourceMetadataValue> = {};
  if (rawMetadata.provenanceVerified === true && provenanceKind) {
    sourceMetadata.provenanceVerified = true;
    sourceMetadata.provenanceKind = provenanceKind;
  }

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
    sourceMetadata,
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

  const rawPurposes = body.sourceResearchPurposes &&
      typeof body.sourceResearchPurposes === "object" &&
      !Array.isArray(body.sourceResearchPurposes)
    ? body.sourceResearchPurposes as Record<string, unknown>
    : {};
  const sourceResearchPurposes = Object.fromEntries(
    Object.entries(rawPurposes).flatMap(([sourceId, purposes]) => {
      if (!sourceIds.has(sourceId) || !Array.isArray(purposes)) return [];
      const normalized = [...new Set(purposes.filter(
        (purpose): purpose is ResearchSearchLanePurpose =>
          typeof purpose === "string" && RESEARCH_PURPOSES.has(purpose as ResearchSearchLanePurpose)
      ))];
      return normalized.length > 0 ? [[sourceId, normalized]] : [];
    }),
  );

  return {
    topic,
    sources,
    creatorProfile: body.creatorProfile ?? {},
    sourceResearchPurposes,
  };
}
