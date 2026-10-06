import { NextResponse } from "next/server";
import {
  getCreditErrorResponse,
  releaseMeteredOperation,
  reserveMeteredOperation,
  settleMeteredOperation,
  type MeteredOperationReservation,
} from "@/lib/credits/serverMetering";
import { CreatorAudioTimelineError, validateCreatorAudioTimelineTopology } from "@/lib/creator/audioTimeline";
import { readCreatorProjectState } from "@/lib/creator/projectState";
import { authenticateRequest } from "@/lib/auth/server";
import { CreatorAudioRenderabilityError, resolveCreatorAudioRenderability } from "@/lib/creator/audioRenderability.server";
import { buildCreatorMusicUsageEventIdentity, registerCreatorMusicExportUsage } from "@/lib/creator/musicUsage";
import type { CreatorMusicUsageEventIdentity } from "@/lib/persistence/music";
import { CreatorExportSceneError, resolveCanonicalCreatorExportScenes } from "@/lib/creator/exportScenes";
import { createCreatorVisualCoveragePlan, resolveCreatorVisualCoverageTargetDuration } from "@/lib/creator/visualCoverage";
import {
  auditCreatorProgramEditorialBalance,
  resolveCreatorProgramVisualRhythm,
} from "@/lib/creator/programEditorialPolish";
import { fingerprintCreatorMedia } from "@/lib/creator/mediaFingerprint.server";
import {
  creatorGovernanceExportBlockResponse,
  resolveCreatorProjectUsedMediaGovernance,
} from "@/lib/creator/usedMediaGovernance.server";
import { getPersistenceServices } from "@/lib/persistence";
import {
  FinalMovieStorageAdmissionError,
  getFinalMovieInternalToken,
  ownedFinalMovieHeaders,
  registerOwnedFinalMovieResponse,
} from "@/lib/creator/finalMovieOwnership.server";
import { checkStorageGenerationAllowance, StorageQuotaOperationalError, storageQuotaFullResponse, storageQuotaOperationalErrorResponse } from "@/lib/persistence/media/storageQuota.server";
import { issueStorageAdmissionForOwner } from "@/lib/persistence/media/storageAdmission.server";
import { persistEconomicOperationBestEffort, unknownCost, type EconomicOperationInput } from "@/lib/economics";

export const runtime = "nodejs";
export const maxDuration = 300;

