import type {
  VideoProvider,
  VideoProviderCreateInput,
  VideoProviderTask,
  VideoProviderCancelResult,
} from "./types";

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "veo-3.1-generate-preview";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const PREMIUM_RATIOS = ["16:9", "9:16"] as const;
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

type InlineImage = {
  inlineData: {
    mimeType: string;
    data: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getApiKey() {
  return process.env.VEO_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim() || "";
}

function getModel() {
  const configuredModel = process.env.VEO_VIDEO_MODEL?.trim();

  if (configuredModel && /^[a-z0-9._-]+$/i.test(configuredModel)) {
    return configuredModel;
  }

  return DEFAULT_MODEL;
}

function getResolution(): "720p" | "1080p" | "4k" {
  const configuredResolution = process.env.VEO_VIDEO_RESOLUTION?.trim().toLowerCase();

  if (
    configuredResolution === "720p" ||
    configuredResolution === "1080p" ||
    configuredResolution === "4k"
  ) {
    return configuredResolution;
  }

  return "1080p";
}

function getAspectRatio(value: unknown): "16:9" | "9:16" {
  if (
    value === "9:16" ||
    value === "720:1280" ||
    value === "portrait" ||
    value === "vertical"
  ) {
    return "9:16";
  }

  return "16:9";
}

function normalizeMimeType(value: string | null, url: string) {
  const normalized = value?.split(";")[0]?.trim().toLowerCase();

  if (normalized === "image/jpg") return "image/jpeg";
  if (normalized && SUPPORTED_IMAGE_MIME_TYPES.has(normalized)) return normalized;
  if (/\.png(?:$|\?)/i.test(url)) return "image/png";
  if (/\.webp(?:$|\?)/i.test(url)) return "image/webp";

  return "image/jpeg";
}

function assertImageSize(byteLength: number) {
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    throw new Error("Premium video input image is empty.");
  }

  if (byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Premium video input image exceeds the 20 MB limit.");
  }
}

function parseDataImage(value: string): InlineImage | null {
  const match = value.match(
    /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-z0-9+/=\s]+)$/i,
  );

  if (!match) return null;

  const mimeType = match[1].toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : match[1].toLowerCase();
  const data = match[2].replace(/\s/g, "");
  assertImageSize(Buffer.byteLength(data, "base64"));

  return {
    inlineData: {
      mimeType,
      data,
    },
  };
}

async function loadInlineImage(url: string): Promise<InlineImage> {
  const dataImage = parseDataImage(url);

  if (dataImage) return dataImage;

  if (!url.startsWith("https://")) {
    throw new Error("Premium video input images must use HTTPS or a supported data URI.");
  }

  const response = await fetch(url, { redirect: "follow" });

  if (!response.ok) {
    throw new Error("Premium video input image could not be downloaded.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  assertImageSize(bytes.byteLength);

  return {
    inlineData: {
      mimeType: normalizeMimeType(response.headers.get("content-type"), url),
      data: bytes.toString("base64"),
    },
  };
}

async function requestJson(url: string, init: RequestInit) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("Premium video service is not configured.");
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiError = asRecord(asRecord(payload).error);
    const apiStatus = optionalString(apiError.status) || `HTTP_${response.status}`;
    console.error("Premium video API request failed:", apiStatus);
    throw new Error("Premium video service rejected the generation request.");
  }

  return asRecord(payload);
}

function getGeneratedVideoUrl(payload: Record<string, unknown>) {
  const response = asRecord(payload.response);
  const generateVideoResponse = asRecord(response.generateVideoResponse);
  const generatedSamples = Array.isArray(generateVideoResponse.generatedSamples)
    ? generateVideoResponse.generatedSamples
    : [];
  const firstSample = asRecord(generatedSamples[0]);
  const video = asRecord(firstSample.video);

  return optionalString(video.uri) || optionalString(video.url);
}

function getOperationError(payload: Record<string, unknown>) {
  const error = asRecord(payload.error);

  return {
    code: optionalString(error.status) || optionalString(error.code),
    message: optionalString(error.message),
  };
}

