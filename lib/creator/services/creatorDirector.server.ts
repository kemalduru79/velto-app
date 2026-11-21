// DIRECTOR-P1 VELTO COPILOT
import { NextResponse } from "next/server";
import type {
  Response as OpenAIResponse,
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";
import { createServerSupabaseClient } from "../../supabase/server";
import { getOpenAIClient } from "../../openai";
import { recordOpenAITextEconomics } from "../../economics";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HISTORY_MESSAGES = 16;
const MAX_CONTEXT_LENGTH = 36_000;
const MAX_ACTION_TEXT_LENGTH = 1_200;

type DirectorMode = "help" | "project";
type DirectorHistoryMessage = {
  role?: "user" | "assistant";
  content?: string;
};

type DirectorActionType =
  | "update_brief_topic"
  | "update_strategy_hook"
  | "update_scene_script"
  | "set_scene_output"
  | "update_thumbnail_copy"
  | "select_thumbnail_scene"
  | "generate_selected_visuals"
  | "generate_selected_voice"
  | "generate_selected_videos"
  | "export_creator_package"
  | "navigate_workspace_stage";

type DirectorActionPayload = {
  topic: string | null;
  hook: string | null;
  sceneId: number | null;
  sceneIds: number[];
  narration: string | null;
  dialogue: string | null;
  renderMode: "image" | "video" | null;
  thumbnailHeadline: string | null;
  thumbnailSubHeadline: string | null;
  thumbnailSceneId: number | null;
  workspaceStage: 1 | 2 | 3 | 4 | 5 | null;
};

type GeneratedDirectorAction = {
  type: DirectorActionType;
  title: string;
  description: string;
  payload: DirectorActionPayload;
};

type DirectorContext = Record<string, unknown> & {
  activeStage?: unknown;
  production?: Record<string, unknown>;
  project?: Record<string, unknown>;
  workflow?: Record<string, unknown>;
};

const DIRECTOR_ACTION_TYPES = new Set<DirectorActionType>([
  "update_brief_topic",
  "update_strategy_hook",
  "update_scene_script",
  "set_scene_output",
  "update_thumbnail_copy",
  "select_thumbnail_scene",
  "generate_selected_visuals",
  "generate_selected_voice",
  "generate_selected_videos",
  "export_creator_package",
  "navigate_workspace_stage",
]);

const PAID_ACTION_TYPES = new Set<DirectorActionType>([
  "generate_selected_visuals",
  "generate_selected_voice",
  "generate_selected_videos",
]);

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeNullableText(value: unknown, maxLength: number) {
  const normalized = safeText(value, maxLength);
  return normalized || null;
}

function safeMode(value: unknown): DirectorMode {
  return value === "help" ? "help" : "project";
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function safeNumberArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0),
    ),
  );
}

function sanitizeHistory(value: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => item as DirectorHistoryMessage)
    .filter(
      (item): item is Required<DirectorHistoryMessage> =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        Boolean(item.content.trim()),
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }));
}

function compactContextScene(value: unknown) {
  const scene = safeObject(value);
  const renderMode = scene.renderMode === "video"
    ? "video"
    : scene.renderMode === "image"
      ? "image"
      : null;

  return {
    id: safeNumber(scene.id),
    text: safeNullableText(scene.text, 240),
    narration: safeNullableText(scene.narration, 520),
    dialogue: safeNullableText(scene.dialogue, 320),
    hasDialogue: Boolean(scene.hasDialogue || safeText(scene.dialogue, 20)),
    renderMode,
    imageReady: Boolean(scene.imageReady || scene.hasImage),
    voiceReady: Boolean(scene.voiceReady || scene.hasVoice),
    videoStatus: safeNullableText(scene.videoStatus, 40),
    hasVideo: Boolean(scene.hasVideo),
    targetDurationSeconds: safeNumber(scene.targetDurationSeconds),
  };
}

