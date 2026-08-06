import os from "node:os";
import { createClient } from "@supabase/supabase-js";

// VELTO_SCALE_P1 — durable multi-worker queue runtime.
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerId =
  process.env.VELTO_WORKER_ID ||
  `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
const internalBaseUrl = (
  process.env.VELTO_INTERNAL_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/+$/, "");
const internalWorkerToken = process.env.VELTO_INTERNAL_WORKER_TOKEN;
const pollMs = clampNumber(process.env.VELTO_QUEUE_POLL_MS, 2000, 250, 30000);
const leaseSeconds = clampNumber(
  process.env.VELTO_QUEUE_LEASE_SECONDS,
  60,
  15,
  900,
);
const jobHeartbeatMs = clampNumber(
  process.env.VELTO_QUEUE_HEARTBEAT_MS,
  Math.max(5000, Math.floor((leaseSeconds * 1000) / 3)),
  3000,
  Math.max(5000, leaseSeconds * 500),
);
const workerHeartbeatMs = clampNumber(
  process.env.VELTO_WORKER_HEARTBEAT_MS,
  15000,
  5000,
  60000,
);
const retryBaseSeconds = clampNumber(
  process.env.VELTO_QUEUE_RETRY_BASE_SECONDS,
  5,
  1,
  300,
);
const retryMaxSeconds = clampNumber(
  process.env.VELTO_QUEUE_RETRY_MAX_SECONDS,
  300,
  retryBaseSeconds,
  3600,
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

if (!supabaseUrl || !serviceRoleKey || !internalWorkerToken) {
  throw new Error(
    "Worker requires SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and VELTO_INTERNAL_WORKER_TOKEN.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

let stopping = false;
let activeJobId = null;
let activeTraceId = null;
let lastFinReconcileAt = 0;
let lastWorkerHeartbeatAt = 0;
let wakeSleep = null;

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.round(parsed), max));
}

function sleep(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      wakeSleep = null;
      resolve();
    }, ms);

    wakeSleep = () => {
      clearTimeout(timer);
      wakeSleep = null;
      resolve();
    };
  });
}

function firstRow(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value && typeof value === "object" ? value : null;
}

const sensitiveKey = /(?:authorization|cookie|password|secret|token|api[-_]?key|service[-_]?role|base64|prompt|script|transcript|content)/i;

function sanitize(value, depth = 0) {
  if (depth > 5) return "[max-depth]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    const cleaned = value
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
      .replace(/\b(?:sk|rk|pk|key)-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]");
    return cleaned.length > 500 ? `${cleaned.slice(0, 500)}…[truncated]` : cleaned;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        sensitiveKey.test(key) ? "[REDACTED]" : sanitize(nested, depth + 1),
      ]),
    );
  }
  return String(value);
}

function log(level, message, metadata = {}) {
  console.log(
    JSON.stringify(
      sanitize({
        type: "velto_log",
        version: 1,
        timestamp: new Date().toISOString(),
        level,
        service: "velto-worker",
        release: process.env.VELTO_RELEASE || "local",
        workerId,
        traceId: activeTraceId,
        message,
        ...metadata,
      }),
    ),
  );
}

function metric(name, value = 1, labels = {}) {
  console.log(
    JSON.stringify(
      sanitize({
        type: "velto_metric",
        version: 1,
        timestamp: new Date().toISOString(),
        service: "velto-worker",
        release: process.env.VELTO_RELEASE || "local",
        workerId,
        traceId: activeTraceId,
        name,
        value,
        labels,
      }),
    ),
  );
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    throw new Error(`${name} failed: ${error.message}`);
  }

  return firstRow(data);
}

function retryDelayForAttempt(attempt, baseSeconds = retryBaseSeconds) {
  const safeAttempt = Math.max(1, Number(attempt || 1));
  const exponential = baseSeconds * 2 ** Math.min(safeAttempt - 1, 12);
  return Math.max(1, Math.min(Math.round(exponential), retryMaxSeconds));
}

async function heartbeatWorker(status, jobId = null, metadata = {}) {
  const result = await rpc("velto_worker_heartbeat", {
    p_worker_id: workerId,
    p_hostname: os.hostname(),
    p_process_id: process.pid,
    p_status: status,
    p_active_job_id: jobId,
    p_metadata: {
      pollMs,
      leaseSeconds,
      jobHeartbeatMs,
      version: "SCALE-P1",
      ...metadata,
    },
  });
  lastWorkerHeartbeatAt = Date.now();
  return result;
}

async function stopWorker(metadata = {}) {
  try {
    await rpc("velto_worker_stop", {
      p_worker_id: workerId,
      p_metadata: {
        stoppedAt: new Date().toISOString(),
        ...metadata,
      },
    });
  } catch (error) {
    log("warn", "Worker stop state could not be persisted.", {
      error: error instanceof Error ? error.message : "Unknown stop error.",
    });
  }
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
    metric("velto_credit_reconciliation_runs_total", 1, { outcome: "changed" });
    log("info", "FIN-P1C reconciliation completed.", { reconciliation: result });
  } else {
    metric("velto_credit_reconciliation_runs_total", 1, { outcome: "no_change" });
  }

  return result;
}

async function claimJob() {
  return rpc("velto_job_claim", {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
}

async function heartbeatJob(jobId) {
  return rpc("velto_job_heartbeat", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
}

function startLeaseHeartbeat(job) {
  let stopped = false;
  let heartbeatInFlight = false;
  let leaseLost = false;

  const tick = async () => {
    if (stopped || heartbeatInFlight) {
      return;
    }

    heartbeatInFlight = true;

    try {
      await heartbeatJob(job.id);
      await heartbeatWorker(stopping ? "stopping" : "busy", job.id, {
        attempt: job.attempts,
        jobType: job.job_type,
      });
    } catch (error) {
      leaseLost = true;
      log("error", "Job lease heartbeat failed.", {
        jobId: job.id,
        error: error instanceof Error ? error.message : "Unknown heartbeat error.",
      });
    } finally {
      heartbeatInFlight = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, jobHeartbeatMs);

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    leaseWasLost() {
      return leaseLost;
    },
  };
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
  retryDelaySeconds = null,
) {
  const delay =
    retryDelaySeconds == null
      ? retryDelayForAttempt(job.attempts)
      : Math.max(1, Math.min(Math.round(retryDelaySeconds), 3600));

  return rpc("velto_job_fail", {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_error_code: errorCode,
    p_error_message: errorMessage,
    p_retryable: retryable,
    p_retry_delay_seconds: delay,
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
      log("info", "Cancelled job ignored before completion.", {
        jobId: job.id,
      });
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

async function processJob(job) {
  const cycleStartedAt = Date.now();
  let cycleOutcome = "completed";
  activeJobId = job.id;
  activeTraceId =
    typeof job.payload?.traceId === "string" && /^[a-zA-Z0-9._:-]{8,128}$/.test(job.payload.traceId)
      ? job.payload.traceId
      : crypto.randomUUID();
  metric("velto_worker_job_cycles_total", 1, {
    event: "started",
    jobType: job.job_type,
  });
  await heartbeatWorker(stopping ? "stopping" : "busy", job.id, {
    attempt: job.attempts,
    jobType: job.job_type,
  });
  const leaseHeartbeat = startLeaseHeartbeat(job);

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
    cycleOutcome = "error";
    const message =
      error instanceof Error ? error.message : "Unknown worker error.";

    log("error", "Job handler crashed.", {
      jobId: job.id,
      jobType: job.job_type,
      error: message,
      leaseLost: leaseHeartbeat.leaseWasLost(),
    });

    if (leaseHeartbeat.leaseWasLost()) {
      log("warn", "Failure persistence skipped because this worker lost the lease.", {
        jobId: job.id,
      });
      return;
    }

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
      } else if (
        failedJob?.status === "failed" &&
        job.job_type === "video_reconcile"
      ) {
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
  } finally {
    leaseHeartbeat.stop();
    metric("velto_worker_job_duration_ms", Date.now() - cycleStartedAt, {
      jobType: job.job_type,
      outcome: cycleOutcome,
    });
    metric("velto_worker_job_cycles_total", 1, {
      event: cycleOutcome,
      jobType: job.job_type,
    });
    activeJobId = null;

    try {
      await heartbeatWorker(stopping ? "stopping" : "idle", null);
    } catch (error) {
      metric("velto_worker_errors_total", 1, { area: "idle_heartbeat" });
      log("warn", "Worker idle heartbeat failed.", {
        error: error instanceof Error ? error.message : "Unknown heartbeat error.",
      });
    } finally {
      activeTraceId = null;
    }
  }
}

async function main() {
  await heartbeatWorker("starting", null, {
    startedAt: new Date().toISOString(),
  });

  log("info", "Worker started.", {
    pollMs,
    leaseSeconds,
    jobHeartbeatMs,
    workerHeartbeatMs,
    retryBaseSeconds,
    retryMaxSeconds,
    internalBaseUrl,
    finReconcileIntervalMs,
    finReconcileBatchLimit,
    finStaleJobMinutes,
  });

  await heartbeatWorker("idle");

  try {
    while (!stopping) {
      const now = Date.now();

      if (now - lastWorkerHeartbeatAt >= workerHeartbeatMs) {
        try {
          await heartbeatWorker("idle");
        } catch (error) {
          metric("velto_worker_errors_total", 1, { area: "registry_heartbeat" });
          log("error", "Worker registry heartbeat failed.", {
            error:
              error instanceof Error ? error.message : "Unknown heartbeat error.",
          });
        }
      }

      if (now - lastFinReconcileAt >= finReconcileIntervalMs) {
        lastFinReconcileAt = now;

        try {
          await reconcileFinancialState();
        } catch (error) {
          metric("velto_worker_errors_total", 1, { area: "credit_reconciliation" });
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
        metric("velto_worker_errors_total", 1, { area: "queue_poll" });
        log("error", "Queue polling failed.", {
          error: error instanceof Error ? error.message : "Unknown queue error.",
        });
      }

      await sleep(pollMs);
    }
  } finally {
    await stopWorker({ activeJobId });
    log("info", "Worker stopped.");
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) {
      return;
    }

    stopping = true;
    wakeSleep?.();
    log("info", `Received ${signal}; no new jobs will be claimed.`, {
      activeJobId,
    });

    void heartbeatWorker("stopping", activeJobId, { signal }).catch((error) => {
      log("warn", "Stopping heartbeat could not be persisted.", {
        error: error instanceof Error ? error.message : "Unknown heartbeat error.",
      });
    });
  });
}

await main();
