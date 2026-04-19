import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

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

    const body = await req.json();
    const {
      title,
      scenes,
      sceneId,
      userInstruction,
    }: {
      title: string;
      scenes: Scene[];
      sceneId: number;
      userInstruction: string;
    } = body;

    if (!title || !Array.isArray(scenes) || !sceneId || !userInstruction?.trim()) {
      return NextResponse.json(
        { error: "title, scenes, sceneId ve userInstruction zorunludur." },
        { status: 400 }
      );
    }

    const targetScene = scenes.find((scene) => scene.id === sceneId);
    if (!targetScene) {
      return NextResponse.json(
        { error: "Düzenlenecek sahne bulunamadı." },
        { status: 404 }
      );
    }

    const previousScenes = scenes
      .filter((scene) => scene.id < sceneId)
      .map(
        (scene) =>
          `Sahne ${scene.id}: ${scene.text}
Anlatıcı: ${scene.narration}
Diyalog: ${scene.dialogue}
Duygu: ${scene.emotion}`
      )
      .join("\n\n");

    const prompt = `
Sen 8-12 yaş grubu için yaratıcı, sinematik, tutarlı hikaye sahneleri yazan bir yardımcı yazarsın.

Görevin:
- Sadece hedef sahneyi yeniden yaz.
- Önceki sahnelerle tutarlı ol.
- Karakter, ton, mekan ve olay akışında kopukluk yaratma.
- Çocuğun verdiği yönlendirmeyi sahneye güçlü biçimde yansıt.
- Sahne kısa, net ve görselleştirilebilir olsun.
- Aynı zamanda anlatıcı, diyalog, kamera, duygu ve hareket ipucu alanlarını da güncelle.
- Sadece geçerli JSON döndür.
- Kod bloğu kullanma.
- Açıklama yazma.

Format:
{
  "updatedScene": {
    "id": ${sceneId},
    "text": "string",
    "narration": "string",
    "dialogue": "string",
    "cameraDirection": "string",
    "emotion": "string",
    "motionHint": "string"
  }
}

Hikaye başlığı:
${title}

Önceki sahneler:
${previousScenes || "Bu sahneden önce başka sahne yok."}

Düzenlenecek mevcut sahne:
Sahne ${targetScene.id}: ${targetScene.text}
Anlatıcı: ${targetScene.narration}
Diyalog: ${targetScene.dialogue}
Kamera: ${targetScene.cameraDirection}
Duygu: ${targetScene.emotion}
Hareket: ${targetScene.motionHint}

Çocuğun yönlendirmesi:
${userInstruction.trim()}
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

    if (!parsed?.updatedScene || typeof parsed.updatedScene.text !== "string") {
      return NextResponse.json(
        { error: "Geçersiz updatedScene formatı.", raw: parsed },
        { status: 500 }
      );
    }

    return NextResponse.json({
      updatedScene: parsed.updatedScene,
    });
  } catch (error) {
    console.error("edit-scene error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Sahne güncellenirken hata oluştu.";

    return NextResponse.json(
      { error: message || "Sahne güncellenirken hata oluştu." },
      { status: 500 }
    );
  }
}