function buildCompactContext(context: DirectorContext, sceneLimit: number) {
  const project = safeObject(context.project);
  const strategy = safeObject(context.strategy);
  const production = safeObject(context.production);
  const publish = safeObject(context.publish);
  const workflow = safeObject(context.workflow);
  const readiness = safeObject(context.readiness);
  const reporting = safeObject(context.reporting);
  const studioGuide = safeObject(context.studioGuide);
  const safety = safeObject(context.safety);
  const rawScenes = Array.isArray(production.scenes) ? production.scenes : [];
  const selectedScene = Object.keys(safeObject(production.selectedScene)).length
    ? compactContextScene(production.selectedScene)
    : null;

  return {
    product: safeNullableText(context.product, 60),
    interfaceLanguage: safeNullableText(context.interfaceLanguage, 12),
    activeStage: safeNumber(context.activeStage),
    contextCompacted: true,
    project: {
      projectId: safeNullableText(project.projectId, 120),
      title: safeNullableText(project.title, 240),
      topic: safeNullableText(project.topic, 1_000),
      contentLanguage: safeNullableText(project.contentLanguage, 12),
      country: safeNullableText(project.country, 80),
      audience: safeNullableText(project.audience, 80),
      contentType: safeNullableText(project.contentType, 100),
      format: safeNullableText(project.format, 80),
      durationSeconds: safeNumber(project.durationSeconds),
      qualityLevel: safeNullableText(project.qualityLevel, 40),
      targetPlatforms: Array.isArray(project.targetPlatforms)
        ? project.targetPlatforms.slice(0, 8).map((item: unknown) => safeText(item, 60)).filter(Boolean)
        : [],
    },
    strategy: {
      mentorReady: Boolean(strategy.mentorReady),
      selectedDirectionId: safeNullableText(strategy.selectedDirectionId, 160),
      selectedHook: safeNullableText(strategy.selectedHook, 800),
      recommendedTitle: safeNullableText(strategy.recommendedTitle, 300),
    },
    production: {
      sceneCount: safeNumber(production.sceneCount),
      selectedSceneIds: safeNumberArray(production.selectedSceneIds),
      selectedScene,
      scenes: rawScenes.slice(0, sceneLimit).map(compactContextScene),
    },
    publish: {
      finalVideoReady: Boolean(publish.finalVideoReady),
      thumbnailSelected: Boolean(publish.thumbnailSelected),
      thumbnailHeadline: safeNullableText(publish.thumbnailHeadline, 180),
      thumbnailSubHeadline: safeNullableText(publish.thumbnailSubHeadline, 240),
      metadataReady: Boolean(publish.metadataReady),
      creatorConfirmations: safeObject(publish.creatorConfirmations),
      packageDownloaded: Boolean(publish.packageDownloaded),
    },
    workflow: {
      currentStage: safeNumber(workflow.currentStage),
      currentStageLabel: safeNullableText(workflow.currentStageLabel, 120),
      currentStageStatus: safeNullableText(workflow.currentStageStatus, 240),
      currentStageProgress: safeNumber(workflow.currentStageProgress),
      availableStages: safeNumberArray(workflow.availableStages)
        .filter((stage) => stage >= 1 && stage <= 4),
      visibleCurrentStep: safeNumber(workflow.visibleCurrentStep),
      visibleCurrentLabel: safeNullableText(workflow.visibleCurrentLabel, 120),
      visibleAvailableSteps: safeNumberArray(workflow.visibleAvailableSteps)
        .filter((step) => step >= 1 && step <= 5),
    },
    readiness: {
      lifecycleStatus: safeNullableText(readiness.lifecycleStatus, 80),
      lifecycleProgress: safeNumber(readiness.lifecycleProgress),
      nextAction: safeNullableText(readiness.nextAction, 120),
      finalVideoStatus: safeNullableText(readiness.finalVideoStatus, 100),
      finalGateStatus: safeNullableText(readiness.finalGateStatus, 100),
      finalGateMessage: safeNullableText(readiness.finalGateMessage, 500),
      continuityStatus: safeNullableText(readiness.continuityStatus, 100),
      blockingSceneIds: safeNumberArray(readiness.blockingSceneIds),
      reviewSceneIds: safeNumberArray(readiness.reviewSceneIds),
      missingVisualSceneIds: safeNumberArray(readiness.missingVisualSceneIds),
      missingVoiceSceneIds: safeNumberArray(readiness.missingVoiceSceneIds),
    },
    reporting: {
      readinessScore: safeNumber(reporting.readinessScore),
      strengths: Array.isArray(reporting.strengths)
        ? reporting.strengths.slice(0, 6).map((item: unknown) => safeText(item, 180)).filter(Boolean)
        : [],
      warnings: Array.isArray(reporting.warnings)
        ? reporting.warnings.slice(0, 6).map((item: unknown) => safeText(item, 220)).filter(Boolean)
        : [],
      nextActions: Array.isArray(reporting.nextActions)
        ? reporting.nextActions.slice(0, 6).map((item: unknown) => safeText(item, 220)).filter(Boolean)
        : [],
    },
    studioGuide: {
      stages: Array.isArray(studioGuide.stages)
        ? studioGuide.stages.slice(0, 5).map((item: unknown) => {
            const stage = safeObject(item);

            return {
              stage: safeNumber(stage.stage),
              name: safeNullableText(stage.name, 80),
              purpose: safeNullableText(stage.purpose, 360),
              keyControls: Array.isArray(stage.keyControls)
                ? stage.keyControls
                    .slice(0, 12)
                    .map((control: unknown) => safeText(control, 100))
                    .filter(Boolean)
                : [],
            };
          })
        : [],
    },
    safety: {
      paidMediaRequiresExplicitConfirmation: Boolean(
        safety.paidMediaRequiresExplicitConfirmation,
      ),
      releaseRequiresExplicitConfirmation: Boolean(
        safety.releaseRequiresExplicitConfirmation,
      ),
      directorCanApplyChanges: Boolean(safety.directorCanApplyChanges),
      directorRequiresUserApproval: Boolean(safety.directorRequiresUserApproval),
      supportedActions: Array.isArray(safety.supportedActions)
        ? safety.supportedActions
            .slice(0, DIRECTOR_ACTION_TYPES.size)
            .map((item: unknown) => safeText(item, 80))
            .filter(Boolean)
        : [],
    },
  };
}

