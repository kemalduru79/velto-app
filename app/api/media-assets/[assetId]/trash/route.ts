import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { classifyMediaReferenceSafety, extractProjectMediaReferences, getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const principal = await authenticateRequest(request);
    const { assetId } = await params;
    const services = getPersistenceServices();
    const asset = await services.mediaAssetRepository.getForOwner(assetId, principal.id);
    if (!asset || !["image", "video", "final_video"].includes(asset.mediaKind)) {
      return NextResponse.json({ error: "Media asset was not found." }, { status: 404 });
    }
    const references = await services.mediaAssetRepository.getReferenceSummaryForOwner(asset.id, principal.id);
    const classification = classifyMediaReferenceSafety(asset.lifecycleState, references);
    if (classification.cleanupState === "IN_USE") {
      return NextResponse.json({ error: "This media is currently in use.", cleanupState: "IN_USE" }, { status: 409 });
    }
    if (classification.cleanupState !== "UNREFERENCED" && classification.cleanupState !== "HISTORY_ONLY") {
      return NextResponse.json({ error: "Media lifecycle state changed.", cleanupState: classification.cleanupState }, { status: 409 });
    }

    if (classification.cleanupState === "HISTORY_ONLY") {
      const body = await request.json().catch(() => ({})) as { projectId?: unknown };
      const projectIds = [...new Set(references.map((reference) => reference.projectId))];
      if (projectIds.length !== 1) {
        return NextResponse.json({ error: "Used in history of multiple projects." }, { status: 409 });
      }
      const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
      if (!projectId || projectId !== projectIds[0] || !asset.publicUrl) {
        return NextResponse.json({ error: "The owning project could not be verified." }, { status: 404 });
      }
      const cleanup = await services.projectRepository.removeAssetHistoryUrlForOwner(projectId, principal.id, asset.publicUrl);
      if (cleanup.status !== "updated") {
        return NextResponse.json(
          { error: cleanup.status === "not_found" ? "Project was not found." : "Project history changed before cleanup." },
          { status: cleanup.status === "not_found" ? 404 : 409 },
        );
      }
      await services.mediaAssetRepository.replaceProjectReferences(
        principal.id,
        projectId,
        extractProjectMediaReferences(cleanup.project),
      );
      const remaining = await services.mediaAssetRepository.getReferenceSummaryForOwner(asset.id, principal.id);
      if (remaining.length > 0) {
        return NextResponse.json({ error: "Media remains in use after history cleanup." }, { status: 409 });
      }
    }

    // The RPC locks the asset and re-checks references; this UI response is
    // never treated as authorization for a stale transition.
    const result = await services.mediaAssetRepository.trashForOwner(asset.id, principal.id);
    if (result === "not_found") return NextResponse.json({ error: "Media asset was not found." }, { status: 404 });
    if (result !== "trashed") {
      return NextResponse.json({ error: result === "in_use" ? "This media became in use." : "Media lifecycle state changed." }, { status: 409 });
    }
    return NextResponse.json({ success: true, assetId: asset.id, lifecycleState: "trashed" });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "A valid session is required." }, { status: 401 });
    }
    console.error("media-assets trash error:", error);
    return NextResponse.json({ error: "Media could not be moved to Trash." }, { status: 503 });
  }
}
