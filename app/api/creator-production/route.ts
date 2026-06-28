import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import {
  createTimelineSyncPlan,
  normalizeVideoQualityTier,
  type VideoQualityTier,
} from "../../../lib/video/timelineSync";

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
  qualityMode?: VideoQualityTier;
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
  characterFreedom:
    "Do not force Joe, a child guide, or any recurring cartoon cast unless the user explicitly requested that character. Support user-defined characters, faceless formats, documentary formats, product-led formats, and channel-specific visual identities.",
  characterContinuity:
    "When the user defines characters, keep their identity, face, outfit, age impression, accessories, and visual role consistent across scenes. If no character is defined, preserve the chosen visual universe instead of inventing a recurring mascot.",
  narrationStyle:
    "Narration must stay clean, short, direct, and speakable. Do not include emotion tags, SFX tags, voice labels, or acting directions inside narration or dialogue.",
  visualContinuity:
    "All scenes must feel like one coherent premium production timeline, not separate AI-generated slides. Keep style, color energy, lighting quality, camera logic, and editorial rhythm consistent.",
  creatorLabVisualEnergy:
    "CreatorLab visuals should be high-clarity, thumbnail-friendly, high-contrast, mobile-readable, platform-aware, and suitable for professional creator output.",
};

function getCreatorLabConsistencyRules(language: "tr" | "en") {
  if (language === "tr") {
    return [
      "Joe, çocuk rehber veya sabit çizgi film karakteri zorunlu değildir. Kullanıcının tanımladığı karakterleri, faceless formatları, belgesel anlatımı, ürün odaklı formatları ve kanal kimliğine özel görsel dili destekle.",
      "Kullanıcı karakter tanımladıysa yüz, yaş hissi, kıyafet, aksesuar, görsel rol ve davranış sürekliliğini koru. Karakter tanımlanmadıysa sahte bir maskot eklemek yerine görsel evreni ve editoryal dili tutarlı tut.",
      "Anlatım kısa, doğrudan ve seslendirilebilir olmalı. Anlatım veya diyalog içine emotion, SFX, voice label veya oyunculuk yönlendirmesi yazma.",
      "Tüm sahneler tek bir premium üretim timeline'ına ait gibi hissettirmeli; ayrı ayrı üretilmiş AI slaytları gibi görünmemeli.",
      "Sahneler arasında tempo, duygu, ışık kalitesi, renk enerjisi, kamera mantığı ve editoryal ritim tutarlı kalmalı.",
      "CreatorLab görselleri mobile-readable, thumbnail-friendly, yüksek kontrastlı, platforma uygun ve profesyonel creator çıktısı seviyesinde olmalı.",
    ];
  }

  return [
    CREATOR_LAB_CONSISTENCY_GUARD.characterFreedom,
    CREATOR_LAB_CONSISTENCY_GUARD.characterContinuity,
    CREATOR_LAB_CONSISTENCY_GUARD.narrationStyle,
    CREATOR_LAB_CONSISTENCY_GUARD.visualContinuity,
    "Maintain consistent pacing, emotion, lighting quality, color energy, camera logic, and editorial rhythm across scenes.",
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
      "User-defined characters or the selected visual universe remain consistent.",
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

function repairCommonJsonIssues(value: string) {
  return value
    .replace(/[“”]/g, "'")
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/',\s*"([A-Za-z][A-Za-z0-9_]*)"\s*:/g, `',"$1":`)
    .trim();
}

function parseCreatorProductionJson(raw: string) {
  const extracted = extractJsonObject(raw);

  try {
    return JSON.parse(extracted);
  } catch (firstError) {
    const repaired = repairCommonJsonIssues(extracted);

    try {
      return JSON.parse(repaired);
    } catch (secondError) {
      console.error("creator-production JSON parse error:", raw);
      console.error("creator-production repaired JSON parse error:", repaired);

      throw secondError;
    }
  }
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

function createFallbackCreatorAnchor(
  language: "tr" | "en",
  topic: string,
  visualStyle: string,
) {
  const isTurkish = language === "tr";

  return [
    {
      name: isTurkish ? "CreatorLab Anlatıcı / Marka Sesi" : "CreatorLab Narrator / Brand Voice",
      age: "18+ professional voice profile",
      appearance: isTurkish
        ? "Faceless veya marka odaklı formatlarda görsel evreni temsil eden profesyonel anlatıcı profili. Zorunlu karakter ya da Joe değildir."
        : "Professional narrator profile representing the visual universe in faceless or brand-led formats. This is not a forced character or Joe.",
      outfit: isTurkish
        ? "Kanal kimliğine ve konuya uygun; gerekiyorsa ekranda görünmez."
        : "Aligned to the channel identity and topic; may remain off-screen when the format is faceless.",
      accessory: topic || visualStyle || "",
      personality: isTurkish
        ? "Net, güvenilir, platforma uygun ve profesyonel creator tonu."
        : "Clear, credible, platform-aware professional creator tone.",
      referenceImage: "",
      voiceId: "",
    },
  ];
}

function createFallbackScene(
  index: number,
  sceneCount: number,
  topic: string,
  language: "tr" | "en",
) {
  const isTurkish = language === "tr";
  const safeTopic = topic || (isTurkish ? "bu içerik fikri" : "this content idea");
  const isFirst = index === 0;
  const isLast = index === sceneCount - 1;

  if (isTurkish) {
    const narration = isFirst
      ? `${safeTopic} neden şimdi önemli? Kısa ve net şekilde başlayalım.`
      : isLast
        ? `Bu fikri güçlü bir kapanışla özetleyip izleyiciyi aksiyona çağıralım.`
        : `${safeTopic} için ana içgörüyü kısa, görsel ve anlaşılır şekilde anlatalım.`;

    return {
      id: index + 1,
      text: isFirst
        ? `Açılış hook'u ve izleyicinin dikkatini çeken net bağlam.`
        : isLast
          ? `Kapanış, özet ve izleyiciye net aksiyon çağrısı.`
          : `Ana içgörü ${index}: kısa açıklama ve görsel örnek.`,
      narration,
      dialogue: "",
      cameraDirection: isFirst
        ? "Güçlü açılış kadrajı, net odak ve yumuşak kamera hareketi."
        : isLast
          ? "Yakın kapanış kadrajı, güven veren final kompozisyonu."
          : "Temiz orta plan, destekleyici B-roll veya grafik geçişi.",
      emotion: isFirst ? "merak uyandıran" : isLast ? "güven veren" : "bilgilendirici",
      motionHint: "Yumuşak zoom, hafif pan veya motion graphic destekli geçiş.",
      visualPrompt: `${safeTopic} hakkında premium creator video sahnesi, profesyonel ışık, yüksek kontrast, platforma uygun görsel evren`,
    };
  }

  const narration = isFirst
    ? `Why does ${safeTopic} matter right now? Let’s make it clear fast.`
    : isLast
      ? `Now wrap the idea with a clear takeaway and a simple next action.`
      : `Explain the key insight about ${safeTopic} with a short visual example.`;

  return {
    id: index + 1,
    text: isFirst
      ? "Opening hook with immediate context and viewer relevance."
      : isLast
        ? "Closing recap with a clear takeaway and soft call to action."
        : `Key insight ${index}: concise explanation with a visual example.`,
    narration,
    dialogue: "",
    cameraDirection: isFirst
      ? "Strong opening frame with clean focus and subtle camera movement."
      : isLast
        ? "Confident closing frame with a clear final composition."
        : "Clean medium frame with supporting B-roll or motion graphic cutaway.",
    emotion: isFirst ? "curious and sharp" : isLast ? "confident" : "informative",
    motionHint: "Soft zoom, gentle pan, or motion-graphic assisted transition.",
    visualPrompt: `premium creator video scene about ${safeTopic}, professional lighting, high contrast, platform-ready visual universe`,
  };
}

