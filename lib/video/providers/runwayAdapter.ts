import RunwayML from "@runwayml/sdk";
import { createLogger } from "@/lib/observability";
import {
  isProviderConfigured,
  resolveProviderEnvironmentValue,
} from "@/lib/runtime/providerEnvironment.mjs";
import {
  normalizeVideoClipDuration,
  normalizeVideoQualityTier,
} from "../timelineSync";
import type {
  VideoProvider,
  VideoProviderCreateInput,
  VideoProviderTask,
  VideoProviderCancelResult,
} from "./types";

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

const SUPPORTED_RATIOS = [
  "1280:720",
  "720:1280",
  "1104:832",
  "960:960",
  "832:1104",
  "1584:672",
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getApiKey() {
  return resolveProviderEnvironmentValue("runway", "apiKey");
}

function getClient() {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("Primary video service is not configured.");
  }

  return new RunwayML({ apiKey });
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

function normalizeTask(task: unknown): VideoProviderTask {
  const record = asRecord(task);
  const output = Array.isArray(record.output) ? record.output : [];
  const firstOutput = output[0];
  const outputRecord = asRecord(firstOutput);
  const videoUrl =
    optionalString(firstOutput) || optionalString(outputRecord.url);

  return {
    nativeTaskId: optionalString(record.id) || "",
    status: optionalString(record.status)?.toUpperCase() || "UNKNOWN",
    failureCode: optionalString(record.failureCode),
    failureMessage: optionalString(record.failureMessage),
    videoUrl,
  };
}

async function createRunwayTask(
  client: RunwayML,
  model: RunwayVideoModel,
  input: VideoProviderCreateInput,
) {
  if (model === "gen4_turbo" || model === "gen4.5") {
    return client.imageToVideo.create({
      model,
      promptImage: input.imageUrl,
      promptText: input.promptText,
      ratio: getGen4Ratio(input.requestedRatio),
      duration: input.durationSec,
    });
  }

  return client.imageToVideo.create({
    model: "seedance2",
    promptImage: input.imageUrl,
    promptText: input.promptText,
    ratio: getSeedance2Ratio(input.requestedRatio),
    duration: input.durationSec,
  });
}

export class RunwayVideoProvider implements VideoProvider {
  readonly key = "runway" as const;
  readonly tier = "primary" as const;
  readonly capabilities = {
    imageToVideo: true,
    firstFrame: true,
    lastFrame: false,
    referenceImage: true,
    supportedRatios: SUPPORTED_RATIOS,
  };

  isAvailable() {
    return isProviderConfigured("runway");
  }

  getRuntimeProfile() { return { model: getModel(), resolution: "ratio_defined", audioMode: "no_audio" }; }

  normalizeDuration(requestedDuration: unknown, qualityMode: unknown) {
    return normalizeVideoClipDuration(
      requestedDuration,
      normalizeVideoQualityTier(qualityMode, "standard"),
    );
  }

  async createTask(input: VideoProviderCreateInput) {
    const task = await createRunwayTask(getClient(), getModel(), input);
    const normalized = normalizeTask(task);

    return {
      ...normalized,
      status: normalized.status === "UNKNOWN" ? "PENDING" : normalized.status,
    };
  }

  async retrieveTask(nativeTaskId: string) {
    const task = await getClient().tasks.retrieve(nativeTaskId);
    return normalizeTask(task);
  }


  async cancelTask(nativeTaskId: string): Promise<VideoProviderCancelResult> {
    if (!/^[a-z0-9._\-]+$/i.test(nativeTaskId)) {
      throw new Error("Primary video task identifier is invalid.");
    }

    const current = await this.retrieveTask(nativeTaskId);
    const currentStatus = current.status.toUpperCase();

    if (["SUCCEEDED", "FAILED", "CANCELED", "CANCELLED"].includes(currentStatus)) {
      return {
        supported: true,
        accepted: currentStatus === "CANCELED" || currentStatus === "CANCELLED",
        status: currentStatus,
        terminal: true,
        message:
          currentStatus === "SUCCEEDED"
            ? "The video task already completed and can no longer be cancelled."
            : undefined,
      };
    }

    const response = await fetch(
      `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(nativeTaskId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "X-Runway-Version": "2024-11-06",
        },
      },
    );

    if (!response.ok && response.status !== 404) {
      await response.text().catch(() => "");
      createLogger({ operation: "provider.video.cancel" }).error(
        "Primary video cancellation failed.",
        undefined,
        { httpStatus: response.status },
      );
      throw new Error("The primary video service could not cancel this task.");
    }

    return {
      supported: true,
      accepted: true,
      status: "CANCELED",
      terminal: true,
    };
  }

  async downloadOutput(outputUrl: string) {
    return fetch(outputUrl, { redirect: "follow" });
  }
}
