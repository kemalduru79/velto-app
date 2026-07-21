import { NextRequest, NextResponse } from "next/server";
import RunwayML from "@runwayml/sdk";
import {
  getCreatorMediaRoute,
  isCreatorMediaActionAllowed,
  normalizeCreatorQualityMode,
} from "../../../lib/creator/mediaRouting";
import { normalizeRunwayClipDuration, normalizeVideoQualityTier } from "../../../lib/video/timelineSync";
import {
  createVideoJobToken,
  getVideoProvider,
  parseVideoJobToken,
  selectCreatorVideoProvider,
} from "../../../lib/video/providers";

export const runtime = "nodejs";

type RunwayVideoModel = "gen4_turbo" | "gen4.5" | "seedance2";

type Gen4Ratio =
  | "1280:720"
  | "720:1280"
  | "1104:832"
  | "960:960"
  | "832:1104"
  | "1584:672";

type Seedance2Ratio =
  | "1280:720"
  | "720:1280"
  | "960:960"
  | "992:432"
  | "864:496"
  | "752:560"
  | "640:640"
  | "560:752"
  | "496:864"
  | "1470:630"
  | "1112:834"
  | "834:1112";

function getClient() {
  const apiKey = process.env.RUNWAY_API_KEY;

  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY is missing");
  }

  return new RunwayML({
    apiKey,
  });
}

function getModel(): RunwayVideoModel {
  const model = process.env.RUNWAY_VIDEO_MODEL?.trim();

  if (model === "gen4_turbo" || model === "gen4.5" || model === "seedance2") {
    return model;
  }

  return "gen4_turbo";
}

function getGen4Ratio(value: unknown): Gen4Ratio {
  if (value === "720:1280") return "720:1280";
  if (value === "1104:832") return "1104:832";
  if (value === "960:960") return "960:960";
  if (value === "832:1104") return "832:1104";
  if (value === "1584:672") return "1584:672";

  return "1280:720";
}

function getSeedance2Ratio(value: unknown): Seedance2Ratio {
  if (value === "720:1280") return "720:1280";
  if (value === "960:960") return "960:960";
  if (value === "992:432") return "992:432";
  if (value === "864:496") return "864:496";
  if (value === "752:560") return "752:560";
  if (value === "640:640") return "640:640";
  if (value === "560:752") return "560:752";
  if (value === "496:864") return "496:864";
  if (value === "1470:630") return "1470:630";
  if (value === "1112:834") return "1112:834";
  if (value === "834:1112") return "834:1112";

  return "1280:720";
}

function buildPrompt({
  text,
  motionHint,
  cameraDirection,
  emotion,
  productProfile,
}: {
  text?: string;
  motionHint?: string;
  cameraDirection?: string;
  emotion?: string;
  productProfile: "storyverse" | "creatorlab";
}) {
  const parts = [
    "Create a short cinematic animated video from the provided image.",
    text ? `Scene description: ${text}` : "",
    motionHint ? `Motion: ${motionHint}` : "",
    cameraDirection ? `Camera: ${cameraDirection}` : "",
    emotion ? `Emotion: ${emotion}` : "",
    productProfile === "storyverse"
      ? "Keep the scene coherent, child-friendly, safe, and visually smooth."
      : "Keep the scene coherent, polished, audience-appropriate, and visually smooth for a professional creator video.",
  ].filter(Boolean);

  return parts.join(" ");
}

function isHttpsAssetUrl(value: string) {
  return value.startsWith("https://");
}

function isImageDataUri(value: string) {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value);
}

