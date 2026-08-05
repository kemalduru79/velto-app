import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";

export const runtime = "nodejs";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({ apiKey });
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseJsonObject(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

export async function POST(req: Request) {
  try {
    await authenticateRequest(req);
    const client = getOpenAIClient();
    const body = await req.json();

    const productionPackage = body?.package || {};
    const language = body?.language === "tr" ? "tr" : "en";
    const targetMarket = safeString(body?.targetMarket, "global");
    const ageGroup = safeString(body?.ageGroup, "professional_18");
    const contentType = safeString(body?.contentType, "educational");
    const creatorFormat = body?.creatorFormat === "short_form"
      ? "short_form"
      : "youtube_video";
    const videoDurationSec = Number(body?.videoDurationSec || productionPackage?.durationSec || 60);
    const patternSummary = body?.patternSummary || null;
    const targetPlatforms = normalizeStringArray(
      body?.targetPlatforms,
      creatorFormat === "short_form"
        ? ["youtube_shorts", "instagram_reels", "tiktok"]
        : ["youtube"],
    );

    const scenes = Array.isArray(productionPackage?.scenes)
      ? productionPackage.scenes.slice(0, 12).map((scene: any) => ({
          id: scene?.id,
          text: safeString(scene?.text),
          narration: safeString(scene?.narration),
          dialogue: safeString(scene?.dialogue),
        }))
      : [];

    const prompt = `
You are a senior publishing strategist for professional 18+ creators.

Generate metadata for a YouTube video.

Return STRICT JSON only with this schema:
{
  "titleOptions": ["title 1", "title 2", "title 3"],
  "recommendedTitle": "best title",
  "description": "YouTube description with 2 short paragraphs and a soft call-to-action",
  "hashtags": ["#tag1", "#tag2"],
  "firstComment": "Pinned first comment suggestion",
  "thumbnailTextIdeas": ["2-4 word thumbnail text", "another option", "another option"],
  "seoKeywords": ["keyword 1", "keyword 2"],
  "audiencePromise": "One-sentence promise for the target audience",
  "hookAlternatives": ["alternative first line 1", "alternative first line 2", "alternative first line 3"],
  "chapters": ["00:00 Opening hook", "00:20 First section"],
  "shortCaption": "1-2 sentence Shorts / Reels / TikTok caption",
  "linkedInCaption": "Professional LinkedIn caption with a clear insight and soft call-to-action",
  "uploadChecklist": ["upload checklist item 1", "upload checklist item 2"],
  "publishingNotes": ["practical publishing note 1", "practical publishing note 2"]
}

Rules:
- Output language: ${language === "tr" ? "Turkish" : "English"}.
- Creator audience profile: ${ageGroup}.
- Target market: ${targetMarket}.
- Content type: ${contentType}.
- Target format: ${creatorFormat === "short_form" ? "Shorts / Reels / TikTok" : "YouTube video"}.
- Selected publishing platforms: ${targetPlatforms.join(", ") || "not specified"}.
- Video duration target: ${videoDurationSec} seconds.
- Professional, audience-appropriate, clear and publish-ready.
- Do not assume a child audience, recurring child character, kids-science framing, or educational-story tone unless the production package explicitly requires it.
- Tailor the copy to the selected platforms while keeping one coherent core message.
- Avoid clickbait that overpromises.
- Titles should be YouTube-friendly, curiosity-led, and under 65 characters when possible.
- Generate one recommended title that is the safest publish-ready option, not merely the most dramatic option.
- Description must include: a short hook, a clear value promise, and a soft call-to-action appropriate for the selected audience.
- Hashtags should be relevant, not spammy, max 8.
- First comment should invite thoughtful engagement, e.g. a question or prompt.
- Thumbnail text ideas must be 1-4 words each and readable on a phone.
- Hook alternatives must be concise first spoken lines and meaningfully different from each other.
- Chapters should use timestamp-like labels, be concise, and fit the selected duration. For short-form, return a compact beat list instead of fabricated timestamps.
- The LinkedIn caption should translate the core insight into a professional post, not simply repeat the video description.
- Upload checklist must be practical and short: title, description, thumbnail, hashtags, audience fit, final video check.
- Publishing notes must help the creator decide how to post the video without overpromising performance.

Production package:
Title: ${safeString(productionPackage?.title, "Untitled")}
Hook: ${safeString(productionPackage?.hook)}
Story premise: ${safeString(productionPackage?.storyPremise)}
Existing YouTube title: ${safeString(productionPackage?.youtubeTitle)}
Existing caption: ${safeString(productionPackage?.caption)}
Thumbnail idea: ${safeString(productionPackage?.thumbnailIdea)}
Scenes JSON:
${JSON.stringify(scenes, null, 2)}

Pattern summary, if available:
${JSON.stringify(patternSummary, null, 2)}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You produce strict JSON only. No markdown, no prose outside JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const parsed = parseJsonObject(raw);

    const titleOptions = normalizeStringArray(parsed.titleOptions).slice(0, 3);
    const recommendedTitle =
      safeString(parsed.recommendedTitle) || titleOptions[0] || safeString(productionPackage?.youtubeTitle, "Untitled Video");

    const metadata = {
      titleOptions: titleOptions.length > 0 ? titleOptions : [recommendedTitle],
      recommendedTitle,
      description: safeString(parsed.description, safeString(productionPackage?.caption)),
      hashtags: normalizeStringArray(parsed.hashtags).slice(0, 8),
      firstComment: safeString(parsed.firstComment),
      thumbnailTextIdeas: normalizeStringArray(parsed.thumbnailTextIdeas).slice(0, 5),
      seoKeywords: normalizeStringArray(parsed.seoKeywords).slice(0, 12),
      audiencePromise: safeString(parsed.audiencePromise),
      hookAlternatives: normalizeStringArray(parsed.hookAlternatives).slice(0, 3),
      chapters: normalizeStringArray(parsed.chapters).slice(0, 12),
      shortCaption: safeString(parsed.shortCaption),
      linkedInCaption: safeString(parsed.linkedInCaption),
      uploadChecklist: normalizeStringArray(parsed.uploadChecklist).slice(0, 8),
      publishingNotes: normalizeStringArray(parsed.publishingNotes).slice(0, 8),
    };

    return NextResponse.json({ ok: true, metadata });
  } catch (error: any) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    console.error("creator-youtube-metadata error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "YouTube metadata generation failed.",
      },
      { status: 500 }
    );
  }
}
