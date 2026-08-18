import { NextRequest, NextResponse } from "next/server";
import {
  getCreatorMediaRoute,
  isCreatorMediaActionAllowed,
  normalizeCreatorQualityMode,
} from "../../../lib/creator/mediaRouting";
import { getMediaProviderFacade } from "../../../lib/providers";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { checkStorageGenerationAllowance, storageQuotaFullResponse } from "@/lib/persistence/media/storageQuota.server";
import { issueStorageAdmissionForOwner } from "@/lib/persistence/media/storageAdmission.server";
import { normalizeVideoQualityTier } from "../../../lib/video/timelineSync";
import {
  createVideoJobToken,
  parseVideoJobToken,
} from "../../../lib/video/providers";

export const runtime = "nodejs";

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
  return [
    "Create a short cinematic animated video from the provided image.",
    text ? `Scene description: ${text}` : "",
    motionHint ? `Motion: ${motionHint}` : "",
    cameraDirection ? `Camera: ${cameraDirection}` : "",
    emotion ? `Emotion: ${emotion}` : "",
    productProfile === "storyverse"
      ? "Keep the scene coherent, child-friendly, safe, and visually smooth."
      : "Keep the scene coherent, polished, audience-appropriate, and visually smooth for a professional creator video.",
  ]
    .filter(Boolean)
    .join(" ");
}

function isHttpsAssetUrl(value: string) {
  return value.startsWith("https://");
}

function isImageDataUri(value: string) {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value);
}

function validateImageInput(imageUrl: unknown) {
  if (!imageUrl || typeof imageUrl !== "string") {
    return "imageUrl is required";
  }
  if (isHttpsAssetUrl(imageUrl) || isImageDataUri(imageUrl)) {
    return null;
  }
  return "imageUrl must be either a public HTTPS URL or a supported base64 data:image URI";
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

function optionalImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim();
}

function referenceImageUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map(optionalImageUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ).slice(0, 3);
}

function publicVideoError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (/not configured|api key|authentication|unauthorized/.test(normalized)) {
    return "The video production service is not configured for this environment.";
  }
  if (/402|payment|billing|credit|quota|insufficient/.test(normalized)) {
    return "The video production service has insufficient capacity for this request.";
  }
  if (/timeout|timed out|network|connection/.test(normalized)) {
    return "The video production service did not respond in time. Retry this scene.";
  }
  return fallback;
}

export async function POST(req: NextRequest) {
  try {
    const principal = await authenticateRequest(req);
    const body = (await req.json()) as Record<string, unknown>;
    const imageUrl = body.imageUrl;
    const isCreatorLabRequest = body.productProfile === "creatorlab";
    const qualityTier = isCreatorLabRequest
      ? normalizeCreatorQualityMode(body.qualityMode, "standard")
      : normalizeVideoQualityTier(body.qualityMode, "standard");
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

    const imageValidationError = validateImageInput(imageUrl);
    if (imageValidationError) {
      return NextResponse.json(
        { ok: false, error: imageValidationError },
        { status: 400 },
      );
    }

    const storageAllowance = await checkStorageGenerationAllowance(principal.id);
    if (!storageAllowance.allowed) return storageQuotaFullResponse(storageAllowance.storage);

    const facade = getMediaProviderFacade();
    const selection =
      isCreatorLabRequest && creatorMediaRoute
        ? facade.selectCreatorVideo(creatorMediaRoute)
        : facade.selectPrimaryVideo();

    if (!selection.available) {
      return NextResponse.json(
        {
          ok: false,
          error: "The video production service is not configured for this environment.",
        },
        { status: 503 },
      );
    }

    const durationPolicy = selection.provider.normalizeDuration(
      body.duration,
      qualityTier,
    );
    const useCinematicContinuity =
      isCreatorLabRequest && qualityTier === "cinematic";
    const lastFrameUrl = useCinematicContinuity
      ? optionalImageUrl(body.lastFrameUrl)
      : undefined;
    const references = useCinematicContinuity
      ? referenceImageUrls(body.referenceImageUrls)
      : [];

    for (const url of [lastFrameUrl, ...references]) {
      if (!url) continue;
      const error = validateImageInput(url);
      if (error) {
        return NextResponse.json({ ok: false, error }, { status: 400 });
      }
    }

    const requestedRatio = getRequestedRatio(body, isCreatorLabRequest);
    const { storageAdmissionId } = await issueStorageAdmissionForOwner({
      ownerUserId: principal.id,
      mediaKind: "video",
      purpose: "storyverse_generated_video",
      projectReference: typeof body.projectId === "string" ? body.projectId : null,
      metadata: { sceneId: body.sceneId ?? null },
    });
    const task = await selection.provider.createTask({
      imageUrl: imageUrl as string,
      lastFrameUrl,
      referenceImageUrls: references,
      promptText: buildPrompt({
        text: typeof body.text === "string" ? body.text : undefined,
        motionHint:
          typeof body.motionHint === "string" ? body.motionHint : undefined,
        cameraDirection:
          typeof body.cameraDirection === "string"
            ? body.cameraDirection
            : undefined,
        emotion: typeof body.emotion === "string" ? body.emotion : undefined,
        productProfile: isCreatorLabRequest ? "creatorlab" : "storyverse",
      }),
      requestedRatio,
      durationSec: durationPolicy.durationSec,
    });

    if (!task.nativeTaskId) {
      throw new Error("Video service did not return a task identifier.");
    }

    return NextResponse.json({
      ok: true,
      taskId: createVideoJobToken(selection.provider.key, task.nativeTaskId),
      status: task.status || "PENDING",
      duration: durationPolicy.durationSec,
      durationPolicy,
      requestedRatio,
      engineTier: selection.selectedTier,
      premiumFallbackUsed: selection.usedFallback,
      storageAdmissionId,
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: "A valid session is required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Video create error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: publicVideoError(
          error,
          "The video production service could not start this task.",
        ),
      },
      { status: 500 },
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
        { status: 400 },
      );
    }

    const facade = getMediaProviderFacade();
    const providerJob = parseVideoJobToken(taskId);
    const provider = providerJob
      ? facade.getVideoByKey(providerJob.providerKey)
      : facade.selectPrimaryVideo().provider;
    const nativeTaskId = providerJob?.nativeTaskId || taskId;
    const task = await provider.retrieveTask(nativeTaskId);

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
      return new NextResponse(output.body, { status: 200, headers });
    }

    const publicTaskId = providerJob
      ? taskId
      : createVideoJobToken(provider.key, nativeTaskId);
    const videoUrl = task.videoUrl
      ? new URL(
          `/api/video?taskId=${encodeURIComponent(publicTaskId)}&download=1`,
          req.url,
        ).toString()
      : null;

    return NextResponse.json({
      ok: true,
      taskId: publicTaskId,
      status: task.status,
      failureCode: task.failureCode,
      failureMessage: task.failureMessage,
      videoUrl,
    });
  } catch (error: unknown) {
    console.error("Video status error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: publicVideoError(
          error,
          "The video production task status could not be retrieved.",
        ),
      },
      { status: 500 },
    );
  }
}
