import type { CreatorMediaRoute } from "../../creator/mediaRouting";
import { RunwayVideoProvider } from "./runwayAdapter";
import type {
  VideoProvider,
  VideoProviderKey,
  VideoProviderSelection,
} from "./types";
import { VeoVideoProvider } from "./veoAdapter";

const JOB_TOKEN_PREFIX = "velto_vp1_";

function createProviders(): Record<VideoProviderKey, VideoProvider> {
  return {
    runway: new RunwayVideoProvider(),
    veo: new VeoVideoProvider(),
  };
}

export function selectCreatorVideoProvider(
  route: CreatorMediaRoute,
): VideoProviderSelection {
  const providers = createProviders();
  const primary = providers.runway;
  const premium = providers.veo;

  if (route.providerTarget === "none") {
    throw new Error("This production mode does not use AI video blocks.");
  }

  if (route.providerTarget === "premium_primary") {
    if (premium.isAvailable()) {
      return {
        provider: premium,
        requestedTier: "premium",
        selectedTier: "premium",
        usedFallback: false,
      };
    }

    return {
      provider: primary,
      requestedTier: "premium",
      selectedTier: "primary",
      usedFallback: true,
    };
  }

  return {
    provider: primary,
    requestedTier: "primary",
    selectedTier: "primary",
    usedFallback: false,
  };
}

export function getVideoProvider(providerKey: VideoProviderKey) {
  return createProviders()[providerKey];
}

export function createVideoJobToken(
  providerKey: VideoProviderKey,
  nativeTaskId: string,
) {
  const payload = Buffer.from(
    JSON.stringify({ providerKey, nativeTaskId }),
    "utf8",
  ).toString("base64url");

  return `${JOB_TOKEN_PREFIX}${payload}`;
}

export function parseVideoJobToken(
  value: string,
): { providerKey: VideoProviderKey; nativeTaskId: string } | null {
  if (!value.startsWith(JOB_TOKEN_PREFIX)) {
    return null;
  }

  try {
    const payload = value.slice(JOB_TOKEN_PREFIX.length);
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { providerKey?: unknown; nativeTaskId?: unknown };

    if (
      (parsed.providerKey !== "runway" && parsed.providerKey !== "veo") ||
      typeof parsed.nativeTaskId !== "string" ||
      !parsed.nativeTaskId.trim()
    ) {
      return null;
    }

    return {
      providerKey: parsed.providerKey as VideoProviderKey,
      nativeTaskId: parsed.nativeTaskId,
    };
  } catch {
    return null;
  }
}
