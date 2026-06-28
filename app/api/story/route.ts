import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createTimelineSyncPlan } from "../../../lib/video/timelineSync";

export const runtime = "nodejs";

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  return new OpenAI({
    apiKey,
  });
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
      const sliced = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sliced);
    }

    throw new Error("JSON parse edilemedi");
  }
}

export async function POST(req: Request) {
  try {
    const client = getOpenAIClient();

    const { prompt } = await req.json();

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt zorunludur." },
        { status: 400 }
      );
    }

    const storyPrompt = `
Sen 8-12 yaş grubu için yaratıcı, görsel olarak güçlü ve çocuk dostu hikaye tasarlayan bir yardımcı yazarsın.

Görevin:
- Tek bir ana hikaye başlığı üret.
- 1 veya 2 ana karakter oluştur.
- Karakterleri sahneler boyunca görsel olarak tutarlı kalacak biçimde tarif et.
- Sabit bir görsel stil rehberi üret.
- Tam olarak 5 sahne yaz.
- Sahneler kısa, net ve güçlü görselleştirilebilir olsun.
- JSON dışında hiçbir şey yazma.

Kurallar:
- Karakter tariflerinde saç, yüz, yaş, kıyafet, aksesuar gibi görsel detaylar net olsun.
- Kıyafet mümkün olduğunca sabit kalsın.
- Stil çocuklara uygun, sıcak, sinematik ve çizgi film benzeri olsun.
- Sahne metinleri karakter tasarımını bozacak kadar rastgele yeni görünüşler önermesin.

Şu formatta cevap ver:
{
  "title": "string",
  "characters": [
    {
      "name": "string",
      "age": "string",
      "appearance": "string",
      "outfit": "string",
      "accessory": "string",
      "personality": "string"
    }
  ],
  "visualBible": {
    "style": "string",
    "palette": "string",
    "camera": "string",
    "consistencyRules": "string"
  },
  "scenes": [
    { "id": 1, "text": "string" },
    { "id": 2, "text": "string" },
    { "id": 3, "text": "string" },
    { "id": 4, "text": "string" },
    { "id": 5, "text": "string" }
  ]
}

Kullanıcının hikaye fikri:
${prompt.trim()}
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: storyPrompt,
    });

    const rawText = response.output_text || "";

    let parsed: any;
    try {
      parsed = parseJsonSafely(rawText);
    } catch {
      return NextResponse.json(
        {
          error: "Model çıktısı JSON olarak parse edilemedi.",
          raw: rawText,
        },
        { status: 500 }
      );
    }

    if (
      !parsed?.title ||
      !Array.isArray(parsed?.characters) ||
      !parsed?.visualBible ||
      !Array.isArray(parsed?.scenes)
    ) {
      return NextResponse.json(
        { error: "Hikaye formatı geçersiz.", raw: parsed },
        { status: 500 }
      );
    }

    const timelineSyncPlan = createTimelineSyncPlan({
      product: "storyverse",
      qualityTier: "lite",
      durationSec: parsed.scenes.length * 7,
      sceneCount: parsed.scenes.length,
      scenes: parsed.scenes,
    });

    return NextResponse.json({
      title: parsed.title,
      characters: parsed.characters,
      visualBible: parsed.visualBible,
      scenes: parsed.scenes,
      timelineSyncPlan,
    });
  } catch (error) {
    console.error("story error:", error);

    const message =
      error instanceof Error ? error.message : "Hikaye oluşturulurken hata oluştu.";

    return NextResponse.json(
      { error: message || "Hikaye oluşturulurken hata oluştu." },
      { status: 500 }
    );
  }
}