import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type SupportedLanguage = "tr" | "en";

type Character = {
  name: string;
  age: string;
  appearance: string;
  outfit: string;
  accessory?: string;
  personality: string;
  referenceImage?: string;
};

const DEFAULT_GUIDE_CHARACTER: Character = {
  name: "Joe",
  age: "10",
  appearance:
    "short slightly messy brown hair, large green eyes, expressive friendly face",
  outfit: "yellow hoodie and blue jeans",
  accessory: "",
  personality:
    "curious, energetic, slightly playful, brave, problem solver, asks simple questions that help children understand the topic",
  referenceImage: "",
};

function normalizeName(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureDefaultGuideCharacter(characters: Character[]) {
  const safeCharacters = Array.isArray(characters) ? characters : [];
  const hasJoe = safeCharacters.some(
    (character) => normalizeName(character?.name) === "joe"
  );

  if (hasJoe) {
    return safeCharacters.map((character) =>
      normalizeName(character?.name) === "joe"
        ? {
            ...DEFAULT_GUIDE_CHARACTER,
            ...character,
            name: "Joe",
            age: character.age || DEFAULT_GUIDE_CHARACTER.age,
            appearance:
              character.appearance || DEFAULT_GUIDE_CHARACTER.appearance,
            outfit: character.outfit || DEFAULT_GUIDE_CHARACTER.outfit,
            accessory:
              character.accessory ?? DEFAULT_GUIDE_CHARACTER.accessory,
            personality:
              character.personality || DEFAULT_GUIDE_CHARACTER.personality,
          }
        : character
    );
  }

  return [DEFAULT_GUIDE_CHARACTER, ...safeCharacters];
}

function buildGuideInstruction(language: SupportedLanguage) {
  return language === "en"
    ? `
MANDATORY SOFT-LOCK GUIDE CHARACTER:
- Always include Joe as a recurring guide character.
- Joe is 10 years old.
- Joe has short slightly messy brown hair, large green eyes, and an expressive friendly face.
- Joe always wears a yellow hoodie and blue jeans.
- Joe is curious, energetic, slightly playful, brave, and a problem solver.
- Joe asks simple questions that help children understand the topic.
- Joe is present as the audience's guide, but the episode is NOT about Joe's personal life.
- Other characters may exist, but do not remove Joe.
- Keep Joe visually reusable across future episodes.
`
    : `
ZORUNLU SOFT-LOCK REHBER KARAKTER:
- Joe her hikayede tekrar eden rehber karakter olarak bulunmalı.
- Joe 10 yaşında.
- Joe'nun kısa, hafif dağınık kahverengi saçları, büyük yeşil gözleri ve samimi/ifade gücü yüksek bir yüzü vardır.
- Joe her zaman sarı hoodie ve mavi jean giyer.
- Joe meraklı, enerjik, hafif oyunbaz, cesur ve problem çözen bir karakterdir.
- Joe çocukların konuyu anlamasına yardım eden basit sorular sorar.
- Joe izleyicinin rehberidir; bölüm Joe'nun kişisel hayatı hakkında olmamalıdır.
- Diğer karakterler olabilir, ancak Joe kaldırılmamalıdır.
- Joe ilerideki bölümlerde görsel olarak tekrar kullanılabilir kalmalıdır.
`;
}

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

function normalizeLanguage(value: unknown): SupportedLanguage {
  return value === "en" ? "en" : "tr";
}

export async function POST(req: Request) {
  try {
    const client = getOpenAIClient();

    const body = await req.json().catch(() => null);
    const prompt = body?.prompt;
    const language = normalizeLanguage(body?.language);

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt zorunludur." },
        { status: 400 }
      );
    }

    const setupPrompt =
      language === "en"
        ? `
You are a professional children's animation creator working on a product called "Storyverse Lab".

You are NOT writing a generic story.
You are designing a reusable cartoon universe for children aged 8-12.

Your job is to create:
- a cartoon universe
- reusable characters
- visually consistent animation assets

STRICT STORYVERSE RULES:
- NEVER include narration tone, voice tone, or acting directions.
- NEVER write phrases like "calm narration tone", "warm voice", or "emotional delivery".
- NEVER include voice acting instructions.
- NEVER include camera instructions in narration or dialogue.
- Keep everything visually describable and easy to animate.
- Make characters reusable across future episodes.

Your task:
- Only generate the initial setup.
- Do not generate scenes yet.
- Create a title that matches the user's idea.
- Create a short story premise / direction.
- Make sure the character count and relationships are correct.
- For example, if the user says "3 siblings", there must be exactly 3 siblings.
- Write clear and editable visual character descriptions.
- Generate a visual style guide.
- Return valid JSON only.
- Do not use markdown code fences.
- Do not add any explanation.
- Do not output any text outside JSON.

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

Generate every text field in English.

User idea:
${prompt.trim()}
`
        : `
Sen "Storyverse Lab" adlı ürün için çalışan profesyonel bir çocuk animasyonu tasarımcısısın.

Sen sıradan bir hikaye yazarı değilsin.
Sen 8-12 yaş çocuklar için tekrar kullanılabilir bir çizgi film evreni tasarlıyorsun.

Sen:
- bir çizgi film evreni kurarsın
- tekrar kullanılabilir karakterler üretirsin
- görsel tutarlılığı yüksek animasyon varlıkları tasarlarsın

KATI STORYVERSE KURALLARI:
- Asla ses tonu, anlatım tonu veya oyunculuk yönlendirmesi yazma.
- "sakin anlatım tonu", "sıcak ses", "duygusal okuma" gibi ifadeler yazma.
- Seslendirme yönlendirmesi yazma.
- Anlatım veya diyalog içinde kamera / yönetmen dili kullanma.
- Her şey görselleştirilebilir ve kolay canlandırılabilir olmalı.
- Karakterler ilerideki bölümlerde tekrar kullanılabilir olmalı.

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
      input: `${buildGuideInstruction(language)}

${setupPrompt}`,
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

    const normalizedCharacters = ensureDefaultGuideCharacter(
      parsed.characters.map((character: any) => ({
        name: character?.name || "",
        age: character?.age || "",
        appearance: character?.appearance || "",
        outfit: character?.outfit || "",
        accessory: character?.accessory || "",
        personality: character?.personality || "",
        referenceImage: character?.referenceImage || "",
      }))
    );

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
      language,
    });
  } catch (error: any) {
    console.error("story-setup error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Başlangıç tasarımı oluşturulurken hata oluştu.";

    return NextResponse.json(
      {
        error: message || "Başlangıç tasarımı oluşturulurken hata oluştu.",
        details:
          process.env.NODE_ENV === "development"
            ? error?.message || "Bilinmeyen hata"
            : undefined,
      },
      { status: 500 }
    );
  }
}