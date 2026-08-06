import { withObservedApiRoute } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { getPersistenceServices } from "@/lib/persistence";
import type { CreditAccount } from "@/lib/credits/types";
import type { VeltoJobRecord } from "@/lib/persistence/jobs";
import { getVideoProvider } from "@/lib/video/providers";
import {
  isValidQueueJobId,
  validatePersistedVideoJobBinding,
} from "@/lib/security/persistedVideoJobBinding";
import { canonicalVideoFailure } from "@/lib/security/videoJobPublicSafety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const FORBIDDEN_HEADERS = ["x-task-id", "x-native-task-id", "x-provider", "x-provider-url"];

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function publicJob(job: VeltoJobRecord) {
  const outputReady =
    job.status === "succeeded" &&
    job.result?.outputReady === true &&
    validatePersistedVideoJobBinding(job) !== null;
  const failure = job.status === "failed" ? canonicalVideoFailure(job.errorCode) : null;
  return {
    id: job.id,
    projectId: job.projectId,
    jobType: job.jobType,
    status: job.status,
    output: {
      ready: outputReady,
      url: outputReady ? `/api/jobs/${encodeURIComponent(job.id)}/output` : null,
    },
    failureCode: failure?.failureCode || null,
    failureMessage: failure?.failureMessage || null,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function routeError(error: unknown, fallback: string) {
  if (error instanceof AuthenticationError) {
    return json({ ok: false, error: "Authentication required." }, 401);
  }
  console.error("job route failed");
  return json({ ok: false, error: fallback }, 500);
}

async function getHandler(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const principal = await authenticateRequest(req);
    const { jobId } = await context.params;
    if (!isValidQueueJobId(jobId)) {
      return json({ ok: false, error: "Job identifier is invalid." }, 400);
    }
    if (
      req.nextUrl.search ||
      Number(req.headers.get("content-length") || 0) > 0 ||
      FORBIDDEN_HEADERS.some((name) => req.headers.has(name))
    ) {
      return json({ ok: false, error: "Provider task input is not accepted." }, 400);
    }
    const job = await getPersistenceServices().jobQueue.getForUser(
      jobId,
      principal.id,
    );
    if (!job) return json({ ok: false, error: "Job was not found." }, 404);
    return json({ ok: true, job: publicJob(job) });
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
    if (!isValidQueueJobId(jobId)) {
      return json({ ok: false, error: "Job identifier is invalid." }, 400);
    }
    if (
      req.nextUrl.search ||
      Number(req.headers.get("content-length") || 0) > 0 ||
      FORBIDDEN_HEADERS.some((name) => req.headers.has(name))
    ) {
      return json({ ok: false, error: "Provider task input is not accepted." }, 400);
    }
    const services = getPersistenceServices();
    const job = await services.jobQueue.getForUser(jobId, principal.id);
    if (!job) return json({ ok: false, error: "Job was not found." }, 404);

    if (job.status === "cancelled") {
      return json({
        ok: true,
        job: publicJob(job),
        cancellation: { accepted: true, alreadyCancelled: true },
      });
    }
    if (job.status === "succeeded") {
      return json(
        { ok: false, error: "This production already completed and can no longer be cancelled.", job: publicJob(job) },
        409,
      );
    }
    if (job.status === "failed") {
      return json(
        { ok: false, error: "This production has already ended.", job: publicJob(job) },
        409,
      );
    }

    const binding = validatePersistedVideoJobBinding(job);
    if (!binding) {
      return json({ ok: false, error: "The persisted video job binding is invalid." }, 409);
    }
    const cancellation = await getVideoProvider(binding.provider).cancelTask(
      binding.nativeTaskId,
    );
    if (cancellation.status === "SUCCEEDED") {
      return json({ ok: false, error: "This production already completed and can no longer be cancelled." }, 409);
    }
    if (!cancellation.supported) {
      return json({ ok: false, error: "Cancellation is not supported for this production." }, 409);
    }
    if (!cancellation.accepted) {
      return json({ ok: false, error: "Cancellation could not be confirmed." }, 502);
    }

    const cancelledJob = await services.jobQueue.cancelForUser({
      jobId,
      userId: principal.id,
      reason: "User cancelled video production.",
      result: {
        provider: binding.provider,
        providerTaskId: binding.nativeTaskId,
        providerCancellationStatus: cancellation.status,
      },
    });

    // Provider-dispatched work remains charged. This is the existing
    // provider-dispatch settlement rule and is intentionally idempotent.
    const chargedCredits = binding.reservedCredits;
    let creditSettled = false;
    let creditAccount: CreditAccount | null = null;
    if (binding.creditReservationId && chargedCredits > 0) {
      try {
        const settlement = await services.creditRepository.settle({
          userId: principal.id,
          reservationId: binding.creditReservationId,
          finalCredits: chargedCredits,
          providerRequestId: binding.nativeTaskId,
          metadata: {
            jobId,
            provider: binding.provider,
            providerTaskId: binding.nativeTaskId,
            billingMoment: "provider_dispatch",
            settledDuringCancellation: true,
          },
        });
        creditSettled = settlement.reservation.status === "settled";
        creditAccount = settlement.account;
      } catch {
        console.warn("cancelled job dispatch credit settlement was not applied");
      }
    }
    if (!creditAccount) {
      creditAccount = await services.creditRepository.getAccount(principal.id).catch(() => null);
    }

    return json({
      ok: true,
      job: publicJob(cancelledJob),
      cancellation: { accepted: true, alreadyCancelled: false },
      credits: {
        released: false,
        charged: true,
        settled: creditSettled,
        chargedCredits,
        account: creditAccount,
      },
    });
  } catch (error) {
    return routeError(error, "Job cancellation failed.");
  }
}

export const GET = withObservedApiRoute("api.jobs.read", getHandler);
export const DELETE = withObservedApiRoute("api.jobs.cancel", deleteHandler);
