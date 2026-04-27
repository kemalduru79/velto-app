import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

type CreatorMentorRequest = {
  topic?: string;
  country?: string;
  ageGroup?: string;
  contentType?: string;
  format?: string;
  language?: "tr" | "en";
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
      "You do not browse the web in this MVP.",
      "You infer patterns from general platform knowledge and the target market provided by the user.",
      "You must return strict JSON only.",
      "No markdown. No code fences.",
    ].join(" ");

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
        "Avoid claiming you analyzed live YouTube data.",
        "Mention if assumptions are based on general pattern inference rather than live API data."
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
      temperature: 0.7,
    });

    const rawText = response.output_text || "";

    let parsed: any;

    try {
      parsed = JSON.parse(rawText);
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
