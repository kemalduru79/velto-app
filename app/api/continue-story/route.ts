import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Scene = {
  id: number;
  text: string;
  narration: string;
  dialogue: string;
  cameraDirection: string;
  emotion: string;
  motionHint: string;
  image?: string;
};

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
    const body = await req.json();
    const {
      title,
      scenes,
      childDirection,
      fromSceneId,
    }: {
      title: string;
      scenes: Scene[];
      childDirection?: string;
      fromSceneId?: number;
    } = body;

    if (!title || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: "title ve scenes zorunludur." },
        { status: 400 }
      );
    }

    const contextScenes =
      typeof fromSceneId === "number"
        ? scenes.filter((scene) => scene.id <= fromSceneId)
        : scenes;

    if (contextScenes.length === 0) {
      return NextResponse.json(
        { error: "Geçerli bir context sahnesi bulunamadı." },
        { status: 400 }
      );
    }

    const lastSceneId = contextScenes[contextScenes.length - 1]?.id ?? 0;
    const nextSceneId = lastSceneId + 1;

    const storySoFar = contextScenes
      .map(
        (scene) =>
          `Sahne ${scene.id}: ${scene.text}
Anlatıcı: ${scene.narration}
Diyalog: ${scene.dialogue}
Duygu: ${scene.emotion}`
      )
      .join("\n\n");

    const directionText =
      childDirection && childDirection.trim()
        ? `Çocuğun yönlendirmesi: ${childDirection.trim()}`
        : "Çocuk ek yönlendirme vermedi. Hikayeyi doğal, merak uyandırıcı ve çocuk dostu biçimde ilerlet.";

    const modeText =
      typeof fromSceneId === "number"
        ? `Önemli: Yeni sahne, özellikle Sahne ${fromSceneId} sonrasındaki yeni akışı başlatmalı.`
        : "Önemli: Bu yeni sahne mevcut son sahneden sonra doğal bir devam sahnesi olmalı.";

    const prompt = `
Sen 8-12 yaş grubu için yaratıcı, sinematik, tutarlı hikaye sahneleri yazan bir yardımcı yazarsın.

Görevin:
- Mevcut hikayenin devamına SADECE 1 yeni sahne yaz.
- Önceki sahnelerle tutarlı ol.
- Tekrar yapma.
- Yeni sahne kısa ve görselleştirilebilir olsun.
- Çocuk dostu dil kullan.
- Hikaye ilerlesin ama tamamen kapanmasın.
- Sahneye çizgi film üretimi için metadata ekle.
- Sadece geçerli JSON döndür.
- Kod bloğu kullanma.
- Açıklama yazma.

Format:
{
  "scene": {
    "id": ${nextSceneId},
    "text": "string",
    "narration": "string",
    "dialogue": "string",
    "cameraDirection": "string",
    "emotion": "string",
    "motionHint": "string"
  }
}

${modeText}

Hikaye başlığı:
${title}

Önceki sahneler:
${storySoFar}

${directionText}
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const rawText = response.output_text || "";

    let parsed;
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
      !parsed?.scene ||
      typeof parsed.scene.id !== "number" ||
      typeof parsed.scene.text !== "string"
    ) {
      return NextResponse.json(
        {
          error: "Geçersiz scene formatı döndü.",
          raw: parsed,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      scene: parsed.scene,
    });
  } catch (error) {
    console.error("continue-story error:", error);
    return NextResponse.json(
      { error: "Yeni sahne üretilirken hata oluştu." },
      { status: 500 }
    );
  }
}