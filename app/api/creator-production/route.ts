import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

type CreatorMentorResult = {
  audienceInsight?: string[];
  hookPatterns?: string[];
  videoIdeas?: Array<{ title?: string; concept?: string }>;
  recommendedIdea?: {
    title?: string;
    reason?: string;
  };
  productionPlan?: string[];
};

type CreatorProductionRequest = {
  topic?: string;
  country?: string;
  ageGroup?: string;
  contentType?: string;
  format?: string;
  durationSec?: number;
  sceneCount?: number;
  language?: "tr" | "en";
  mentorAnalysis?: CreatorMentorResult;
};

function asString(value: unknown, fallback = "") {
  const result = String(value || "").trim();
  return result || fallback;
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(numericValue), min), max);
}

function getPacingBlueprint(sceneCount: number) {
  const hookEnd = Math.max(1, Math.ceil(sceneCount * 0.15));
  const setupEnd = Math.max(hookEnd + 1, Math.ceil(sceneCount * 0.3));
  const developmentEnd = Math.max(setupEnd + 1, Math.ceil(sceneCount * 0.72));
  const climaxEnd = Math.max(developmentEnd + 1, Math.ceil(sceneCount * 0.88));

  return {
    hook: `Scenes 1-${hookEnd}: hook, curiosity gap, and immediate visual payoff`,
    setup: `Scenes ${hookEnd + 1}-${setupEnd}: setup, context, and the first clear learning promise`,
    development: `Scenes ${setupEnd + 1}-${developmentEnd}: core explanation with escalating visual examples`,
    climax: `Scenes ${developmentEnd + 1}-${climaxEnd}: strongest fact, surprise, or visual demonstration`,
    resolution: `Scenes ${climaxEnd + 1}-${sceneCount}: recap, memorable takeaway, and soft engagement question`,
  };
}

const CREATOR_LAB_CONSISTENCY_GUARD = {
  recurringCharacter:
    "Joe is a consistent 10-year-old boy with short slightly messy brown hair, large green eyes, a red baseball cap, a blue t-shirt with a clear rocket logo, simple blue jeans, and simple white sneakers.",
  personality:
    "Joe is curious, energetic, kind, brave, slightly playful, emotionally expressive, and asks short questions that help children understand the topic.",
  narrationStyle:
    "Narration must stay clean, short, warm, direct, and speakable. Do not include emotion tags, SFX tags, voice labels, or acting directions inside narration or dialogue.",
  visualContinuity:
    "All scenes must feel like one premium 3D animated film episode, not separate AI-generated slides. Keep character design, color energy, lighting quality, and cinematic framing consistent.",
  creatorLabVisualEnergy:
    "Creator Lab visuals should be high-clarity, thumbnail-friendly, high-contrast, premium 3D animated, mobile-readable, and child-safe.",
};

function getCreatorLabConsistencyRules(language: "tr" | "en") {
  if (language === "tr") {
    return [
      "Joe her sahnede aynı karakter olarak korunmalı: 10 yaşında erkek çocuk, kısa hafif dağınık kahverengi saç, büyük yeşil gözler, kırmızı beyzbol şapkası, roket logolu mavi t-shirt, mavi jean ve beyaz spor ayakkabılar.",
      "Joe'nun kişiliği tutarlı kalmalı: meraklı, enerjik, nazik, cesur, hafif oyunbaz, duygusal olarak ifade gücü yüksek ve konuyu anlamaya yardım eden kısa sorular soran bir rehber.",
      "Anlatım kısa, sıcak, doğrudan ve seslendirilebilir olmalı. Anlatım veya diyalog içine emotion, SFX, voice label veya oyunculuk yönlendirmesi yazma.",
      "Tüm sahneler tek bir premium 3D animasyon bölümüne ait gibi hissettirmeli; ayrı ayrı üretilmiş AI slaytları gibi görünmemeli.",
      "Sahneler arasında tempo, duygu, karakter davranışı, ışık kalitesi, renk enerjisi ve sinematik çerçeveleme tutarlı kalmalı.",
      "Creator Lab görselleri YouTube için mobile-readable, thumbnail-friendly, yüksek kontrastlı, premium 3D animated ve child-safe olmalı.",
    ];
  }

  return [
    CREATOR_LAB_CONSISTENCY_GUARD.recurringCharacter,
    CREATOR_LAB_CONSISTENCY_GUARD.personality,
    CREATOR_LAB_CONSISTENCY_GUARD.narrationStyle,
    CREATOR_LAB_CONSISTENCY_GUARD.visualContinuity,
    "Maintain consistent pacing, emotion, character behavior, lighting quality, color energy, and cinematic framing across scenes.",
    CREATOR_LAB_CONSISTENCY_GUARD.creatorLabVisualEnergy,
  ];
}

