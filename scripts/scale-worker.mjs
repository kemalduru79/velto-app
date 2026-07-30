import os from "node:os";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerId =
  process.env.VELTO_WORKER_ID ||
  `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
const internalBaseUrl = (
  process.env.VELTO_INTERNAL_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/+$/, "");
const pollMs = clampNumber(process.env.VELTO_QUEUE_POLL_MS, 2000, 250, 30000);
const leaseSeconds = clampNumber(
  process.env.VELTO_QUEUE_LEASE_SECONDS,
  60,
  15,
  900,
);
const finReconcileIntervalMs = clampNumber(
  process.env.VELTO_FIN_RECONCILE_INTERVAL_MS,
  60000,
  10000,
  3600000,
);
const finReconcileBatchLimit = clampNumber(
  process.env.VELTO_FIN_RECONCILE_BATCH_LIMIT,
  200,
  1,
  1000,
);
const finStaleJobMinutes = clampNumber(
  process.env.VELTO_FIN_STALE_JOB_MINUTES,
  10,
  1,
  1440,
);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Worker requires SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// VELTO_CANCEL_P1 — prevent cancelled jobs from settling credits
let stopping = false;
let lastFinReconcileAt = 0;

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.round(parsed), max));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstRow(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value && typeof value === "object" ? value : null;
}

function log(level, message, metadata = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: "velto-worker",
      workerId,
      message,
      ...metadata,
    }),
  );
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    throw new Error(`${name} failed: ${error.message}`);
  }

  return firstRow(data);
}

async function reconcileFinancialState() {
  const result = await rpc("velto_fin_reconcile", {
    p_batch_limit: finReconcileBatchLimit,
    p_stale_job_minutes: finStaleJobMinutes,
    p_source: `worker:${workerId}`,
  });

  const changed = [
    "settledDispatchedCount",
    "settlementErrors",
    "staleJobsFailed",
    "expiredCount",
  ].some((field) => Number(result?.[field] || 0) > 0);

  if (changed) {
    log("info", "FIN-P1C reconciliation completed.", { reconciliation: result });
  }

  return result;
}

async function claimJob() {
  return rpc("velto_job_claim", {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
}

async function getJobStatus(jobId) {
  const { data, error } = await supabase
    .from("velto_jobs")
    .select("status")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Job status check failed: ${error.message}`);
  }

  return typeof data?.status === "string" ? data.status : null;
}

async function cancellationWon(jobId) {
  return (await getJobStatus(jobId)) === "cancelled";
}

async function completeJob(job, result) {
  await rpc("velto_job_complete", {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_result: result || {},
  });
}

async function rescheduleJob(job, delaySeconds, reason) {
  await rpc("velto_job_reschedule", {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_delay_seconds: delaySeconds,
    p_reason: reason || null,
  });
}

async function failJob(
  job,
  errorCode,
  errorMessage,
  retryable = true,
  retryDelaySeconds = 15,
) {
  return rpc("velto_job_fail", {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_error_code: errorCode,
    p_error_message: errorMessage,
    p_retryable: retryable,
    p_retry_delay_seconds: retryDelaySeconds,
  });
}

function mapCreditAccount(result) {
  const account = result?.account;

  if (!account || typeof account !== "object") {
    return null;
  }

  return {
    userId: String(account.user_id || ""),
    balanceCredits: Number(account.balance_credits || 0),
    reservedCredits: Number(account.reserved_credits || 0),
    availableCredits: Number(account.available_credits || 0),
    lifetimeGrantedCredits: Number(account.lifetime_granted_credits || 0),
    lifetimeUsedCredits: Number(account.lifetime_used_credits || 0),
    updatedAt: String(account.updated_at || ""),
  };
}

async function settleJobCredit(job, metadata = {}) {
  const reservationId =
    typeof job.payload?.creditReservationId === "string"
      ? job.payload.creditReservationId.trim()
      : "";
  const finalCredits = Number(job.payload?.reservedCredits || 0);

  if (!reservationId || !job.user_id || finalCredits <= 0) {
    return null;
  }

  const result = await rpc("velto_credit_settle", {
    p_user_id: job.user_id,
    p_reservation_id: reservationId,
    p_final_credits: finalCredits,
    p_provider_cost_usd: null,
    p_provider_request_id:
      typeof job.payload?.nativeTaskId === "string"
        ? job.payload.nativeTaskId
        : null,
    p_metadata: metadata,
  });

  return mapCreditAccount(result);
}

async function releaseJobCredit(job, reason, metadata = {}) {
  const reservationId =
    typeof job.payload?.creditReservationId === "string"
      ? job.payload.creditReservationId.trim()
      : "";

  if (!reservationId || !job.user_id) {
    return null;
  }

  const result = await rpc("velto_credit_release", {
    p_user_id: job.user_id,
    p_reservation_id: reservationId,
    p_reason: reason,
    p_metadata: metadata,
  });

  return mapCreditAccount(result);
}

async function handleRuntimeProbe(job) {
  await completeJob(job, {
    handledBy: workerId,
    hostname: os.hostname(),
    pid: process.pid,
    completedAt: new Date().toISOString(),
  });
}