async function buildGenerationInstance(input: VideoProviderCreateInput) {
  const instance: Record<string, unknown> = {
    prompt: input.promptText,
  };

  // The premium API exposes interpolation and asset-reference generation as
  // distinct modes. Prefer precise first/last-frame interpolation when a next
  // scene frame exists; otherwise use up to three continuity references.
  if (input.lastFrameUrl) {
    instance.image = await loadInlineImage(input.imageUrl);
    instance.lastFrame = await loadInlineImage(input.lastFrameUrl);
    return instance;
  }

  const referenceUrls = Array.from(
    new Set(
      [input.imageUrl, ...(input.referenceImageUrls || [])]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 3);

  if (referenceUrls.length > 1) {
    instance.referenceImages = await Promise.all(
      referenceUrls.map(async (url) => ({
        image: await loadInlineImage(url),
        referenceType: "asset",
      })),
    );
    return instance;
  }

  instance.image = await loadInlineImage(input.imageUrl);
  return instance;
}

export class VeoVideoProvider implements VideoProvider {
  readonly key = "veo" as const;
  readonly tier = "premium" as const;
  readonly capabilities = {
    imageToVideo: true,
    firstFrame: true,
    lastFrame: true,
    referenceImage: true,
    supportedRatios: PREMIUM_RATIOS,
  };

  isAvailable() {
    return Boolean(getApiKey());
  }

  normalizeDuration() {
    return {
      durationSec: 8,
      reason:
        "Premium cinematic clips use the 8-second high-resolution continuity profile.",
    };
  }

  async createTask(input: VideoProviderCreateInput): Promise<VideoProviderTask> {
    const instance = await buildGenerationInstance(input);
    const payload = await requestJson(
      `${API_BASE_URL}/models/${getModel()}:predictLongRunning`,
      {
        method: "POST",
        body: JSON.stringify({
          instances: [instance],
          parameters: {
            aspectRatio: getAspectRatio(input.requestedRatio),
            durationSeconds: "8",
            resolution: getResolution(),
            numberOfVideos: 1,
            personGeneration: "allow_adult",
          },
        }),
      },
    );
    const nativeTaskId = optionalString(payload.name) || "";

    if (!nativeTaskId) {
      throw new Error("Premium video service did not return a task identifier.");
    }

    return {
      nativeTaskId,
      status: "PENDING",
      videoUrl: null,
      failureCode: null,
      failureMessage: null,
    };
  }

  async retrieveTask(nativeTaskId: string): Promise<VideoProviderTask> {
    if (!/^[a-z0-9._\-/:]+$/i.test(nativeTaskId)) {
      throw new Error("Premium video task identifier is invalid.");
    }

    const payload = await requestJson(`${API_BASE_URL}/${nativeTaskId}`, {
      method: "GET",
    });
    const operationError = getOperationError(payload);
    const videoUrl = getGeneratedVideoUrl(payload);
    const isDone = payload.done === true;

    return {
      nativeTaskId,
      status: operationError.code
        ? "FAILED"
        : isDone && videoUrl
          ? "SUCCEEDED"
          : isDone
            ? "FAILED"
            : "PENDING",
      videoUrl,
      failureCode: operationError.code,
      failureMessage:
        operationError.message ||
        (isDone && !videoUrl
          ? "Premium video generation completed without a downloadable output."
          : null),
    };
  }


  async cancelTask(nativeTaskId: string): Promise<VideoProviderCancelResult> {
    const current = await this.retrieveTask(nativeTaskId);
    const currentStatus = current.status.toUpperCase();

    if (["SUCCEEDED", "FAILED", "CANCELED", "CANCELLED"].includes(currentStatus)) {
      return {
        supported: false,
        accepted: currentStatus === "CANCELED" || currentStatus === "CANCELLED",
        status: currentStatus,
        terminal: true,
        message:
          currentStatus === "SUCCEEDED"
            ? "The premium video task already completed and can no longer be cancelled."
            : undefined,
      };
    }

    return {
      supported: false,
      accepted: false,
      status: currentStatus || "PENDING",
      terminal: false,
      message:
        "The active premium video API does not expose a verified cancellation operation for this task type.",
    };
  }

  async downloadOutput(outputUrl: string) {
    const apiKey = getApiKey();

    if (!apiKey) {
      throw new Error("Premium video service is not configured.");
    }

    if (!outputUrl.startsWith("https://")) {
      throw new Error("Premium video output URL is invalid.");
    }

    return fetch(outputUrl, {
      headers: {
        "x-goog-api-key": apiKey,
      },
      redirect: "follow",
    });
  }
}
