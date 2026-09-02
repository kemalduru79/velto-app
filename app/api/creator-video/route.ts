import {
  createLogger,
  getObservabilityContext,
  withObservedApiRoute,
} from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getMediaProviderFacade } from "@/lib/providers";
import {
  getCreditErrorResponse,
  markMeteredOperationProviderDispatch,
  releaseMeteredOperation,
  reserveMeteredOperation,
  settleMeteredOperation,
  type MeteredOperationReservation,
} from "@/lib/credits/serverMetering";
import { getPersistenceServices } from "@/lib/persistence";
import {
  getCreatorMediaRoute,
  isCreatorMediaActionAllowed,
  normalizeCreatorQualityMode,
} from "../../../lib/creator/mediaRouting";
import {
  createVideoJobToken,
  getVideoProvider,
} from "../../../lib/video/providers";
import { checkStorageGenerationAllowance, StorageQuotaOperationalError, storageQuotaFullResponse, storageQuotaOperationalErrorResponse } from "@/lib/persistence/media/storageQuota.server";
import {
  buildCanonicalCreatorVideoQueueInput,
  validateCreatorVideoRequestBoundary,
} from "@/lib/security/creatorVideoTaskBindingBoundary";
import { CREATOR_VIDEO_WORKER_STALE_SECONDS } from "@/lib/creator/videoGeneration";
import { buildCreatorVideoProviderPrompt } from "@/lib/creator/videoPromptPolicy";
import { calculateRunwayCost, calculateVeoCost, persistEconomicOperationBestEffort, type EconomicCostResult, type EconomicOperationInput } from "@/lib/economics";
import { inferCreatorProductionSignals } from "@/lib/creator/productionIntelligence";
import { getCreatorVideoRuntimeContext, selectCreatorVideoProfile } from "@/lib/video/creatorSmartRouting";
import { evaluateCreatorEconomicAdmission, getCreatorMarginEnforcementMode } from "@/lib/economics/economicAdmission";
import { getCreatorEconomicUsageSnapshot } from "@/lib/economics/usageService.server";

export const runtime = "nodejs";
export const maxDuration = 60;

function isHttpsAssetUrl(value: string) {
  return value.startsWith("https://");
}

function isImageDataUri(value: string) {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value);
}

function validateImageInput(value: unknown, fieldName = "imageUrl") {
  if (!value || typeof value !== "string") {
    return `${fieldName} is required`;
  }

  if (isHttpsAssetUrl(value) || isImageDataUri(value)) {
    return null;
  }

  return `${fieldName} must use HTTPS or a supported data:image URI`;
}

function optionalImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim();
}

function referenceImageUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map(optionalImageUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ).slice(0, 3);
}

function requestedRatio(body: Record<string, unknown>) {
  if (body.ratio || body.requestedRatio) {
    return body.ratio || body.requestedRatio;
  }

  return body.creatorFormat === "short_form" ? "720:1280" : "1280:720";
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (message === "This production mode does not use AI video blocks.") {
    return message;
  }

  if (/not configured|401|unauthorized|invalid api|authentication|api key/.test(normalized)) {
    return "The video production service is not configured for this environment.";
  }

  if (/402|payment|billing|credit|quota|insufficient/.test(normalized)) {
    return "The video production service has insufficient capacity for this request.";
  }

  if (/image|download|asset|url|fetch/.test(normalized)) {
    return "The video production service could not read the selected scene image.";
  }

  if (/duration|ratio|resolution|unsupported|invalid parameter/.test(normalized)) {
    return "The selected video settings are not supported by the active production route.";
  }

  if (/timeout|timed out|network|connection/.test(normalized)) {
    return "The video production service did not respond in time. Retry this scene.";
  }

  return "The CreatorLab video service could not start this motion task.";
}

