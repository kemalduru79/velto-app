import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
Sen 8-12 yaş grubu için yaratıcı, sinematik, tutarlı hikaye sahneleri yazan bir yardımcı yazarsın.

Görevin:
- Verilen karakter tasarımı ve görsel stile sadık kalarak tam 5 sahne üret.
- Her sahnede görsel, ses ve animasyon üretimine uygun metadata da ver.
- Karakter sayısını ve ilişkileri bozma.
- Karakterlerin görünüşünü ve kimliğini sahnelerde tutarlı kullan.
- Sadece geçerli JSON döndür.
- Kod bloğu kullanma.
- Açıklama yazma.

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

Kurallar:
- text: sahnenin ana olayını anlatır
- narration: anlatıcının okuyabileceği kısa metin
- dialogue: kısa konuşma ya da boş string
- cameraDirection: örn. "wide shot", "close-up", "over the shoulder"
- emotion: tek baskın duygu veya kısa duygu ifadesi
- motionHint: Runway benzeri video üretimi için hareket ipucu

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
    return NextResponse.json(
      { error: "Hikaye oluşturulurken hata oluştu." },
      { status: 500 }
    );
  }
}