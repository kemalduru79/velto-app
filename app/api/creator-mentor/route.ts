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

function normalizeCreatorAudienceProfile(value: unknown): string {
  const raw = asString(value, "professional_18").toLowerCase();

  if (["6-8", "8-12", "10-16", "13-17"].includes(raw)) {
    return "professional_18";
  }

  if (raw.includes("broad")) {
    return "broad_18";
  }

  if (raw.includes("mainstream")) {
    return "mainstream_18";
  }

  if (raw.includes("niche") || raw.includes("expert")) {
    return "niche_18";
  }

  return "professional_18";
}

function audienceProfileLabel(value: string): string {
  switch (value) {
    case "broad_18":
      return "broad adult consumer audience, 18+";
    case "mainstream_18":
      return "mainstream adult audience, 18+";
    case "niche_18":
      return "niche expert or enthusiast audience, 18+";
    case "professional_18":
    default:
      return "professional or B2B adult audience, 18+";
  }
}

function sanitizeCreatorText(value: string): string {
  return value
    .replace(/\bJoe\b/g, "the creator")
    .replace(/\bteen viewers\b/gi, "adult viewers")
    .replace(/\bGen Z attention spans\b/gi, "platform-native attention spans")
    .replace(/\byoung viewers\b/gi, "adult viewers")
    .replace(/\bfor teens\b/gi, "for adult viewers")
    .replace(/\bteens\b/gi, "adult viewers")
    .replace(/\bteen\b/gi, "adult")
    .replace(/\bchildren\b/gi, "viewers")
    .replace(/\bkids\b/gi, "viewers")
    .replace(/\bparents\b/gi, "decision-makers")
    .replace(/\bclassroom\b/gi, "professional learning context");
}

function sanitizeStringArray(items: string[]): string[] {
  return items.map(sanitizeCreatorText).filter(Boolean);
}

type CreatorMentorIdea = {
  title: string;
  concept: string;
};

function normalizeAnalysis(parsed: any, topic: string): CreatorMentorAnalysis {
  const fallbackHook = `Wait… ${topic.replace(/[?.!]+$/g, "")}?!`;

  const videoIdeas: CreatorMentorIdea[] = Array.isArray(parsed?.videoIdeas)
    ? parsed.videoIdeas
        .map((item: any) => ({
          title: asString(item?.title),
          concept: asString(item?.concept),
        }))
        .filter((item: any) => item.title && item.concept)
        .slice(0, 5)
    : [];

  const safeIdeas: CreatorMentorIdea[] = videoIdeas.length
    ? videoIdeas
    : [
        {
          title: topic,
          concept:
            "A professional creator-format video concept that turns the topic into a clear hook, structured narrative, strong viewer payoff, and platform-ready production angle.",
        },
      ];

  const recommendedTitle =
    asString(parsed?.recommendedIdea?.title) || safeIdeas[0]?.title || topic;

  return {
    audienceInsight: sanitizeStringArray(
      toStringArray(parsed?.audienceInsight, [
        "Professional viewers respond to clear value, strong first-5-second hooks, credible framing, and practical takeaways.",
        "CreatorLab should optimize the idea for platform performance, audience retention, thumbnail clarity, and publish-ready positioning.",
        "Use a professional narrator, faceless creator format, brand voice, or presenter concept only when it fits the selected adult audience and topic.",
      ]).slice(0, 5),
    ),
    hookPatterns: sanitizeStringArray(
      toStringArray(parsed?.hookPatterns, [
        fallbackHook,
        "Open with a surprising visual reveal in the first 3 seconds.",
        "Avoid slow openings like 'Did you know'; use shock, urgency, or a direct question.",
      ]).slice(0, 5),
    ),
    videoIdeas: safeIdeas.map((item: CreatorMentorIdea) => ({
      title: sanitizeCreatorText(item.title),
      concept: sanitizeCreatorText(item.concept),
    })),
    recommendedIdea: {
      title: sanitizeCreatorText(recommendedTitle),
      reason: sanitizeCreatorText(
        asString(parsed?.recommendedIdea?.reason) ||
          "This idea has a clear audience promise, strong hook potential, and fits a professional creator production workflow.",
      ),
    },
    productionPlan: sanitizeStringArray(
      toStringArray(parsed?.productionPlan, [
        "Start with a sharp first-line hook under 8 words.",
        "Make the audience promise clear before adding context.",
        "Break the idea into short retention-focused visual beats.",
        "Use platform-native pacing, concise narration, and clear visual direction.",
        "End with a practical takeaway, call-to-action, or next-step prompt.",
      ]).slice(0, 7),
    ),
  };
}

export async function POST(req: Request) {
  try {
    const client = getOpenAIClient();
    const body = await req.json().catch(() => null);

    const topic = asString(body?.topic);
    const country = asString(body?.country, "Global / International");
    const audienceProfile = normalizeCreatorAudienceProfile(body?.ageGroup);
    const audienceProfileText = audienceProfileLabel(audienceProfile);
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
      : "No YouTube trend data was provided. Use professional YouTube creator strategy, retention, thumbnail, and short-form best practices.";

    const systemPrompt = `
You are a senior YouTube creator strategist for CreatorLab.
You design professional 18+ creator content for YouTube, Shorts, Reels, TikTok, and faceless or presenter-led social video workflows.

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
- Do not use Joe, children, parents, teens, teen viewers, Gen Z, classroom framing, school framing, or child-cartoon assumptions unless the user explicitly asks for them in the topic or brief.
- Optimize for professional creator output: strong audience promise, retention, authority, clarity, and platform performance.
- Example strong hooks:
  - "This trend is already changing work."
  - "Most creators are missing this."
  - "Here is the signal behind the hype."

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

Audience profile:
${audienceProfileText}

Content type:
${contentType}

Format:
${format}

Creator format rules:
- CreatorLab is an 18+ professional creator production engine.
- Treat the selected audience as adults only: ${audienceProfileText}.
- Do not default to Joe, child/teen characters, teen audience language, parent reassurance, or classroom framing.
- Prefer faceless documentary, professional narrator, brand voice, subject-matter host, product-led, or presenter-led concepts depending on the selected adult audience profile.
- If the user explicitly names a character, preserve it; otherwise keep the recommendation character-neutral.

YouTube data sample:
${youtubeContext}

Create a mentor analysis optimized for high CTR, strong first 5 seconds, retention, professional creator quality, thumbnail potential, and publish-ready production planning. Do not mention teens, parents, children, Joe, classroom, or young viewers unless the topic itself explicitly asks for that audience.
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