async function postHandler(req: NextRequest) {
  let reservation: MeteredOperationReservation | null = null;
  let providerTaskAccepted = false;
  let providerTaskId = "";
  let providerKey = "";
  let economicCost: EconomicCostResult | null = null;
  let economicAttempt: EconomicOperationInput | null = null;

  try {
    const principal = await authenticateRequest(req);
    let requestValue: unknown;
    try {
      requestValue = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON request body." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const boundary = validateCreatorVideoRequestBoundary(requestValue);
    if (!boundary.ok) {
      return NextResponse.json(
        { ok: false, error: boundary.message },
        { status: boundary.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    const { body, projectBinding } = boundary;
    const qualityMode = normalizeCreatorQualityMode(
      body.qualityMode,
      "standard",
    );
    const mediaRoute = getCreatorMediaRoute(qualityMode);

    if (!isCreatorMediaActionAllowed(mediaRoute, "ai_video_blocks")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            qualityMode === "draft"
              ? "Draft is a text-only planning mode."
              : "AI motion blocks require Pro or Cinematic production quality.",
        },
        { status: 409 },
      );
    }

    const imageUrl = body.imageUrl;
    const imageError = validateImageInput(imageUrl);

    if (imageError) {
      return NextResponse.json(
        { ok: false, error: imageError },
        { status: 400 },
      );
    }

    const useCinematicContinuity = qualityMode === "cinematic";
    const lastFrameUrl = useCinematicContinuity
      ? optionalImageUrl(body.lastFrameUrl)
      : undefined;
    const references = useCinematicContinuity
      ? referenceImageUrls(body.referenceImageUrls)
      : [];

    for (const [fieldName, url] of [
      ["lastFrameUrl", lastFrameUrl],
      ...references.map((url, index) => [`referenceImageUrls[${index}]`, url]),
    ] as Array<[string, string | undefined]>) {
      if (!url) continue;
      const error = validateImageInput(url, fieldName);
      if (error) {
        return NextResponse.json(
          { ok: false, error },
          { status: 400 },
        );
      }
    }

    const services = getPersistenceServices();
    let canonicalProjectId: string | null = null;
    if (projectBinding.mode === "saved_project") {
      const ownedProject = await services.projectRepository.getForOwner(
        projectBinding.requestedProjectId,
        principal.id,
      );
      if (!ownedProject) {
        return NextResponse.json(
          { ok: false, error: "Project was not found." },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }
      canonicalProjectId = ownedProject.id;
    }

    const storageAllowance = await checkStorageGenerationAllowance(principal.id);
    if (!storageAllowance.allowed) return storageQuotaFullResponse(storageAllowance.storage);

    if (body.productProfile === "creatorlab") {
      const queueHealth = await services.jobQueue.getHealth(
        CREATOR_VIDEO_WORKER_STALE_SECONDS,
      );
      if (queueHealth.activeWorkers < 1) {
        return NextResponse.json(
          { ok: false, error: "Video generation is temporarily unavailable. Please try again shortly." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    if (body.productProfile === "creatorlab" && canonicalProjectId) {
      const activeDuplicate = (await services.jobQueue.listForUser(principal.id, 100)).some(
        (job) => job.projectId === canonicalProjectId &&
          ["queued", "running"].includes(job.status) &&
          String(job.payload.sceneId ?? "") === String(body.sceneId ?? ""),
      );
      if (activeDuplicate) {
        return NextResponse.json(
          { ok: false, error: "Video generation is already active for this scene." },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    const legacySelection = getMediaProviderFacade().selectCreatorVideo(mediaRoute);
    const ratio = String(requestedRatio(body));
    const productionSignals = inferCreatorProductionSignals({
      id: Number(body.sceneId) || 0,
      text: [body.text, body.emotion].filter(Boolean).join(" "),
      motionHint: String(body.motionHint || ""),
      cameraDirection: String(body.cameraDirection || ""),
      sceneRole: body.sceneRole as never,
      visualImportance: body.visualImportance as number,
      motionImportance: body.motionImportance as number,
      continuityImportance: body.continuityImportance as number,
      referenceAvailabilityCount: references.length + (lastFrameUrl ? 1 : 0),
    });
    const requestedSeconds = Number(body.duration) || 5;
    const smartRoute = selectCreatorVideoProfile({
      qualityTier: qualityMode,
      visualImportance: productionSignals.visualImportance,
      motionImportance: productionSignals.motionImportance,
      continuityImportance: productionSignals.continuityImportance,
      productionPriority: Math.round((productionSignals.visualImportance * 0.45 + productionSignals.motionImportance * 0.55) * 100) / 100,
      recommendedSeconds: requestedSeconds,
      referenceAvailabilityCount: references.length + (lastFrameUrl ? 1 : 0),
      lastFrameAvailable: Boolean(lastFrameUrl),
      requestedRatio: ratio,
      sceneRole: productionSignals.sceneRole,
    }, getCreatorVideoRuntimeContext());
    const routedProfile = body.productProfile === "creatorlab" ? smartRoute.selectedProfile : null;
    const selection = routedProfile ? {
      provider: getVideoProvider(routedProfile.provider), requestedTier: qualityMode === "cinematic" ? "premium" as const : "primary" as const,
      selectedTier: routedProfile.provider === "veo" ? "premium" as const : "primary" as const,
      usedFallback: smartRoute.reasonCodes.includes("PRE_DISPATCH_FALLBACK"), available: true, fallbackReason: null,
    } : legacySelection;

    if (body.productProfile === "creatorlab" && !routedProfile) {
      throw new Error("Video production service is not configured.");
    }

    if (!selection.available) {
      throw new Error("Video production service is not configured.");
    }

    const durationPolicy = routedProfile ? { durationSec: smartRoute.providerBilledDurationSec || requestedSeconds, reason: smartRoute.reasonCodes.join(",") } : selection.provider.normalizeDuration(body.duration, qualityMode);

    if (body.productProfile === "creatorlab") {
      const usageSnapshot = await getCreatorEconomicUsageSnapshot({ userId: principal.id, projectId: canonicalProjectId, window: canonicalProjectId ? "project_lifetime" : "current_month", tier: qualityMode === "cinematic" ? "cinematic" : "pro" });
      const admission = evaluateCreatorEconomicAdmission({
        tier: qualityMode === "cinematic" ? "cinematic" : "pro", operationType: "creator_video", estimatedProviderCostUsd: smartRoute.estimatedProviderCostUsd,
        currentActualCogsUsd: usageSnapshot.usage.actualProviderCogsUsd, currentEstimatedExposureUsd: usageSnapshot.usage.estimatedPendingProviderCogsUsd, currentCommittedExposureUsd: usageSnapshot.usage.committedEconomicExposureUsd,
        currentVideoActualCogsUsd: usageSnapshot.usage.byOperation.creator_video?.actualCogsUsd || 0, currentVideoEstimatedExposureUsd: usageSnapshot.usage.byOperation.creator_video?.estimatedCogsUsd || 0, currentVideoCommittedExposureUsd: usageSnapshot.usage.byOperation.creator_video?.committedExposureUsd || 0,
        finishedMinutes: usageSnapshot.duration.finishedMinutes, costCoverageStatus: usageSnapshot.usage.costCoverageStatus, aggregationComplete: usageSnapshot.usage.aggregationComplete, origin: "automatic", enforcementMode: getCreatorMarginEnforcementMode(),
      });
      if (usageSnapshot.duration.denominatorSource === "unavailable" || usageSnapshot.usage.unknownCostOperations > 0 || !usageSnapshot.usage.aggregationComplete) createLogger({ operation: "creator-video.economic-coverage" }).warn("Creator economic coverage is incomplete.", { missingDurationDenominator: usageSnapshot.duration.denominatorSource === "unavailable", unknownCostOperations: usageSnapshot.usage.unknownCostOperations, aggregationComplete: usageSnapshot.usage.aggregationComplete, estimatedPendingProviderCogsUsd: usageSnapshot.usage.estimatedPendingProviderCogsUsd, projectId: canonicalProjectId });
      if (admission.mode !== "allowed") {
        const admissionLogger = createLogger({ operation: "creator-video.economic-admission" });
        const metadata = { mode: admission.mode, reasonCodes: admission.reasonCodes, projectId: canonicalProjectId };
        if (admission.allowed) admissionLogger.warn("Creator video economic admission pressure.", metadata);
        else admissionLogger.error("Creator video economic admission denied.", undefined, metadata);
      }
      if (!admission.allowed) return NextResponse.json({ ok: false, code: "CREATOR_PRODUCTION_ALLOWANCE_EXCEEDED", error: "Your current production allowance cannot cover this operation." }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }

    reservation = await reserveMeteredOperation(req, {
      operationType: "creator_video",
      qualityMode,
      provider: selection.provider.key,
      referenceId: `${canonicalProjectId || `draft:${principal.id}`}:scene-${body.sceneId ?? "unknown"}:video`,
      metadata: {
        productProfile: "creatorlab",
        projectId: canonicalProjectId,
        sceneId:
          typeof body.sceneId === "string" || typeof body.sceneId === "number"
            ? body.sceneId
            : null,
        durationSec: durationPolicy.durationSec,
        engineTier: selection.selectedTier,
        profileKey: routedProfile?.profileKey || null,
        estimatedProviderCostUsd: smartRoute.estimatedProviderCostUsd,
        pricingVersion: smartRoute.pricingVersion,
      },
      billable: true,
      requireCostGuardConfirmation: true,
      admissionMode: "creator_accounting",
      accounting: {
        attemptKey: `${req.headers.get("x-idempotency-key")!.trim()}:${selection.provider.key}:generation:1`,
        route: "/api/creator-video",
        operationType: "creator_video",
        productTier: qualityMode,
        providerTier: selection.selectedTier,
        model: (routedProfile || selection.provider.getRuntimeProfile()).model,
        projectId: canonicalProjectId,
        sceneId:
          typeof body.sceneId === "string" || typeof body.sceneId === "number"
            ? body.sceneId
            : null,
      },
    });

    // Do not reject an HTTPS asset based on a HEAD request. Some signed storage
    // and CDN URLs reject HEAD while remaining fully downloadable by providers.
    const task = await selection.provider.createTask({
      imageUrl: imageUrl as string,
      lastFrameUrl,
      referenceImageUrls: references,
      promptText: buildCreatorVideoProviderPrompt(body),
      requestedRatio: requestedRatio(body),
      durationSec: durationPolicy.durationSec,
      runtimeProfile: routedProfile ? { model: routedProfile.model, resolution: routedProfile.resolution, audioMode: routedProfile.audioMode, profileKey: routedProfile.profileKey, pricingVersion: smartRoute.pricingVersion || undefined } : undefined,
    });

    if (!task.nativeTaskId) {
      throw new Error("Video service did not return a task identifier.");
    }

    // VELTO_CANCEL_P1_1 — once the provider accepts the task, cost exposure
    // exists. From this point forward the Velto reservation must be settled,
    // not released merely because the user later stops the task.
    providerTaskAccepted = true;
    providerTaskId = task.nativeTaskId;
    providerKey = selection.provider.key;
    const profile = routedProfile || selection.provider.getRuntimeProfile();
    const calculatedCost = selection.provider.key === "runway" ? calculateRunwayCost(profile.model, durationPolicy.durationSec, profile.resolution) : calculateVeoCost(profile.model, profile.resolution, durationPolicy.durationSec);
    economicCost = selection.provider.key === "veo" && calculatedCost.costStatus === "exact" ? { ...calculatedCost, costStatus: "estimated", reason: "Google Veo becomes actual COGS only after successful generation." } : calculatedCost;
    const logicalOperationId = req.headers.get("x-idempotency-key")?.trim() || reservation?.reservationId || `video:${task.nativeTaskId}`;
    economicAttempt = {
      attemptKey: `${logicalOperationId}:${selection.provider.key}:generation:1`, logicalOperationId, idempotencyKey: req.headers.get("x-idempotency-key"), creditReservationId: reservation?.reservationId,
      userId: principal.id, projectId: canonicalProjectId, sceneId: body.sceneId == null ? null : String(body.sceneId), route: "/api/creator-video", operationType: "creator_video", productTier: qualityMode,
      provider: selection.provider.key, providerTier: selection.selectedTier, model: profile.model, fallbackProvider: selection.usedFallback ? selection.provider.key : null,
      providerRequestId: task.nativeTaskId, state: selection.provider.key === "veo" ? "provider_accepted" : "provider_billed", billingMoment: selection.provider.key === "veo" ? "successful_generation" : "provider_dispatch", fallbackAttempt: selection.usedFallback,
      quantities: { profileKey: routedProfile?.profileKey || "legacy", requestedSeconds: Number(body.duration) || 0, providerBilledSeconds: durationPolicy.durationSec, resolution: profile.resolution, audioMode: profile.audioMode, referenceCount: references.length + (lastFrameUrl ? 1 : 0), requestCount: 1, routingReasonCodes: smartRoute.reasonCodes.join(","), fallbackChain: smartRoute.fallbackProfiles.join(",") },
      cost: economicCost, dispatchedAt: new Date().toISOString(), providerAcceptedAt: new Date().toISOString(),
    };
    await persistEconomicOperationBestEffort(economicAttempt!);

    // FIN-P1C — persist the provider-dispatch boundary before queue creation.
    // If the queue or immediate settlement path fails, reconciliation can still
    // identify this reservation as billable and settle it exactly once.
    if (reservation) {
      try {
        await markMeteredOperationProviderDispatch(
          reservation,
          task.nativeTaskId,
          {
            route: "creator-video",
            billingMoment: "provider_dispatch",
            provider: selection.provider.key,
            providerTaskAcceptedAt: new Date().toISOString(),
          },
        );
      } catch {
        // Do not hide an accepted provider task from the user merely because
        // the marker write was temporarily unavailable. The queue payload and
        // immediate settlement path provide two additional reconciliation paths.
        createLogger({ operation: "creator-video.dispatch-marker" }).error(
          "Provider dispatch marker failed.",
        );
      }
    }

    const publicTaskId = createVideoJobToken(
      selection.provider.key,
      task.nativeTaskId,
    );
    const requestKey =
      req.headers.get("x-idempotency-key")?.trim() ||
      `creator-video:${publicTaskId}`;
    const canonicalQueueInput = buildCanonicalCreatorVideoQueueInput({
      userId: principal.id,
      canonicalProjectId,
      publicTaskId,
      nativeTaskId: task.nativeTaskId,
      provider: selection.provider.key,
      sceneId: body.sceneId ?? null,
      creatorSceneId: typeof body.creatorSceneId === "string" ? body.creatorSceneId : null,
      qualityMode,
      creditReservationId: reservation?.reservationId || null,
      reservedCredits: reservation?.reservedCredits || 0,
      traceId: getObservabilityContext().traceId || null,
      runtimeProfile: { profileKey: routedProfile?.profileKey || "legacy", provider: selection.provider.key, model: profile.model, resolution: profile.resolution, audioMode: profile.audioMode, requestedDurationSec: Number(body.duration) || 0, providerBilledDurationSec: durationPolicy.durationSec, pricingVersion: economicCost.pricingVersion, estimatedProviderCostUsd: economicCost.providerCostUsd, economicAttemptKey: economicAttempt.attemptKey, logicalOperationId, creditReservationId: reservation?.reservationId || null, dispatchedAt: economicAttempt.dispatchedAt, providerAcceptedAt: economicAttempt.providerAcceptedAt, fallbackAttempt: selection.usedFallback },
    });
    const queueJob = await services.jobQueue.enqueue({
      userId: canonicalQueueInput.userId,
      projectId: canonicalQueueInput.projectId,
      jobType: "video_reconcile",
      priority: 200,
      maxAttempts: 120,
      idempotencyKey: `video-reconcile:${requestKey}`,
      payload: canonicalQueueInput.payload,
    });

    const chargedCredits = reservation?.reservedCredits || 0;
    let creditAccount = reservation?.accountAfterReserve || null;
    let settlementPending = false;

    if (reservation) {
      try {
        const settlement = await settleMeteredOperation(reservation, {
          providerCostUsd: selection.provider.key === "runway" ? economicCost.providerCostUsd ?? undefined : undefined,
          providerRequestId: task.nativeTaskId,
          metadata: {
            route: "creator-video",
            billingMoment: "provider_dispatch",
            queueJobId: queueJob.id,
            provider: selection.provider.key,
          },
        });
        creditAccount = settlement?.account || null;
      } catch {
        // The provider task and reconciliation job already exist. Keep the
        // reservation attached to the job; the worker repeats the idempotent
        // settlement before its first provider-status check.
        settlementPending = true;
        createLogger({ operation: "creator-video.credit-settlement" }).error(
          "Dispatch credit settlement was deferred.",
        );
      }
    }

    reservation = null;

    return NextResponse.json({
      ok: true,
      queueJobId: queueJob.id,
      status: task.status || "PENDING",
      duration: durationPolicy.durationSec,
      durationPolicy,
      engineTier: selection.selectedTier,
      premiumFallbackUsed: selection.usedFallback,
      credits: creditAccount
        ? {
            chargedCredits,
            reservedCredits: settlementPending ? chargedCredits : 0,
            settlementPending,
            account: creditAccount,
          }
        : { chargedCredits: 0, reservedCredits: 0, settlementPending: false },
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (error instanceof StorageQuotaOperationalError) return storageQuotaOperationalErrorResponse(error);

    if (reservation) {
      if (providerTaskAccepted) {
        if (economicAttempt) await persistEconomicOperationBestEffort({ ...economicAttempt, state: "application_failed_after_provider_cost", ambiguityReason: error instanceof Error ? error.message : "startup_failure", failedAt: new Date().toISOString() });
        // A provider task was accepted, therefore provider cost may already
        // exist. Do not release the reservation. Settle best-effort so Velto
        // billing follows the provider dispatch boundary.
        try {
          await settleMeteredOperation(reservation, {
            providerCostUsd: economicCost?.providerCostUsd ?? undefined,
            providerRequestId: providerTaskId || undefined,
            metadata: {
              route: "creator-video",
              billingMoment: "provider_dispatch",
              provider: providerKey || null,
              startupError: error instanceof Error ? error.message : "unknown",
            },
          });
        } catch {
          createLogger({ operation: "creator-video.credit-settlement" }).error(
            "Accepted-task credit settlement failed.",
          );
        }
      } else {
        await releaseMeteredOperation(reservation, "video_generation_start_failed", {
          route: "creator-video",
        });
      }
    }

    const creditErrorResponse = getCreditErrorResponse(error);
    if (creditErrorResponse) return creditErrorResponse;

    createLogger({ operation: "creator-video.create" }).error(
      "Creator video creation failed.",
    );

    return NextResponse.json(
      { ok: false, error: publicError(error) },
      { status: 500 },
    );
  }
}

async function noStorePostHandler(req: NextRequest) {
  const response = await postHandler(req);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const POST = withObservedApiRoute(
  "api.creator-video.create",
  noStorePostHandler,
);
