import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { classifyMediaReferenceSafety, getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const repository = getPersistenceServices().mediaAssetRepository;
    const assets = (await repository.listForOwner(principal.id)).filter((asset) =>
      asset.lifecycleState !== "purged" &&
      (asset.mediaKind === "image" || asset.mediaKind === "video" || asset.mediaKind === "final_video"),
    );
    const inventory = await Promise.all(assets.map(async (asset) => {
      const references = await repository.getReferenceSummaryForOwner(asset.id, principal.id);
      const classification = classifyMediaReferenceSafety(asset.lifecycleState, references);
      return {
        id: asset.id,
        publicUrl: asset.publicUrl,
        mediaKind: asset.mediaKind,
        sizeBytes: asset.sizeBytes,
        lifecycleState: asset.lifecycleState,
        trashedAt: asset.trashedAt,
        ...classification,
        referenceSummary: references.map(({ projectId, referenceType, referenceKey }) => ({
          projectId, referenceType, referenceKey,
        })),
      };
    }));
    return NextResponse.json({ assets: inventory });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "A valid session is required." }, { status: 401 });
    }
    console.error("media-assets inventory error:", error);
    return NextResponse.json({ error: "Media inventory is temporarily unavailable." }, { status: 503 });
  }
}
