import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const principal = await authenticateRequest(request);
    const { assetId } = await params;
    const repository = getPersistenceServices().mediaAssetRepository;
    const ownedAsset = await repository.getForOwner(assetId, principal.id);
    if (!ownedAsset || !["image", "video", "final_video"].includes(ownedAsset.mediaKind)) {
      return NextResponse.json({ error: "Media asset was not found." }, { status: 404 });
    }
    if (ownedAsset.lifecycleState !== "trashed") {
      return NextResponse.json({ error: "Media lifecycle state changed." }, { status: 409 });
    }
    const restored = await repository.restoreForOwner(assetId, principal.id);
    if (!restored) return NextResponse.json({ error: "Media lifecycle state changed." }, { status: 409 });
    return NextResponse.json({ success: true, assetId, lifecycleState: "active" });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "A valid session is required." }, { status: 401 });
    }
    console.error("media-assets restore error:", error);
    return NextResponse.json({ error: "Media could not be restored." }, { status: 503 });
  }
}
