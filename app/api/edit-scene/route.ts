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

type SupportedLanguage = "tr" | "en";

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

function normalizeLanguage(value: unknown): SupportedLanguage {
  return value === "en" ? "en" : "tr";
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
      language,
    }: {
      title: string;
      scenes: Scene[];
      sceneId: number;
      userInstruction: string;
      language?: SupportedLanguage;
    } = body;

    const normalizedLanguage = normalizeLanguage(language);

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
      .map((scene) =>
        normalizedLanguage === "en"
          ? `Scene ${scene.id}: ${scene.text}
Narration: ${scene.narration}
Dialogue: ${scene.dialogue}
Emotion: ${scene.emotion}`
          : `Sahne ${scene.id}: ${scene.text}
Anlatıcı: ${scene.narration}
Diyalog: ${scene.dialogue}
Duygu: ${scene.emotion}`
      )
      .join("\n\n");

    const prompt =
      normalizedLanguage === "en"
        ? `
You are an assistant who edits cinematic, consistent children's animation scenes for ages 8-12.

Your task:
- Rewrite only the target scene.
- Stay consistent with previous scenes.
- Do not break character, tone, location, or story continuity.
- Reflect the child's direction clearly in the rewritten scene.
- The scene must fit an 8-10 second animation.
- The scene must be visual, clear, fast-paced, and easy to animate.
- Return valid JSON only.
- Do not use markdown code fences.
- Do not write explanations.

VERY IMPORTANT RULES:
- narration must be one sentence only.
- narration must be at most 12-14 words.
- dialogue may be empty.
- if dialogue exists, it must be short.
- use a maximum of 8 words per character line.
- use at most 1 short exchange.
- the scene must have one dominant action.
- avoid long explanation or complex narration.

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

Story title:
${title}

Previous scenes:
${previousScenes || "There are no earlier scenes before this one."}

Current scene to edit:
Scene ${targetScene.id}: ${targetScene.text}
Narration: ${targetScene.narration}
Dialogue: ${targetScene.dialogue}
Camera: ${targetScene.cameraDirection}
Emotion: ${targetScene.emotion}
Motion: ${targetScene.motionHint}

Child direction:
${userInstruction.trim()}

Generate every output field in English.
`
        : `
Sen 8-12 yaş grubu için yaratıcı, sinematik, tutarlı çocuk animasyonu sahneleri düzenleyen bir yardımcı yazarsın.

Görevin:
- Sadece hedef sahneyi yeniden yaz.
- Önceki sahnelerle tutarlı kal.
- Karakter, ton, mekan ve olay akışında kopukluk yaratma.
- Çocuğun verdiği yönlendirmeyi sahneye net biçimde yansıt.
- Sahne 8-10 saniyelik kısa animasyona uygun olsun.
- Sahne görsel, net, hızlı tempolu ve kolay canlandırılabilir olsun.
- Sadece geçerli JSON döndür.
- Kod bloğu kullanma.
- Açıklama yazma.

ÇOK KRİTİK KURALLAR:
- narration tek cümle olmalı.
- narration maksimum 12-14 kelime olmalı.
- dialogue boş olabilir.
- dialogue varsa kısa olmalı.
- Karakter başına maksimum 8 kelime kullan.
- Maksimum 1 kısa konuşma alışverişi olsun.
- Sahne tek bir baskın aksiyon taşımalı.
- Uzun açıklama ve karmaşık anlatım kullanma.

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
      language: normalizedLanguage,
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