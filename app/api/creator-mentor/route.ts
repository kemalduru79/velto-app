import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

type SupportedLanguage = "tr" | "en";

type YoutubeResearchVideo = {
  id?: string;
  title?: string;
  channel?: string;
  publishedAt?: string;
  views?: number;
  likes?: number;
  durationSec?: number;
  url?: string;
};

type CreatorMentorAnalysis = {
  audienceInsight: string[];
  hookPatterns: string[];
  videoIdeas: Array<{
    title: string;
    concept: string;
  }>;
  recommendedIdea: {
    title: string;
    reason: string;
  };
  productionPlan: string[];
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({ apiKey });
}

function normalizeLanguage(value: unknown): SupportedLanguage {
  return value === "en" ? "en" : "tr";
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function compactYoutubeData(videos: unknown): YoutubeResearchVideo[] {
  if (!Array.isArray(videos)) {
    return [];
  }

  return videos.slice(0, 8).map((video: any) => ({
    title: asString(video?.title),
    channel: asString(video?.channel),
    views: Number(video?.views || 0),
    likes: Number(video?.likes || 0),
    durationSec: Number(video?.durationSec || 0),
    publishedAt: asString(video?.publishedAt),
    url: asString(video?.url),
  }));
}

function parseJsonSafely(rawText: string) {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("JSON parse edilemedi");
  }
}

function extractTextFromResponse(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  const textParts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        textParts.push(part.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return normalized.length ? normalized : fallback;
}

function normalizeAnalysis(parsed: any, topic: string): CreatorMentorAnalysis {
  const fallbackHook = `Wait… ${topic.replace(/[?.!]+$/g, "")}?!`;

  const videoIdeas = Array.isArray(parsed?.videoIdeas)
    ? parsed.videoIdeas
        .map((item: any) => ({
          title: asString(item?.title),
          concept: asString(item?.concept),
        }))
        .filter((item: any) => item.title && item.concept)
        .slice(0, 5)
    : [];

  const safeIdeas = videoIdeas.length
    ? videoIdeas
    : [
        {
          title: topic,
          concept:
            "A curiosity-driven animated explainer where Joe guides kids through the surprising answer using fast visuals and one clear learning takeaway.",
        },
      ];

  const recommendedTitle =
    asString(parsed?.recommendedIdea?.title) || safeIdeas[0]?.title || topic;

  return {
    audienceInsight: toStringArray(parsed?.audienceInsight, [
      "Kids aged 8-12 respond well to surprising questions, fast visual reveals, and simple explanations.",
      "Parents are more likely to approve content that combines curiosity, learning value, and a safe animated style.",
      "Joe should act as the guide: he asks the question, reacts with surprise, and helps the audience understand the answer.",
    ]).slice(0, 5),
    hookPatterns: toStringArray(parsed?.hookPatterns, [
      fallbackHook,
      "Open with a surprising visual reveal in the first 3 seconds.",
      "Avoid slow openings like 'Did you know'; use shock, urgency, or a direct question.",
    ]).slice(0, 5),
    videoIdeas: safeIdeas,
    recommendedIdea: {
      title: recommendedTitle,
      reason:
        asString(parsed?.recommendedIdea?.reason) ||
        "This idea has a clear curiosity gap, strong visual potential, and fits a short animated explainer format.",
    },
    productionPlan: toStringArray(parsed?.productionPlan, [
      "Start with a strong Joe-led hook under 7 words.",
      "Show the surprising concept visually before explaining it.",
      "Break the answer into 3 simple visual beats.",
      "Use bright, readable animation and short narration lines.",
      "End with a quick recap and a new curiosity question.",
    ]).slice(0, 7),
  };
}

export async function POST(req: Request) {
  try {
    const client = getOpenAIClient();
    const body = await req.json().catch(() => null);

    const topic = asString(body?.topic);
    const country = asString(body?.country, "Global / International");
    const ageGroup = asString(body?.ageGroup, "8-12");
    const contentType = asString(body?.contentType, "Educational");
    const format = asString(body?.format, "Shorts / 60 sec");
    const language = normalizeLanguage(body?.language);
    const youtubeData = compactYoutubeData(body?.youtubeData);

    if (!topic) {
      return NextResponse.json(
        { success: false, error: "Konu veya video fikri zorunludur." },
        { status: 400 }
      );
    }

    const outputLanguageLine =
      language === "en"
        ? "Generate every field in English."
        : "Tüm alanları Türkçe üret.";

    const youtubeContext = youtubeData.length
      ? JSON.stringify(youtubeData, null, 2)
      : "No YouTube trend data was provided. Use general YouTube kids edutainment best practices.";

    const systemPrompt = `
You are a senior YouTube kids edutainment strategist.
You design content for an AI animated channel with a recurring guide character named Joe.

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON.
- Do not use markdown.
- Do not include comments.
- Do not include text outside JSON.
- Never return arrays alone; always return the full object.
- Keep every string concise and production-ready.

HOOK QUALITY RULES:
- Hooks must be stronger than passive "Did you know" openings.
- Prefer surprise, urgency, contradiction, or a direct curiosity gap.
- At least one hook pattern must be a concrete first-line hook under 7 words.
- Joe may deliver the hook as a guide character.
- Example strong hooks:
  - "Wait… octopuses have THREE hearts?!"
  - "Why does it need 3 hearts?!"
  - "This animal has THREE hearts?!"

Return exactly this JSON structure:
{
  "audienceInsight": ["string", "string", "string"],
  "hookPatterns": ["string", "string", "string"],
  "videoIdeas": [
    { "title": "string", "concept": "string" },
    { "title": "string", "concept": "string" },
    { "title": "string", "concept": "string" }
  ],
  "recommendedIdea": {
    "title": "string",
    "reason": "string"
  },
  "productionPlan": ["string", "string", "string", "string", "string"]
}
`;

    const userPrompt = `
${outputLanguageLine}

Topic / video idea:
${topic}

Target market:
${country}

Age group:
${ageGroup}

Content type:
${contentType}

Format:
${format}

Recurring guide character:
Joe, a curious 10-year-old guide. Joe asks questions and reacts, but the content topic remains the hero.

YouTube data sample:
${youtubeContext}

Create a mentor analysis optimized for high CTR, strong first 5 seconds, child-friendly education, and parent-approved viewing.
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    });

    const rawText = extractTextFromResponse(response);

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: "Modelden metin çıktısı alınamadı." },
        { status: 500 }
      );
    }

    let parsed: any;

    try {
      parsed = parseJsonSafely(rawText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Creator mentor çıktısı JSON olarak parse edilemedi.",
          raw: rawText,
        },
        { status: 500 }
      );
    }

    const analysis = normalizeAnalysis(parsed, topic);

    return NextResponse.json({
      success: true,
      analysis,
      raw: process.env.NODE_ENV === "development" ? rawText : undefined,
    });
  } catch (error: any) {
    console.error("creator-mentor error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Creator mentor analizi oluşturulurken hata oluştu.",
        details:
          process.env.NODE_ENV === "development"
            ? error?.message || "Bilinmeyen hata"
            : undefined,
      },
      { status: 500 }
    );
  }
}