// 3Q FINAL PRODUCTION GATE
const EXPORT_HEALTH_TIMEOUT_MS = 4_000;
const EXPORT_RENDER_TIMEOUT_MS = 270_000;

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
  let exportDispatched = false;
  let economicAttempt: EconomicOperationInput | null = null;

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
    const productProfile = project.flow_type === "creator_lab"
      ? "creatorlab"
      : body.productProfile === "creatorlab"
        ? "creatorlab"
        : "storyverse";
    const persistedCreatorState = productProfile === "creatorlab" ? readCreatorProjectState(project) : null;
    const authoritativeCreatorFormat =
      productProfile === "creatorlab"
        ? persistedCreatorState?.brief.format === "youtube_video"
          ? "youtube_video"
          : persistedCreatorState?.brief.format === "short_form"
            ? "short_form"
            : null
        : null;

    if (productProfile === "creatorlab" && !authoritativeCreatorFormat) {
      return NextResponse.json(
        {
          ok: false,
          code: "creator_format_invalid",
          error: "Creator project format is invalid.",
          creditReserved: false,
        },
        {
          status: 409,
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
          },
        },
      );
    }

    if (productProfile === "creatorlab") {
      const audioTopology = validateCreatorAudioTimelineTopology({
        timeline: persistedCreatorState?.production.audioTimeline,
        sceneIds: (persistedCreatorState?.createReview.scenes || []).map((scene) => {
          if (!scene || typeof scene !== "object" || Array.isArray(scene)) return "";
          const creatorSceneId = (scene as Record<string, unknown>).creatorSceneId;
          return typeof creatorSceneId === "string" ? creatorSceneId.trim() : "";
        }),
      });
      if (audioTopology.status !== "ready") {
        return NextResponse.json(
          {
            ok: false,
            code: "creator_audio_topology_invalid",
            error: "Project audio is out of sync with the current scene plan.",
            creditReserved: false,
            issues: audioTopology.issues.map((issue) => issue.code),
          },
          { status: 409, headers: { "Cache-Control": "private, no-store, max-age=0" } },
        );
      }
    }
    const qualityMode = body.qualityMode;
    const evidenceGovernance = project.flow_type === "creator_lab"
      ? (await resolveCreatorProjectUsedMediaGovernance({
          ownerUserId: principal.id,
          project,
        })).governance
      : null;
    if (evidenceGovernance?.status === "blocked") {
      return NextResponse.json(
        creatorGovernanceExportBlockResponse(evidenceGovernance),
        { status: 409, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    let programEditorialPolish: ReturnType<
      typeof auditCreatorProgramEditorialBalance
    > | null = null;

    const exportPayload = { ...body };
    exportPayload.projectId = project.id;
    if (authoritativeCreatorFormat) {
      exportPayload.creatorFormat = authoritativeCreatorFormat;
    }
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
      const persistedScenes = new Map(
        (persistedCreatorState?.createReview.scenes || []).flatMap((scene) => {
          if (!scene || typeof scene !== "object" || Array.isArray(scene)) return [];
          const value = scene as Record<string, unknown>;
          return typeof value.creatorSceneId === "string" && value.creatorSceneId.trim()
            ? [[value.creatorSceneId.trim(), value] as const]
            : [];
        }),
      );
      try {
        const canonicalExportScenes = resolveCanonicalCreatorExportScenes(
          Array.isArray(body.scenes) ? body.scenes.filter(
            (scene): scene is Record<string, unknown> => Boolean(scene && typeof scene === "object" && !Array.isArray(scene)),
          ).map((scene) => {
            const creatorSceneId = typeof scene.creatorSceneId === "string" ? scene.creatorSceneId.trim() : "";
            const persistedScene = persistedScenes.get(creatorSceneId);
            return persistedScene ? { ...scene, assetHistory: persistedScene.assetHistory } : scene;
          }) : [],
        );

        const resolvedExportScenes = canonicalExportScenes.map(
          (scene, sceneIndex, canonicalScenes) => {
          const selectedMediaUrl = scene.exportSource === "video" ? scene.videoUrl : scene.image;
          const previousScene = sceneIndex > 0 ? canonicalScenes[sceneIndex - 1] : undefined;
          const previousSelectedMediaUrl = previousScene
            ? previousScene.exportSource === "video"
              ? previousScene.videoUrl
              : previousScene.image
            : "";
          const programRhythm = resolveCreatorProgramVisualRhythm({
            sceneIndex,
            sceneCount: canonicalScenes.length,
            selectedMediaUrl,
            previousSelectedMediaUrl,
          });
          const mediaIdentity = fingerprintCreatorMedia(selectedMediaUrl);
          if (process.env.NODE_ENV !== "production") {
            console.info("Creator export scene", {
              scene: scene.creatorSceneId.slice(0, 12),
              mode: scene.exportSource,
              media: mediaIdentity,
            });
          }
          const persistedScene = persistedScenes.get(scene.creatorSceneId);
          if (!persistedScene) throw new CreatorExportSceneError("invalid_scene_identity");
          const persistedTiming = persistedScene.timing && typeof persistedScene.timing === "object" && !Array.isArray(persistedScene.timing)
            ? persistedScene.timing as { targetSceneDuration?: number }
            : undefined;
          const visualCoveragePlan = createCreatorVisualCoveragePlan({
            creatorSceneId: scene.creatorSceneId,
            image: typeof persistedScene.image === "string" ? persistedScene.image : undefined,
            videoUrl: typeof persistedScene.videoUrl === "string" ? persistedScene.videoUrl : undefined,
            videoStatus: typeof persistedScene.videoStatus === "string" ? persistedScene.videoStatus : undefined,
            videoDurationSeconds: Number(persistedScene.videoDurationSeconds),
            clipInSec: typeof persistedScene.clipInSec === "number" && Number.isFinite(persistedScene.clipInSec)
              ? Number(persistedScene.clipInSec)
              : undefined,
            clipOutSec: typeof persistedScene.clipOutSec === "number" && Number.isFinite(persistedScene.clipOutSec)
              ? Number(persistedScene.clipOutSec)
              : undefined,
            targetDurationSec: resolveCreatorVisualCoverageTargetDuration({
              timingTargetDurationSec: persistedTiming?.targetSceneDuration,
              fallbackTargetDurationSec: persistedScene.targetDurationSec,
            }),
            timing: persistedTiming,
            selectedSource: scene.exportSource === "video" ? "video" : "image",
            assetHistory: Array.isArray(persistedScene.assetHistory) ? persistedScene.assetHistory : undefined,
            visualBlockPlan: Array.isArray(persistedScene.visualBlockPlan) ? persistedScene.visualBlockPlan : undefined,
          }, {
            editorialCadence: authoritativeCreatorFormat === "youtube_video",
            motionPresetOffset: programRhythm.motionPresetOffset,
          });
            return {
              ...scene,
              image: typeof persistedScene.image === "string" ? persistedScene.image : "",
              videoUrl: typeof persistedScene.videoUrl === "string" ? persistedScene.videoUrl : "",
              visualCoveragePlan,
              narration: persistedScene.narration,
              dialogue: persistedScene.dialogue,
              audioUrl: persistedScene.audioUrl,
              dialogueAudioUrl: persistedScene.dialogueAudioUrl,
              mediaIdentity,
            };
          },
        );

        exportPayload.scenes = resolvedExportScenes;

        if (authoritativeCreatorFormat === "youtube_video") {
          programEditorialPolish = auditCreatorProgramEditorialBalance(
            resolvedExportScenes.map((scene) => ({
              creatorSceneId: scene.creatorSceneId,
              selectedMediaUrl:
                scene.exportSource === "video"
                  ? scene.videoUrl
                  : scene.image,
              selectedSource: scene.exportSource,
            })),
          );
        }
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
    const musicUsageIdentities: CreatorMusicUsageEventIdentity[] = [];
    if (productProfile === "creatorlab") {
      const renderability = await resolveCreatorAudioRenderability({
        ownerUserId: principal.id,
        projectId: project.id,
        timeline: persistedCreatorState?.production.audioTimeline,
      });
      for (const asset of renderability.assets) {
        if (asset.kind !== "licensed") continue;
        const usageIdentity = buildCreatorMusicUsageEventIdentity({
          entitlementId: asset.entitlementId, userId: principal.id, projectId: project.id,
          trackId: asset.trackId, exportIdempotencyKey: request.headers.get("x-idempotency-key"),
        });
        if (!usageIdentity) throw new CreatorAudioRenderabilityError("creator_audio_acquisition_required");
        musicUsageIdentities.push(usageIdentity);
      }
      exportPayload.audioTimeline = renderability.timeline;
      exportPayload.creatorAudioAssets = renderability.assets;
      delete exportPayload.backgroundMusic;
    } else {
      delete exportPayload.backgroundMusic;
      delete exportPayload.audioTimeline;
      delete exportPayload.creatorAudioAssets;
    }

    const exportApiBase = getExportApiBase();

    // The service and governance checks intentionally run before credit reservation.
    await assertExportServiceReady(exportApiBase);

    const storageAllowance = await checkStorageGenerationAllowance(principal.id);
    if (!storageAllowance.allowed) return storageQuotaFullResponse(storageAllowance.storage);
    let storageAdmissionId: string;
    try {
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
        evidenceGovernanceStatus: evidenceGovernance?.status || "not_applicable",
      },
      billable: productProfile === "creatorlab",
      requireCostGuardConfirmation: productProfile === "creatorlab",
      admissionMode: productProfile === "creatorlab" ? "creator_accounting" : "balance_backed",
      accounting: productProfile === "creatorlab" ? {
        attemptKey: `${request.headers.get("x-idempotency-key")!.trim()}:velto-export:1`,
        route: "/api/creator-export",
        operationType: "creator_export",
        productTier: String(qualityMode || "standard"),
        providerTier: "infrastructure",
        model: "ffmpeg-1280x720-25fps",
        projectId: project.id,
      } : undefined,
    });
    const logicalExportId = request.headers.get("x-idempotency-key")?.trim() || creditReservation?.reservationId || `export:${crypto.randomUUID()}`;
    exportPayload.economicExportId = logicalExportId;
    economicAttempt = { attemptKey: `${logicalExportId}:velto-export:1`, logicalOperationId: logicalExportId, idempotencyKey: request.headers.get("x-idempotency-key"), creditReservationId: creditReservation?.reservationId,
      userId: principal.id, projectId: project.id, exportId: logicalExportId, route: "/api/creator-export", operationType: "creator_export", productTier: String(qualityMode || "standard"), provider: "velto-export", providerTier: "infrastructure", model: "ffmpeg-1280x720-25fps", state: "dispatch_attempted", billingMoment: "render_runtime", quantities: { sceneCount: Array.isArray(exportPayload.scenes) ? exportPayload.scenes.length : 0, requestCount: 1, evidenceGovernanceStatus: evidenceGovernance?.status || "not_applicable" }, cost: unknownCost("Railway runtime, Supabase storage, and egress rates are not approved."), dispatchedAt: new Date().toISOString() };
    await persistEconomicOperationBestEffort(economicAttempt);

    exportDispatched = true;
    const response = await fetch(`${exportApiBase}/export-movie`, {
      method: "POST",
      headers: ownedFinalMovieHeaders(principal.id, project.id, internalExportToken, storageAdmissionId),
      body: JSON.stringify(exportPayload),
      signal: AbortSignal.timeout(EXPORT_RENDER_TIMEOUT_MS),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok || !data?.movieUrl) {
      throw new Error(data?.error || "Film export işlemi başarısız oldu.");
    }

    await registerOwnedFinalMovieResponse({ data, ownerUserId: principal.id, projectId: project.id });
    economicAttempt = { ...economicAttempt, state: "provider_billed", providerRequestId: response.headers.get("x-request-id") || response.headers.get("request-id"), assetIdentity: data.storagePath,
      quantities: { ...economicAttempt.quantities, sceneCount: Number(data.sceneCount || 0), timelineDurationSec: Number(data.durationSeconds || 0), outputBytes: Number(data.sizeBytes || 0), uploadBytes: Number(data.sizeBytes || 0), elapsedRuntimeMs: Number(data.elapsedRuntimeMs || 0), storageBytes: Number(data.sizeBytes || 0) },
      providerAcceptedAt: data.renderStartedAt || new Date().toISOString(), completedAt: data.renderCompletedAt || new Date().toISOString() };
    await persistEconomicOperationBestEffort(economicAttempt);

    for (const musicUsageIdentity of musicUsageIdentities) {
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
            evidenceGovernanceStatus: evidenceGovernance?.status || "not_applicable",
          },
        })
      : null;

    return NextResponse.json({
      ...data,
      finalProductionGate: {
        version: "3Q",
        status: "passed",
        evidenceGovernanceStatus: evidenceGovernance?.status || "not_applicable",
      },
      evidenceGovernance: evidenceGovernance
        ? {
            version: evidenceGovernance.version,
            status: evidenceGovernance.status,
            requiresManualReview: evidenceGovernance.requiresManualReview,
            blockedIssueCount: evidenceGovernance.blockedIssueCount,
            reviewIssueCount: evidenceGovernance.reviewIssueCount,
          }
        : null,
      programEditorialPolish,
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
      if (exportDispatched) {
        if (economicAttempt) await persistEconomicOperationBestEffort({ ...economicAttempt, state: "application_failed_after_provider_cost", ambiguityReason: error instanceof Error ? error.message : "export_dispatch_ambiguous", failedAt: new Date().toISOString() });
        try { await settleMeteredOperation(creditReservation, { metadata: { applicationFailedAfterProviderCost: true, exportDispatchAmbiguous: true } }); } catch {}
      } else await releaseMeteredOperation(creditReservation, error instanceof Error ? error.message : "creator export failed");
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
    if (error instanceof CreatorAudioRenderabilityError || error instanceof CreatorAudioTimelineError) {
      return NextResponse.json(
        { ok: false, code: error instanceof CreatorAudioRenderabilityError ? error.code : "creator_audio_timeline_invalid", error: error.message, creditReserved: false },
        { status: 409 },
      );
    }

    if (error instanceof FinalMovieStorageAdmissionError) {
      return NextResponse.json(
        { ok: false, code: "STORAGE_ADMISSION_UNAVAILABLE", error: error.message, creditReserved: false },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (error instanceof StorageQuotaOperationalError) return storageQuotaOperationalErrorResponse(error);

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