function sanitizeContext(value: unknown) {
  const context = safeObject(value);
  const serialized = JSON.stringify(context);

  if (serialized.length <= MAX_CONTEXT_LENGTH) {
    return { context, serialized };
  }

  const compactContext = buildCompactContext(context, 24);
  let compactSerialized = JSON.stringify(compactContext);

  if (compactSerialized.length > MAX_CONTEXT_LENGTH) {
    compactContext.production.scenes = compactContext.production.scenes.slice(0, 12);
    compactSerialized = JSON.stringify(compactContext);
  }

  if (compactSerialized.length > MAX_CONTEXT_LENGTH) {
    compactContext.production.scenes = compactContext.production.scenes.slice(0, 6);
    compactSerialized = JSON.stringify(compactContext);
  }

  return {
    context,
    serialized: compactSerialized,
  };
}

function getContextScenes(
  context: DirectorContext,
): Array<Record<string, unknown>> {
  const rawScenes = context?.production?.scenes;
  const scenes: unknown[] = Array.isArray(rawScenes) ? rawScenes : [];

  return scenes
    .map((scene) => safeObject(scene))
    .filter((scene) => Number.isFinite(Number(scene.id)));
}

function getContextScene(context: DirectorContext, sceneId: number | null) {
  if (!sceneId) return null;
  return getContextScenes(context).find((scene) => Number(scene.id) === sceneId) || null;
}

function getAllowedSceneIds(context: DirectorContext) {
  return new Set(getContextScenes(context).map((scene) => Number(scene.id)));
}

