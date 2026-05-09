import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type SceneIntelligence = {
  curiosity_score?: number;
  emotional_intensity?: number;
  climax_level?: number;
  tension_score?: number;
  thumbnail_strength?: number;
  hook_strength?: number;
  retention_strength?: number;
  youtube_ready_score?: number;
  notes?: string[];
};

type Scene = {
  id: number;
  text: string;
  narration: string;
  dialogue: string;
  cameraDirection: string;
  emotion: string;
  motionHint: string;
  intelligence?: SceneIntelligence;
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
You are editing a Storyverse animated scene for ages 8-12.

STRICT STORYVERSE EDITING RULES:
- keep character identity stable
- do not change character traits
- do not introduce visual inconsistency
- do not change age, outfit, accessory, personality, or relationship unless explicitly requested
- do not add narration tone, voice tone, acting, or delivery instructions
- keep all spoken text short, natural, and TTS-ready

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
    "motionHint": "string",
    "intelligence": {
      "curiosity_score": 0-100,
      "emotional_intensity": 0-100,
      "climax_level": 0-100,
      "tension_score": 0-100,
      "thumbnail_strength": 0-100,
      "hook_strength": 0-100,
      "retention_strength": 0-100,
      "youtube_ready_score": 0-100,
      "notes": ["short insight"]
    }
  }
}


ADDITIONAL DYNAMIC SCENE INTELLIGENCE RULES:
- Recalculate scene intelligence completely after every edit.
- Intelligence scores must reflect the UPDATED version only.
- Higher curiosity and tension should increase hook_strength.
- Emotional reveals should increase emotional_intensity and retention_strength.
- Strong visual moments should increase thumbnail_strength.
- Return realistic scoring values between 0 and 100.
- Include 1-3 short notes explaining strengths or weaknesses.

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
Sen 8-12 yaş grubu için Storyverse animasyon sahnesi düzenleyen bir yardımcı yazarsın.

KATI STORYVERSE DÜZENLEME KURALLARI:
- karakter kimliğini sabit tut
- karakter özelliklerini değiştirme
- görsel tutarsızlık yaratma
- özellikle istenmedikçe yaş, kıyafet, aksesuar, kişilik veya ilişki değiştirme
- ses tonu, anlatım tonu, oyunculuk veya okuma yönlendirmesi yazma
- tüm konuşma metinleri kısa, doğal ve TTS'e hazır olmalı

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
    "motionHint": "string",
    "intelligence": {
      "curiosity_score": 0-100,
      "emotional_intensity": 0-100,
      "climax_level": 0-100,
      "tension_score": 0-100,
      "thumbnail_strength": 0-100,
      "hook_strength": 0-100,
      "retention_strength": 0-100,
      "youtube_ready_score": 0-100,
      "notes": ["short insight"]
    }
  }
}


EK DYNAMIC SCENE INTELLIGENCE KURALLARI:
- Her düzenleme sonrası intelligence skorlarını yeniden hesapla.
- Skorlar SADECE güncellenmiş sahneyi yansıtmalı.
- Güçlü merak ve gerilim hook_strength skorunu artırmalı.
- Duygusal anlar emotional_intensity ve retention_strength skorunu artırmalı.
- Güçlü görsel anlar thumbnail_strength skorunu artırmalı.
- Tüm skorlar 0-100 arasında gerçekçi olmalı.
- 1-3 kısa analiz notu üret.

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

    const normalizedScene = {
      ...parsed.updatedScene,
      intelligence: {
        curiosity_score:
          parsed.updatedScene?.intelligence?.curiosity_score ?? 72,
        emotional_intensity:
          parsed.updatedScene?.intelligence?.emotional_intensity ?? 68,
        climax_level:
          parsed.updatedScene?.intelligence?.climax_level ?? 65,
        tension_score:
          parsed.updatedScene?.intelligence?.tension_score ?? 70,
        thumbnail_strength:
          parsed.updatedScene?.intelligence?.thumbnail_strength ?? 74,
        hook_strength:
          parsed.updatedScene?.intelligence?.hook_strength ?? 76,
        retention_strength:
          parsed.updatedScene?.intelligence?.retention_strength ?? 71,
        youtube_ready_score:
          parsed.updatedScene?.intelligence?.youtube_ready_score ?? 73,
        notes:
          parsed.updatedScene?.intelligence?.notes || [
            normalizedLanguage === "en"
              ? "Scene intelligence refreshed after edit."
              : "Scene intelligence edit sonrası güncellendi.",
          ],
      },
    };

    return NextResponse.json({
      updatedScene: normalizedScene,
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