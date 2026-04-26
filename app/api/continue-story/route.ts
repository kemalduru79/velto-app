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
      childDirection,
      fromSceneId,
      language,
    }: {
      title: string;
      scenes: Scene[];
      childDirection?: string;
      fromSceneId?: number;
      language?: SupportedLanguage;
    } = body;

    const normalizedLanguage = normalizeLanguage(language);

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

    const directionText =
      childDirection && childDirection.trim()
        ? normalizedLanguage === "en"
          ? `Child direction: ${childDirection.trim()}`
          : `Çocuğun yönlendirmesi: ${childDirection.trim()}`
        : normalizedLanguage === "en"
        ? "The child did not give extra direction. Continue the story naturally, with curiosity and child-friendly tone."
        : "Çocuk ek yönlendirme vermedi. Hikayeyi doğal, merak uyandırıcı ve çocuk dostu biçimde ilerlet.";

    const modeText =
      typeof fromSceneId === "number"
        ? normalizedLanguage === "en"
          ? `Important: The new scene must start the new branch especially after Scene ${fromSceneId}.`
          : `Önemli: Yeni sahne, özellikle Sahne ${fromSceneId} sonrasındaki yeni akışı başlatmalı.`
        : normalizedLanguage === "en"
        ? "Important: This new scene must naturally continue after the current final scene."
        : "Önemli: Bu yeni sahne mevcut son sahneden sonra doğal bir devam sahnesi olmalı.";

    const prompt =
      normalizedLanguage === "en"
        ? `
You are continuing a cartoon episode for "Storyverse Lab".

The story must:
- remain consistent
- feel episodic
- keep curiosity alive
- preserve the established characters

STRICT STORYVERSE RULES:
- Do NOT resolve everything unless the user explicitly asks for an ending.
- Do NOT add narration tone, voice tone, acting, or delivery instructions.
- Keep scenes dynamic, visual, and easy to animate.
- Dialogue must sound natural and child-friendly.
- Do not include stage directions inside narration or dialogue.
- Keep all spoken text short and TTS-ready.

Your task:
- Write ONLY 1 new scene that continues the current story.
- Stay consistent with previous scenes.
- Do not repeat yourself.
- The new scene must be visually clear, easy to animate, and suitable for an 8-10 second animation.
- Use child-friendly language.
- Advance the story without fully closing it.
- Return valid JSON only.
- Do not use markdown code fences.
- Do not write explanations.

VERY IMPORTANT RULES:
- The scene must be short, rhythmic, and visual.
- narration must be exactly one sentence.
- narration must be at most 12-14 words.
- dialogue may be empty.
- if dialogue exists, it must be very short.
- use a maximum of 8 words per character line.
- use at most 1 short exchange.
- the scene must contain one main action only.
- avoid long explanations or complicated plot chains.

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

Story title:
${title}

Previous scenes:
${storySoFar}

${directionText}

Generate every output field in English.
`
        : `
Sen "Storyverse Lab" için bir çizgi film bölümünü devam ettiriyorsun.

Hikaye:
- tutarlı kalmalı
- bölüm hissi vermeli
- merakı canlı tutmalı
- mevcut karakterleri korumalı

KATI STORYVERSE KURALLARI:
- Kullanıcı özellikle final istemedikçe her şeyi çözme.
- Ses tonu, anlatım tonu, oyunculuk veya okuma yönlendirmesi yazma.
- Sahne dinamik, görsel ve kolay canlandırılabilir olmalı.
- Diyaloglar doğal ve çocuk dostu olmalı.
- Anlatım veya diyalog içine sahne/yönetmen talimatı koyma.
- Tüm konuşma metinleri kısa ve TTS'e hazır olmalı.

Görevin:
- Mevcut hikayenin devamına SADECE 1 yeni sahne yaz.
- Önceki sahnelerle tutarlı ol.
- Tekrar yapma.
- Yeni sahne görsel olarak net, kolay canlandırılabilir ve 8-10 saniyelik animasyona uygun olsun.
- Çocuk dostu dil kullan.
- Hikaye ilerlesin ama tamamen kapanmasın.
- Sadece geçerli JSON döndür.
- Kod bloğu kullanma.
- Açıklama yazma.

ÇOK KRİTİK KURALLAR:
- Sahne kısa, ritmik ve görselleştirilebilir olmalı.
- narration tek cümle olmalı.
- narration maksimum 12-14 kelime olmalı.
- dialogue boş olabilir.
- dialogue varsa çok kısa olmalı.
- Karakter başına maksimum 8 kelime kullan.
- Maksimum 1 kısa konuşma alışverişi olsun.
- Sahne tek bir ana aksiyon içermeli.
- Uzun anlatım, açıklama ve karmaşık olay zinciri kullanma.

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
      language: normalizedLanguage,
    });
  } catch (error) {
    console.error("continue-story error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Yeni sahne üretilirken hata oluştu.";

    return NextResponse.json(
      { error: message || "Yeni sahne üretilirken hata oluştu." },
      { status: 500 }
    );
  }
}