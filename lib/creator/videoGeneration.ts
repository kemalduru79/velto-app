// The worker defaults to a 15s registry heartbeat; three missed heartbeats
// fail closed while tolerating one transient delayed write.
export const CREATOR_VIDEO_WORKER_STALE_SECONDS = 45;

export type CreatorVideoGenerationInput = {
  text?: string; motionHint?: string; cameraDirection?: string; emotion?: string;
  imageUrl?: string; lastFrameUrl?: string; referenceImageUrls?: string[];
  qualityMode?: string; creatorFormat?: string; duration?: number;
};

export function buildCreatorVideoGenerationSignature(input: CreatorVideoGenerationInput) {
  return `creator-video-v2:${JSON.stringify({
    promptPolicy: CREATOR_VIDEO_PROMPT_POLICY_VERSION,
    text: String(input.text || "").trim(),
    motionHint: String(input.motionHint || "").trim(),
    cameraDirection: String(input.cameraDirection || "").trim(),
    emotion: String(input.emotion || "").trim(),
    imageUrl: String(input.imageUrl || "").trim(),
    lastFrameUrl: String(input.lastFrameUrl || "").trim(),
    referenceImageUrls: [...(input.referenceImageUrls || [])].map(String),
    qualityMode: String(input.qualityMode || ""),
    creatorFormat: String(input.creatorFormat || ""),
    duration: Number(input.duration || 0),
  })}`;
}

export function buildLegacyCreatorVideoGenerationSignature(input: CreatorVideoGenerationInput) {
  return `creator-video-v1:${JSON.stringify({
    text: String(input.text || "").trim(),
    motionHint: String(input.motionHint || "").trim(),
    cameraDirection: String(input.cameraDirection || "").trim(),
    emotion: String(input.emotion || "").trim(),
    imageUrl: String(input.imageUrl || "").trim(),
    lastFrameUrl: String(input.lastFrameUrl || "").trim(),
    referenceImageUrls: [...(input.referenceImageUrls || [])].map(String),
    qualityMode: String(input.qualityMode || ""),
    creatorFormat: String(input.creatorFormat || ""),
    duration: Number(input.duration || 0),
  })}`;
}

export type CreatorVideoCurrentness = "missing" | "processing" | "delayed" | "error" | "current" | "stale";

export function deriveCreatorVideoCurrentness(input: {
  videoUrl?: string; videoStatus?: string; generationSignature?: string;
  currentSignature: string; legacyCurrentSignature?: string; legacyBaseline?: boolean;
}): CreatorVideoCurrentness {
  if (input.videoStatus === "processing") return "processing";
  if (input.videoStatus === "delayed") return "delayed";
  if (!String(input.videoUrl || "").trim()) return input.videoStatus === "error" ? "error" : "missing";
  if (!input.generationSignature) return input.legacyBaseline === false ? "stale" : "current";
  return input.generationSignature === input.currentSignature ||
    (Boolean(input.legacyCurrentSignature) && input.generationSignature === input.legacyCurrentSignature)
    ? "current"
    : "stale";
}

export function hasHealthyCreatorVideoWorker(
  workers: Array<{ status?: string; lastSeenAt?: string; capabilities?: string[] }>,
  nowMs: number,
  staleSeconds = CREATOR_VIDEO_WORKER_STALE_SECONDS,
) {
  return workers.some((worker) =>
    ["starting", "idle", "busy"].includes(String(worker.status || "")) &&
    (!worker.capabilities || worker.capabilities.includes("video_reconcile")) &&
    nowMs - Date.parse(String(worker.lastSeenAt || "")) <= staleSeconds * 1000
  );
}
export const CREATOR_VIDEO_PROMPT_POLICY_VERSION = "composition-safe-v1" as const;
