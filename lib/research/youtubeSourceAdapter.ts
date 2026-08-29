import {
  createResearchSourceId,
  type ResearchSource,
  type ResearchSourceLanguage,
} from "./sourceContract.ts";

export type YoutubeResearchCandidate = {
  id: string;
  title: string;
  description?: string;
  channel: string;
  publishedAt?: string;
  views?: number;
  likes?: number;
  durationSec?: number;
  thumbnail?: string;
  url: string;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function finiteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export function adaptYoutubeResearchCandidate(
  candidate: YoutubeResearchCandidate,
  language: ResearchSourceLanguage = null,
): ResearchSource | null {
  const externalId = clean(candidate.id, 80);
  const title = clean(candidate.title, 500);
  const url = clean(candidate.url, 2_000);

  if (!externalId || !title || !url) return null;

  const publisher = clean(candidate.channel, 300);
  const publishedAt = clean(candidate.publishedAt, 80) || null;
  const summary = clean(candidate.description, 2_000) || null;
  const thumbnailUrl = clean(candidate.thumbnail, 2_000) || null;
  const durationSec = finiteNumber(candidate.durationSec);
  const views = finiteNumber(candidate.views);
  const likes = finiteNumber(candidate.likes);

  return {
    sourceId: createResearchSourceId("youtube", externalId),
    adapterId: "youtube",
    mediaKind: "video",
    externalId,
    title,
    url,
    publisher,
    author: null,
    publishedAt,
    language,
    summary,
    thumbnailUrl,
    durationSec,
    metrics: {
      views,
      likes,
    },
    sourceMetadata: {
      channel: publisher || null,
      platform: "youtube",
    },
  };
}

export function adaptYoutubeResearchCandidates(
  candidates: YoutubeResearchCandidate[],
  language: ResearchSourceLanguage = null,
) {
  return candidates
    .map((candidate) => adaptYoutubeResearchCandidate(candidate, language))
    .filter((source): source is ResearchSource => source !== null);
}
