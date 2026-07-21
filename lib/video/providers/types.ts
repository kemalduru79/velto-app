export type VideoProviderKey = "runway" | "veo";
export type VideoProviderTier = "primary" | "premium";

export type VideoProviderCapabilities = {
  imageToVideo: boolean;
  firstFrame: boolean;
  lastFrame: boolean;
  referenceImage: boolean;
  supportedRatios: readonly string[];
};

export type VideoProviderCreateInput = {
  imageUrl: string;
  lastFrameUrl?: string;
  referenceImageUrls?: string[];
  promptText: string;
  requestedRatio: unknown;
  durationSec: number;
};

export type VideoProviderDurationPolicy = {
  durationSec: number;
  reason: string;
};

export type VideoProviderTask = {
  nativeTaskId: string;
  status: string;
  videoUrl: string | null;
  failureCode: string | null;
  failureMessage: string | null;
};

export interface VideoProvider {
  readonly key: VideoProviderKey;
  readonly tier: VideoProviderTier;
  readonly capabilities: VideoProviderCapabilities;
  isAvailable(): boolean;
  normalizeDuration(
    requestedDuration: unknown,
    qualityMode: unknown,
  ): VideoProviderDurationPolicy;
  createTask(input: VideoProviderCreateInput): Promise<VideoProviderTask>;
  retrieveTask(nativeTaskId: string): Promise<VideoProviderTask>;
  downloadOutput(outputUrl: string): Promise<Response>;
}

export type VideoProviderSelection = {
  provider: VideoProvider;
  requestedTier: VideoProviderTier;
  selectedTier: VideoProviderTier;
  usedFallback: boolean;
};