function getDurationBudget(durationSec: number, sceneCount: number) {
  const lowerTotalSpeechSec = Math.max(10, Math.round(durationSec * 0.9));
  const upperTotalSpeechSec = Math.max(
    lowerTotalSpeechSec + 3,
    Math.round(durationSec * 1.1),
  );
  const targetTotalSpeechSec = Math.round(
    (lowerTotalSpeechSec + upperTotalSpeechSec) / 2,
  );
  const targetWordsTotal = Math.max(
    24,
    Math.round(targetTotalSpeechSec * 2.35),
  );
  const maxWordsTotal = Math.max(
    targetWordsTotal + sceneCount,
    Math.round(upperTotalSpeechSec * 2.55),
  );
  const targetWordsPerScene = Math.max(
    6,
    Math.floor(targetWordsTotal / Math.max(1, sceneCount)),
  );
  const maxWordsPerScene = Math.max(
    targetWordsPerScene + 2,
    Math.ceil(maxWordsTotal / Math.max(1, sceneCount)),
  );

  return {
    lowerTotalSpeechSec,
    targetTotalSpeechSec,
    upperTotalSpeechSec,
    targetWordsTotal,
    maxWordsTotal,
    targetWordsPerScene,
    maxWordsPerScene,
  };
}


function getCreatorLabTestReadinessProfile(
  durationSec: number,
  sceneCount: number,
  estimatedTotalSpeechSeconds: number,
  upperTotalSpeechSec: number,
) {
  const speechWithinBudget = estimatedTotalSpeechSeconds <= upperTotalSpeechSec;
  const recommendedTestMode = sceneCount <= 6 ? "minimum-cost-6-scene-test" : "standard-flow-test";

  return {
    recommendedTestMode,
    minimumSceneRule: "Creator Lab test flow should keep at least 6 scenes. Do not reduce to a single-scene test because the current product flow is designed around a minimum multi-scene structure.",
    testAfterSprintBundle: true,
    costControl: [
      "Use exactly 6 scenes for the first validation run.",
      "Use a short, simple topic with compact narration.",
      "Avoid batch generation during validation.",
      "Do not test Shorts-native export in this phase.",
      "Validate one complete Creator Lab package before Vercel/Railway push."
    ],
    manualChecks: [
      "Characters and Joe identity remain visually consistent.",
      "Images look premium 3D/cinematic rather than flat 2D.",
      "Speech does not continue into the next scene after the visual changes.",
      "Speech is not cut before a sentence finishes.",
      "Thumbnail and YouTube metadata are publish-ready.",
      "Export package includes usable caption, title, description, hashtags, and checklist files."
    ],
    passCriteria: [
      "All 6 scenes are generated.",
      "Estimated total speech duration stays within target budget.",
      "No scene changes while speech is still continuing from the previous scene.",
      "No audio is abruptly cut at scene boundaries.",
      "Final output is standard YouTube-friendly 16:9 rather than forced Shorts-native output."
    ],
    speechWithinBudget,
  };
}

function countWords(value: string) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

  return words.length;
}

function trimToWordLimit(value: string, maxWords: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

  if (words.length <= maxWords) {
    return value.trim();
  }

  return `${words
    .slice(0, maxWords)
    .join(" ")
    .replace(/[,.!?:;]+$/, "")}…`;
}

function estimateSpeechSeconds(value: string) {
  return Math.round((countWords(value) / 2.35) * 10) / 10;
}

function normalizeScenesWithBudget(
  value: unknown,
  sceneCount: number,
  maxWordsPerScene: number,
) {
  const scenes = normalizeScenes(value, sceneCount);

  return scenes.map((scene) => {
    const narration = trimToWordLimit(scene.narration, maxWordsPerScene);
    const dialogue = trimToWordLimit(
      scene.dialogue,
      Math.max(0, Math.floor(maxWordsPerScene * 0.45)),
    );
    const combinedSpeech = [narration, dialogue].filter(Boolean).join(" ");

    return {
      ...scene,
      narration,
      dialogue,
      estimatedSpeechSeconds: estimateSpeechSeconds(combinedSpeech),
      speechWordCount: countWords(combinedSpeech),
    };
  });
}

