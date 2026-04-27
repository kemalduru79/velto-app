import { NextResponse } from "next/server";

type YoutubeResearchVideo = {
  id?: string;
  title?: string;
  channel?: string;
  publishedAt?: string;
  views?: number;
  likes?: number;
  durationSec?: number;
  thumbnail?: string;
  url?: string;
};

function normalizeVideos(value: unknown): Required<YoutubeResearchVideo>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const video = item as YoutubeResearchVideo;

      return {
        id: String(video?.id || "").trim(),
        title: String(video?.title || "").trim(),
        channel: String(video?.channel || "").trim(),
        publishedAt: String(video?.publishedAt || "").trim(),
        views: Number(video?.views || 0),
        likes: Number(video?.likes || 0),
        durationSec: Number(video?.durationSec || 0),
        thumbnail: String(video?.thumbnail || "").trim(),
        url: String(video?.url || "").trim(),
      };
    })
    .filter((video) => video.title)
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);
}

function tokenizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s]/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2)
    .filter(
      (token) =>
        ![
          "the",
          "and",
          "for",
          "with",
          "you",
          "your",
          "kids",
          "children",
          "video",
          "cartoon",
          "animation",
        ].includes(token)
    );
}

function getTopKeywords(videos: Required<YoutubeResearchVideo>[]) {
  const counts = new Map<string, number>();

  videos.forEach((video, index) => {
    const weight = Math.max(1, videos.length - index);
    tokenizeTitle(video.title).forEach((token) => {
      counts.set(token, (counts.get(token) || 0) + weight);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([keyword]) => keyword);
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  return Math.round(sorted[mid]);
}

function detectHookPatterns(titles: string[]) {
  const patterns: string[] = [];

  const joined = titles.join(" ").toLowerCase();

  if (titles.some((title) => title.includes("?"))) {
    patterns.push("Question-led hooks appear in the sample and can increase curiosity.");
  }

  if (/\bwhy\b|\bhow\b|\bwhat\b/i.test(joined)) {
    patterns.push("Explainer hooks using Why/How/What are common in high-intent educational content.");
  }

  if (/\bday in the life\b|\blife of\b/i.test(joined)) {
    patterns.push("Day-in-the-life framing works well for role and profession-based videos.");
  }

  if (/\bfacts?\b|\bamazing\b|\bfun\b|\bsecret\b|\bhidden\b/i.test(joined)) {
    patterns.push("Fact-led wording is a useful hook style for short educational videos.");
  }

  if (!patterns.length) {
    patterns.push("Use a direct curiosity hook in the first 3 seconds.");
    patterns.push("Frame the video around one clear question or surprising fact.");
  }

  return patterns.slice(0, 5);
}

function detectTitlePatterns(titles: string[], topKeywords: string[]) {
  const patterns: string[] = [];

  if (topKeywords.length) {
    patterns.push(`Repeated high-signal keywords: ${topKeywords.slice(0, 5).join(", ")}.`);
  }

  if (titles.some((title) => title.length <= 55)) {
    patterns.push("Short, clear titles are present in the sample and should be preferred.");
  }

  if (titles.some((title) => /kids|children|for kids/i.test(title))) {
    patterns.push("Audience-labeled titles appear in the sample; use only when it feels natural.");
  }

  if (titles.some((title) => /!/.test(title))) {
    patterns.push("Some titles use excitement markers, but avoid overusing exclamation marks.");
  }

  if (!patterns.length) {
    patterns.push("Use a concise title with one curiosity trigger and one clear topic keyword.");
  }

  return patterns.slice(0, 5);
}

function calculateCompetitionLevel(videos: Required<YoutubeResearchVideo>[]) {
  const totalViews = videos.reduce((sum, video) => sum + video.views, 0);
  const topViews = videos[0]?.views || 0;
  const concentration = totalViews ? topViews / totalViews : 0;
  const avgViews = average(videos.map((video) => video.views));

  if (avgViews > 5_000_000 || concentration > 0.65) {
    return "high" as const;
  }

  if (avgViews > 500_000 || concentration > 0.45) {
    return "medium" as const;
  }

  return "low" as const;
}

function calculateOpportunityScore(
  videos: Required<YoutubeResearchVideo>[],
  recommendedDurationSec: number,
  competitionLevel: "low" | "medium" | "high"
) {
  const sampleScore = Math.min(30, videos.length * 3);
  const durationScore =
    recommendedDurationSec >= 25 && recommendedDurationSec <= 90
      ? 30
      : recommendedDurationSec <= 180
        ? 20
        : 10;
  const competitionScore =
    competitionLevel === "low" ? 30 : competitionLevel === "medium" ? 22 : 14;
  const engagementScore = videos.some((video) => video.likes > 0) ? 10 : 5;

  return Math.min(100, sampleScore + durationScore + competitionScore + engagementScore);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const topic = String(body?.topic || "").trim();
    const videos = normalizeVideos(body?.videos);

    if (!videos.length) {
      return NextResponse.json(
        { error: "Pattern analizi için YouTube video verisi zorunlu." },
        { status: 400 }
      );
    }

    const topVideos = videos.slice(0, 10);
    const titles = topVideos.map((video) => video.title);
    const topKeywords = getTopKeywords(topVideos);
    const durationValues = topVideos
      .map((video) => video.durationSec)
      .filter((duration) => duration > 0);

    const recommendedDurationSec = Math.max(
      20,
      Math.min(180, median(durationValues) || Math.round(average(durationValues)) || 60)
    );

    const competitionLevel = calculateCompetitionLevel(topVideos);
    const opportunityScore = calculateOpportunityScore(
      topVideos,
      recommendedDurationSec,
      competitionLevel
    );

    const hookPatterns = detectHookPatterns(titles);
    const topTitlePatterns = detectTitlePatterns(titles, topKeywords);

    const recommendedContentAngle = topic
      ? `Create a focused ${recommendedDurationSec}-second video around "${topic}" using a question-led hook and one clear visual payoff.`
      : `Create a focused ${recommendedDurationSec}-second video using a question-led hook and one clear visual payoff.`;

    const reasoning = [
      `The recommendation is based on ${topVideos.length} YouTube sample videos sorted by view count.`,
      `Median/typical duration signal suggests around ${recommendedDurationSec} seconds.`,
      `Competition is estimated as ${competitionLevel} based on view concentration and average views.`,
      topKeywords.length
        ? `Keyword signals include: ${topKeywords.slice(0, 6).join(", ")}.`
        : "No strong repeated keyword signal was detected, so a clear curiosity-led title is preferred.",
    ];

    return NextResponse.json({
      success: true,
      summary: {
        topTitlePatterns,
        hookPatterns,
        recommendedDurationSec,
        opportunityScore,
        competitionLevel,
        recommendedContentAngle,
        reasoning,
      },
    });
  } catch (e: any) {
    console.error("youtube-pattern-engine error:", e);

    return NextResponse.json(
      { error: e?.message || "Pattern engine error" },
      { status: 500 }
    );
  }
}