function normalizeActionPayload(value: unknown): DirectorActionPayload {
  const payload = safeObject(value);
  const renderMode = payload.renderMode === "video"
    ? "video"
    : payload.renderMode === "image"
      ? "image"
      : null;

  return {
    topic: safeNullableText(payload.topic, MAX_ACTION_TEXT_LENGTH),
    hook: safeNullableText(payload.hook, MAX_ACTION_TEXT_LENGTH),
    sceneId: safeNumber(payload.sceneId),
    sceneIds: safeNumberArray(payload.sceneIds),
    narration: safeNullableText(payload.narration, MAX_ACTION_TEXT_LENGTH),
    dialogue: safeNullableText(payload.dialogue, MAX_ACTION_TEXT_LENGTH),
    renderMode,
    thumbnailHeadline: safeNullableText(payload.thumbnailHeadline, 160),
    thumbnailSubHeadline: safeNullableText(payload.thumbnailSubHeadline, 240),
    thumbnailSceneId: safeNumber(payload.thumbnailSceneId),
    workspaceStage:
      [1, 2, 3, 4, 5].includes(Number(payload.workspaceStage))
        ? (Number(payload.workspaceStage) as 1 | 2 | 3 | 4 | 5)
        : null,
  };
}

function actionAllowedInStage(type: DirectorActionType, activeStage: number) {
  if (type === "navigate_workspace_stage") return true;
  if (type === "update_brief_topic") return activeStage === 1;
  if (type === "update_strategy_hook") return activeStage === 2;
  if (
    type === "update_scene_script" ||
    type === "set_scene_output" ||
    type === "generate_selected_visuals" ||
    type === "generate_selected_voice" ||
    type === "generate_selected_videos"
  ) {
    return activeStage === 3;
  }
  if (
    type === "update_thumbnail_copy" ||
    type === "select_thumbnail_scene" ||
    type === "export_creator_package"
  ) {
    return activeStage === 4;
  }
  return false;
}

function buildActionChanges(
  type: DirectorActionType,
  payload: DirectorActionPayload,
  context: DirectorContext,
) {
  const project = safeObject(context.project);
  const strategy = safeObject(context.strategy);
  const publish = safeObject(context.publish);
  const selectedIds = safeNumberArray(context?.production?.selectedSceneIds);
  const sceneIds = payload.sceneIds.length ? payload.sceneIds : selectedIds;
  const scene = getContextScene(context, payload.sceneId);

  if (type === "navigate_workspace_stage") {
    const stageLabels: Record<number, string> = {
      1: "Brief",
      2: "Strategy",
      3: "Production Setup",
      4: "Create & Review",
      5: "Publish",
    };

    return [{
      label: "Workspace",
      before: stageLabels[Number(context?.workflow?.visibleCurrentStep)] || "Current step",
      after: stageLabels[Number(payload.workspaceStage)] || "Requested stage",
    }];
  }

  if (type === "update_brief_topic") {
    return [{ label: "Topic", before: safeText(project.topic, 300) || "—", after: payload.topic || "—" }];
  }

  if (type === "update_strategy_hook") {
    return [{ label: "Opening hook", before: safeText(strategy.selectedHook, 300) || "—", after: payload.hook || "—" }];
  }

  if (type === "update_scene_script") {
    return [
      {
        label: `Scene ${payload.sceneId || "?"} narration`,
        before: safeText(scene?.narration, 420) || "—",
        after: payload.narration || safeText(scene?.narration, 420) || "—",
      },
      ...(payload.dialogue !== null
        ? [{
            label: `Scene ${payload.sceneId || "?"} dialogue`,
            before: safeText(scene?.dialogue, 320) || "—",
            after: payload.dialogue || "—",
          }]
        : []),
    ];
  }

  if (type === "set_scene_output") {
    return [{
      label: "Scene output",
      before: sceneIds
        .map((id) => {
          const current = getContextScene(context, id);
          return `${id}: ${safeText(current?.renderMode, 20) || "not selected"}`;
        })
        .join(", "),
      after: `${sceneIds.join(", ")}: ${payload.renderMode || "—"}`,
    }];
  }

  if (type === "update_thumbnail_copy") {
    return [
      {
        label: "Thumbnail headline",
        before: safeText(publish.thumbnailHeadline, 180) || "—",
        after: payload.thumbnailHeadline || safeText(publish.thumbnailHeadline, 180) || "—",
      },
      ...(payload.thumbnailSubHeadline !== null
        ? [{
            label: "Thumbnail subheadline",
            before: safeText(publish.thumbnailSubHeadline, 220) || "—",
            after: payload.thumbnailSubHeadline || "—",
          }]
        : []),
    ];
  }

  if (type === "select_thumbnail_scene") {
    return [{
      label: "Thumbnail source",
      before: publish.thumbnailSelected ? "Current selected thumbnail" : "Not selected",
      after: `Scene ${payload.thumbnailSceneId || "?"}`,
    }];
  }

  if (type === "generate_selected_visuals") {
    return [{ label: "Paid media action", before: "Not started", after: `Generate missing visuals for scenes ${sceneIds.join(", ")}` }];
  }

  if (type === "generate_selected_voice") {
    return [{ label: "Paid media action", before: "Not started", after: `Generate missing voice tracks for scenes ${sceneIds.join(", ")}` }];
  }

  if (type === "generate_selected_videos") {
    return [{ label: "Paid media action", before: "Not started", after: `Start video generation for scenes ${sceneIds.join(", ")}` }];
  }

  return [{
    label: "Creator Package",
    before: publish.packageDownloaded ? "Already downloaded" : "Not downloaded",
    after: "Validate and download current release package",
  }];
}

