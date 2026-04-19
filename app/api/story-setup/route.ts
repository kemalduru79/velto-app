import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

function extractTextFromResponse(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  const textParts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      if (part?.type === "output_text" && typeof part?.text === "string") {
        textParts.push(part.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY eksik." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt zorunludur." },
        { status: 400 }
      );
    }

    const setupPrompt = `
Sen 8-12 yaş grubu için yaratıcı çocuk hikayeleri tasarlayan bir yardımcı yazarsın.

Görevin:
- Sadece başlangıç tasarımı üret.
- Henüz sahne üretme.
- Kullanıcının fikrine uygun bir başlık oluştur.
- Kısa bir hikaye özeti / yönü oluştur.
- Karakterleri doğru sayıda ve doğru ilişkide kurmaya dikkat et.
- Örneğin kullanıcı "3 kardeş" dediyse kardeş sayısı 3 olmalı.
- Karakterlerin görsel tasarımını net ve düzenlenebilir şekilde yaz.
- Görsel stil rehberi üret.
- Sadece geçerli JSON döndür.
- Kod bloğu kullanma.
- Açıklama yazma.
- JSON dışına tek bir karakter bile ekleme.

Format:
{
  "title": "string",
  "storyPremise": "string",
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
  }
}

Kullanıcı fikri:
${prompt.trim()}
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: setupPrompt,
    });

    const rawText = extractTextFromResponse(response);

    if (!rawText) {
      return NextResponse.json(
        {
          error: "Modelden metin çıktısı alınamadı.",
        },
        { status: 500 }
      );
    }

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
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.title ||
      !parsed.storyPremise ||
      !Array.isArray(parsed.characters) ||
      !parsed.visualBible
    ) {
      return NextResponse.json(
        {
          error: "Kurulum formatı geçersiz.",
          raw: parsed,
        },
        { status: 500 }
      );
    }

    const normalizedCharacters = parsed.characters.map((character: any) => ({
      name: character?.name || "",
      age: character?.age || "",
      appearance: character?.appearance || "",
      outfit: character?.outfit || "",
      accessory: character?.accessory || "",
      personality: character?.personality || "",
      referenceImage: character?.referenceImage || "",
    }));

    const normalizedVisualBible = {
      style: parsed.visualBible?.style || "",
      palette: parsed.visualBible?.palette || "",
      camera: parsed.visualBible?.camera || "",
      consistencyRules: parsed.visualBible?.consistencyRules || "",
    };

    return NextResponse.json({
      title: parsed.title,
      storyPremise: parsed.storyPremise,
      characters: normalizedCharacters,
      visualBible: normalizedVisualBible,
    });
  } catch (error: any) {
    console.error("story-setup error:", error);

    return NextResponse.json(
      {
        error: "Başlangıç tasarımı oluşturulurken hata oluştu.",
        details:
          process.env.NODE_ENV === "development"
            ? error?.message || "Bilinmeyen hata"
            : undefined,
      },
      { status: 500 }
    );
  }
}