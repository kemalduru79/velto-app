import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import {
  createTimelineSyncPlan,
  normalizeVideoQualityTier,
} from "../../../lib/video/timelineSync";
import {
  creatorBriefRequestsDialogue,
  normalizeCreatorAdultScene,
} from "../../../lib/creator/adultContentGuard";
import {
  mergeCreatorSceneContinuityState,
  normalizeCreatorSceneContinuityState,
} from "../../../lib/creator/sceneContinuity";

type CreatorSceneInput = {
  id?: unknown;
  text?: unknown;
  narration?: unknown;
  dialogue?: unknown;
  cameraDirection?: unknown;
  emotion?: unknown;
  motionHint?: unknown;
  visualPrompt?: unknown;
  intelligence?: unknown;
  continuity?: unknown;
};

type CreatorProductionPackageInput = {
  title?: unknown;
  hook?: unknown;
  storyPremise?: unknown;
  characters?: unknown;
  visualBible?: unknown;
  scenes?: unknown;
  thumbnailIdea?: unknown;
  youtubeTitle?: unknown;
  caption?: unknown;
  durationSec?: unknown;
  sceneCount?: unknown;
  targetSceneDurationSec?: unknown;
  qualityMode?: unknown;
  timelineSyncPlan?: unknown;
};

type CreatorScriptPlanRequest = {
  topic?: unknown;
  contentType?: unknown;
  format?: unknown;
  durationSec?: unknown;
  sceneCount?: unknown;
  language?: unknown;
  qualityMode?: unknown;
  dialogueRequested?: unknown;
  productionPackage?: CreatorProductionPackageInput | null;
};

type SceneRole = "hook" | "setup" | "development" | "climax" | "resolution";

type SceneBudget = {
  id: number;
  role: SceneRole;
  targetDurationSec: number;
  minWords: number;
  targetWords: number;
  maxWords: number;
  maxMotionBlockSec: number;
  visualBlockCount: number;
};

function asString(value: unknown, fallback = "") {
  const result = String(value || "").replace(/\s+/g, " ").trim();
  return result || fallback;
}

function asFiniteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function countWords(value: string) {
  return value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

function estimateSpeechSeconds(value: string, language: "tr" | "en") {
  const wordsPerSecond = language === "tr" ? 2.05 : 2.25;
  return roundTo(countWords(value) / wordsPerSecond, 1);
}

function inferSceneRole(index: number, sceneCount: number): SceneRole {
  if (index === 0) return "hook";
  if (index === sceneCount - 1) return "resolution";
  if (index === 1 && sceneCount >= 4) return "setup";
  if (index >= Math.max(2, Math.floor(sceneCount * 0.78))) return "climax";
  return "development";
}

function getRoleWeight(role: SceneRole) {
  if (role === "hook") return 0.72;
  if (role === "setup") return 0.96;
  if (role === "climax") return 1.18;
  if (role === "resolution") return 0.84;
  return 1;
}

function distributeDurations(
  durationSec: number,
  sceneCount: number,
  format: string,
) {
  const roles = Array.from({ length: sceneCount }, (_, index) =>
    inferSceneRole(index, sceneCount),
  );
  const weights = roles.map(getRoleWeight);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  const minSceneDuration = format === "youtube_video" ? 7 : 3;
  const maxSceneDuration = 30;
  const durations = weights.map((weight) =>
    clamp((durationSec * weight) / weightTotal, minSceneDuration, maxSceneDuration),
  );

  for (let pass = 0; pass < 12; pass += 1) {
    const difference = durationSec - durations.reduce((sum, value) => sum + value, 0);
    if (Math.abs(difference) < 0.05) break;

    const adjustable = durations
      .map((value, index) => ({ value, index }))
      .filter(({ value }) =>
        difference > 0
          ? value < maxSceneDuration - 0.05
          : value > minSceneDuration + 0.05,
      );

    if (!adjustable.length) break;

    const delta = difference / adjustable.length;
    for (const item of adjustable) {
      durations[item.index] = clamp(
        durations[item.index] + delta,
        minSceneDuration,
        maxSceneDuration,
      );
    }
  }

  return durations.map((value) => roundTo(value, 1));
}

function getSpeechCoverage(role: SceneRole, format: string) {
  if (role === "hook") return format === "youtube_video" ? 0.58 : 0.52;
  if (role === "setup") return 0.72;
  if (role === "climax") return 0.82;
  if (role === "resolution") return 0.68;
  return format === "youtube_video" ? 0.78 : 0.72;
}

function getMaxMotionBlockSeconds(qualityMode: string) {
  if (qualityMode === "cinematic") return 8;
  if (qualityMode === "pro") return 5;
  return 8;
}

function createSceneBudgets({
  durationSec,
  sceneCount,
  format,
  language,
  qualityMode,
}: {
  durationSec: number;
  sceneCount: number;
  format: string;
  language: "tr" | "en";
  qualityMode: string;
}): SceneBudget[] {
  const durations = distributeDurations(durationSec, sceneCount, format);
  const wordsPerSecond = language === "tr" ? 2.05 : 2.25;
  const maxMotionBlockSec = getMaxMotionBlockSeconds(qualityMode);

  return durations.map((targetDurationSec, index) => {
    const role = inferSceneRole(index, sceneCount);
    const targetWords = Math.max(
      role === "hook" ? 5 : format === "youtube_video" ? 14 : 6,
      Math.round(
        targetDurationSec * wordsPerSecond * getSpeechCoverage(role, format),
      ),
    );
    const minWords = Math.max(
      role === "hook" ? 4 : format === "youtube_video" ? 11 : 5,
      Math.round(targetWords * 0.76),
    );
    const maxWords = Math.max(
      targetWords + 2,
      Math.round(targetDurationSec * wordsPerSecond * 0.9),
    );

    return {
      id: index + 1,
      role,
      targetDurationSec,
      minWords,
      targetWords,
      maxWords,
      maxMotionBlockSec,
      visualBlockCount: Math.max(1, Math.ceil(targetDurationSec / maxMotionBlockSec)),
    };
  });
}

function extractJsonObject(raw: string) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned;
}

