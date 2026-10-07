import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { classifyMediaReferenceSafety, getPersistenceServices } from "@/lib/persistence";
import { getMediaPurgeEligibility } from "@/lib/persistence/media/purgePolicy";
import { getServerMediaPurgeConfiguration } from "@/lib/persistence/media/mediaPurge.server";
import { auditCreatorMediaCostHygiene } from "@/lib/creator/mediaCostHygiene";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const repository = getPersistenceServices().mediaAssetRepository;
    const purgeConfig = getServerMediaPurgeConfiguration();
    const assets = (await repository.listForOwner(principal.id)).filter((asset) =>
      asset.lifecycleState !== "purged" &&
      (asset.mediaKind === "image" || asset.mediaKind === "video" || asset.mediaKind === "final_video"),
    );
    const inventory = await Promise.all(assets.map(async (asset) => {
      const references = await repository.getReferenceSummaryForOwner(asset.id, principal.id);
      const classification = classifyMediaReferenceSafety(asset.lifecycleState, references);
      const purgeEligibility = getMediaPurgeEligibility(asset.trashedAt, purgeConfig.retentionDays);
      return {
        id: asset.id,
        publicUrl: asset.publicUrl,
        mediaKind: asset.mediaKind,
        sizeBytes: asset.sizeBytes,
        lifecycleState: asset.lifecycleState,
        trashedAt: asset.trashedAt,
        createdAt: asset.createdAt ?? null,
        purgePending: Boolean(asset.purgeStartedAt),
        retentionDays: purgeConfig.retentionDays,
        permanentDeleteEnabled: purgeConfig.permanentDeleteEnabled,
        permanentDeleteEligible: purgeConfig.permanentDeleteEnabled && purgeEligibility.eligible && !asset.purgeStartedAt && references.length === 0,
        purgeEligibleAt: purgeEligibility.eligibleAt,
        purgeDaysRemaining: purgeEligibility.daysRemaining,
        ...classification,
        referenceSummary: references.map(({ projectId, referenceType, referenceKey }) => ({
          projectId, referenceType, referenceKey,
        })),
      };
    }));

    const costHygiene = auditCreatorMediaCostHygiene(
      inventory.map((asset) => ({
        id: asset.id,
        mediaKind: asset.mediaKind,
        sizeBytes: asset.sizeBytes,
        lifecycleState: asset.lifecycleState,
        createdAt: asset.createdAt,
        cleanupState: asset.cleanupState,
      })),
    );

    return NextResponse.json({ assets: inventory, costHygiene });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "A valid session is required." }, { status: 401 });
    }
    console.error("media-assets inventory error:", error);
    return NextResponse.json({ error: "Media inventory is temporarily unavailable." }, { status: 503 });
  }
}
