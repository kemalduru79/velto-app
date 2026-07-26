import { NextRequest, NextResponse } from "next/server";
import {
  getCreatorMediaRoute,
  isCreatorMediaActionAllowed,
  normalizeCreatorQualityMode,
} from "../../../lib/creator/mediaRouting";
import {
  createVideoJobToken,
  getVideoProvider,
  parseVideoJobToken,
  selectCreatorVideoProvider,
} from "../../../lib/video/providers";

export const runtime = "nodejs";
export const maxDuration = 60;

function isHttpsAssetUrl(value: string) {
  return value.startsWith("https://");
}

function isImageDataUri(value: string) {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value);
}

function validateImageInput(value: unknown, fieldName = "imageUrl") {
  if (!value || typeof value !== "string") {
    return `${fieldName} is required`;
  }

  if (isHttpsAssetUrl(value) || isImageDataUri(value)) {
    return null;
  }

  return `${fieldName} must use HTTPS or a supported data:image URI`;
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

function requestedRatio(body: Record<string, unknown>) {
  if (body.ratio || body.requestedRatio) {
    return body.ratio || body.requestedRatio;
  }

  return body.creatorFormat === "short_form" ? "720:1280" : "1280:720";
}

function buildPrompt(body: Record<string, unknown>) {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const motionHint =
    typeof body.motionHint === "string" ? body.motionHint.trim() : "";
  const cameraDirection =
    typeof body.cameraDirection === "string"
      ? body.cameraDirection.trim()
      : "";
  const emotion =
    typeof body.emotion === "string" ? body.emotion.trim() : "";

  return [
    "Create a polished cinematic motion block from the supplied production image.",
    text ? `Scene context: ${text}` : "",
    motionHint ? `Motion direction: ${motionHint}` : "",
    cameraDirection ? `Camera direction: ${cameraDirection}` : "",
    emotion ? `Emotional tone: ${emotion}` : "",
    "Preserve subject identity, visual continuity, composition and professional production quality.",
    "Avoid frozen frames, abrupt morphing, text artifacts and unrelated scene changes.",
  ]
    .filter(Boolean)
    .join(" ");
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  const safeMessages = [
    "Primary video service is not configured.",
    "Premium video service is not configured.",
    "This production mode does not use AI video blocks.",
    "Video service did not return a task identifier.",
    "Premium video input image could not be downloaded.",
    "Premium video input image exceeds the 20 MB limit.",
    "Premium video service rejected the generation request.",
  ];

  if (safeMessages.includes(message)) {
    return message;
  }

  if (/401|unauthorized|invalid api|authentication|api key/.test(normalized)) {
    return "The primary video service rejected the configured API key.";
  }

  if (/402|payment|billing|credit|quota|insufficient/.test(normalized)) {
    return "The video production service has insufficient credits or quota for this request.";
  }

  if (/image|download|asset|url|fetch/.test(normalized)) {
    return "The video production service could not read the selected scene image.";
  }

  if (/duration|ratio|resolution|unsupported|invalid parameter/.test(normalized)) {
    return "The selected video settings are not supported by the active production service.";
  }

  if (/timeout|timed out|network|connection/.test(normalized)) {
    return "The video production service did not respond in time. Retry this scene.";
  }

  return "The CreatorLab video service could not start this motion task.";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const qualityMode = normalizeCreatorQualityMode(
      body.qualityMode,
      "standard",
    );
    const mediaRoute = getCreatorMediaRoute(qualityMode);

    if (!isCreatorMediaActionAllowed(mediaRoute, "ai_video_blocks")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            qualityMode === "draft"
              ? "Draft is a text-only planning mode."
              : "AI motion blocks require Pro or Cinematic production quality.",
        },
        { status: 409 },
      );
    }

    const imageUrl = body.imageUrl;
    const imageError = validateImageInput(imageUrl);

    if (imageError) {
      return NextResponse.json(
        { ok: false, error: imageError },
        { status: 400 },
      );
    }

    const selection = selectCreatorVideoProvider(mediaRoute);

    if (!selection.provider.isAvailable()) {
      throw new Error(
        selection.selectedTier === "premium"
          ? "Premium video service is not configured."
          : "Primary video service is not configured.",
      );
    }

    const durationPolicy = selection.provider.normalizeDuration(
      body.duration,
      qualityMode,
    );
    const useCinematicContinuity = qualityMode === "cinematic";
    const lastFrameUrl = useCinematicContinuity
      ? optionalImageUrl(body.lastFrameUrl)
      : undefined;
    const references = useCinematicContinuity
      ? referenceImageUrls(body.referenceImageUrls)
      : [];

    for (const [fieldName, url] of [
      ["lastFrameUrl", lastFrameUrl],
      ...references.map((url, index) => [`referenceImageUrls[${index}]`, url]),
    ] as Array<[string, string | undefined]>) {
      if (!url) continue;
      const error = validateImageInput(url, fieldName);
      if (error) {
        return NextResponse.json(
          { ok: false, error },
          { status: 400 },
        );
      }
    }

    // Do not reject an HTTPS asset based on a HEAD request. Some signed storage
    // and CDN URLs reject HEAD while remaining fully downloadable by providers.
    const task = await selection.provider.createTask({
      imageUrl: imageUrl as string,
      lastFrameUrl,
      referenceImageUrls: references,
      promptText: buildPrompt(body),
      requestedRatio: requestedRatio(body),
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
      engineTier: selection.selectedTier,
      premiumFallbackUsed: selection.usedFallback,
    });
  } catch (error: unknown) {
    console.error("creator-video create error:", error);

    return NextResponse.json(
      { ok: false, error: publicError(error) },
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

    const parsedProviderJob = parseVideoJobToken(taskId);
    const providerJob = parsedProviderJob ||
      (/^[a-z0-9._\-]+$/i.test(taskId)
        ? { providerKey: "runway" as const, nativeTaskId: taskId }
        : null);

    if (!providerJob) {
      return NextResponse.json(
        { ok: false, error: "CreatorLab video task identifier is invalid." },
        { status: 400 },
      );
    }

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
          `/api/creator-video?taskId=${encodeURIComponent(taskId)}&download=1`,
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
  } catch (error: unknown) {
    console.error("creator-video status error:", error);

    return NextResponse.json(
      { ok: false, error: publicError(error) },
      { status: 500 },
    );
  }
}
