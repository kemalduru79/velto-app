import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import {
  createTimelineSyncPlan,
  estimateSpeechSeconds,
  normalizeVideoQualityTier,
  type TimelineSceneInput,
  type VideoQualityTier,
} from "../../../lib/video/timelineSync";
import { getCreatorVoiceScriptGuidance } from "../../../lib/creator/voiceRouting";

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

type CreatorTimelinePreviewRequest = {
  topic?: string;
  scenes?: TimelineSceneInput[];
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
  const result = String(value || "").replace(/\s+/g, " ").trim();
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

function trimWords(value: string, maxWords: number) {
  const words = asString(value).split(" ").filter(Boolean);

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return `${words.slice(0, maxWords).join(" ").replace(/[,.!?:;]+$/, "")}…`;
}

function buildOutlineItems({
  topic,
  mentorAnalysis,
  sceneCount,
}: {
  topic: string;
  mentorAnalysis: CreatorMentorResult;
  sceneCount: number;
}) {
  const productionPlan = Array.isArray(mentorAnalysis.productionPlan)
    ? mentorAnalysis.productionPlan.filter((item) => asString(item))
    : [];
  const videoIdeas = Array.isArray(mentorAnalysis.videoIdeas)
    ? mentorAnalysis.videoIdeas
        .map((idea) => [idea?.title, idea?.concept].map((item) => asString(item)).filter(Boolean).join(" — "))
        .filter(Boolean)
    : [];
  const audienceInsights = Array.isArray(mentorAnalysis.audienceInsight)
    ? mentorAnalysis.audienceInsight.filter((item) => asString(item))
    : [];
  const hookPatterns = Array.isArray(mentorAnalysis.hookPatterns)
    ? mentorAnalysis.hookPatterns.filter((item) => asString(item))
    : [];

  const fallback = [
    `Open with a clear curiosity hook about ${topic}.`,
    `Explain why this topic matters for the selected audience.`,
    `Introduce the first visual example or comparison.`,
    `Build the main argument with a concrete proof point.`,
    `Deliver the strongest surprise, contrast, or transformation moment.`,
    `Close with a concise takeaway and platform-friendly call to action.`,
  ];

  const combined = [
    ...productionPlan,
    ...hookPatterns,
    ...audienceInsights,
    ...videoIdeas,
    ...fallback,
  ].filter(Boolean);

  return Array.from({ length: sceneCount }, (_, index) => combined[index % combined.length] || fallback[index % fallback.length]);
}

function createDryRunScenes({
  topic,
  mentorAnalysis,
  durationSec,
  sceneCount,
  language,
  format,
}: {
  topic: string;
  mentorAnalysis: CreatorMentorResult;
  durationSec: number;
  sceneCount: number;
  language: "tr" | "en";
  format: string;
}): TimelineSceneInput[] {
  const outlineItems = buildOutlineItems({ topic, mentorAnalysis, sceneCount });
  const voiceGuidance = getCreatorVoiceScriptGuidance({
    format,
    durationSec,
    sceneCount,
    language,
  });
  const softMaxWords = voiceGuidance.maxWordsPerScene;

  return outlineItems.map((outline, index) => {
    const sceneNumber = index + 1;
    const intro =
      language === "tr"
        ? `Sahne ${sceneNumber}: ${topic}.`
        : `Scene ${sceneNumber}: ${topic}.`;
    const narration = trimWords(`${intro} ${outline}`, softMaxWords);
    const dialogue = "";
    const speechText = [narration, dialogue].filter(Boolean).join(" ");

    return {
      id: sceneNumber,
      text: outline,
      narration,
      dialogue,
      visualPrompt:
        language === "tr"
          ? `${topic} için profesyonel, yüksek kontrastlı, YouTube uyumlu görsel beat.`
          : `Professional high-contrast YouTube-ready visual beat for ${topic}.`,
      cameraDirection:
        sceneNumber === 1
          ? "Strong opening frame with immediate subject clarity."
          : "Clean editorial shot with simple motion and readable composition.",
      motionHint: sceneNumber === 1 ? "fast hook push-in" : "controlled editorial motion",
      estimatedSpeechSeconds: estimateSpeechSeconds(speechText),
      speechWordCount: speechText.split(/\s+/).filter(Boolean).length,
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
      .catch(() => null)) as CreatorTimelinePreviewRequest | null;

    const topic = asString(
      body?.topic || body?.mentorAnalysis?.recommendedIdea?.title,
      "CreatorLab video",
    );
    const durationSec = clampNumber(body?.durationSec, 60, 5, 3600);
    const sceneCount = clampNumber(body?.sceneCount, 6, 1, 36);
    const qualityMode = normalizeVideoQualityTier(body?.qualityMode, "pro");
    const language = body?.language === "tr" ? "tr" : "en";
    const mentorAnalysis = body?.mentorAnalysis || {};

    const providedScenes = Array.isArray(body?.scenes)
      ? body.scenes
          .filter((scene) => scene && typeof scene === "object")
          .map((scene, index) => {
            const id = scene.id || index + 1;
            const narration = asString(scene.narration);
            const dialogue = asString(scene.dialogue);
            const text = asString(
              scene.text,
              narration || dialogue || `${topic} scene ${index + 1}`,
            );
            const speechText = [narration, dialogue].filter(Boolean).join(" ");

            return {
              ...scene,
              id,
              text,
              narration,
              dialogue,
              visualPrompt: asString(
                scene.visualPrompt,
                `Professional YouTube-ready visual beat for ${topic}.`,
              ),
              cameraDirection: asString(
                scene.cameraDirection,
                "Clean editorial shot with readable composition.",
              ),
              motionHint: asString(
                scene.motionHint,
                "controlled editorial motion",
              ),
              estimatedSpeechSeconds:
                Number(scene.estimatedSpeechSeconds) ||
                estimateSpeechSeconds(speechText || text),
              speechWordCount:
                Number(scene.speechWordCount) ||
                (speechText || text).split(/\s+/).filter(Boolean).length,
            };
          })
      : [];

    const scenes = providedScenes.length > 0
      ? providedScenes
      : createDryRunScenes({
          topic,
          mentorAnalysis,
          durationSec,
          sceneCount,
          language,
          format: asString(body?.format, "Shorts / Reels / TikTok"),
        });

    const timelineSyncPlan = createTimelineSyncPlan({
      product: "creatorlab",
      qualityTier: qualityMode,
      durationSec,
      sceneCount: scenes.length || sceneCount,
      scenes,
    });

    return NextResponse.json({
      success: true,
      previewMode: providedScenes.length > 0 ? "actual_scene_timeline" : "dry_run_timeline_only",
      costProfile: "no_video_no_image_no_voice",
      timelineSyncPlan,
      previewScenes: scenes,
      notes: [
        "Dry-run preview does not call paid video, voice, image, or final export services.",
        "Use this plan to find likely audio/video mismatch before paid asset generation.",
      ],
    });
  } catch (e: unknown) {
    console.error("creator-timeline-preview error:", e);

    return NextResponse.json(
      {
        error:
          (e instanceof Error ? e.message : "") ||
          "Timeline preview oluşturulurken hata oluştu.",
      },
      { status: 500 },
    );
  }
}
