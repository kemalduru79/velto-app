import { NextResponse } from "next/server";
import OpenAI from "openai";
import { enforceCreatorApiBoundary } from "@/lib/security/creatorApiBoundary";
import { checkStorageGenerationAllowance, storageQuotaFullResponse } from "@/lib/persistence/media/storageQuota.server";

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
  const source = safeString(
    metadata?.recommendedTitle,
    safeString(productionPackage?.title, safeString(productionPackage?.hook)),
  )
    .replace(/[“”"'!?.,:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = source.split(" ").filter(Boolean).slice(0, 4);
  const fallback = language === "tr" ? "NEDEN ÖNEMLİ" : "WHY IT MATTERS";

  return normalizeHeadline(words.join(" ") || fallback, language);
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
  const title = safeString(
    productionPackage?.title,
    safeString(metadata?.recommendedTitle, "professional creator video"),
  );
  const hook = safeString(productionPackage?.hook, safeString(metadata?.audiencePromise));

  return {
    headline,
    subHeadline: "",
    imagePrompt: [
      `Topic: ${title}`,
      hook ? `Core promise or tension: ${hook}` : "",
      "Use a professional presenter, faceless creator visual, product-led composition, or bold symbolic subject according to the topic.",
      "One dominant focal subject should control the composition.",
      "Use strong contrast, cinematic lighting, clean background, bold color separation, and professional visual storytelling.",
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
    const secured = await enforceCreatorApiBoundary<any>(req, "creator-thumbnail");
    if (!secured.ok) return secured.response;
    const body = secured.context.body;
    const storageAllowance = await checkStorageGenerationAllowance(secured.context.user.id);
    if (!storageAllowance.allowed) return storageQuotaFullResponse(storageAllowance.storage);
    const client = getOpenAIClient();

    const productionPackage = body?.package || {};
    const metadata = body?.metadata || {};
    const language: SupportedLanguage = body?.language === "tr" ? "tr" : "en";
    const targetMarket = safeString(body?.targetMarket, "global");
    const ageGroup = safeString(body?.ageGroup, "professional_18");
    const contentType = safeString(body?.contentType, "educational_explainer");
    const creatorFormat =
      body?.creatorFormat === "short_form" ? "short_form" : "youtube_video";
    const targetPlatforms = Array.isArray(body?.targetPlatforms)
      ? body.targetPlatforms
          .filter((item: unknown) => typeof item === "string")
          .map((item: string) => item.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const videoDurationSec = Number(body?.videoDurationSec || productionPackage?.durationSec || 60);

    const fallbackPlan = buildFallbackPlan({ productionPackage, metadata, language });

    const planningPrompt = `
You are a senior thumbnail strategist for professional 18+ creator content.

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
- Primary format: ${creatorFormat === "short_form" ? "vertical short-form" : "landscape YouTube video"}
- Selected platforms: ${targetPlatforms.join(", ") || "not specified"}

Thumbnail psychology rules:
- Headline must be extremely short: 1-4 words.
- Avoid weak openings like "Did you know", "Discover", "Learn", "Explained", "Fun Facts".
- Use surprise, mystery, or impossible curiosity.
- Prefer question/exclamation energy.
- The image must have ONE dominant focal object.
- Use a professional presenter, faceless creator visual, product-led composition, or bold symbolic subject according to the topic.
- Never insert a default recurring character that the user did not request.
- Composition should feel like a clickable YouTube thumbnail, not a school worksheet, poster, infographic, or title card.
- Avoid clutter, tiny details, small text blocks, labels, diagrams, educational panels, or multi-line poster text.
- No brand logos, YouTube UI, copyrighted characters, or celebrity likenesses.
- Audience-appropriate, credible, visually compelling, and brand-safe.

Composition formula:
- Left or right side: one dominant presenter, product, or symbolic subject.
- Opposite side: one supporting focal object or clean negative space with dramatic lighting.
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
Create premium thumbnail base art for professional creator content.

PRIMARY DELIVERY:
${creatorFormat === "short_form"
  ? "Vertical short-form cover composition. Keep the central subject crop-safe for 9:16."
  : "Landscape YouTube thumbnail composition. Keep the central subject crop-safe for 16:9."}

THUMBNAIL HEADLINE CONCEPT:
${plan.headline}

SUPPORTING CONCEPT:
${plan.subHeadline || "none"}

SCENE DIRECTION:
${plan.imagePrompt}

MANDATORY VISUAL RULES:
- Make this look platform-native and high-impact, not like a presentation slide, poster, or infographic.
- Use one dominant presenter, product, or symbolic focal subject appropriate to the production package.
- Do not insert a child presenter, recurring mascot, or default character unless explicitly requested by the production package.
- Use bold contrast, cinematic lighting, strong depth, clean negative space, and mobile-readable visual hierarchy.
- Leave clean space for a short headline overlay.
- Prefer no rendered text inside the image. The app overlays typography separately.
- No brand logos, platform UI, copyrighted characters, celebrity likenesses, misleading claims, graphic violence, or unsafe content.

ANTI-POSTER RULES:
- No multi-line subtitles.
- No infographic panels.
- No labels, arrows, tiny text, watermarks, or cluttered background.
- No generic AI slideshow look.
- No distorted anatomy or unreadable faces.

STYLE:
premium professional creator thumbnail, cinematic editorial lighting, strong emotional or conceptual storytelling, clean composition, high visual impact, credible and audience-appropriate.
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
