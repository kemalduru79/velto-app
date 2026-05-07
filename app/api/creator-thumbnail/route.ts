import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type SupportedLanguage = "tr" | "en";

type ThumbnailPlan = {
  headline: string;
  subHeadline: string;
  imagePrompt: string;
};

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

function clampText(value: string, maxLength: number) {
  const text = safeString(value);

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength).trim();
}

function extractJsonObject(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("Thumbnail planning JSON could not be parsed.");
  }
}

function normalizeHeadline(value: string, language: SupportedLanguage) {
  const cleaned = safeString(value)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[.]+$/g, "")
    .trim();

  if (!cleaned) {
    return language === "tr" ? "BU NASIL?!" : "HOW?!";
  }

  const words = cleaned.split(" ").filter(Boolean);
  const maxWords = 4;
  const shortened = words.length > maxWords ? words.slice(0, maxWords).join(" ") : cleaned;
  const withPunch = /[!?]$/.test(shortened) ? shortened : `${shortened}?!`;

  return withPunch.toUpperCase();
}

function getFallbackHeadline({
  productionPackage,
  metadata,
  language,
}: {
  productionPackage: any;
  metadata: any;
  language: SupportedLanguage;
}) {
  const hook = safeString(productionPackage?.hook);
  const title = safeString(metadata?.recommendedTitle, safeString(productionPackage?.title));
  const source = hook || title;

  if (/octopus|octop/i.test(source)) {
    return language === "tr" ? "3 KALP?!" : "THREE HEARTS?!";
  }

  if (/rocket|roket/i.test(source)) {
    return language === "tr" ? "ROKET GÜCÜ?!" : "ROCKET POWER?!";
  }

  if (/gravity|yer çekimi|yerçekimi/i.test(source)) {
    return language === "tr" ? "YER ÇEKİMİ YOK?!" : "NO GRAVITY?!";
  }

  if (/sun|güneş/i.test(source)) {
    return language === "tr" ? "GÜNEŞ YOK?!" : "NO SUN?!";
  }

  return language === "tr" ? "BU NASIL?!" : "HOW?!";
}

