import { NextResponse } from "next/server";
import OpenAI from "openai";
import { recordOpenAITextEconomics } from "@/lib/economics";

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

const COUNTRY_TO_REGION: Record<string, string> = {
  global: "US",
  us: "US",
  canada: "CA",
  uk: "GB",
  australia: "AU",
  germany: "DE",
  france: "FR",
  spain: "ES",
  turkey: "TR",
};

const GENERIC_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "create",
  "creating",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "make",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "video",
  "with",
  "bir",
  "bu",
  "da",
  "de",
  "için",
  "ile",
  "oluştur",
  "oluşturan",
  "ve",
  "veya",
  "video",
]);

type ResearchContext = {
  primarySubject: string;
  contentIntent: string;
  supportingTerms: string[];
  excludedTerms: string[];
  searchQuery: string;
  extractionMode: "ai" | "fallback";
};

type CandidateVideo = {
  id: string;
  title: string;
  description: string;
  channel: string;
  publishedAt: string;
  views: number;
  likes: number;
  durationSec: number;
  thumbnail: string;
  url: string;
};

function asString(value: unknown, fallback = "") {
  const result = String(value || "").replace(/\s+/g, " ").trim();
  return result || fallback;
}

function asStringArray(value: unknown, maxItems = 8) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => asString(item))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function isoDurationToSeconds(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) return 0;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function normalizeRegion(country?: string) {
  const key = String(country || "global").toLowerCase();
  return COUNTRY_TO_REGION[key] || "US";
}

function normalizeLanguage(language?: string) {
  return language === "tr" ? "tr" : "en";
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        !GENERIC_STOP_WORDS.has(token),
    );
}

function extractFallbackSubject(topic: string) {
  const quoted = Array.from(topic.matchAll(/["“”']([^"“”']{2,120})["“”']/g))
    .map((match) => asString(match[1]))
    .filter(Boolean);

  if (quoted.length > 0) return quoted[0];

  const significantTokens = tokenize(topic).slice(0, 10);
  return significantTokens.join(" ") || topic.slice(0, 120);
}

function createFallbackResearchContext({
  topic,
  contentTypeLabel,
  format,
}: {
  topic: string;
  contentTypeLabel: string;
  format: string;
}): ResearchContext {
  const primarySubject = extractFallbackSubject(topic);
  const supportingTerms = [contentTypeLabel, format]
    .map((value) => asString(value))
    .filter(Boolean)
    .slice(0, 3);
  const searchQuery = [primarySubject, ...supportingTerms]
    .filter(Boolean)
    .join(" ")
    .slice(0, 220);

  return {
    primarySubject,
    contentIntent: contentTypeLabel || "professional creator research",
    supportingTerms,
    excludedTerms: [],
    searchQuery,
    extractionMode: "fallback",
  };
}

function parseJsonObject(raw: string) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end < start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function createResearchContext({
  topic,
  contentType,
  contentTypeLabel,
  format,
  ageGroup,
  countryLabel,
  language,
}: {
  topic: string;
  contentType: string;
  contentTypeLabel: string;
  format: string;
  ageGroup: string;
  countryLabel: string;
  language: "tr" | "en";
}): Promise<ResearchContext> {
  const fallback = createFallbackResearchContext({
    topic,
    contentTypeLabel,
    format,
  });
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return fallback;

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.1,
      input: [
        {
          role: "system",
          content: [
            "You extract a topic-independent research brief for professional creator market research.",
            "Identify the actual subject the user wants to research, not the instruction wording or visual style adjectives.",
            "Return strict JSON only with primarySubject, contentIntent, supportingTerms, excludedTerms, searchQuery.",
            "primarySubject must be concise and preserve essential names, products, organizations, events, or concepts.",
            "searchQuery must be a concise YouTube search query grounded only in the user's subject and intent.",
            "Do not add children, animation, cartoons, celebrities, brands, or other entities unless explicitly present or logically required by the request.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            topic,
            contentType,
            contentTypeLabel,
            format,
            ageGroup,
            countryLabel,
            outputLanguage: language,
          }),
        },
      ],
    });
    await recordOpenAITextEconomics({ route: "/api/youtube-research", operationType: "creator_youtube_research_synthesis", model: process.env.OPENAI_MODEL || "gpt-4.1-mini", response });
    const parsed = parseJsonObject(response.output_text || "");

    if (!parsed) return fallback;

    const primarySubject = asString(parsed.primarySubject, fallback.primarySubject);
    const contentIntent = asString(parsed.contentIntent, fallback.contentIntent);
    const supportingTerms = asStringArray(parsed.supportingTerms, 6);
    const excludedTerms = asStringArray(parsed.excludedTerms, 6);
    const modelQuery = asString(parsed.searchQuery);
    const searchQuery = (modelQuery || [primarySubject, ...supportingTerms.slice(0, 3)].join(" "))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    return {
      primarySubject,
      contentIntent,
      supportingTerms,
      excludedTerms,
      searchQuery: searchQuery || fallback.searchQuery,
      extractionMode: "ai",
    };
  } catch (error) {
    console.error("youtube-research context extraction error:", error);
    return fallback;
  }
}

