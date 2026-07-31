import { withObservedApiRoute } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import type { CreditAccount } from "@/lib/credits/types";
import type { VeltoJobRecord } from "@/lib/persistence/jobs";
import {
  getVideoProvider,
  parseVideoJobToken,
  type VideoProviderKey,
} from "@/lib/video/providers";

// VELTO_CANCEL_P1 — owner-scoped provider and credit cancellation
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicJob(job: VeltoJobRecord) {
  return {
    id: job.id,
    projectId: job.projectId,
    jobType: job.jobType,
    status: job.status,
    result: job.result,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function routeError(error: unknown, fallback: string) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 401 },
    );
  }

  console.error("job route error:", error);

  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : fallback,
    },
    { status: 500 },
  );
}

async function getHandler(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const principal = await authenticateRequest(req);
    const { jobId } = await context.params;
    const job = await getPersistenceServices().jobQueue.getForUser(
      jobId,
      principal.id,
    );

    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: true, job: publicJob(job) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error, "Job status request failed.");
  }
}

async function deleteHandler(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const principal = await authenticateRequest(req);
    const { jobId } = await context.params;
    const services = getPersistenceServices();
    const job = await services.jobQueue.getForUser(jobId, principal.id);

    if (!job) {
      return NextResponse.json(
        { ok: false, error: "Job was not found." },
        { status: 404 },
      );
    }

    if (job.status === "cancelled") {
      return NextResponse.json({
        ok: true,
        job: publicJob(job),
        cancellation: { accepted: true, alreadyCancelled: true },
      });
    }

    if (job.status === "succeeded") {
      return NextResponse.json(
        {
          ok: false,
          error: "This production already completed and can no longer be cancelled.",
          job: publicJob(job),
        },
        { status: 409 },
      );
    }

    if (job.status === "failed") {
      return NextResponse.json(
        {
          ok: false,
          error: "This production has already ended.",
          job: publicJob(job),
        },
        { status: 409 },
      );
    }

    if (job.jobType !== "video_reconcile") {
      return NextResponse.json(
        { ok: false, error: "This job type does not support cancellation." },
        { status: 409 },
      );
    }

    const publicTaskId =
      typeof job.payload.taskId === "string" ? job.payload.taskId.trim() : "";
    const parsedTask = publicTaskId ? parseVideoJobToken(publicTaskId) : null;
    const payloadProvider =
      job.payload.provider === "runway" || job.payload.provider === "veo"
        ? (job.payload.provider as VideoProviderKey)
        : null;
    const providerKey = parsedTask?.providerKey || payloadProvider;
    const nativeTaskId =
      parsedTask?.nativeTaskId ||
      (typeof job.payload.nativeTaskId === "string"
        ? job.payload.nativeTaskId.trim()
        : "");

    if (!providerKey || !nativeTaskId) {
      return NextResponse.json(
        {
          ok: false,
          error: "The provider task reference required for cancellation is missing.",
        },
        { status: 409 },
      );
    }

    const provider = getVideoProvider(providerKey);
    const cancellation = await provider.cancelTask(nativeTaskId);

    if (cancellation.status === "SUCCEEDED") {
      return NextResponse.json(
        {
          ok: false,
          error:
            cancellation.message ||
            "This production already completed and can no longer be cancelled.",
          cancellation,
        },
        { status: 409 },
      );
    }

    if (!cancellation.supported) {
      return NextResponse.json(
        {
          ok: false,
          error:
            cancellation.message ||
            "The active video service does not support verified cancellation for this task.",
          cancellation,
        },
        { status: 409 },
      );
    }

    if (!cancellation.accepted) {
      return NextResponse.json(
        {
          ok: false,
          error:
            cancellation.message ||
            "The video service did not confirm cancellation.",
          cancellation,
        },
        { status: 502 },
      );
    }

    const cancelledJob = await services.jobQueue.cancelForUser({
      jobId,
      userId: principal.id,
      reason: "User cancelled video production.",
      result: {
        provider: providerKey,
        providerTaskId: nativeTaskId,
        providerCancellationStatus: cancellation.status,
      },
    });

    // VELTO_CANCEL_P1_1 — cancellation after provider dispatch stops the
    // production result, but it does not refund Velto credit because provider
    // cost exposure began when the task was accepted. Settle idempotently here
    // as well, so a fast cancellation cannot bypass a deferred request-path
    // settlement before the worker gets its first lease.
    const reservationId =
      typeof job.payload.creditReservationId === "string"
        ? job.payload.creditReservationId.trim()
        : "";
    const chargedCredits = Number(job.payload.reservedCredits || 0);
    let creditSettled = false;
    let creditAccount: CreditAccount | null = null;

    if (reservationId && chargedCredits > 0) {
      try {
        const settlement = await services.creditRepository.settle({
          userId: principal.id,
          reservationId,
          finalCredits: chargedCredits,
          providerRequestId: nativeTaskId,
          metadata: {
            jobId,
            provider: providerKey,
            providerTaskId: nativeTaskId,
            billingMoment: "provider_dispatch",
            settledDuringCancellation: true,
          },
        });
        creditSettled = settlement.reservation.status === "settled";
        creditAccount = settlement.account;
      } catch (creditError) {
        console.warn("cancelled job dispatch credit settlement was not applied:", creditError);
      }
    }

    if (!creditAccount) {
      creditAccount = await services.creditRepository
        .getAccount(principal.id)
        .catch(() => null);
    }

    return NextResponse.json(
      {
        ok: true,
        job: publicJob(cancelledJob),
        cancellation,
        credits: {
          released: false,
          charged: true,
          settled: creditSettled,
          chargedCredits,
          account: creditAccount,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return routeError(error, "Job cancellation failed.");
  }
}

export const GET = withObservedApiRoute("api.jobs.read", getHandler);
export const DELETE = withObservedApiRoute("api.jobs.cancel", deleteHandler);