function parseModelJson(raw: string) {
  const extracted = extractJsonObject(raw);
  try {
    return JSON.parse(extracted) as Record<string, unknown>;
  } catch {
    const repaired = extracted
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(repaired) as Record<string, unknown>;
  }
}

function normalizeSourceScenes(value: unknown, sceneCount: number) {
  const source = Array.isArray(value) ? value : [];

  return Array.from({ length: sceneCount }, (_, index) => {
    const raw = (source[index] || {}) as CreatorSceneInput;
    return {
      id: index + 1,
      text: asString(raw.text),
      narration: asString(raw.narration),
      dialogue: asString(raw.dialogue),
      cameraDirection: asString(raw.cameraDirection),
      emotion: asString(raw.emotion),
      motionHint: asString(raw.motionHint),
      visualPrompt: asString(raw.visualPrompt),
      intelligence: raw.intelligence,
      continuity: normalizeCreatorSceneContinuityState(raw.continuity),
    };
  });
}

function normalizeModelScenes(
  value: unknown,
  sourceScenes: ReturnType<typeof normalizeSourceScenes>,
) {
  const modelScenes = Array.isArray(value) ? value : [];
  const byId = new Map<number, Record<string, unknown>>();

  modelScenes.forEach((item, index) => {
    const record = item && typeof item === "object"
      ? (item as Record<string, unknown>)
      : {};
    const id = Math.round(asFiniteNumber(record.id, index + 1));
    byId.set(id, record);
  });

  return sourceScenes.map((source) => {
    const revised = byId.get(source.id) || {};
    return {
      ...source,
      text: asString(revised.text, source.text),
      narration: asString(revised.narration, source.narration),
      dialogue: asString(revised.dialogue, source.dialogue),
      cameraDirection: asString(
        revised.cameraDirection,
        source.cameraDirection,
      ),
      emotion: asString(revised.emotion, source.emotion),
      motionHint: asString(revised.motionHint, source.motionHint),
      visualPrompt: asString(revised.visualPrompt, source.visualPrompt),
      continuity: mergeCreatorSceneContinuityState(
        source.continuity,
        revised.continuity,
      ),
    };
  });
}

function createVisualBlockPlan(
  scene: ReturnType<typeof normalizeSourceScenes>[number],
  budget: SceneBudget,
) {
  const count = budget.visualBlockCount;
  const baseDuration = budget.targetDurationSec / count;
  const purposes = [
    "establish the scene and subject",
    "advance the central idea with a new visual beat",
    "add evidence, detail, or contextual B-roll",
    "create a visual contrast or perspective shift",
    "deliver the scene payoff and transition forward",
  ];

  return Array.from({ length: count }, (_, index) => ({
    id: `${scene.id}.${index + 1}`,
    durationSec: roundTo(
      index === count - 1
        ? budget.targetDurationSec - baseDuration * (count - 1)
        : baseDuration,
      1,
    ),
    purpose: purposes[Math.min(index, purposes.length - 1)],
    prompt: [
      scene.visualPrompt || scene.text,
      purposes[Math.min(index, purposes.length - 1)],
      "Preserve the same subject identity, visual universe, lighting logic, and editorial continuity.",
    ]
      .filter(Boolean)
      .join(". "),
  }));
}

