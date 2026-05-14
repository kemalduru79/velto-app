import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type SupportedLanguage = "tr" | "en";

type ReflectionRequest = {
  language?: SupportedLanguage;
  professionTitle?: string;
  missionTitle?: string;
  decisionTitle?: string;
  decisionScenario?: string;
  selectedOption?: string;
  selectedEffect?: string;
  traitProfile?: Record<string, unknown>;
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

function asText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  const textParts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const contentItem of content) {
      if (typeof contentItem?.text === "string") {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

function buildSystemPrompt(language: SupportedLanguage) {
  return language === "en"
    ? [
        "You are VELTO AI Career Lab's child-safe mentor reflection assistant.",
        "Help a child think deeper about one decision inside an interactive profession simulation.",
        "Never position this as a career test, diagnosis, psychological assessment, or deterministic recommendation.",
        "Do not say whether the child is good or bad at a profession.",
        "Use warm, reflective language suitable for ages 9-15.",
        "Focus on reasoning, trade-offs, alternatives, risks, empathy, teamwork, focus, courage, creativity, and learning.",
      ].join(" ")
    : [
        "Sen VELTO AI Career Lab'in çocuk güvenli mentor reflection asistanısın.",
        "Interaktif meslek simülasyonunda verilen tek bir karar üzerine çocuğun daha derin düşünmesine yardım et.",
        "Bunu kariyer testi, tanı, psikolojik değerlendirme veya kesin kariyer önerisi gibi konumlandırma.",
        "Çocuğun bir meslekte iyi ya da kötü olduğunu söyleme.",
        "9-15 yaşa uygun, sıcak ve düşündürücü bir dil kullan.",
        "Akıl yürütme, seçeneklerin bedeli, alternatifler, riskler, empati, takım çalışması, odak, cesaret, yaratıcılık ve öğrenmeye odaklan.",
      ].join(" ");
}

function buildUserPrompt(body: ReflectionRequest, language: SupportedLanguage) {
  const professionTitle = asText(body.professionTitle, "Career Lab");
  const missionTitle = asText(body.missionTitle, "Interactive Mission");
  const decisionTitle = asText(body.decisionTitle, "Decision");
  const decisionScenario = asText(body.decisionScenario, "-");
  const selectedOption = asText(body.selectedOption, "-");
  const selectedEffect = asText(body.selectedEffect, "-");

  if (language === "en") {
    return [
      `Profession: ${professionTitle}`,
      `Mission: ${missionTitle}`,
      `Decision: ${decisionTitle}`,
      `Scenario: ${decisionScenario}`,
      `Selected option: ${selectedOption}`,
      `Local effect: ${selectedEffect}`,
      `Current trait profile: ${JSON.stringify(body.traitProfile || {}, null, 2)}`,
      "",
      "Create a mentor reflection in Markdown with exactly these sections:",
      "## What this decision shows",
      "## Trade-off to think about",
      "## A deeper question",
      "## Try this next",
      "",
      "Keep it under 180 words.",
    ].join("\n");
  }

  return [
    `Meslek: ${professionTitle}`,
    `Görev: ${missionTitle}`,
    `Karar: ${decisionTitle}`,
    `Senaryo: ${decisionScenario}`,
    `Seçilen seçenek: ${selectedOption}`,
    `Yerel etki: ${selectedEffect}`,
    `Mevcut trait profili: ${JSON.stringify(body.traitProfile || {}, null, 2)}`,
    "",
    "Markdown formatında, tam olarak şu bölümlerle mentor reflection oluştur:",
    "## Bu karar ne gösteriyor",
    "## Üzerinde düşünülmesi gereken denge",
    "## Daha derin bir soru",
    "## Bir sonraki denemede şunu dene",
    "",
    "180 kelimeyi geçme.",
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReflectionRequest;
    const language = normalizeLanguage(body.language);
    const client = getOpenAIClient();
    const model =
      process.env.OPENAI_CAREER_REFLECTION_MODEL ||
      process.env.OPENAI_CAREER_NARRATIVE_MODEL ||
      process.env.OPENAI_TEXT_MODEL ||
      "gpt-4.1-mini";

    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: buildSystemPrompt(language) },
        { role: "user", content: buildUserPrompt(body, language) },
      ],
      max_output_tokens: 600,
    });

    const reflection = extractOutputText(response);

    if (!reflection) {
      return NextResponse.json(
        {
          ok: false,
          error:
            language === "en"
              ? "OpenAI returned an empty mentor reflection."
              : "OpenAI boş bir mentor reflection döndürdü.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      model,
      language,
      reflection,
      usage: response.usage ?? null,
      safetyNote:
        language === "en"
          ? "This is a reflection on a simulated decision, not a career test or psychological assessment."
          : "Bu, simüle edilmiş bir karar üzerine düşünme çıktısıdır; kariyer testi veya psikolojik değerlendirme değildir.",
    });
  } catch (error: any) {
    const message = error?.message || "Career mentor reflection failed.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: message.includes("OPENAI_API_KEY") ? 500 : 502 }
    );
  }
}