function scoreCandidate(video: CandidateVideo, context: ResearchContext) {
  const haystack = normalizeText(
    `${video.title} ${video.description} ${video.channel}`,
  );
  const primaryPhrase = normalizeText(context.primarySubject);
  const primaryTokens = Array.from(new Set(tokenize(context.primarySubject)));
  const supportingTokens = Array.from(
    new Set(context.supportingTerms.flatMap((term) => tokenize(term))),
  );
  const excludedTokens = Array.from(
    new Set(context.excludedTerms.flatMap((term) => tokenize(term))),
  );
  const matchedPrimary = primaryTokens.filter((token) => haystack.includes(token));
  const matchedSupporting = supportingTokens.filter((token) => haystack.includes(token));
  const matchedExcluded = excludedTokens.filter((token) => haystack.includes(token));
  const exactSubjectMatch = Boolean(
    primaryPhrase && primaryPhrase.length >= 3 && haystack.includes(primaryPhrase),
  );
  const primaryCoverage = primaryTokens.length
    ? matchedPrimary.length / primaryTokens.length
    : 0;

  let relevanceScore = exactSubjectMatch ? 64 : 0;
  relevanceScore += Math.round(primaryCoverage * 40);
  relevanceScore += Math.min(18, matchedSupporting.length * 6);
  relevanceScore -= matchedExcluded.length * 30;

  const subjectRelevant = primaryTokens.length <= 1
    ? matchedPrimary.length >= 1 || exactSubjectMatch
    : exactSubjectMatch || primaryCoverage >= 0.6;
  const relevant = subjectRelevant && relevanceScore >= 24 && matchedExcluded.length === 0;

  return {
    relevant,
    relevanceScore: Math.max(0, relevanceScore),
    relevanceReason: exactSubjectMatch
      ? "exact_subject"
      : primaryCoverage >= 0.6
        ? "strong_subject_overlap"
        : "insufficient_subject_overlap",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const topic = asString(body?.topic);
    const country = asString(body?.country, "global");
    const countryLabel = asString(body?.countryLabel, country);
    const language = normalizeLanguage(body?.language);
    const contentType = asString(body?.contentType);
    const contentTypeLabel = asString(body?.contentTypeLabel, contentType);
    const format = asString(body?.format);
    const ageGroup = asString(body?.ageGroup);
    const maxResults = Math.min(Math.max(Number(body?.maxResults || 12), 1), 25);

    if (!topic) {
      return NextResponse.json({ error: "topic zorunlu." }, { status: 400 });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "YOUTUBE_API_KEY tanımlı değil." },
        { status: 500 },
      );
    }

    const researchContext = await createResearchContext({
      topic,
      contentType,
      contentTypeLabel,
      format,
      ageGroup,
      countryLabel,
      language,
    });
    const regionCode = normalizeRegion(country);
    const query = researchContext.searchQuery;

    const searchUrl = new URL(YOUTUBE_SEARCH_URL);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", String(Math.min(25, Math.max(maxResults * 2, 12))));
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("regionCode", regionCode);
    searchUrl.searchParams.set("relevanceLanguage", language);
    searchUrl.searchParams.set("safeSearch", "strict");
    searchUrl.searchParams.set("videoEmbeddable", "true");
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString(), { cache: "no-store" });
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      return NextResponse.json(
        {
          error:
            searchData?.error?.message ||
            "YouTube search isteği başarısız oldu.",
        },
        { status: searchRes.status },
      );
    }

    const videoIds = (searchData.items || [])
      .map((item: any) => item?.id?.videoId)
      .filter(Boolean)
      .slice(0, 25);

    if (videoIds.length === 0) {
      return NextResponse.json({
        success: true,
        videos: [],
        query,
        regionCode,
        language,
        researchContext,
        filteredOutCount: 0,
      });
    }

    const videosUrl = new URL(YOUTUBE_VIDEOS_URL);
    videosUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    videosUrl.searchParams.set("id", videoIds.join(","));
    videosUrl.searchParams.set("key", apiKey);

    const videosRes = await fetch(videosUrl.toString(), { cache: "no-store" });
    const videosData = await videosRes.json();

    if (!videosRes.ok) {
      return NextResponse.json(
        {
          error:
            videosData?.error?.message ||
            "YouTube videos isteği başarısız oldu.",
        },
        { status: videosRes.status },
      );
    }

    const candidates: CandidateVideo[] = (videosData.items || []).map((video: any) => ({
      id: video.id,
      title: video?.snippet?.title || "",
      description: video?.snippet?.description || "",
      channel: video?.snippet?.channelTitle || "",
      publishedAt: video?.snippet?.publishedAt || "",
      views: Number(video?.statistics?.viewCount || 0),
      likes: Number(video?.statistics?.likeCount || 0),
      durationSec: isoDurationToSeconds(video?.contentDetails?.duration || "PT0S"),
      thumbnail:
        video?.snippet?.thumbnails?.high?.url ||
        video?.snippet?.thumbnails?.medium?.url ||
        video?.snippet?.thumbnails?.default?.url ||
        "",
      url: `https://www.youtube.com/watch?v=${video.id}`,
    }));

    const scored = candidates.map((video) => ({
      ...video,
      ...scoreCandidate(video, researchContext),
    }));
    const videos = scored
      .filter((video) => video.relevant)
      .sort(
        (left, right) =>
          right.relevanceScore - left.relevanceScore ||
          right.views - left.views,
      )
      .slice(0, maxResults)
      .map(({ relevant: _relevant, description: _description, ...video }) => video);

    return NextResponse.json({
      success: true,
      query,
      regionCode,
      language,
      researchContext,
      filteredOutCount: Math.max(0, candidates.length - videos.length),
      videos,
    });
  } catch (error: unknown) {
    console.error("youtube-research error:", error);

    return NextResponse.json(
      {
        error:
          (error instanceof Error ? error.message : "") ||
          "YouTube research error",
      },
      { status: 500 },
    );
  }
}
