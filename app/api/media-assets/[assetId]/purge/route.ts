import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import { getServerMediaPurgeConfiguration, purgeMediaAssetForOwner } from "@/lib/persistence/media/mediaPurge.server";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const principal = await authenticateRequest(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || body.confirmPermanentDeletion !== true || Object.keys(body).some((key) => key !== "confirmPermanentDeletion")) {
      return NextResponse.json({ ok: false, code: "CONFIRMATION_REQUIRED", error: "Explicit permanent-deletion confirmation is required." }, { status: 400, headers: NO_STORE });
    }
    if (!getServerMediaPurgeConfiguration().permanentDeleteEnabled) {
      return NextResponse.json({ ok: false, code: "FEATURE_DISABLED", error: "Permanent deletion is not enabled." }, { status: 409, headers: NO_STORE });
    }
    const { assetId } = await params;
    const asset = await getPersistenceServices().mediaAssetRepository.getForOwner(assetId, principal.id);
    if (!asset || !["image", "video", "final_video"].includes(asset.mediaKind)) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", error: "Media asset was not found." }, { status: 404, headers: NO_STORE });
    }
    const result = await purgeMediaAssetForOwner(principal.id, assetId);
    if (result.status === "purged") return NextResponse.json({ ok: true, code: "PURGED", freedBytes: result.freedBytes }, { headers: NO_STORE });
    const response = {
      not_found: ["NOT_FOUND", 404], not_trashed: ["NOT_TRASHED", 409], retention_not_met: ["RETENTION_NOT_MET", 409],
      in_use: ["IN_USE", 409], purge_already_pending: ["PURGE_ALREADY_PENDING", 409],
      storage_remove_failed: ["PURGE_FAILED", 503], recovery_required: ["RECOVERY_REQUIRED", 503],
    }[result.status] || ["RECOVERY_REQUIRED", 503];
    return NextResponse.json({ ok: false, code: response[0], error: response[0] === "RECOVERY_REQUIRED" ? "Physical cleanup requires recovery." : "Media could not be permanently deleted." }, { status: Number(response[1]), headers: NO_STORE });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, code: "AUTHENTICATION_REQUIRED", error: "A valid session is required." }, { status: 401, headers: NO_STORE });
    console.error("media purge route error:", error);
    return NextResponse.json({ ok: false, code: "PURGE_FAILED", error: "Media could not be permanently deleted." }, { status: 503, headers: NO_STORE });
  }
}