function padCreatorScenes(
  scenes: ReturnType<typeof normalizeScenes>,
  sceneCount: number,
  topic: string,
  language: "tr" | "en",
) {
  const nextScenes = [...scenes].slice(0, sceneCount);

  while (nextScenes.length < sceneCount) {
    nextScenes.push(
      createFallbackScene(nextScenes.length, sceneCount, topic, language),
    );
  }

  return nextScenes.map((scene, index) => ({
    ...scene,
    id: index + 1,
    text: asString(scene.text, createFallbackScene(index, sceneCount, topic, language).text),
    narration: asString(
      scene.narration,
      createFallbackScene(index, sceneCount, topic, language).narration,
    ),
    visualPrompt: asString(
      scene.visualPrompt,
      createFallbackScene(index, sceneCount, topic, language).visualPrompt,
    ),
  }));
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
    const ageGroup = asString(body?.ageGroup, "Professional creator audience / 18+");
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
    const qualityMode = normalizeVideoQualityTier(body?.qualityMode, "pro");
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
      "You are a senior YouTube producer, retention editor, creative director, and platform packaging strategist.",
      "You convert a creator mentor analysis into a production-ready package for an AI video generation pipeline.",
      "This is Smart Production Sync: duration, scene count, pacing, and story structure must match.",
      "Return strict valid JSON only. No markdown. No code fences. No comments.",
      "Every JSON string must use valid escaping. Do not use raw double quotes inside string values.",
      "For thumbnail text, do not wrap the visible text in single or double quote marks; write the text plainly.",
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
        "Keep content safe, platform-appropriate, and aligned with the selected audience profile.",
        "Do not force a fixed mascot, child guide, or Joe unless the user explicitly requested it in the topic, mentor analysis, or channel concept.",
        "CreatorLab is an 18+ professional creator workflow. Do not create teen or child presenters unless the user explicitly requested a teen/child audience or character.",
        "Create reusable characters only when the video concept benefits from character continuity.",
        "If Joe appears because the user requested him, keep him visually and behaviorally consistent; otherwise do not inject Joe into the production package.",
        "All scenes must preserve one coherent visual universe, not separate unrelated image styles.",
        "Maintain consistent narration tone, emotional rhythm, and cinematic energy from scene to scene.",
        "CreatorLab visual prompts should stay high-clarity, platform-aware, mobile-readable, premium, and thumbnail-friendly; do not limit the style to cartoons unless requested.",
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
      temperature: 0.35,
    });

    const rawText = response.output_text || "";

    let parsed: any;

    try {
      parsed = parseCreatorProductionJson(rawText);
    } catch {
      return NextResponse.json(
        { error: "Creator production çıktısı JSON olarak parse edilemedi." },
        { status: 500 },
      );
    }

    const visualStyle = asString(
      parsed?.visualBible?.style,
      "Premium platform-ready visual universe",
    );
    const characters = normalizeCharacters(parsed.characters).length
      ? normalizeCharacters(parsed.characters)
      : createFallbackCreatorAnchor(language, topic, visualStyle);
    const normalizedScenes = normalizeScenes(
      parsed.scenes,
      sceneCount,
    );
    const paddedScenes = padCreatorScenes(
      normalizedScenes,
      sceneCount,
      topic,
      language,
    );
    const scenes = normalizeScenesWithBudget(
      paddedScenes,
      sceneCount,
      durationBudget.maxWordsPerScene,
    );
    const productionRepairNotes = [
      !normalizeCharacters(parsed.characters).length
        ? "No explicit character set was returned by the model; CreatorLab inserted a neutral narrator / brand voice anchor for faceless or professional formats."
        : "",
      normalizedScenes.length < sceneCount
        ? `The model returned ${normalizedScenes.length} scene(s); CreatorLab padded the text-only production stage to ${sceneCount} editable scenes before paid rendering.`
        : "",
    ].filter(Boolean);

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
    const timelineSyncPlan = createTimelineSyncPlan({
      product: "creatorlab",
      qualityTier: qualityMode,
      durationSec,
      sceneCount,
      scenes,
    });

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
          "Premium platform-ready visual style with consistent character identity or consistent visual universe, high production value, and strong editorial clarity.",
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
          "Keep user-defined characters, visual universe, colors, lighting quality, emotional tone, and editorial rhythm consistent across scenes. Avoid generic AI slideshow variation.",
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
      qualityMode,
      timelineSyncPlan,
      creatorLabTestReadiness,
      pacingBlueprint,
      productionRepairNotes,
      textOnlyProductionStage: true,
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
