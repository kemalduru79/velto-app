import { normalizeCreatorAudioTimeline, type CreatorAudioTimeline } from "./audioTimeline";
import { resolveOwnedCreatorAudioAsset } from "./audioAssetResolver.server";
import { resolveCreatorPremiumMusicExportEntitlement } from "./musicEntitlement";
import { isPremiumMusicAcquisitionEnabled } from "@/lib/providers/music/downloadSecurity";
import { getPersistenceServices } from "@/lib/persistence";
import type { MediaAssetRepository } from "@/lib/persistence/media";
import type { ProjectRepository } from "@/lib/persistence/projects";
import type { CreatorMusicEntitlementRepository } from "@/lib/persistence/music";

export type CreatorAudioRenderabilityCode =
  | "creator_audio_timeline_required"
  | "creator_audio_placement_not_renderable"
  | "creator_audio_rights_not_renderable"
  | "creator_audio_asset_not_renderable"
  | "creator_audio_acquisition_required";

export class CreatorAudioRenderabilityError extends Error {
  constructor(readonly code: CreatorAudioRenderabilityCode) {
    super("Project audio is not ready for final use.");
    this.name = "CreatorAudioRenderabilityError";
  }
}

export type CreatorRenderableAudioAsset =
  | ({ kind: "uploaded" } & Awaited<ReturnType<typeof resolveOwnedCreatorAudioAsset>>)
  | { kind: "licensed"; assetId: string; entitlementId: string; trackId: string };

type Dependencies = {
  projectRepository: ProjectRepository;
  mediaAssetRepository: MediaAssetRepository;
  entitlementRepository: CreatorMusicEntitlementRepository;
  acquisitionEnabled: boolean;
  privateBucket?: string;
};

export async function resolveCreatorAudioRenderability(input: {
  ownerUserId: string;
  projectId: string;
  timeline: CreatorAudioTimeline | null | undefined;
}, dependencies?: Dependencies) {
  if (!input.timeline) throw new CreatorAudioRenderabilityError("creator_audio_timeline_required");
  const timeline = normalizeCreatorAudioTimeline(input.timeline);
  const persistence = dependencies ? null : getPersistenceServices();
  const resolved = dependencies || {
    projectRepository: persistence!.projectRepository,
    mediaAssetRepository: persistence!.mediaAssetRepository,
    entitlementRepository: persistence!.creatorMusicEntitlementRepository,
    acquisitionEnabled: isPremiumMusicAcquisitionEnabled(),
    privateBucket: process.env.CREATOR_PREMIUM_MUSIC_BUCKET?.trim(),
  };
  const assets: CreatorRenderableAudioAsset[] = [];
  const resolvedAssetIds = new Set<string>();

  for (const placement of timeline.placements) {
    if (placement.kind !== "music") {
      if (placement.status === "active") throw new CreatorAudioRenderabilityError("creator_audio_placement_not_renderable");
      continue;
    }
    if (placement.status !== "active" || !placement.asset) {
      throw new CreatorAudioRenderabilityError("creator_audio_placement_not_renderable");
    }
    if (!["verified", "creator_attested"].includes(placement.asset.rights.status)) {
      throw new CreatorAudioRenderabilityError("creator_audio_rights_not_renderable");
    }
    if (resolvedAssetIds.has(placement.asset.assetId)) continue;

    if (placement.asset.origin === "uploaded") {
      const descriptor = await resolveOwnedCreatorAudioAsset({
        ownerUserId: input.ownerUserId,
        projectId: input.projectId,
        assetId: placement.asset.assetId,
      }, resolved);
      if (!["verified", "creator_attested"].includes(descriptor.rights.status)) {
        throw new CreatorAudioRenderabilityError("creator_audio_rights_not_renderable");
      }
      assets.push({ ...descriptor, kind: "uploaded" });
      resolvedAssetIds.add(placement.asset.assetId);
      continue;
    }

    if (placement.asset.origin !== "licensed_catalog" || !placement.asset.assetId.startsWith("catalog:")) {
      throw new CreatorAudioRenderabilityError("creator_audio_asset_not_renderable");
    }
    if (!resolved.acquisitionEnabled) throw new CreatorAudioRenderabilityError("creator_audio_acquisition_required");
    const trackId = placement.asset.assetId.slice("catalog:".length);
    const entitlement = await resolveCreatorPremiumMusicExportEntitlement({
      userId: input.ownerUserId,
      projectId: input.projectId,
      trackId,
    }, {
      projectRepository: resolved.projectRepository,
      entitlementRepository: resolved.entitlementRepository,
      acquisitionEnabled: resolved.acquisitionEnabled,
      privateBucket: resolved.privateBucket,
    }).catch(() => null);
    if (!entitlement) throw new CreatorAudioRenderabilityError("creator_audio_acquisition_required");
    assets.push({ kind: "licensed", assetId: placement.asset.assetId, ...entitlement });
    resolvedAssetIds.add(placement.asset.assetId);
  }

  return { timeline, assets };
}
