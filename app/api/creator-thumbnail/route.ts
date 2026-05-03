import { NextResponse } from "next/server";
import OpenAI from "openai";

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
    const client = getOpenAIClient();
    const body = await req.json();

    const productionPackage = body?.package || {};
    const metadata = body?.metadata || {};
    const language = body?.language === "tr" ? "tr" : "en";
    const targetMarket = safeString(body?.targetMarket, "global");
    const ageGroup = safeString(body?.ageGroup, "8-12");
    const contentType = safeString(body?.contentType, "educational");
    const videoDurationSec = Number(body?.videoDurationSec || productionPackage?.durationSec || 60);

    const planningPrompt = `
You are a YouTube thumbnail creative director for child-safe educational/story videos.

Return STRICT JSON only:
{
  "headline": "2-5 word thumbnail headline",
  "subHeadline": "optional short supporting phrase",
  "imagePrompt": "detailed thumbnail image prompt"
}

Rules:
- Language for text ideas: ${language === "tr" ? "Turkish" : "English"}.
- Audience age: ${ageGroup}.
- Target market: ${targetMarket}.
- Content type: ${contentType}.
- Duration target: ${videoDurationSec} seconds.
- Child-safe, positive, colorful, curiosity-driven.
- Thumbnail should be 16:9 YouTube style.
- Avoid scary, violent, medical, political, or adult themes.
- Keep any visible text minimal and large.
- The image prompt must describe a clean, high-contrast, animated/cartoon-style thumbnail with a clear focal character/object.
- Do not use brand logos, YouTube UI, copyrighted characters, or celebrity likenesses.

Production package:
Title: ${safeString(productionPackage?.title, "Untitled")}
Hook: ${safeString(productionPackage?.hook)}
Story premise: ${safeString(productionPackage?.storyPremise)}
Thumbnail idea: ${safeString(productionPackage?.thumbnailIdea)}
Recommended metadata title: ${safeString(metadata?.recommendedTitle)}
Audience promise: ${safeString(metadata?.audiencePromise)}
`;

    const planning = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "Return strict JSON only. No markdown.",
        },
        {
          role: "user",
          content: planningPrompt,
        },
      ],
    });

    const parsed = parseJsonObject(planning.choices?.[0]?.message?.content || "{}");

    const headline = safeString(parsed.headline, safeString(metadata?.recommendedTitle, safeString(productionPackage?.title, "Thumbnail")));
    const subHeadline = safeString(parsed.subHeadline);
    const imagePrompt = safeString(parsed.imagePrompt);

    const finalImagePrompt = `
Create a YouTube thumbnail image in wide landscape composition.

Style: colorful animated children's educational video thumbnail, high contrast, clean composition, expressive character or object, bright background, cinematic lighting, safe and friendly, no logos, no copyrighted characters, no celebrity likeness.

Main headline concept: ${headline}
Supporting concept: ${subHeadline}
Scene direction: ${imagePrompt}

Important:
- Do not render small unreadable text.
- If text appears, keep it minimal, large, and clean.
- Make it suitable for children ages ${ageGroup}.
`;

    const image = await client.images.generate({
      model: "gpt-image-1",
      size: "1536x1024",
      quality: "medium",
      n: 1,
      prompt: finalImagePrompt,
    });

    const b64 = image.data?.[0]?.b64_json;

    if (!b64) {
      throw new Error("Thumbnail image could not be generated.");
    }

    const imageUrl = `data:image/png;base64,${b64}`;

    return NextResponse.json({
      ok: true,
      thumbnail: {
        imageUrl,
        prompt: finalImagePrompt.trim(),
        headline,
        subHeadline,
      },
    });
  } catch (error: any) {
    console.error("creator-thumbnail error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Thumbnail generation failed.",
      },
      { status: 500 }
    );
  }
}
