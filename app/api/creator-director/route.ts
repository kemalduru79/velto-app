import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_CONTEXT_LENGTH = 24_000;

type DirectorMode = "help" | "project";
type DirectorHistoryMessage = {
  role?: "user" | "assistant";
  content?: string;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({ apiKey });
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeMode(value: unknown): DirectorMode {
  return value === "help" ? "help" : "project";
}

function sanitizeHistory(value: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => item as DirectorHistoryMessage)
    .filter(
      (item): item is Required<DirectorHistoryMessage> =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        Boolean(item.content.trim()),
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }));
}

function sanitizeContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "{}";
  }

  const serialized = JSON.stringify(value);
  return serialized.length > MAX_CONTEXT_LENGTH
    ? `${serialized.slice(0, MAX_CONTEXT_LENGTH)}…`
    : serialized;
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
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

    const body = await req.json();
    const message = safeText(body?.message, MAX_MESSAGE_LENGTH);
    const language = body?.language === "en" ? "en" : "tr";
    const mode = safeMode(body?.mode);
    const history = sanitizeHistory(body?.history);
    const context = sanitizeContext(body?.context);

    if (!message) {
      return NextResponse.json({ error: "Mesaj zorunludur." }, { status: 400 });
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_CREATOR_DIRECTOR_MODEL || "gpt-5-mini";
    const modeInstruction =
      mode === "help"
        ? "Answer as a product-use specialist. Explain how to use CreatorLab, where a control is located, why an action may be unavailable, and what the quality or export options mean. Do not invent capabilities that are not present in the supplied product context."
        : "Answer as a project-aware creative director. Use the supplied brief, selected strategy, scenes, production status, selected scene, publishing state, and validation blockers. Give a specific recommendation for this project rather than generic content advice.";

    const instructions = `
You are Creator Director inside VELTO CreatorLab, a professional creator-production workspace for adults.
${modeInstruction}

Operating rules:
- Reply in ${language === "en" ? "English" : "Turkish"}.
- Keep the response concise, actionable and easy to scan. Prefer 2-5 short paragraphs or a very small list.
- Never claim that you changed the project, generated media, spent credits, deleted an asset, exported a package, or completed an action. You only advise in this version.
- Never trigger or imply automatic paid-media generation. Image, voice, video and export actions require explicit user confirmation in the main workspace.
- Do not expose internal provider or model names. Discuss user-facing quality levels, expected results and credit implications only.
- Do not recommend selecting video for every scene. Respect the user's explicit scene-output decisions.
- If the project context is insufficient, say exactly which missing decision or asset blocks a reliable answer.
- For legal, medical, financial or factual claims intended for publication, remind the creator to verify the claim before release.
- Do not use child-oriented Storyverse language, mascots or assumptions.
`;

    const conversation = history
      .map((item) => `${item.role === "user" ? "USER" : "DIRECTOR"}: ${item.content}`)
      .join("\n");

    const input = `
CURRENT CREATORLAB CONTEXT (structured JSON):
${context}

RECENT CONVERSATION:
${conversation || "No previous messages."}

CURRENT USER MESSAGE:
${message}
`;

    const response = await client.responses.create({
      model,
      instructions,
      input,
      max_output_tokens: 700,
      store: false,
    });

    const answer = response.output_text?.trim();

    if (!answer) {
      return NextResponse.json(
        { error: "Creator Director yanıt oluşturamadı." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      answer,
      mode,
      model,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : null,
    });
  } catch (error) {
    console.error("creator-director error:", error);

    return NextResponse.json(
      {
        error:
          (error instanceof Error ? error.message : "") ||
          "Creator Director geçici olarak kullanılamıyor.",
      },
      { status: 500 },
    );
  }
}
