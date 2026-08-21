import os from "node:os";

export function createJobHandlers({
  cancellationWon,
  clampNumber,
  completeJob,
  failJob,
  internalBaseUrl,
  internalWorkerToken,
  log,
  releaseJobCredit,
  rescheduleJob,
  retryBaseSeconds,
  retryDelayForAttempt,
  settleJobCredit,
  workerId,
}) {
  async function handleRuntimeProbe(job) {
    const delayMs = clampNumber(job.payload?.delayMs, 0, 0, 5000);

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    await completeJob(job, {
      handledBy: workerId,
      hostname: os.hostname(),
      pid: process.pid,
      delayMs,
      completedAt: new Date().toISOString(),
    });
  }

  async function handleVideoReconcile(job) {
    const queueJobId = typeof job.id === "string" ? job.id.trim() : "";

    if (!queueJobId) {
      await releaseJobCredit(job, "video_reconcile_invalid_payload", {
        jobId: job.id,
      });
      await failJob(
        job,
        "INVALID_PAYLOAD",
        "video_reconcile requires a queue job identifier.",
        false,
      );
      return;
    }

    const dispatchCreditAccount = await settleJobCredit(job, {
      jobId: job.id,
      billingMoment: "provider_dispatch",
    });

    const response = await fetch(
      `${internalBaseUrl}/api/internal/jobs/${encodeURIComponent(queueJobId)}/provider-status`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${internalWorkerToken}`,
        },
        signal: AbortSignal.timeout(20000),
      },
    );
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof body?.error === "string"
          ? body.error
          : `Video status endpoint returned ${response.status}.`;
      const retryable = response.status >= 500 || response.status === 429;
      const retryBase = response.status === 429 ? 15 : retryBaseSeconds;

      if (!retryable || Number(job.attempts || 0) >= Number(job.max_attempts || 0)) {
        log("warn", "Terminal provider-status failure kept as charged after dispatch.", {
          jobId: job.id,
          httpStatus: response.status,
        });
      }

      await failJob(
        job,
        retryable ? "VIDEO_STATUS_TEMPORARY_FAILURE" : "VIDEO_STATUS_REJECTED",
        message,
        retryable,
        retryable ? retryDelayForAttempt(job.attempts, retryBase) : null,
      );
      return;
    }

    const status = String(body?.status || "PENDING").toUpperCase();

    if (["SUCCEEDED", "COMPLETED", "READY"].includes(status)) {
      if (await cancellationWon(job.id)) {
        log("info", "Cancelled job ignored before completion.", { jobId: job.id });
        return;
      }

      if (!body?.outputReady) {
        await failJob(
          job,
          "VIDEO_OUTPUT_MISSING",
          "Video generation completed without a readable output.",
          false,
        );
        return;
      }

      const creditAccount =
        dispatchCreditAccount ||
        (await settleJobCredit(job, {
          jobId: job.id,
          status,
          billingMoment: "provider_dispatch",
          videoUrlCreated: Boolean(body?.outputReady),
        }));

      await completeJob(job, {
        status,
        outputReady: Boolean(body?.outputReady),
        failureCode: body?.failureCode || null,
        failureMessage: body?.failureMessage || null,
        creditAccount,
      });
      return;
    }

    if (["FAILED", "ERROR", "CANCELLED", "CANCELED"].includes(status)) {
      if (await cancellationWon(job.id)) {
        log("info", "Cancelled job already reconciled by the request path.", {
          jobId: job.id,
          status,
        });
        return;
      }

      log("warn", "Provider video ended without output after billable dispatch.", {
        jobId: job.id,
        status,
        failureCode: body?.failureCode || null,
      });

      await failJob(
        job,
        body?.failureCode || "VIDEO_GENERATION_FAILED",
        body?.failureMessage || "Video generation failed.",
        false,
      );
      return;
    }

    if (Number(job.attempts || 0) >= Number(job.max_attempts || 0)) {
      log("warn", "Provider video reconciliation timed out after billable dispatch.", {
        jobId: job.id,
        status,
      });
      await failJob(
        job,
        "VIDEO_STATUS_TIMEOUT",
        `Video task did not complete before the retry limit. Last status: ${status}.`,
        false,
      );
      return;
    }

    await rescheduleJob(job, 8, `Video task is ${status}.`);
  }

  return { handleRuntimeProbe, handleVideoReconcile };
}
