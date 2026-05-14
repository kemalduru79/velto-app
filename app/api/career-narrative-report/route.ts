import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type SupportedLanguage = "tr" | "en";

type NarrativeReportRequest = {
  language?: SupportedLanguage;
  prompt?: string;
  payload?: unknown;
  sessionSnapshot?: unknown;
  structuredInputs?: unknown;
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

function asSafeString(value: unknown, fallback = "") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
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

function buildFallbackPrompt(body: NarrativeReportRequest, language: SupportedLanguage) {
  const prompt = asSafeString(body.prompt);

  if (prompt) {
    return prompt;
  }

  return language === "en"
    ? [
        "Create a child-safe AI Career Lab narrative report from the structured simulation data below.",
        "",
        "Rules:",
        "- Do not present this as a career test.",
        "- Do not make psychological, diagnostic, or deterministic career claims.",
        "- Do not say the child should become this profession.",
        "- Use warm, exploratory, age-appropriate language for ages 9-15.",
        "- Clearly state that the report only reflects choices made inside a simulation.",
        "",
        "Structured input:",
        safeJsonStringify(body.payload ?? body.structuredInputs ?? body.sessionSnapshot),
      ].join("\n")
    : [
        "Aşağıdaki yapılandırılmış simülasyon verisinden çocuk güvenli bir AI Career Lab anlatı raporu oluştur.",
        "",
        "Kurallar:",
        "- Bunu kariyer testi gibi sunma.",
        "- Psikolojik, tanısal veya kesin kariyer yönlendirmesi içeren iddialarda bulunma.",
        "- Çocuğun bu mesleği seçmesi gerektiğini söyleme.",
        "- 9-15 yaş aralığına uygun, sıcak, keşif odaklı bir dil kullan.",
        "- Raporun yalnızca simülasyon içindeki seçimleri yansıttığını açıkça belirt.",
        "",
        "Yapılandırılmış girdi:",
        safeJsonStringify(body.payload ?? body.structuredInputs ?? body.sessionSnapshot),
      ].join("\n");
}

function buildSystemPrompt(language: SupportedLanguage) {
  return language === "en"
    ? [
        "You are VELTO AI Career Lab's child-safe narrative report assistant.",
        "You generate supportive, exploratory reports from interactive profession simulations.",
        "You must never position the output as a real career test, psychological assessment, diagnosis, or deterministic recommendation.",
        "You must not claim that the child should become a specific profession.",
        "You should help the child reflect on choices, strengths, teamwork, logic, focus, creativity, courage, and empathy inside the simulated mission.",
        "Use clear, warm language suitable for ages 9-15 and understandable for parents or mentors.",
      ].join(" ")
    : [
        "Sen VELTO AI Career Lab'in çocuk güvenli anlatı raporu asistanısın.",
        "Interaktif meslek simülasyonlarından destekleyici ve keşif odaklı raporlar üretirsin.",
        "Çıktıyı asla gerçek kariyer testi, psikolojik değerlendirme, tanı veya kesin yönlendirme gibi konumlandırmamalısın.",
        "Çocuğun belirli bir mesleği seçmesi gerektiğini iddia etmemelisin.",
        "Çocuğun simülasyon görevi içindeki seçimleri, güçlü sinyalleri, takım çalışması, mantık, odak, yaratıcılık, cesaret ve empati yaklaşımı üzerine düşünmesine yardım etmelisin.",
        "9-15 yaşa uygun, ebeveyn veya mentorların da anlayabileceği açık ve sıcak bir dil kullan.",
      ].join(" ");
}

function buildResponseInstruction(language: SupportedLanguage) {
  return language === "en"
    ? [
        "Return the report in Markdown.",
        "Use these sections:",
        "1. Mission Story",
        "2. What Your Choices Showed Inside the Simulation",
        "3. Strength Signals",
        "4. One Thing to Try Next Time",
        "5. Parent / Mentor Note",
        "Keep it concise, encouraging, and specific to the provided data.",
      ].join("\n")
    : [
        "Raporu Markdown formatında döndür.",
        "Şu bölümleri kullan:",
        "1. Görev Hikâyesi",
        "2. Simülasyon İçinde Seçimlerin Ne Gösterdi",
        "3. Güçlü Sinyaller",
        "4. Bir Sonraki Denemede Keşfedilecek Şey",
        "5. Ebeveyn / Mentor Notu",
        "Kısa, teşvik edici ve verilen veriye özel yaz.",
      ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as NarrativeReportRequest;
    const language = normalizeLanguage(body.language);
    const userPrompt = buildFallbackPrompt(body, language);
    const model =
      process.env.OPENAI_CAREER_NARRATIVE_MODEL ||
      process.env.OPENAI_TEXT_MODEL ||
      "gpt-4.1-mini";

    if (!userPrompt || userPrompt.length < 40) {
      return NextResponse.json(
        {
          ok: false,
          error:
            language === "en"
              ? "Career narrative prompt is missing or too short."
              : "Career narrative prompt eksik veya çok kısa.",
        },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(language),
        },
        {
          role: "user",
          content: `${userPrompt}\n\n${buildResponseInstruction(language)}`,
        },
      ],
      max_output_tokens: 1200,
    });

    const narrativeReport = extractOutputText(response);

    if (!narrativeReport) {
      return NextResponse.json(
        {
          ok: false,
          error:
            language === "en"
              ? "OpenAI returned an empty narrative report."
              : "OpenAI boş bir anlatı raporu döndürdü.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      model,
      language,
      narrativeReport,
      usage: response.usage ?? null,
      safetyNote:
        language === "en"
          ? "This is not a career test or psychological assessment. It only reflects choices made inside a simulation."
          : "Bu bir kariyer testi veya psikolojik değerlendirme değildir. Yalnızca simülasyon içinde yapılan seçimleri yansıtır.",
    });
  } catch (error: any) {
    const message = error?.message || "Career narrative report generation failed.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: message.includes("OPENAI_API_KEY") ? 500 : 502 }
    );
  }
}