function extractJsonObject(raw: string) {
  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    return cleaned;
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function normalizeCharacters(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 4).map((item, index) => {
    const character = item as Record<string, unknown>;

    return {
      name: asString(character.name, `Character ${index + 1}`),
      age: asString(character.age, ""),
      appearance: asString(character.appearance, ""),
      outfit: asString(character.outfit, ""),
      accessory: asString(character.accessory, ""),
      personality: asString(character.personality, ""),
      referenceImage: "",
      voiceId: "",
    };
  });
}

function normalizeScenes(value: unknown, sceneCount: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, sceneCount).map((item, index) => {
    const scene = item as Record<string, unknown>;

    return {
      id: Number(scene.id) || index + 1,
      text: asString(scene.text),
      narration: asString(scene.narration),
      dialogue: asString(scene.dialogue),
      cameraDirection: asString(
        scene.cameraDirection,
        "Clean animated framing with clear focus.",
      ),
      emotion: asString(scene.emotion, "curious and energetic"),
      motionHint: asString(
        scene.motionHint,
        asString(scene.visualPrompt, "Simple animated movement."),
      ),
      visualPrompt: asString(scene.visualPrompt),
    };
  });
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "").trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Geçersiz oturum." }, { status: 401 });
    }

    const body = (await req
      .json()
      .catch(() => null)) as CreatorProductionRequest | null;

    const topic = asString(body?.topic);
    const country = asString(body?.country, "Global / International");
    const ageGroup = asString(body?.ageGroup, "8-12");
    const contentType = asString(body?.contentType, "Educational");
    const format = asString(body?.format, "Shorts / 60 sec");
    const durationSec = clampNumber(body?.durationSec, 60, 45, 360);
    const sceneCount = clampNumber(body?.sceneCount, 6, 6, 36);
    const targetSceneDurationSec = Math.max(
      5,
      Math.round(durationSec / sceneCount),
    );
    const durationBudget = getDurationBudget(durationSec, sceneCount);
    const language = body?.language === "tr" ? "tr" : "en";
    const mentorAnalysis = body?.mentorAnalysis || {};
    const pacingBlueprint = getPacingBlueprint(sceneCount);

    if (!topic && !mentorAnalysis?.recommendedIdea?.title) {
      return NextResponse.json(
        { error: "topic veya recommendedIdea zorunlu." },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY tanımlı değil." },
        { status: 500 },
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = [
      "You are a senior YouTube animated video producer, retention editor, and child-safe storytelling designer.",
      "You convert a creator mentor analysis into a production-ready package for an AI video generation pipeline.",
      "This is Smart Production Sync: duration, scene count, pacing, and story structure must match.",
      "Return strict JSON only. No markdown. No code fences.",
      "The output must be compatible with a scene-based animation engine.",
    ].join(" ");

    const userPrompt = {
      task: "Create a synchronized production-ready video package.",
      target: {
        market: country,
        ageGroup,
        contentType,
        format,
        durationSec,
        sceneCount,
        targetSceneDurationSec,
        speechDurationBudget: durationBudget,
        outputLanguage: language === "en" ? "English" : "Turkish",
      },
      pacingBlueprint,
      consistencyGuard: getCreatorLabConsistencyRules(language),
      topic,
      mentorAnalysis,
      requiredJsonShape: {
        title: "string",
        hook: "string",
        storyPremise: "string",
        characters: [
          {
            name: "string",
            age: "string",
            appearance: "string",
            outfit: "string",
            accessory: "string",
            personality: "string",
          },
        ],
        visualBible: {
          style: "string",
          palette: "string",
          camera: "string",
          consistencyRules: "string",
        },
        scenes: [
          {
            id: 1,
            text: "string",
            narration: "string",
            dialogue: "string",
            cameraDirection: "string",
            emotion: "string",
            motionHint: "string",
            visualPrompt: "string",
          },
        ],
        thumbnailIdea: "string",
        youtubeTitle: "string",
        caption: "string",
      },
      rules: [
        `Create exactly ${sceneCount} scenes.`,
        "The product flow has a minimum of 6 scenes. Never collapse this into a single-scene test structure.",
        `Design the video for approximately ${durationSec} seconds total.`,
        `Total spoken narration + dialogue must stay between ${durationBudget.lowerTotalSpeechSec} and ${durationBudget.upperTotalSpeechSec} seconds, targeting ${durationBudget.targetTotalSpeechSec} seconds.`,
        `Total spoken words must stay under ${durationBudget.maxWordsTotal} words across all scenes.`,
        `Each scene should fit roughly ${targetSceneDurationSec} seconds and should use about ${durationBudget.targetWordsPerScene} spoken words, never more than ${durationBudget.maxWordsPerScene} spoken words including narration and dialogue.`,
        "Scene 1 must open with a strong 3-second curiosity hook.",
        "Follow the provided pacingBlueprint so the video has a clear beginning, development, climax, and resolution.",
        "Do not create a 7-scene short if sceneCount is larger; match the requested scene count.",
        "Keep narration clean. Do not include emotion tags, voice labels, or sound-effect labels inside narration.",
        "Keep each narration line short, direct, and speakable. Prefer one compact sentence per scene.",
        "Dialogue may be empty if the format is narrator-led. If dialogue is used, keep it very short.",
        "Do not compensate with long dialogue. The total speech budget includes narration and dialogue together.",
        "Scenes must be visual and easy for AI image/video generation.",
        "Keep content age-appropriate, educational, and safe.",
        "Create simple reusable characters if the video benefits from character continuity.",
        "Joe must stay visually and behaviorally consistent if he appears in the video.",
        "All scenes must preserve one coherent visual universe, not separate unrelated image styles.",
        "Maintain consistent narration tone, emotional rhythm, and cinematic energy from scene to scene.",
        "Creator Lab visual prompts should stay high-clarity, premium 3D animated, mobile-readable, and thumbnail-friendly.",
        "Avoid repetitive scene openings; each scene should advance the story or explanation.",
      ],
    };

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(userPrompt),
        },
      ],
      temperature: 0.62,
    });

    const rawText = response.output_text || "";
    const cleanedJson = extractJsonObject(rawText);

    let parsed: any;

    try {
      parsed = JSON.parse(cleanedJson);
    } catch {
      console.error("creator-production JSON parse error:", rawText);

      return NextResponse.json(
        { error: "Creator production çıktısı JSON olarak parse edilemedi." },
        { status: 500 },
      );
    }

    const characters = normalizeCharacters(parsed.characters);
    const scenes = normalizeScenesWithBudget(
      parsed.scenes,
      sceneCount,
      durationBudget.maxWordsPerScene,
    );

    if (!characters.length || !scenes.length) {
      return NextResponse.json(
        { error: "Production package eksik karakter veya sahne içeriyor." },
        { status: 500 },
      );
    }

    if (scenes.length < sceneCount) {
      return NextResponse.json(
        {
          error: `Production package beklenen minimum sahne sayısına ulaşamadı. Beklenen: ${sceneCount}, gelen: ${scenes.length}.`,
        },
        { status: 500 },
      );
    }

    const estimatedTotalSpeechSeconds =
      Math.round(
        scenes.reduce((sum, scene) => sum + scene.estimatedSpeechSeconds, 0) *
          10,
      ) / 10;
    const estimatedTotalSpeechWords = scenes.reduce(
      (sum, scene) => sum + scene.speechWordCount,
      0,
    );
    const creatorLabTestReadiness = getCreatorLabTestReadinessProfile(
      durationSec,
      sceneCount,
      estimatedTotalSpeechSeconds,
      durationBudget.upperTotalSpeechSec,
    );

    const productionPackage = {
      title: asString(
        parsed.title,
        asString(mentorAnalysis?.recommendedIdea?.title, "Creator Lab Video"),
      ),
      hook: asString(parsed.hook),
      storyPremise: asString(parsed.storyPremise),
      characters,
      visualBible: {
        style: asString(
          parsed?.visualBible?.style,
          "Premium cinematic 3D animated film style suitable for children, with consistent character identity and high production value.",
        ),
        palette: asString(
          parsed?.visualBible?.palette,
          "Vivid but balanced colors with strong subject/background contrast.",
        ),
        camera: asString(
          parsed?.visualBible?.camera,
          "Simple clear shots, gentle pans, and occasional close-ups.",
        ),
        consistencyRules: asString(
          parsed?.visualBible?.consistencyRules,
          "Keep Joe, character outfits, colors, lighting quality, emotional tone, and accessories consistent across scenes. Avoid generic AI slideshow variation.",
        ),
      },
      scenes,
      thumbnailIdea: asString(parsed.thumbnailIdea),
      youtubeTitle: asString(parsed.youtubeTitle),
      caption: asString(parsed.caption),
      durationSec,
      sceneCount,
      targetSceneDurationSec,
      durationBudget,
      estimatedTotalSpeechSeconds,
      estimatedTotalSpeechWords,
      creatorLabTestReadiness,
      pacingBlueprint,
    };

    return NextResponse.json({
      success: true,
      productionPackage,
    });
  } catch (e: any) {
    console.error("creator-production error:", e);

    return NextResponse.json(
      {
        error:
          e?.message || "Creator production paketi oluşturulurken hata oluştu.",
      },
      { status: 500 },
    );
  }
}
