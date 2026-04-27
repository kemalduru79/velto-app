import { NextResponse } from "next/server";

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

function isoDurationToSeconds(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) {
    return 0;
  }

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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const topic = String(body?.topic || "").trim();
    const country = String(body?.country || "global").trim();
    const language = normalizeLanguage(body?.language);
    const maxResults = Math.min(Math.max(Number(body?.maxResults || 12), 1), 25);

    if (!topic) {
      return NextResponse.json(
        { error: "topic zorunlu." },
        { status: 400 }
      );
    }

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "YOUTUBE_API_KEY tanımlı değil." },
        { status: 500 }
      );
    }

    const regionCode = normalizeRegion(country);
    const query = `${topic} kids animation`;

    const searchUrl = new URL(YOUTUBE_SEARCH_URL);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", String(maxResults));
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("regionCode", regionCode);
    searchUrl.searchParams.set("relevanceLanguage", language);
    searchUrl.searchParams.set("safeSearch", "strict");
    searchUrl.searchParams.set("videoEmbeddable", "true");
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString(), {
      cache: "no-store",
    });

    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      return NextResponse.json(
        {
          error:
            searchData?.error?.message ||
            "YouTube search isteği başarısız oldu.",
        },
        { status: searchRes.status }
      );
    }

    const videoIds = (searchData.items || [])
      .map((item: any) => item?.id?.videoId)
      .filter(Boolean)
      .slice(0, maxResults);

    if (videoIds.length === 0) {
      return NextResponse.json({
        success: true,
        videos: [],
      });
    }

    const videosUrl = new URL(YOUTUBE_VIDEOS_URL);
    videosUrl.searchParams.set("part", "snippet,statistics,contentDetails");
    videosUrl.searchParams.set("id", videoIds.join(","));
    videosUrl.searchParams.set("key", apiKey);

    const videosRes = await fetch(videosUrl.toString(), {
      cache: "no-store",
    });

    const videosData = await videosRes.json();

    if (!videosRes.ok) {
      return NextResponse.json(
        {
          error:
            videosData?.error?.message ||
            "YouTube videos isteği başarısız oldu.",
        },
        { status: videosRes.status }
      );
    }

    const videos = (videosData.items || [])
      .map((video: any) => {
        const thumbnail =
          video?.snippet?.thumbnails?.high?.url ||
          video?.snippet?.thumbnails?.medium?.url ||
          video?.snippet?.thumbnails?.default?.url ||
          "";

        return {
          id: video.id,
          title: video?.snippet?.title || "",
          channel: video?.snippet?.channelTitle || "",
          publishedAt: video?.snippet?.publishedAt || "",
          views: Number(video?.statistics?.viewCount || 0),
          likes: Number(video?.statistics?.likeCount || 0),
          durationSec: isoDurationToSeconds(video?.contentDetails?.duration || "PT0S"),
          thumbnail,
          url: `https://www.youtube.com/watch?v=${video.id}`,
        };
      })
      .sort((a: any, b: any) => b.views - a.views);

    return NextResponse.json({
      success: true,
      query,
      regionCode,
      language,
      videos,
    });
  } catch (e: any) {
    console.error("youtube-research error:", e);

    return NextResponse.json(
      { error: e?.message || "YouTube research error" },
      { status: 500 }
    );
  }
}
