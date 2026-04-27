import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

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

type CreatorMentorRequest = {
  topic?: string;
  country?: string;
  ageGroup?: string;
  contentType?: string;
  format?: string;
  language?: "tr" | "en";
  youtubeData?: YoutubeResearchVideo[];
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeIdeas(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const idea = item as { title?: unknown; concept?: unknown };
      return {
        title: String(idea?.title || "").trim(),
        concept: String(idea?.concept || "").trim(),
      };
    })
    .filter((item) => item.title && item.concept)
    .slice(0, 5);
}

function normalizeYoutubeData(value: unknown): YoutubeResearchVideo[] {
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
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
    .slice(0, 12);
}

function extractJsonObject(rawText: string) {
  try {
    return JSON.parse(rawText);
  } catch {
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = rawText.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced);
    }

    throw new Error("JSON parse failed");
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Geçersiz oturum." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as CreatorMentorRequest | null;

    const topic = String(body?.topic || "").trim();
    const country = String(body?.country || "Global / International").trim();
    const ageGroup = String(body?.ageGroup || "8-12").trim();
    const contentType = String(body?.contentType || "Educational").trim();
    const format = String(body?.format || "Shorts / 60 sec").trim();
    const language = body?.language === "tr" ? "tr" : "en";
    const youtubeData = normalizeYoutubeData(body?.youtubeData);

    if (!topic) {
      return NextResponse.json(
        { error: "topic zorunlu." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY tanımlı değil." },
        { status: 500 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = [
      "You are a senior YouTube content strategist for safe, child-friendly animated videos.",
      "You are building a creator mentor analysis before video production.",
      "If YouTube data is provided, use it as market signal data to identify title, hook, duration, and topic patterns.",
      "If YouTube data is not provided, infer from general platform best practices.",
      "Do not claim you browsed live YouTube unless YouTube data is included in the request.",
      "Return strict JSON only. No markdown. No code fences.",
      "JSON keys must always stay in English, even if outputLanguage is Turkish.",
    ].join(" ");

    const youtubeResearchSummary = youtubeData.map((video, index) => ({
      rank: index + 1,
      title: video.title,
      channel: video.channel,
      views: video.views,
      likes: video.likes,
      durationSec: video.durationSec,
      publishedAt: video.publishedAt,
      url: video.url,
    }));

    const userPrompt = {
      task: "Create a creator mentor analysis before video production.",
      target: {
        market: country,
        ageGroup,
        contentType,
        format,
        outputLanguage: language === "en" ? "English" : "Turkish",
      },
      topic,
      youtubeDataAvailable: youtubeResearchSummary.length > 0,
      youtubeResearchData: youtubeResearchSummary,
      requiredJsonShape: {
        audienceInsight: ["string", "string", "string"],
        hookPatterns: ["string", "string", "string"],
        videoIdeas: [
          { title: "string", concept: "string" },
          { title: "string", concept: "string" },
          { title: "string", concept: "string" },
          { title: "string", concept: "string" },
          { title: "string", concept: "string" }
        ],
        recommendedIdea: {
          title: "string",
          reason: "string"
        },
        productionPlan: ["string", "string", "string", "string", "string"]
      },
      rules: [
        "Optimize for retention, curiosity, and simple animation.",
        "Keep recommendations age-appropriate and safe.",
        "Focus on practical creator guidance, not just story generation.",
        "If YouTube data is available, explicitly use title patterns, duration patterns, and view concentration signals.",
        "If YouTube data is available, avoid copying titles exactly; create inspired but original ideas.",
        "If YouTube data is available, include one audience insight that starts with 'Based on the YouTube sample...' or its Turkish equivalent.",
        "If YouTube data is not available, mention that the analysis is based on general pattern inference.",
        "Keep JSON values concise and actionable."
      ]
    };

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(userPrompt),
        },
      ],
      temperature: 0.6,
    });

    const rawText = response.output_text || "";

    let parsed: any;

    try {
      parsed = extractJsonObject(rawText);
    } catch (error) {
      console.error("creator-mentor JSON parse error:", rawText);
      return NextResponse.json(
        { error: "Creator mentor çıktısı JSON olarak parse edilemedi." },
        { status: 500 }
      );
    }

    const videoIdeas = normalizeIdeas(parsed.videoIdeas);

    const analysis = {
      audienceInsight: normalizeStringArray(parsed.audienceInsight),
      hookPatterns: normalizeStringArray(parsed.hookPatterns),
      videoIdeas,
      recommendedIdea: {
        title: String(parsed?.recommendedIdea?.title || videoIdeas[0]?.title || "").trim(),
        reason: String(parsed?.recommendedIdea?.reason || "").trim(),
      },
      productionPlan: normalizeStringArray(parsed.productionPlan),
      youtubeDataUsed: youtubeResearchSummary.length > 0,
      youtubeSampleSize: youtubeResearchSummary.length,
    };

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (e: any) {
    console.error("creator-mentor error:", e);

    return NextResponse.json(
      { error: e?.message || "Creator mentor analizi oluşturulurken hata oluştu." },
      { status: 500 }
    );
  }
}
