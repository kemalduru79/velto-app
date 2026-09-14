import "server-only";
import { persistEconomicOperationBestEffort, unknownCost } from "@/lib/economics";
import type { CreatorMusicEntitlement } from "@/lib/persistence/music";

export async function recordCreatorMusicAcquisitionEconomics(input: {
  acquisition: { entitlement: CreatorMusicEntitlement; reused: boolean };
  userId: string;
  projectId: string;
}) {
  if (input.acquisition.reused) return;
  const entitlement = input.acquisition.entitlement;
  const logicalOperationId = `creator-music-acquisition:${entitlement.id}`;
  await persistEconomicOperationBestEffort({
    attemptKey: `${logicalOperationId}:1`,
    logicalOperationId,
    userId: input.userId,
    projectId: input.projectId,
    route: "/api/creator-music/acquire",
    operationType: "creator_music_acquisition",
    productTier: "creatorlab",
    provider: entitlement.providerKey,
    providerTier: "licensed_catalog",
    model: entitlement.licensePolicyVersion,
    state: "provider_billed",
    billingMoment: "successful_acquisition",
    assetIdentity: entitlement.storagePath,
    reuseIdentity: entitlement.id,
    quantities: {
      requestCount: 1,
      outputBytes: entitlement.sizeBytes || 0,
      storageBytes: entitlement.sizeBytes || 0,
    },
    cost: unknownCost("Licensed music acquisition pricing is not approved."),
    providerAcceptedAt: entitlement.acquiredAt || new Date().toISOString(),
    completedAt: entitlement.acquiredAt || new Date().toISOString(),
  });
}
