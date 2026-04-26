import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type Character = {
  name: string;
  age: string;
  appearance: string;
  outfit: string;
  accessory?: string;
  personality: string;
};

type VisualBible = {
  style: string;
  palette: string;
  camera: string;
  consistencyRules: string;
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

    const {
      title,
      storyPremise,
      characters,
      visualBible,
      language,
    }: {
      title: string;
      storyPremise: string;
      characters: Character[];
      visualBible: VisualBible;
      language?: SupportedLanguage;
    } = await req.json();

    const normalizedLanguage = normalizeLanguage(language);

    if (
      !title?.trim() ||
      !storyPremise?.trim() ||
      !Array.isArray(characters) ||
      characters.length === 0 ||
      !visualBible
    ) {
      return NextResponse.json(
        { error: "title, storyPremise, characters ve visualBible zorunludur." },
        { status: 400 }
      );
    }

    const characterText = characters
      .map((character, index) => {
        return normalizedLanguage === "en"
          ? `
Character ${index + 1}
Name: ${character.name}
Age: ${character.age}
Appearance: ${character.appearance}
Outfit: ${character.outfit}
Accessory: ${character.accessory || "None"}
Personality: ${character.personality}
`
          : `
Karakter ${index + 1}
Ad: ${character.name}
Yaş: ${character.age}
Dış görünüş: ${character.appearance}
Kıyafet: ${character.outfit}
Aksesuar: ${character.accessory || "Yok"}
Kişilik: ${character.personality}
`;
      })
      .join("\n");

    const prompt =
      normalizedLanguage === "en"
        ? `
You are writing a short animated episode for "Storyverse Lab".

This is NOT a generic story.
This is a cartoon episode for children aged 8-12.

STRICT STORYVERSE RULES:
- Every scene must feel like a cartoon shot.
- Keep narration clean. Do NOT include tone, voice, acting, or delivery instructions.
- Dialogue must sound like real kids talking.
- Avoid literary language.
- Avoid internal monologue.
- Avoid explaining feelings; show them through visible actions.
- Do not include stage directions inside narration or dialogue.
- Keep all spoken text short, natural, and TTS-ready.

Your task:
- Generate EXACTLY 5 scenes using the given character setup and visual style.
- Each scene must be suitable for a short 8-10 second animation.
- The pacing should be fast, clear, child-friendly, and easy to visualize.
- Keep characters, appearance, relationships, and tone consistent.
- The story should flow, but scenes should not be overly long.
- Return valid JSON only.
- Do not use markdown code fences.
- Do not write explanations.

VERY IMPORTANT RULES:
- Every scene must be easy to animate.
- "text" must describe the visual action clearly.
- "narration" must be one sentence only.
- "narration" must be at most 12-14 words.
- "dialogue" may be empty.
- If "dialogue" exists, it must be very short.
- Use a maximum of 8 words per character line.
- Use at most 1 short exchange.
- Avoid long explanations, internal monologue, or complex plot exposition.
- Each scene must have one main idea.

STORY STRUCTURE:
- Scene 1: intriguing opening / hook
- Scene 2: situation becomes clearer
- Scene 3: development / small change
- Scene 4: mini crisis / tension
- Scene 5: resolution + sense of continuation / curiosity

Format:
{
  "scenes": [
    {
      "id": 1,
      "text": "string",
      "narration": "string",
      "dialogue": "string",
      "cameraDirection": "string",
      "emotion": "string",
      "motionHint": "string"
    }
  ]
}

Field rules:
- text: clearly describe the visual event
- narration: a very short narrator sentence
- dialogue: short spoken line or empty string
- cameraDirection: e.g. "wide shot", "close-up", "tracking shot", "over the shoulder"
- emotion: dominant emotion of the scene
- motionHint: short, clear animation movement cue

Story title:
${title.trim()}

Story direction:
${storyPremise.trim()}

Character design:
${characterText}

Visual style:
Style: ${visualBible.style}
Palette: ${visualBible.palette}
Camera: ${visualBible.camera}
Consistency rules: ${visualBible.consistencyRules}

Generate every output field in English.
`
        : `
Sen "Storyverse Lab" için kısa bir çizgi film bölümü yazıyorsun.

Bu normal bir hikaye değil.
Bu 8-12 yaş çocuklar için çizgi film bölümü.

KATI STORYVERSE KURALLARI:
- Her sahne bir çizgi film karesi gibi hissettirmeli.
- Anlatım temiz olmalı. Ses tonu, anlatım tonu, oyunculuk veya okuma yönlendirmesi yazma.
- Diyaloglar gerçek çocuk konuşması gibi doğal olmalı.
- Edebi dil kullanma.
- İç monolog kullanma.
- Duyguları açıklama; görünür aksiyonlarla göster.
- Anlatım veya diyalog içine sahne/yönetmen talimatı koyma.
- Tüm konuşma metinleri kısa, doğal ve TTS'e hazır olmalı.

Görevin:
- Verilen karakter tasarımı ve görsel stile sadık kalarak TAM 5 sahne üret.
- Her sahne, 8-10 saniyelik kısa animasyon sahnesi olacak şekilde yazılmalı.
- Sahne temposu hızlı, net, çocuk dostu ve görselleştirilebilir olmalı.
- Karakterleri, görünüşlerini, ilişkilerini ve tonunu tutarlı koru.
- Hikaye akışlı olsun ama sahneler gereksiz uzun olmasın.
- Sadece geçerli JSON döndür.
- Kod bloğu kullanma.
- Açıklama yazma.

ÇOK KRİTİK KURALLAR:
- Her sahne kolay canlandırılabilir olmalı.
- "text" görsel olarak ne olduğunu anlatmalı.
- "narration" tek cümle olmalı.
- "narration" maksimum 12-14 kelime olmalı.
- "dialogue" boş olabilir.
- "dialogue" varsa çok kısa olmalı.
- Her karakter için maksimum 8 kelime kullan.
- Maksimum 1 kısa konuşma alışverişi olsun.
- Uzun açıklama, iç monolog, karmaşık olay anlatımı yapma.
- Her sahne tek ana fikre sahip olsun.

HİKAYE YAPISI:
- Sahne 1: merak uyandıran giriş / hook
- Sahne 2: durumun netleşmesi
- Sahne 3: gelişme / küçük değişim
- Sahne 4: mini kriz / gerilim
- Sahne 5: çözüm + devam hissi / merak

Format:
{
  "scenes": [
    {
      "id": 1,
      "text": "string",
      "narration": "string",
      "dialogue": "string",
      "cameraDirection": "string",
      "emotion": "string",
      "motionHint": "string"
    }
  ]
}

Alan kuralları:
- text: sahnenin görsel olayını net anlat
- narration: anlatıcının okuyacağı çok kısa tek cümle
- dialogue: kısa konuşma ya da boş string
- cameraDirection: örn. "wide shot", "close-up", "tracking shot", "over the shoulder"
- emotion: sahnenin baskın duygusu
- motionHint: animasyon hareketi için net ve kısa ipucu

Hikaye başlığı:
${title.trim()}

Hikaye yönü:
${storyPremise.trim()}

Karakter tasarımı:
${characterText}

Görsel stil:
Stil: ${visualBible.style}
Renk paleti: ${visualBible.palette}
Kamera: ${visualBible.camera}
Tutarlılık kuralları: ${visualBible.consistencyRules}
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

    if (!Array.isArray(parsed?.scenes)) {
      return NextResponse.json(
        { error: "Scene formatı geçersiz.", raw: parsed },
        { status: 500 }
      );
    }

    return NextResponse.json({
      scenes: parsed.scenes,
      language: normalizedLanguage,
    });
  } catch (error) {
    console.error("build-story error:", error);

    const message =
      error instanceof Error ? error.message : "Hikaye oluşturulurken hata oluştu.";

    return NextResponse.json(
      { error: message || "Hikaye oluşturulurken hata oluştu." },
      { status: 500 }
    );
  }
}