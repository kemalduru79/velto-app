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

type SceneIntelligence = {
  scene_type:
    | "hook"
    | "discovery"
    | "dialogue"
    | "action"
    | "mystery"
    | "emotional"
    | "comedy"
    | "climax"
    | "resolution";
  emotional_intensity: number;
  pacing_level: "slow" | "medium" | "fast";
  curiosity_score: number;
  tension_score: number;
  climax_level: number;
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
};

function normalizeNameForCharacter(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureDefaultGuideCharacter(characters: Character[]) {
  const safeCharacters = Array.isArray(characters) ? characters : [];
  const hasJoe = safeCharacters.some(
    (character) => normalizeNameForCharacter(character?.name) === "joe"
  );

  if (hasJoe) {
    return safeCharacters.map((character) =>
      normalizeNameForCharacter(character?.name) === "joe"
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

function buildGuideSceneInstruction(language: SupportedLanguage) {
  return language === "en"
    ? `
CRITICAL SOFT-LOCK CHARACTER RULES:
- Joe is the recurring guide character of this universe.
- Joe MUST appear naturally in every scene.
- Joe reacts, explores, and asks short questions that help the audience understand the topic.
- The episode is NOT about Joe's personal life; Joe is the guide, not the subject.
- Keep Joe visually consistent: short slightly messy brown hair, large green eyes, red baseball cap, blue t-shirt with a clear rocket logo, blue jeans, simple white sneakers, same age and proportions.
- Do not redesign Joe, rename Joe, remove Joe, or replace Joe with another child.
- Dialogue may include Joe when useful, but keep lines short and TTS-ready.

CRITICAL FIRST-SCENE HOOK RULES:
- Scene 1 MUST open with an immediate hook in the first spoken line.
- The hook should usually be spoken by Joe.
- The hook must be short, direct, and curiosity-driven.
- Keep the hook under 7 words when possible.
- Prefer surprise or urgency: "Wait…", "Why…?!", "What if…?!", "This animal…?!"
- Avoid weak passive openings such as "Did you know", "One day", "Once upon a time", or slow background explanations.
- Scene 1 dialogue should make the child want to keep watching immediately.
- Good examples: "Wait… octopuses have THREE hearts?!", "Why does an octopus need three hearts?!", "Gravity just disappeared?!"
`
    : `
KRİTİK SOFT-LOCK KARAKTER KURALLARI:
- Joe bu evrenin tekrar eden rehber karakteridir.
- Joe her sahnede doğal şekilde yer almalı.
- Joe izleyicinin konuyu anlamasına yardım eden kısa sorular sorar, keşfeder ve tepki verir.
- Bölüm Joe'nun kişisel hayatı hakkında değildir; Joe konunun kendisi değil rehberidir.
- Joe görsel olarak tutarlı kalmalı: kısa hafif dağınık kahverengi saç, büyük yeşil gözler, kırmızı beyzbol şapkası, roket logolu mavi t-shirt, mavi jean, beyaz spor ayakkabılar, aynı yaş ve oranlar.
- Joe'yu yeniden tasarlama, adını değiştirme, sahneden çıkarma veya başka bir çocukla değiştirme.
- Diyalog gerektiğinde Joe içerebilir; satırlar kısa ve TTS'e hazır olmalı.

KRİTİK İLK SAHNE HOOK KURALLARI:
- Sahne 1 ilk konuşma satırında güçlü bir hook ile başlamalı.
- Hook çoğunlukla Joe tarafından söylenmeli.
- Hook kısa, direkt ve merak uyandırıcı olmalı.
- Mümkünse 7 kelimenin altında kalmalı.
- Şaşkınlık veya aciliyet kullan: "Dur…", "Neden…?!", "Ya…?!", "Bu hayvan…?!"
- "Biliyor muydun", "Bir gün", "Bir varmış bir yokmuş" gibi yavaş ve pasif açılışlardan kaçın.
- Sahne 1 diyaloğu çocuğun hemen izlemeye devam etmesini sağlamalı.
- İyi örnekler: "Dur… ahtapotların ÜÇ kalbi mi var?!", "Ahtapot neden üç kalbe ihtiyaç duyar?!", "Yerçekimi birden kayboldu?!"
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

function normalizeLanguage(value: unknown): SupportedLanguage {
  return value === "en" ? "en" : "tr";
}


function normalizeSceneIntelligence(
  intelligence: Partial<SceneIntelligence> | undefined
): SceneIntelligence {
  const safeNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
      return fallback;
    }

    return Math.max(1, Math.min(10, Math.round(parsed)));
  };

  const safePacing =
    intelligence?.pacing_level === "slow" ||
    intelligence?.pacing_level === "fast"
      ? intelligence.pacing_level
      : "medium";

  const validSceneTypes = [
    "hook",
    "discovery",
    "dialogue",
    "action",
    "mystery",
    "emotional",
    "comedy",
    "climax",
    "resolution",
  ] as const;

  const safeSceneType = validSceneTypes.includes(
    intelligence?.scene_type as any
  )
    ? (intelligence?.scene_type as SceneIntelligence["scene_type"])
    : "discovery";

  return {
    scene_type: safeSceneType,
    emotional_intensity: safeNumber(
      intelligence?.emotional_intensity,
      5
    ),
    pacing_level: safePacing,
    curiosity_score: safeNumber(intelligence?.curiosity_score, 5),
    tension_score: safeNumber(intelligence?.tension_score, 4),
    climax_level: safeNumber(intelligence?.climax_level, 3),
  };
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

    const effectiveCharacters = ensureDefaultGuideCharacter(characters);

    const characterText = effectiveCharacters
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
- Each scene must be suitable for a 10-second default animation rhythm, with an adaptive 8-12 second range when the scene needs more room for dialogue or explanation.
- The pacing should be fast, clear, child-friendly, and easy to visualize.
- Keep characters, appearance, relationships, tone, pacing, emotional continuity, and cinematic visual identity consistent.
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
- Scene 1: immediate curiosity hook with Joe reacting in the first spoken line
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
- Her sahne, 10 saniyelik varsayılan animasyon ritmine uygun yazılmalı; diyalog veya açıklama yoğun olduğunda 8-12 saniyelik adaptif aralık desteklenmelidir.
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
- Sahne 1: Joe’nun ilk konuşma satırında tepki verdiği güçlü merak hook’u
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
      input: `${buildGuideSceneInstruction(normalizedLanguage)}

${prompt}`,
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