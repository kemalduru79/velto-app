import type { CreatorMediaRoute } from "../../creator/mediaRouting";
import { observeProviderCall } from "@/lib/observability";
import { RunwayVideoProvider } from "./runwayAdapter";
import type {
  VideoProvider,
  VideoProviderKey,
  VideoProviderSelection,
} from "./types";
import { VeoVideoProvider } from "./veoAdapter";

const JOB_TOKEN_PREFIX = "velto_vp1_";
function createObservedVideoProvider(raw: VideoProvider): VideoProvider {
  return {
    key: raw.key,
    tier: raw.tier,
    capabilities: raw.capabilities,
    isAvailable: () => raw.isAvailable(),
    normalizeDuration: (requestedDuration, qualityMode) =>
      raw.normalizeDuration(requestedDuration, qualityMode),
    createTask: (input) =>
      observeProviderCall(
        {
          mediaType: "video",
          providerTier: raw.tier,
          operation: "create",
          metadata: { durationSec: input.durationSec },
        },
        () => raw.createTask(input),
      ),
    retrieveTask: (nativeTaskId) =>
      observeProviderCall(
        { mediaType: "video", providerTier: raw.tier, operation: "status" },
        () => raw.retrieveTask(nativeTaskId),
      ),
    cancelTask: (nativeTaskId) =>
      observeProviderCall(
        { mediaType: "video", providerTier: raw.tier, operation: "cancel" },
        () => raw.cancelTask(nativeTaskId),
      ),
    downloadOutput: (outputUrl) =>
      observeProviderCall(
        { mediaType: "video", providerTier: raw.tier, operation: "download" },
        () => raw.downloadOutput(outputUrl),
      ),
  };
}

let providers: Record<VideoProviderKey, VideoProvider> | null = null;

function getProviders(): Record<VideoProviderKey, VideoProvider> {
  providers ||= {
    runway: createObservedVideoProvider(new RunwayVideoProvider()),
    veo: createObservedVideoProvider(new VeoVideoProvider()),
  };
  return providers;
}

function createSelection({
  provider,
  requestedTier,
  selectedTier,
  usedFallback,
  fallbackReason = null,
}: Omit<VideoProviderSelection, "available">): VideoProviderSelection {
  return {
    provider,
    requestedTier,
    selectedTier,
    usedFallback,
    available: provider.isAvailable(),
    fallbackReason,
  };
}

export function selectPrimaryVideoProvider(): VideoProviderSelection {
  return createSelection({
    provider: getProviders().runway,
    requestedTier: "primary",
    selectedTier: "primary",
    usedFallback: false,
    fallbackReason: null,
  });
}

export function selectCreatorVideoProvider(route: CreatorMediaRoute): VideoProviderSelection {
  const registry = getProviders();
  const primary = registry.runway;
  const premium = registry.veo;

  if (route.providerTarget === "none") {
    throw new Error("This production mode does not use AI video blocks.");
  }

  if (route.providerTarget === "premium_primary") {
    if (premium.isAvailable()) {
      return createSelection({ provider: premium, requestedTier: "premium", selectedTier: "premium", usedFallback: false, fallbackReason: null });
    }
    if (primary.isAvailable()) {
      return createSelection({ provider: primary, requestedTier: "premium", selectedTier: "primary", usedFallback: true, fallbackReason: "premium_unavailable" });
    }
    return createSelection({ provider: premium, requestedTier: "premium", selectedTier: "premium", usedFallback: false, fallbackReason: null });
  }

  return selectPrimaryVideoProvider();
}

export function getVideoProvider(providerKey: VideoProviderKey) {
  return getProviders()[providerKey];
}

export function createVideoJobToken(providerKey: VideoProviderKey, nativeTaskId: string) {
  const payload = Buffer.from(JSON.stringify({ providerKey, nativeTaskId }), "utf8").toString("base64url");
  return `${JOB_TOKEN_PREFIX}${payload}`;
}

export function parseVideoJobToken(value: string): { providerKey: VideoProviderKey; nativeTaskId: string } | null {
  if (!value.startsWith(JOB_TOKEN_PREFIX)) return null;
  try {
    const payload = value.slice(JOB_TOKEN_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { providerKey?: unknown; nativeTaskId?: unknown };
    if ((parsed.providerKey !== "runway" && parsed.providerKey !== "veo") || typeof parsed.nativeTaskId !== "string" || !parsed.nativeTaskId.trim()) {
      return null;
    }
    return { providerKey: parsed.providerKey as VideoProviderKey, nativeTaskId: parsed.nativeTaskId };
  } catch {
    return null;
  }
}
