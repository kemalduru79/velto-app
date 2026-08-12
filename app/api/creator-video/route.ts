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
} from "../../../lib/video/providers";
import {
  buildCanonicalCreatorVideoQueueInput,
  validateCreatorVideoRequestBoundary,
} from "@/lib/security/creatorVideoTaskBindingBoundary";
import { CREATOR_VIDEO_WORKER_STALE_SECONDS } from "@/lib/creator/videoGeneration";
import { buildCreatorVideoProviderPrompt } from "@/lib/creator/videoPromptPolicy";

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

    const selection = getMediaProviderFacade().selectCreatorVideo(mediaRoute);

    if (!selection.available) {
      throw new Error("Video production service is not configured.");
    }

    const durationPolicy = selection.provider.normalizeDuration(
      body.duration,
      qualityMode,
    );

    reservation = await reserveMeteredOperation(req, {
      operationType: "creator_video",
      qualityMode,
      provider: selection.provider.key,
      referenceId: `${canonicalProjectId || `draft:${principal.id}`}:scene-${body.sceneId ?? "unknown"}:video`,
      metadata: {
        productProfile: "creatorlab",
        projectId: canonicalProjectId,
        sceneId: body.sceneId ?? null,
        durationSec: durationPolicy.durationSec,
        engineTier: selection.selectedTier,
      },
      billable: true,
      requireCostGuardConfirmation: true,
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
          providerRequestId: task.nativeTaskId,
          metadata: {
            route: "creator-video",
            billingMoment: "provider_dispatch",
            queueJobId: queueJob.id,
            provider: selection.provider.key,
          },
        });
        creditAccount = settlement.account;
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

    if (reservation) {
      if (providerTaskAccepted) {
        // A provider task was accepted, therefore provider cost may already
        // exist. Do not release the reservation. Settle best-effort so Velto
        // billing follows the provider dispatch boundary.
        try {
          await settleMeteredOperation(reservation, {
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