export function sanitizeGeneratedActions(
  value: unknown,
  context: DirectorContext,
  mode: DirectorMode,
) {
  if (!Array.isArray(value)) return [];

  const activeStage = Number(context.activeStage || 0);
  const allowedSceneIds = getAllowedSceneIds(context);
  const selectedSceneIds = safeNumberArray(context?.production?.selectedSceneIds)
    .filter((sceneId) => allowedSceneIds.has(sceneId));
  const qualityLevel = safeText(context?.project?.qualityLevel, 40);
  const availableVisibleSteps = new Set(
    safeNumberArray(context?.workflow?.visibleAvailableSteps)
      .filter((step) => step >= 1 && step <= 5),
  );

  return value
    .slice(0, 2)
    .map((item) => safeObject(item))
    .filter((item) => DIRECTOR_ACTION_TYPES.has(item.type as DirectorActionType))
    .map((item) => {
      const type = item.type as DirectorActionType;
      const payload = normalizeActionPayload(item.payload);
      payload.sceneIds = payload.sceneIds.filter((sceneId) => allowedSceneIds.has(sceneId));

      if (!payload.sceneIds.length && selectedSceneIds.length) {
        payload.sceneIds = selectedSceneIds;
      }

      return {
        type,
        title: safeText(item.title, 120),
        description: safeText(item.description, 420),
        payload,
      } satisfies GeneratedDirectorAction;
    })
    .filter((action) => {
      if (mode === "help" && action.type !== "navigate_workspace_stage") {
        return false;
      }

      if (!actionAllowedInStage(action.type, activeStage)) return false;

      if (action.type === "navigate_workspace_stage") {
        return Boolean(
          action.payload.workspaceStage &&
          availableVisibleSteps.has(action.payload.workspaceStage),
        );
      }

      if (action.type === "update_brief_topic") return Boolean(action.payload.topic);
      if (action.type === "update_strategy_hook") return Boolean(action.payload.hook);
      if (action.type === "update_scene_script") {
        return Boolean(
          action.payload.sceneId &&
          allowedSceneIds.has(action.payload.sceneId) &&
          (action.payload.narration || action.payload.dialogue),
        );
      }
      if (action.type === "set_scene_output") {
        if (!action.payload.renderMode || !action.payload.sceneIds.length) return false;
        if (action.payload.renderMode === "video" && !["pro", "cinematic"].includes(qualityLevel)) {
          return false;
        }
        return true;
      }
      if (action.type === "update_thumbnail_copy") {
        return Boolean(action.payload.thumbnailHeadline || action.payload.thumbnailSubHeadline);
      }
      if (action.type === "select_thumbnail_scene") {
        const scene = getContextScene(context, action.payload.thumbnailSceneId);
        return Boolean(scene?.imageReady);
      }
      if (
        action.type === "generate_selected_visuals" ||
        action.type === "generate_selected_voice"
      ) {
        return action.payload.sceneIds.length > 0;
      }
      if (action.type === "generate_selected_videos") {
        return (
          ["pro", "cinematic"].includes(qualityLevel) &&
          action.payload.sceneIds.length > 0 &&
          action.payload.sceneIds.every((sceneId) => {
            const scene = getContextScene(context, sceneId);
            return scene?.renderMode === "video" && Boolean(scene?.imageReady);
          })
        );
      }
      return true;
    })
    .map((action, index) => {
      const isPaid = PAID_ACTION_TYPES.has(action.type);
      const isRelease = action.type === "export_creator_package";

      return {
        id: `director-action-${Date.now()}-${index}`,
        ...action,
        impact: isPaid ? "credit_variable" : isRelease ? "release" : "none",
        requiresExplicitConfirmation: isPaid || isRelease,
        changes: buildActionChanges(action.type, action.payload, context),
        status: "pending",
      };
    });
}