async function handleVideoReconcile(job) {
  const taskId =
    typeof job.payload?.taskId === "string" ? job.payload.taskId.trim() : "";

  if (!taskId) {
    await releaseJobCredit(job, "video_reconcile_invalid_payload", {
      jobId: job.id,
    });
    await failJob(
      job,
      "INVALID_PAYLOAD",
      "video_reconcile requires payload.taskId.",
      false,
    );
    return;
  }

  // VELTO_CANCEL_P1_1 — settle on provider dispatch, not on successful
  // completion. The RPC is idempotent, so this also closes any settlement that
  // the request path had to defer after the provider task was accepted.
  const dispatchCreditAccount = await settleJobCredit(job, {
    jobId: job.id,
    taskId,
    billingMoment: "provider_dispatch",
  });

  const response = await fetch(
    `${internalBaseUrl}/api/creator-video?taskId=${encodeURIComponent(taskId)}`,
    {
      headers: {
        Accept: "application/json",
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

    const isFinalAttempt =
      !retryable || Number(job.attempts || 0) >= Number(job.max_attempts || 0);

    if (isFinalAttempt) {
      log("warn", "Terminal provider-status failure kept as charged after dispatch.", {
        jobId: job.id,
        taskId,
        httpStatus: response.status,
      });
    }

    await failJob(
      job,
      retryable ? "VIDEO_STATUS_TEMPORARY_FAILURE" : "VIDEO_STATUS_REJECTED",
      message,
      retryable,
      15,
    );
    return;
  }

  const status = String(body?.status || "PENDING").toUpperCase();

  if (["SUCCEEDED", "COMPLETED", "READY"].includes(status)) {
    if (await cancellationWon(job.id)) {
      log("info", "Cancelled job ignored before credit settlement.", {
        jobId: job.id,
        taskId,
      });
      return;
    }

    const creditAccount = dispatchCreditAccount || await settleJobCredit(job, {
      jobId: job.id,
      taskId,
      status,
      billingMoment: "provider_dispatch",
      videoUrlCreated: Boolean(body?.videoUrl),
    });

    await completeJob(job, {
      taskId,
      status,
      videoUrl: body?.videoUrl || null,
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
        taskId,
        status,
      });
      return;
    }

    log("warn", "Provider video ended without output after billable dispatch.", {
      jobId: job.id,
      taskId,
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
      taskId,
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

async function processJob(job) {
  log("info", "Job claimed.", {
    jobId: job.id,
    jobType: job.job_type,
    attempt: job.attempts,
    maxAttempts: job.max_attempts,
  });

  try {
    if (job.job_type === "runtime_probe") {
      await handleRuntimeProbe(job);
    } else if (job.job_type === "video_reconcile") {
      await handleVideoReconcile(job);
    } else {
      await failJob(
        job,
        "UNSUPPORTED_JOB_TYPE",
        `Unsupported job type: ${job.job_type}`,
        false,
      );
    }

    log("info", "Job processing cycle completed.", {
      jobId: job.id,
      jobType: job.job_type,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown worker error.";

    log("error", "Job handler crashed.", {
      jobId: job.id,
      jobType: job.job_type,
      error: message,
    });

    try {
      if (await cancellationWon(job.id)) {
        log("info", "Worker error ignored because the job was cancelled.", {
          jobId: job.id,
        });
        return;
      }

      const failedJob = await failJob(
        job,
        "WORKER_HANDLER_ERROR",
        message,
        true,
        15,
      );

      if (failedJob?.status === "failed" && job.job_type !== "video_reconcile") {
        try {
          await releaseJobCredit(job, "worker_handler_failed", {
            jobId: job.id,
            handlerError: message,
          });
        } catch (creditReleaseError) {
          log("error", "Terminal job credit could not be released.", {
            jobId: job.id,
            error:
              creditReleaseError instanceof Error
                ? creditReleaseError.message
                : "Unknown credit release error.",
          });
        }
      } else if (failedJob?.status === "failed" && job.job_type === "video_reconcile") {
        log("warn", "Video reconcile failure kept charged after provider dispatch.", {
          jobId: job.id,
          handlerError: message,
        });
      }
    } catch (failError) {
      log("error", "Job failure state could not be persisted.", {
        jobId: job.id,
        error:
          failError instanceof Error
            ? failError.message
            : "Unknown queue persistence error.",
      });
    }
  }
}

async function main() {
  log("info", "Worker started.", {
    pollMs,
    leaseSeconds,
    internalBaseUrl,
    finReconcileIntervalMs,
    finReconcileBatchLimit,
    finStaleJobMinutes,
  });

  while (!stopping) {
    const now = Date.now();

    if (now - lastFinReconcileAt >= finReconcileIntervalMs) {
      // Set the timestamp before the call so a temporary database failure does
      // not create a tight retry loop that starves normal queue processing.
      lastFinReconcileAt = now;

      try {
        await reconcileFinancialState();
      } catch (error) {
        log("error", "FIN-P1C reconciliation failed.", {
          error:
            error instanceof Error
              ? error.message
              : "Unknown reconciliation error.",
        });
      }
    }

    try {
      const job = await claimJob();

      if (job) {
        await processJob(job);
        continue;
      }
    } catch (error) {
      log("error", "Queue polling failed.", {
        error: error instanceof Error ? error.message : "Unknown queue error.",
      });
    }

    await sleep(pollMs);
  }

  log("info", "Worker stopped.");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    log("info", `Received ${signal}; finishing current cycle.`);
  });
}

await main();