async function checkUrlAccessible(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function validateImageInput(imageUrl: unknown) {
  if (!imageUrl || typeof imageUrl !== "string") {
    return "imageUrl is required";
  }

  if (isHttpsAssetUrl(imageUrl)) {
    return null;
  }

  if (isImageDataUri(imageUrl)) {
    return null;
  }

  return "imageUrl must be either a public HTTPS URL or a supported base64 data:image URI";
}

async function createVideoTask({
  client,
  model,
  imageUrl,
  promptText,
  requestedRatio,
  duration,
}: {
  client: RunwayML;
  model: RunwayVideoModel;
  imageUrl: string;
  promptText: string;
  requestedRatio: unknown;
  duration: number;
}) {
  if (model === "gen4_turbo") {
    const ratio = getGen4Ratio(requestedRatio);

    return client.imageToVideo.create({
      model: "gen4_turbo",
      promptImage: imageUrl,
      promptText,
      ratio,
      duration,
    });
  }

  if (model === "gen4.5") {
    const ratio = getGen4Ratio(requestedRatio);

    return client.imageToVideo.create({
      model: "gen4.5",
      promptImage: imageUrl,
      promptText,
      ratio,
      duration,
    });
  }

  const ratio = getSeedance2Ratio(requestedRatio);

  return client.imageToVideo.create({
    model: "seedance2",
    promptImage: imageUrl,
    promptText,
    ratio,
    duration,
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeTask(task: unknown) {
  const record = asRecord(task);
  const status = optionalString(record.status)?.toUpperCase() || "UNKNOWN";
  const output = Array.isArray(record.output) ? record.output : [];
  const firstOutput = output[0];
  const outputRecord = asRecord(firstOutput);

  const videoUrl =
    optionalString(firstOutput) || optionalString(outputRecord.url);

  return {
    nativeTaskId: optionalString(record.id) || "",
    status,
    failureCode: optionalString(record.failureCode),
    failureMessage: optionalString(record.failureMessage),
    videoUrl,
  };
}

function getPublicVideoError(error: unknown, fallback: string) {
  if (
    error instanceof Error &&
    (error.message === "Primary video service is not configured." ||
      error.message === "Premium video service is not configured.")
  ) {
    return error.message;
  }

  return fallback;
}

function getRequestedRatio(
  body: Record<string, unknown>,
  isCreatorLabRequest: boolean,
) {
  const explicitRatio = body.ratio || body.requestedRatio;

  if (explicitRatio) return explicitRatio;

  if (isCreatorLabRequest) {
    return body.creatorFormat === "short_form" ? "720:1280" : "1280:720";
  }

  return "960:960";
}

function getOptionalImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;

  return value.trim();
}

function getReferenceImageUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map(getOptionalImageUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ).slice(0, 3);
}

function validateOptionalImageInputs(urls: string[]) {
  for (const url of urls) {
    const error = validateImageInput(url);
    if (error) return error;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const imageUrl = body?.imageUrl;
    const text = body?.text ?? "";
    const motionHint = body?.motionHint ?? "";
    const cameraDirection = body?.cameraDirection ?? "";
    const emotion = body?.emotion ?? "";

    const isCreatorLabRequest = body?.productProfile === "creatorlab";
    const qualityTier = isCreatorLabRequest
      ? normalizeCreatorQualityMode(body?.qualityMode, "standard")
      : normalizeVideoQualityTier(body?.qualityMode, "standard");
    const creatorMediaRoute = isCreatorLabRequest
      ? getCreatorMediaRoute(qualityTier)
      : null;

    if (
      creatorMediaRoute &&
      !isCreatorMediaActionAllowed(creatorMediaRoute, "ai_video_blocks")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            qualityTier === "draft"
              ? "Draft mode does not start paid media generation."
              : "AI video blocks are available in Pro and Cinematic modes.",
        },
        { status: 409 },
      );
    }

    const requestedRatio = getRequestedRatio(body, isCreatorLabRequest);

    const imageValidationError = validateImageInput(imageUrl);
    if (!imageValidationError && typeof imageUrl === "string" && imageUrl.startsWith("https://")) {
      const ok = await checkUrlAccessible(imageUrl);
      if (!ok) {
        return NextResponse.json(
          { ok: false, error: "imageUrl is not accessible to the video service", imageUrl },
          { status: 400 }
        );
      }
    }
    if (imageValidationError) {
      return NextResponse.json(
        { ok: false, error: imageValidationError },
        { status: 400 }
      );
    }

    const promptText = buildPrompt({
      text,
      motionHint,
      cameraDirection,
      emotion,
      productProfile: isCreatorLabRequest ? "creatorlab" : "storyverse",
    });

    if (isCreatorLabRequest && creatorMediaRoute) {
      const selection = selectCreatorVideoProvider(creatorMediaRoute);
      const durationPolicy = selection.provider.normalizeDuration(
        body?.duration,
        qualityTier,
      );
      const useCinematicContinuity = qualityTier === "cinematic";
      const lastFrameUrl = useCinematicContinuity
        ? getOptionalImageUrl(body?.lastFrameUrl)
        : undefined;
      const referenceImageUrls = useCinematicContinuity
        ? getReferenceImageUrls(body?.referenceImageUrls)
        : [];
      const optionalImageError = validateOptionalImageInputs([
        ...(lastFrameUrl ? [lastFrameUrl] : []),
        ...referenceImageUrls,
      ]);

      if (optionalImageError) {
        return NextResponse.json(
          { ok: false, error: optionalImageError },
          { status: 400 },
        );
      }

      const task = await selection.provider.createTask({
        imageUrl,
        lastFrameUrl,
        referenceImageUrls,
        promptText,
        requestedRatio,
        durationSec: durationPolicy.durationSec,
      });

      if (!task.nativeTaskId) {
        throw new Error("Video service did not return a task identifier.");
      }

      return NextResponse.json({
        ok: true,
        taskId: createVideoJobToken(
          selection.provider.key,
          task.nativeTaskId,
        ),
        status: task.status || "PENDING",
        duration: durationPolicy.durationSec,
        durationPolicy,
        requestedRatio,
        engineTier: selection.selectedTier,
        premiumFallbackUsed: selection.usedFallback,
      });
    }

    const model = getModel();
    const durationPolicy = normalizeRunwayClipDuration(
      body?.duration,
      qualityTier,
    );
    const duration = durationPolicy.durationSec;
    const client = getClient();

    const task = await createVideoTask({
      client,
      model,
      imageUrl,
      promptText,
      requestedRatio,
      duration,
    });

    return NextResponse.json({
      ok: true,
      taskId: task.id,
      status: "PENDING",
      duration,
      durationPolicy,
      requestedRatio,
    });
  } catch (error: unknown) {
    console.error("Video create error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: getPublicVideoError(
          error,
          "The video production service could not start this task.",
        ),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    const providerJob = parseVideoJobToken(taskId);

    if (providerJob) {
      const provider = getVideoProvider(providerJob.providerKey);
      const task = await provider.retrieveTask(providerJob.nativeTaskId);

      if (searchParams.get("download") === "1") {
        if (task.status !== "SUCCEEDED" || !task.videoUrl) {
          return NextResponse.json(
            { ok: false, error: "Video output is not ready for download." },
            { status: 409 },
          );
        }

        const output = await provider.downloadOutput(task.videoUrl);

        if (!output.ok || !output.body) {
          return NextResponse.json(
            { ok: false, error: "Video output could not be downloaded." },
            { status: 502 },
          );
        }

        const headers = new Headers({
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Type": output.headers.get("content-type") || "video/mp4",
        });
        const contentLength = output.headers.get("content-length");

        if (contentLength) headers.set("Content-Length", contentLength);

        return new NextResponse(output.body, {
          status: 200,
          headers,
        });
      }

      const videoUrl = task.videoUrl
        ? new URL(
            `/api/video?taskId=${encodeURIComponent(taskId)}&download=1`,
            req.url,
          ).toString()
        : null;

      return NextResponse.json({
        ok: true,
        taskId,
        status: task.status,
        failureCode: task.failureCode,
        failureMessage: task.failureMessage,
        videoUrl,
      });
    }

    const client = getClient();
    const task = await client.tasks.retrieve(taskId);
    const normalized = normalizeTask(task);

    return NextResponse.json({
      ok: true,
      taskId,
      status: normalized.status,
      failureCode: normalized.failureCode,
      failureMessage: normalized.failureMessage,
      videoUrl: normalized.videoUrl,
    });
  } catch (error: unknown) {
    console.error("Video status error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: getPublicVideoError(
          error,
          "The video production task status could not be retrieved.",
        ),
      },
      { status: 500 }
    );
  }
}
