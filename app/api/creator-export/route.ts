import { NextResponse } from "next/server";
import {
  getCreditErrorResponse,
  releaseMeteredOperation,
  reserveMeteredOperation,
  settleMeteredOperation,
  type MeteredOperationReservation,
} from "@/lib/credits/serverMetering";
import { normalizeCreatorBackgroundMusicConfig } from "@/lib/creator/backgroundMusic";
import {
  isCreatorPremiumMusicTrackId,
} from "@/lib/creator/musicLibrary";
import { authenticateRequest } from "@/lib/auth/server";
import { resolveCreatorPremiumMusicExportEntitlement } from "@/lib/creator/musicEntitlement";
import { isPremiumMusicAcquisitionEnabled } from "@/lib/providers/music/downloadSecurity";
import { buildCreatorMusicUsageEventIdentity, registerCreatorMusicExportUsage } from "@/lib/creator/musicUsage";
import type { CreatorMusicUsageEventIdentity } from "@/lib/persistence/music";
import { CreatorExportSceneError, resolveCanonicalCreatorExportScenes } from "@/lib/creator/exportScenes";
import { fingerprintCreatorMedia } from "@/lib/creator/mediaFingerprint.server";
import { getPersistenceServices } from "@/lib/persistence";
import {
  FinalMovieStorageAdmissionError,
  getFinalMovieInternalToken,
  ownedFinalMovieHeaders,
  registerOwnedFinalMovieResponse,
} from "@/lib/creator/finalMovieOwnership.server";
import { checkStorageGenerationAllowance, storageQuotaFullResponse } from "@/lib/persistence/media/storageQuota.server";
import { issueStorageAdmissionForOwner } from "@/lib/persistence/media/storageAdmission.server";

export const runtime = "nodejs";
export const maxDuration = 60;

// 3Q FINAL PRODUCTION GATE
const EXPORT_HEALTH_TIMEOUT_MS = 4_000;

class ExportServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportServiceUnavailableError";
  }
}

function getExportApiBase() {
  const value =
    process.env.EXPORT_API_URL || process.env.NEXT_PUBLIC_EXPORT_API_URL || "";

  if (!value.trim()) {
    throw new ExportServiceUnavailableError(
      "Final video service URL is not configured.",
    );
  }

  const parsed = new URL(value.trim());
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ExportServiceUnavailableError(
      "Final video service URL is invalid.",
    );
  }

  return parsed.toString().replace(/\/$/, "");
}

async function assertExportServiceReady(baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(EXPORT_HEALTH_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => null);
    const compatible =
      data?.stitchContinuityVersion === "3N-4" &&
      data?.finalProductionGateCompatible === true;

    if (!response.ok || data?.ok !== true || !compatible) {
      throw new ExportServiceUnavailableError(
        "Final video service is not ready for the current production continuity release.",
      );
    }
  } catch (error) {
    if (error instanceof ExportServiceUnavailableError) throw error;
    throw new ExportServiceUnavailableError(
      "Final video service is currently unavailable. No export credit was reserved.",
    );
  }
}

