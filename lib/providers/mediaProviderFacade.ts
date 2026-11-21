// VELTO_PORT_P1_3K_3O — centralized provider abstraction and tier routing.
import type { CreatorMediaRoute } from "../creator/mediaRouting";
import { getImageProvider } from "./image";
import { getVoiceProvider } from "./voice";
import {
  getVideoProvider,
  selectCreatorVideoProvider,
  selectPrimaryVideoProvider,
  type VideoProviderKey,
} from "../video/providers";

export type PublicVideoServiceHealth = {
  canGenerate: boolean;
  requestedTier: "primary" | "premium";
  activeTier: "primary" | "premium";
  fallbackUsed: boolean;
  reasonCode: "ready" | "premium_fallback" | "not_configured";
};

const mediaProviderFacade = {
  image: getImageProvider,
  voice: getVoiceProvider,
  selectCreatorVideo: selectCreatorVideoProvider,
  selectPrimaryVideo: selectPrimaryVideoProvider,
  getCreatorVideoHealth(route: CreatorMediaRoute): PublicVideoServiceHealth {
    const selection = selectCreatorVideoProvider(route);
    return {
      canGenerate: selection.available,
      requestedTier: selection.requestedTier,
      activeTier: selection.selectedTier,
      fallbackUsed: selection.usedFallback,
      reasonCode: selection.available ? (selection.usedFallback ? "premium_fallback" : "ready") : "not_configured",
    };
  },
  getVideoByKey(providerKey: VideoProviderKey) {
    return getVideoProvider(providerKey);
  },
};

export function getMediaProviderFacade() {
  return mediaProviderFacade;
}
