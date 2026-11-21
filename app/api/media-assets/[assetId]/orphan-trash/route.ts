import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import {
  classifyMediaReferenceSafety,
  extractProjectMediaReferences,
  getPersistenceServices,
} from "@/lib/persistence";
import { resolveCreatorMediaOrphanTrashEligibility } from "@/lib/creator/mediaCostHygiene";

export const runtime = "nodejs";

const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE,
  });
}

function normalizeRegisteredMediaUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  try {
    const principal = await authenticateRequest(request);

    const body = await request.json().catch(() => null) as
      | Record<string, unknown>
      | null;

    if (
      !body ||
      body.confirmOrphanTrash !== true ||
      Object.keys(body).some((key) => key !== "confirmOrphanTrash")
    ) {
      return json(
        {
          ok: false,
          code: "CONFIRMATION_REQUIRED",
          error: "Explicit orphan-trash confirmation is required.",
        },
        400,
      );
    }

    const { assetId } = await params;
    const services = getPersistenceServices();

    const asset = await services.mediaAssetRepository.getForOwner(
      assetId,
      principal.id,
    );

    if (
      !asset ||
      !["image", "video", "final_video"].includes(asset.mediaKind)
    ) {
      return json(
        {
          ok: false,
          code: "NOT_FOUND",
          error: "Media asset was not found.",
        },
        404,
      );
    }

    if (asset.lifecycleState !== "active") {
      return json(
        {
          ok: false,
          code: "STATE_CHANGED",
          error: "Media lifecycle state changed.",
        },
        409,
      );
    }

    const references =
      await services.mediaAssetRepository.getReferenceSummaryForOwner(
        asset.id,
        principal.id,
      );

    const classification = classifyMediaReferenceSafety(
      asset.lifecycleState,
      references,
    );

    const eligibility = resolveCreatorMediaOrphanTrashEligibility({
      id: asset.id,
      mediaKind: asset.mediaKind,
      sizeBytes: asset.sizeBytes,
      lifecycleState: asset.lifecycleState,
      createdAt: asset.createdAt,
      cleanupState: classification.cleanupState,
    });

    if (!eligibility.eligible) {
      const code = {
        unsupported_kind: "NOT_FOUND",
        state_changed: "STATE_CHANGED",
        in_use: "IN_USE",
        history_only: "HISTORY_ONLY",
        age_unknown: "AGE_UNKNOWN",
        grace_not_met: "GRACE_NOT_MET",
      }[eligibility.reason];

      return json(
        {
          ok: false,
          code,
          reason: eligibility.reason,
          graceHours: eligibility.graceHours,
          ageHours: eligibility.ageHours,
          error: "Media is not eligible for orphan cleanup.",
        },
        eligibility.reason === "unsupported_kind" ? 404 : 409,
      );
    }

    const authoritativePublicUrl =
      normalizeRegisteredMediaUrl(asset.publicUrl);

    if (!authoritativePublicUrl) {
      return json(
        {
          ok: false,
          code: "REFERENCE_AUTHORITY_UNAVAILABLE",
          error: "Persisted media reference authority is unavailable.",
        },
        409,
      );
    }

    // The reference table is normally authoritative, but project saves can
    // intentionally complete with deferred media-reference synchronization.
    // Before orphan cleanup, re-check the persisted project records so a
    // temporarily stale reference index cannot authorize Trash.
    const projectSummaries =
      await services.projectRepository.listForOwner(principal.id);

    for (const projectSummary of projectSummaries) {
      const project = await services.projectRepository.getForOwner(
        projectSummary.id,
        principal.id,
      );

      if (!project) continue;

      const stillPersisted = extractProjectMediaReferences(project).some(
        (reference) => reference.url === authoritativePublicUrl,
      );

      if (stillPersisted) {
        return json(
          {
            ok: false,
            code: "PERSISTED_REFERENCE_FOUND",
            error: "Media remains referenced by a persisted project.",
          },
          409,
        );
      }
    }

    // The repository RPC locks the asset and re-checks indexed references.
    // The persisted-project scan above additionally protects against deferred
    // reference synchronization. F1/F2 telemetry is never mutation authority.
    const result = await services.mediaAssetRepository.trashForOwner(
      asset.id,
      principal.id,
    );

    if (result === "not_found") {
      return json(
        {
          ok: false,
          code: "NOT_FOUND",
          error: "Media asset was not found.",
        },
        404,
      );
    }

    if (result === "in_use") {
      return json(
        {
          ok: false,
          code: "IN_USE",
          error: "Media became referenced before cleanup completed.",
        },
        409,
      );
    }

    if (result !== "trashed") {
      return json(
        {
          ok: false,
          code: "STATE_CHANGED",
          error: "Media lifecycle state changed.",
        },
        409,
      );
    }

    return json({
      ok: true,
      code: "TRASHED",
      assetId: asset.id,
      lifecycleState: "trashed",
      graceHours: eligibility.graceHours,
      ageHours: eligibility.ageHours,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return json(
        {
          ok: false,
          code: "AUTHENTICATION_REQUIRED",
          error: "A valid session is required.",
        },
        401,
      );
    }

    console.error("orphan media trash error:", error);

    return json(
      {
        ok: false,
        code: "ORPHAN_TRASH_FAILED",
        error: "Media could not be moved to Trash.",
      },
      503,
    );
  }
}