export async function POST(request: Request) {
  let creditReservation: MeteredOperationReservation | null = null;

  try {
    const principal = await authenticateRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const requestedProjectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!requestedProjectId) {
      return NextResponse.json({ ok: false, error: "Project was not found.", creditReserved: false }, { status: 404 });
    }
    const project = await getPersistenceServices().projectRepository.getForOwner(requestedProjectId, principal.id);
    if (!project) {
      return NextResponse.json({ ok: false, error: "Project was not found.", creditReserved: false }, { status: 404 });
    }
    const productProfile =
      body.productProfile === "creatorlab" ? "creatorlab" : "storyverse";
    const qualityMode = body.qualityMode;
    const exportPayload = { ...body };
    exportPayload.projectId = project.id;
    delete exportPayload.ownerUserId;
    delete exportPayload.userId;
    delete exportPayload.qualityMode;
    delete exportPayload.musicEntitlement;
    delete exportPayload.musicAsset;
    delete exportPayload.musicStorage;
    delete exportPayload.storageAdmissionId;
    delete exportPayload.consumptionToken;
    delete exportPayload.storageBucket;
    delete exportPayload.storagePath;
    if (productProfile === "creatorlab") {
      try {
        exportPayload.scenes = resolveCanonicalCreatorExportScenes(
          Array.isArray(body.scenes) ? body.scenes.filter(
            (scene): scene is Record<string, unknown> => Boolean(scene && typeof scene === "object" && !Array.isArray(scene)),
          ) : [],
        ).map((scene) => {
          const selectedMediaUrl = scene.exportSource === "video" ? scene.videoUrl : scene.image;
          const mediaIdentity = fingerprintCreatorMedia(selectedMediaUrl);
          if (process.env.NODE_ENV !== "production") {
            console.info("Creator export scene", {
              scene: scene.creatorSceneId.slice(0, 12),
              mode: scene.exportSource,
              media: mediaIdentity,
            });
          }
          return { ...scene, mediaIdentity };
        });
      } catch (error) {
        if (error instanceof CreatorExportSceneError) {
          return NextResponse.json(
            { ok: false, code: "creator_export_scene_identity_invalid", error: "Final video scene sequence is invalid.", creditReserved: false },
            { status: 409 },
          );
        }
        throw error;
      }
    }
    const internalExportToken = getFinalMovieInternalToken();
    let musicUsageIdentity: CreatorMusicUsageEventIdentity | null = null;
    if (productProfile === "creatorlab") {
      const backgroundMusic = normalizeCreatorBackgroundMusicConfig(
        body.backgroundMusic,
        [],
        isCreatorPremiumMusicTrackId,
      );
      if (backgroundMusic.mode === "selected") {
        const blockPremiumMusicExport = () => NextResponse.json(
          { ok: false, code: "creator_premium_music_confirmation_required", error: "Premium music must be confirmed before final export.", creditReserved: false },
          { status: 409 },
        );
        if (!isPremiumMusicAcquisitionEnabled()) return blockPremiumMusicExport();
        let musicEntitlement;
        try {
          musicEntitlement = await resolveCreatorPremiumMusicExportEntitlement({
            userId: principal.id,
            projectId: project.id,
            trackId: backgroundMusic.selectedTrackId,
          });
        } catch {
          return blockPremiumMusicExport();
        }
        if (!musicEntitlement) return blockPremiumMusicExport();
        musicUsageIdentity = buildCreatorMusicUsageEventIdentity({
          entitlementId: musicEntitlement.entitlementId,
          userId: principal.id,
          projectId: project.id,
          trackId: musicEntitlement.trackId,
          exportIdempotencyKey: request.headers.get("x-idempotency-key"),
        });
        if (!musicUsageIdentity) return blockPremiumMusicExport();
        exportPayload.musicEntitlement = musicEntitlement;
      }
      exportPayload.backgroundMusic = backgroundMusic;
    } else {
      delete exportPayload.backgroundMusic;
    }

    const exportApiBase = getExportApiBase();

    // The service check intentionally runs before credit reservation.
    await assertExportServiceReady(exportApiBase);

    let storageAdmissionId: string;
    try {
      const storageAllowance = await checkStorageGenerationAllowance(principal.id);
      if (!storageAllowance.allowed) return storageQuotaFullResponse(storageAllowance.storage);
      ({ storageAdmissionId } = await issueStorageAdmissionForOwner({
        ownerUserId: principal.id,
        mediaKind: "video",
        purpose: "final_movie_export",
        projectReference: project.id,
        metadata: { productProfile, operation: "final_movie_export" },
      }));
    } catch {
      throw new FinalMovieStorageAdmissionError();
    }

    creditReservation = await reserveMeteredOperation(request, {
      operationType: "creator_export",
      qualityMode,
      provider: "velto-export",
      referenceId:
        typeof body.projectId === "string" ? body.projectId : undefined,
      metadata: {
        sceneCount: Array.isArray(exportPayload.scenes) ? exportPayload.scenes.length : 0,
        finalProductionGate: "3Q",
      },
      billable: productProfile === "creatorlab",
      requireCostGuardConfirmation: productProfile === "creatorlab",
    });

    const response = await fetch(`${exportApiBase}/export-movie`, {
      method: "POST",
      headers: ownedFinalMovieHeaders(principal.id, project.id, internalExportToken, storageAdmissionId),
      body: JSON.stringify(exportPayload),
      signal: AbortSignal.timeout(55_000),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok || !data?.movieUrl) {
      throw new Error(data?.error || "Film export işlemi başarısız oldu.");
    }

    await registerOwnedFinalMovieResponse({ data, ownerUserId: principal.id, projectId: project.id });

    if (musicUsageIdentity) {
      await registerCreatorMusicExportUsage(musicUsageIdentity);
    }

    const creditResult = creditReservation
      ? await settleMeteredOperation(creditReservation, {
          providerRequestId:
            response.headers.get("x-request-id") ||
            response.headers.get("request-id") ||
            undefined,
          metadata: {
            movieUrlCreated: true,
            sceneCount: data.sceneCount,
            finalProductionGate: "3Q",
          },
        })
      : null;

    return NextResponse.json({
      ...data,
      finalProductionGate: { version: "3Q", status: "passed" },
      creditAccount: creditResult?.account || null,
      creditUsage: creditReservation
        ? {
            operationType: creditReservation.operationType,
            credits: creditReservation.reservedCredits,
          }
        : null,
    });
  } catch (error) {
    if (creditReservation) {
      await releaseMeteredOperation(
        creditReservation,
        error instanceof Error ? error.message : "creator export failed",
      );
    }

    if (error instanceof ExportServiceUnavailableError) {
      return NextResponse.json(
        {
          ok: false,
          code: "creator_export_service_unavailable",
          error: error.message,
          creditReserved: false,
          finalProductionGate: { version: "3Q", status: "blocked" },
        },
        { status: 503 },
      );
    }

    if (error instanceof FinalMovieStorageAdmissionError) {
      return NextResponse.json(
        { ok: false, code: "STORAGE_ADMISSION_UNAVAILABLE", error: error.message, creditReserved: false },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const creditResponse = getCreditErrorResponse(error);
    if (creditResponse) return creditResponse;

    console.error("creator-export error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Film export işlemi tamamlanamadı.",
      },
      { status: 500 },
    );
  }
}