const DIRECTOR_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    intent: {
      type: "string",
      enum: [
        "studio_help",
        "creative_direction",
        "project_status",
        "workflow_guidance",
      ],
    },
    followUps: {
      type: "array",
      maxItems: 3,
      items: { type: "string" },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: Array.from(DIRECTOR_ACTION_TYPES),
          },
          title: { type: "string" },
          description: { type: "string" },
          payload: {
            type: "object",
            additionalProperties: false,
            properties: {
              topic: { type: ["string", "null"] },
              hook: { type: ["string", "null"] },
              sceneId: { type: ["number", "null"] },
              sceneIds: { type: "array", items: { type: "number" } },
              narration: { type: ["string", "null"] },
              dialogue: { type: ["string", "null"] },
              renderMode: {
                anyOf: [
                  { type: "string", enum: ["image", "video"] },
                  { type: "null" },
                ],
              },
              thumbnailHeadline: { type: ["string", "null"] },
              thumbnailSubHeadline: { type: ["string", "null"] },
              thumbnailSceneId: { type: ["number", "null"] },
              workspaceStage: {
                anyOf: [
                  { type: "number", enum: [1, 2, 3, 4, 5] },
                  { type: "null" },
                ],
              },
            },
            required: [
              "topic",
              "hook",
              "sceneId",
              "sceneIds",
              "narration",
              "dialogue",
              "renderMode",
              "thumbnailHeadline",
              "thumbnailSubHeadline",
              "thumbnailSceneId",
              "workspaceStage",
            ],
          },
        },
        required: ["type", "title", "description", "payload"],
      },
    },
  },
  required: ["answer", "intent", "followUps", "actions"],
} as const;