function buildSceneHealth(
  scene: ReturnType<typeof normalizeSourceScenes>[number],
  budget: SceneBudget,
  language: "tr" | "en",
) {
  const combinedSpeech = [scene.narration, scene.dialogue]
    .filter(Boolean)
    .join(" ");
  const speechWordCount = countWords(combinedSpeech);
  const estimatedSpeechSec = estimateSpeechSeconds(combinedSpeech, language);
  const status =
    speechWordCount < budget.minWords
      ? "too_short"
      : speechWordCount > budget.maxWords ||
          estimatedSpeechSec > budget.targetDurationSec - 0.8
        ? "too_long"
        : "ready";

  return {
    status,
    speechWordCount,
    estimatedSpeechSec,
    targetDurationSec: budget.targetDurationSec,
    minWords: budget.minWords,
    targetWords: budget.targetWords,
    maxWords: budget.maxWords,
    visualBlockCount: budget.visualBlockCount,
    maxMotionBlockSec: budget.maxMotionBlockSec,
  };
}

async function reviseScenes({
  client,
  topic,
  contentType,
  format,
  language,
  dialogueRequested,
  sourceScenes,
  budgets,
  repairIssues,
}: {
  client: OpenAI;
  topic: string;
  contentType: string;
  format: string;
  language: "tr" | "en";
  dialogueRequested: boolean;
  sourceScenes: ReturnType<typeof normalizeSourceScenes>;
  budgets: SceneBudget[];
  repairIssues?: Array<{ id: number; status: string; words: number }>;
}) {
  const systemPrompt = [
    "You are a senior documentary writer, YouTube script editor, retention editor, and scene-based production planner for CreatorLab, an adult 18+ professional creator product.",
    "Rewrite the supplied scene scripts into a coherent, content-rich, professionally speakable sequence.",
    "Never use child-audience framing, classroom language, a child host, Joe, a mascot, or simplified cartoon dialogue unless the brief explicitly makes children the subject; even then, write for the selected adult creator audience.",
    "Dialogue is opt-in. Do not invent a conversation merely to create a hook.",
    "Return strict valid JSON only. Do not use markdown or comments.",
    "Never invent specific facts, quotes, dates, statistics, or biographical claims that are not supported by the supplied material.",
    "Do not use filler, generic motivational language, repetitive scene openings, placeholder text, or empty three-second narration.",
    "Narration may use multiple natural sentences when the scene budget supports it. Do not force every scene into one compact sentence.",
    "Keep narration and dialogue clean: no speaker labels, emotion tags, SFX tags, or camera directions inside spoken text.",
    "Every scene must advance the story, argument, explanation, or emotional progression.",
    "Preserve scene order, scene count, topic, audience intent, and visual continuity.",
  ].join(" ");

  const userPrompt = {
    task: repairIssues?.length
      ? "Repair only the script-budget failures while preserving the complete sequence."
      : "Create a duration-safe professional script pass for every scene.",
    topic,
    contentType,
    format,
    dialogueRequested,
    outputLanguage: language === "tr" ? "Turkish" : "English",
    repairIssues: repairIssues || [],
    sceneBudgets: budgets,
    sourceScenes,
    requiredJsonShape: {
      scenes: [
        {
          id: 1,
          text: "concise scene purpose",
          narration: "professionally speakable narration within the supplied word range",
          dialogue: "optional dialogue; empty when narrator-led",
          cameraDirection: "production direction, not spoken text",
          emotion: "scene emotion",
          motionHint: "visual movement direction",
          visualPrompt: "specific visual-generation prompt",
          continuity: "optional supplied structured continuity state, including explicitChanges when deliberate; preserve or update only when the rewritten scene changes a production fact",
        },
      ],
    },
    rules: [
      "Return exactly the same number of scenes and the same numeric ids.",
      "For each scene, keep total narration plus dialogue between minWords and maxWords, targeting targetWords.",
      "The opening scene must be immediate, credible, and compelling, but it must still contain meaningful context rather than an empty slogan.",
      "Do not open with Hey kids, Did you know, Can you guess, Wow, Wait, or equivalent childlike audience-address formulas.",
      "Development scenes should contain concrete explanation, progression, evidence framing, or story detail drawn from the supplied source material.",
      dialogueRequested
        ? "Dialogue is explicitly requested by the brief. Keep it professional, natural, and necessary."
        : "Keep dialogue empty in every scene. Use professional narration or voice-over instead, including in Scene 1.",
      "Do not repeat the hook in later scenes.",
      "Write for continuous spoken delivery without abrupt cutoffs at scene boundaries.",
      "Make visualPrompt specific enough to support multiple coherent visual beats inside the scene.",
      "Preserve supplied structured continuity metadata. Do not invent missing facts or silently erase deliberate scene changes.",
    ],
  };

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPrompt) },
    ],
    temperature: 0.3,
  });

  const parsed = parseModelJson(response.output_text || "");
  return normalizeModelScenes(parsed.scenes, sourceScenes).map((scene, index) =>
    normalizeCreatorAdultScene(scene, {
      language,
      isOpeningScene: index === 0,
      allowDialogue: dialogueRequested,
    }),
  );
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized request." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as CreatorScriptPlanRequest | null;
    const productionPackage = body?.productionPackage;

    if (!productionPackage || typeof productionPackage !== "object") {
      return NextResponse.json(
        { error: "productionPackage is required." },
        { status: 400 },
      );
    }

    const sourceSceneArray = Array.isArray(productionPackage.scenes)
      ? productionPackage.scenes
      : [];
    const requestedSceneCount = Math.round(
      asFiniteNumber(body?.sceneCount, sourceSceneArray.length || 1),
    );
    const sceneCount = clamp(requestedSceneCount, 1, 36);
    const durationSec = clamp(
      asFiniteNumber(
        body?.durationSec,
        asFiniteNumber(productionPackage.durationSec, sceneCount * 10),
      ),
      5,
      3600,
    );
    const contentType = asString(body?.contentType, "Professional creator video");
    const format = asString(body?.format, "youtube_video");
    const language: "tr" | "en" = body?.language === "tr" ? "tr" : "en";
    const qualityMode = asString(
      body?.qualityMode,
      asString(productionPackage.qualityMode, "pro"),
    );
    const topic = asString(
      body?.topic,
      asString(productionPackage.title, "CreatorLab video"),
    );
    const dialogueRequested =
      typeof body?.dialogueRequested === "boolean"
        ? body.dialogueRequested
        : creatorBriefRequestsDialogue({ topic, contentType, format });
    const sourceScenes = normalizeSourceScenes(
      productionPackage.scenes,
      sceneCount,
    );

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const budgets = createSceneBudgets({
      durationSec,
      sceneCount,
      format,
      language,
      qualityMode,
    });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let revisedScenes = await reviseScenes({
      client,
      topic,
      contentType,
      format,
      language,
      dialogueRequested,
      sourceScenes,
      budgets,
    });

    const firstHealth = revisedScenes.map((scene, index) =>
      buildSceneHealth(scene, budgets[index], language),
    );
    const repairIssues = firstHealth
      .map((health, index) => ({
        id: index + 1,
        status: health.status,
        words: health.speechWordCount,
      }))
      .filter((item) => item.status !== "ready");

    if (repairIssues.length > 0) {
      revisedScenes = await reviseScenes({
        client,
        topic,
        contentType,
        format,
        language,
        dialogueRequested,
        sourceScenes: revisedScenes,
        budgets,
        repairIssues,
      });
    }

    const enrichedScenes = revisedScenes.map((scene, index) => {
      const budget = budgets[index];
      const scriptHealth = buildSceneHealth(scene, budget, language);
      return {
        ...scene,
        targetDurationSec: budget.targetDurationSec,
        estimatedSpeechSec: scriptHealth.estimatedSpeechSec,
        speechWordCount: scriptHealth.speechWordCount,
        scriptHealth,
        visualBlockPlan: createVisualBlockPlan(scene, budget),
      };
    });

    const timelineSyncPlan = createTimelineSyncPlan({
      product: "creatorlab",
      qualityTier: normalizeVideoQualityTier(qualityMode, "pro"),
      durationSec,
      sceneCount,
      scenes: enrichedScenes,
    });
    const finalHealth = enrichedScenes.map((scene) => scene.scriptHealth);
    const readySceneCount = finalHealth.filter(
      (health) => health.status === "ready",
    ).length;

    const resultPackage = {
      ...productionPackage,
      scenes: enrichedScenes,
      durationSec,
      sceneCount,
      targetSceneDurationSec: roundTo(durationSec / sceneCount, 1),
      contentType,
      format,
      qualityMode,
      dialogueRequested,
      timelineSyncPlan,
      scriptPlan: {
        version: "px3a-v1",
        durationSec,
        sceneCount,
        readySceneCount,
        needsReviewSceneIds: finalHealth
          .map((health, index) =>
            health.status === "ready" ? null : index + 1,
          )
          .filter((value): value is number => value !== null),
        providerAwareVisualBlocks: true,
      },
    };

    return NextResponse.json({
      success: true,
      productionPackage: resultPackage,
      scriptPlan: resultPackage.scriptPlan,
    });
  } catch (error: unknown) {
    console.error("creator-script-plan error:", error);
    return NextResponse.json(
      {
        error:
          (error instanceof Error ? error.message : "") ||
          "The professional script plan could not be generated.",
      },
      { status: 500 },
    );
  }
}