function buildFallbackPlan({
  productionPackage,
  metadata,
  language,
}: {
  productionPackage: any;
  metadata: any;
  language: SupportedLanguage;
}): ThumbnailPlan {
  const headline = getFallbackHeadline({ productionPackage, metadata, language });
  const title = safeString(productionPackage?.title, safeString(metadata?.recommendedTitle, "kids science video"));
  const hook = safeString(productionPackage?.hook, safeString(metadata?.audiencePromise));

  return {
    headline,
    subHeadline: "",
    imagePrompt: [
      `Topic: ${title}`,
      hook ? `Core surprise: ${hook}` : "",
      "Joe, the recurring 10-year-old guide character, reacts with a huge shocked expression.",
      "One massive focal object related to the topic dominates the other side of the frame.",
      "Use strong contrast, cinematic lighting, clean background, bold color separation, and emotional visual storytelling.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function normalizePlan(plan: any, fallback: ThumbnailPlan, language: SupportedLanguage): ThumbnailPlan {
  const headline = normalizeHeadline(safeString(plan?.headline, fallback.headline), language);
  const subHeadline = clampText(safeString(plan?.subHeadline, fallback.subHeadline), 48);
  const imagePrompt = clampText(safeString(plan?.imagePrompt, fallback.imagePrompt), 1400);

  return {
    headline,
    subHeadline,
    imagePrompt,
  };
}

export async function POST(req: Request) {
  try {
    const client = getOpenAIClient();
    const body = await req.json();

    const productionPackage = body?.package || {};
    const metadata = body?.metadata || {};
    const language: SupportedLanguage = body?.language === "tr" ? "tr" : "en";
    const targetMarket = safeString(body?.targetMarket, "global");
    const ageGroup = safeString(body?.ageGroup, "8-12");
    const contentType = safeString(body?.contentType, "educational");
    const videoDurationSec = Number(body?.videoDurationSec || productionPackage?.durationSec || 60);

    const fallbackPlan = buildFallbackPlan({ productionPackage, metadata, language });

    const planningPrompt = `
You are a senior YouTube thumbnail strategist for child-safe curiosity, science, and story videos.

Return STRICT JSON only:
{
  "headline": "1-4 word thumbnail headline",
  "subHeadline": "optional 0-4 word support phrase",
  "imagePrompt": "detailed thumbnail image prompt"
}

MISSION:
Create a scroll-stopping thumbnail concept, NOT an educational poster.

Audience:
- Language for text ideas: ${language === "tr" ? "Turkish" : "English"}
- Audience age: ${ageGroup}
- Target market: ${targetMarket}
- Content type: ${contentType}
- Duration target: ${videoDurationSec} seconds

Thumbnail psychology rules:
- Headline must be extremely short: 1-4 words.
- Avoid weak openings like "Did you know", "Discover", "Learn", "Explained", "Fun Facts".
- Use surprise, mystery, or impossible curiosity.
- Prefer question/exclamation energy.
- The image must have ONE dominant focal object.
- Joe must have a strong reaction: shocked, amazed, confused, or "no way" expression.
- Composition should feel like a clickable YouTube thumbnail, not a school worksheet, poster, infographic, or title card.
- Avoid clutter, tiny details, small text blocks, labels, diagrams, educational panels, or multi-line poster text.
- No brand logos, YouTube UI, copyrighted characters, or celebrity likenesses.
- Child-safe, positive, colorful, and friendly.

Composition formula:
- Left or right side: Joe close-up with a huge expressive face.
- Opposite side: one oversized topic object with dramatic lighting.
- Background: simple, high contrast, clean, colorful.
- Text space: leave clean empty space for a short headline; do not design a full poster.

Production package:
Title: ${safeString(productionPackage?.title, "Untitled")}
Hook: ${safeString(productionPackage?.hook)}
Story premise: ${safeString(productionPackage?.storyPremise)}
Thumbnail idea: ${safeString(productionPackage?.thumbnailIdea)}
Recommended metadata title: ${safeString(metadata?.recommendedTitle)}
Audience promise: ${safeString(metadata?.audiencePromise)}
Thumbnail text ideas: ${Array.isArray(metadata?.thumbnailTextIdeas) ? metadata.thumbnailTextIdeas.join(" | ") : ""}
`;

    let plan = fallbackPlan;

    try {
      const planning = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.45,
        messages: [
          {
            role: "system",
            content: "Return strict JSON only. No markdown. No explanations.",
          },
          {
            role: "user",
            content: planningPrompt,
          },
        ],
      });

      const parsed = extractJsonObject(planning.choices?.[0]?.message?.content || "{}");
      plan = normalizePlan(parsed, fallbackPlan, language);
    } catch (planningError) {
      console.warn("creator-thumbnail planning fallback used:", planningError);
      plan = normalizePlan(fallbackPlan, fallbackPlan, language);
    }

    const finalImagePrompt = `
Create a premium 16:9 YouTube thumbnail image for a child-safe curiosity video.

THUMBNAIL HEADLINE CONCEPT:
${plan.headline}

SUPPORTING CONCEPT:
${plan.subHeadline || "none"}

SCENE DIRECTION:
${plan.imagePrompt}

MANDATORY VISUAL RULES:
- Make this look like a high-CTR YouTube thumbnail, not an educational poster.
- Show Joe, the recurring 10-year-old guide character, close to camera with a huge expressive reaction.
- Joe visual identity: short slightly messy brown hair, large green eyes, expressive friendly face, yellow hoodie, blue jeans.
- Use one oversized focal object connected to the topic.
- Use bold contrast, cinematic lighting, bright kid-friendly colors, and strong depth.
- Keep the composition simple and readable on a phone screen.
- Leave clean space for a short headline overlay.
- Prefer no rendered text inside the image. If text appears, it must be only the exact short headline: "${plan.headline}".

ANTI-POSTER RULES:
- No multi-line subtitles.
- No educational poster layout.
- No infographic panels.
- No labels or arrows unless absolutely necessary.
- No tiny text.
- No cluttered background.
- No brand logos, YouTube UI, copyrighted characters, celebrity likenesses, scary violence, medical gore, politics, or adult themes.

STYLE:
premium animated kids science thumbnail, expressive cartoon movie style, high visual impact, clean composition, strong emotional storytelling, highly clickable, safe and friendly.
`;

    const image = await client.images.generate({
      model: "gpt-image-1",
      size: "1536x1024",
      quality: "high",
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
        headline: plan.headline,
        subHeadline: plan.subHeadline,
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
