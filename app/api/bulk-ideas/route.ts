import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BulkIdeaResult = {
  topic: string;
  title: string;
  hook: string;
  score: number;
  angle: string;
  reason: string;
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

function clampScore(value: unknown) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, numeric));
}

function normalizeIdeas(topics: string[], sourceIdeas: any[]): BulkIdeaResult[] {
  return topics.map((topic: string, index: number) => {
    const item = sourceIdeas[index] || {};

    return {
      topic: safeString(item?.topic, topic),
      title: safeString(item?.title, topic),
      hook: safeString(item?.hook, "A curious, kid-friendly video idea."),
      score: clampScore(item?.score),
      angle: safeString(item?.angle, "Educational curiosity angle"),
      reason: safeString(
        item?.reason,
        "Clear topic with child-friendly learning potential."
      ),
    };
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const topics = Array.isArray(body?.topics)
      ? body.topics
          .map((topic: unknown) => safeString(topic))
          .filter(Boolean)
          .slice(0, 12)
      : [];

    if (topics.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "At least one topic is required.",
        },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    const prompt = `
You are a YouTube content strategist for kids/family educational videos.

Create lightweight idea cards for each topic. Do NOT create full scripts, thumbnails, or scenes.

Return one idea per input topic.

Rules:
- Keep titles child-safe and YouTube-friendly.
- Score must be a normal decimal number between 0 and 1, for example 0.74.
- Score based on clarity, curiosity, visual potential, and educational value.
- Avoid unsafe or misleading clickbait.
- Use the requested language where practical.

Context:
Language: ${safeString(body?.language, "en")}
Target market: ${safeString(body?.targetMarket, "global")}
Age group: ${safeString(body?.ageGroup, "8-12")}
Content type: ${safeString(body?.contentType, "educational")}
Format: ${safeString(body?.format, "shorts_60")}

Topics:
${JSON.stringify(topics, null, 2)}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.35,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bulk_ideas_response",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ideas: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    topic: { type: "string" },
                    title: { type: "string" },
                    hook: { type: "string" },
                    score: { type: "number" },
                    angle: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["topic", "title", "hook", "score", "angle", "reason"],
                },
              },
            },
            required: ["ideas"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Return only valid JSON that matches the schema. Do not include markdown.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed: any = { ideas: [] };

    try {
      parsed = JSON.parse(raw);
    } catch (parseError) {
      console.error("bulk-ideas JSON parse error:", parseError, raw);
      parsed = { ideas: [] };
    }

    const sourceIdeas = Array.isArray(parsed?.ideas) ? parsed.ideas : [];
    const ideas = normalizeIdeas(topics, sourceIdeas);

    return NextResponse.json({
      ok: true,
      ideas,
    });
  } catch (error: any) {
    console.error("bulk-ideas error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Bulk idea generation failed.",
      },
      { status: 500 }
    );
  }
}
