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

    const {
      title,
      storyPremise,
      characters,
      visualBible,
    }: {
      title: string;
      storyPremise: string;
      characters: Character[];
      visualBible: VisualBible;
    } = await req.json();

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
        return `
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

    const prompt = `
Sen 8-12 yaş grubu için yaratıcı, sinematik, görsel düşünerek yazan bir çocuk animasyon senaristisin.

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