export async function handleCreatorDirectorRequest(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
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

    const body = await req.json();
    const message = safeText(body?.message, MAX_MESSAGE_LENGTH);
    const interfaceLanguage =
      body?.interfaceLanguage === "en" ? "en" : "tr";
    const mode = safeMode(body?.mode);
    const history = sanitizeHistory(body?.history);
    const { context, serialized: contextText } = sanitizeContext(body?.context);

    if (!message) {
      return NextResponse.json({ error: "Mesaj zorunludur." }, { status: 400 });
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_CREATOR_DIRECTOR_MODEL || "gpt-5-mini";
    const modeInstruction =
      mode === "help"
        ? "Act as Velto Studio Help. Explain how to use the current workspace, where controls are located, why an action may be unavailable, and what quality, readiness, reporting or export options mean. You may propose only a safe workspace-navigation action."
        : "Act as the Creative Director inside Velto Copilot. Use the supplied brief, selected strategy, scenes, production status, selected scene, lifecycle, publishing state, report signals and validation blockers. Give creative recommendations only when the user asks for advice, review or direction; otherwise answer the direct question without unsolicited critique.";

    const instructions = `
You are Velto Copilot inside VELTO CreatorLab, a professional creator-production workspace for adults.
${modeInstruction}

Language rules:
- Reply in the language used in the CURRENT USER MESSAGE.
- If the user explicitly requests another language, use that language.
- If the message is mixed-language, use the dominant language.
- The interface language is ${interfaceLanguage === "en" ? "English" : "Turkish"}; use it only as a fallback when the message language is unclear.
- You support multilingual conversations and may continue in a language different from the interface.

Operating rules:
- Keep the answer concise, actionable and easy to scan.
- Start with the direct answer. For creative reviews, state the strongest recommendation, why it matters, and the next practical step.
- You may propose at most two structured actions, but never claim that an action has already happened.
- A structured action is only a preview. The user must approve it in the interface before CreatorLab applies or runs anything.
- Only use action types from the supplied schema and only when the current stage and context make the action reliable.
- The user-facing workflow has exactly five steps: Brief, Strategy, Production Setup, Create & Review, and Publish. Use these names in answers and previews; never expose the internal four-stage architecture.
- Use workflow.visibleCurrentStep, workflow.visibleCurrentLabel and workflow.visibleAvailableSteps for user-facing workflow guidance.
- Use navigate_workspace_stage when a user asks where to go or what to do next and the target visible step is available. Its workspaceStage payload is the visible step number 1–5.
- Safe text or selection changes may be proposed when they materially improve the project.
- Paid-media actions may be proposed only when the user explicitly asks to generate or run that media action.
- Export may be proposed only when the user explicitly asks to export or download the Creator Package.
- Never trigger or imply automatic paid-media generation. Image, voice and video actions require a second explicit confirmation because they can call paid APIs.
- Do not expose internal provider or model names. Discuss user-facing quality levels and variable credit impact only.
- Do not recommend selecting video for every scene. Respect explicit scene-output decisions.
- Do not invent scene IDs, assets, controls or capabilities that are absent from the context.
- If the project context is insufficient, say exactly which missing decision or asset blocks a reliable answer and return no action.
- For legal, medical, financial or factual claims intended for publication, remind the creator to verify the claim before release.
- Do not use child-oriented Storyverse language, mascots or assumptions.
`;

    const conversation = history
      .map((item) => `${item.role === "user" ? "USER" : "DIRECTOR"}: ${item.content}`)
      .join("\n");

    const input = `
CURRENT CREATORLAB CONTEXT (structured JSON):
${contextText}

RECENT CONVERSATION:
${conversation || "No previous messages."}

CURRENT USER MESSAGE:
${message}
`;

    const response = await client.responses.create({
      model,
      instructions,
      input,
      max_output_tokens: 1_500,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "creator_director_response",
          strict: true,
          schema: DIRECTOR_RESPONSE_SCHEMA,
        },
      },
    } as ResponseCreateParamsNonStreaming) as OpenAIResponse;
    await recordOpenAITextEconomics({ route: "/api/creator-director", operationType: "creator_director", model, response });

    const rawOutput = response.output_text?.trim();

    if (!rawOutput) {
      return NextResponse.json(
        { error: "Velto Copilot yanıt oluşturamadı." },
        { status: 502 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      parsed = {
        answer: rawOutput,
        intent: mode === "help" ? "studio_help" : "creative_direction",
        followUps: [],
        actions: [],
      };
    }

    const answer = safeText(parsed.answer, 5_000);
    if (!answer) {
      return NextResponse.json(
        { error: "Velto Copilot boş yanıt döndürdü." },
        { status: 502 },
      );
    }

    const actions = sanitizeGeneratedActions(parsed.actions, context, mode);
    const intent = [
      "studio_help",
      "creative_direction",
      "project_status",
      "workflow_guidance",
    ].includes(String(parsed.intent))
      ? String(parsed.intent)
      : mode === "help"
        ? "studio_help"
        : "creative_direction";
    const followUps = Array.isArray(parsed.followUps)
      ? Array.from(
          new Set(
            parsed.followUps
              .map((item: unknown) => safeText(item, 180))
              .filter(Boolean),
          ),
        ).slice(0, 3)
      : [];

    return NextResponse.json({
      answer,
      actions,
      intent,
      followUps,
      mode,
      responseLanguage: "auto",
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : null,
    });
  } catch (error) {
    console.error("creator-director error:", error);

    return NextResponse.json(
      {
        error:
          (error instanceof Error ? error.message : "") ||
          "Velto Copilot geçici olarak kullanılamıyor.",
      },
      { status: 500 },
    );
  }
}
