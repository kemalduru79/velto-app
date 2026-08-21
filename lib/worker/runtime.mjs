import os from "node:os";
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_SERVER_ENVIRONMENT,
  resolveConfiguredValue,
} from "../runtime/coreEnvironment.mjs";
import { createJobHandlers } from "./jobHandlers.mjs";
import { clampNumber, resolveWorkerRuntimeConfig } from "./runtimeConfig.mjs";

// VELTO_SCALE_P1 — durable multi-worker queue runtime.
const supabaseUrl = resolveConfiguredValue(
  process.env,
  SUPABASE_SERVER_ENVIRONMENT.url,
);
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerId =
  process.env.VELTO_WORKER_ID ||
  `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
const internalBaseUrl = (
  process.env.VELTO_INTERNAL_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/+$/, "");
const internalWorkerToken = process.env.VELTO_INTERNAL_WORKER_TOKEN;
const {
  pollMs,
  leaseSeconds,
  jobHeartbeatMs,
  workerHeartbeatMs,
  retryBaseSeconds,
  retryMaxSeconds,
  finReconcileIntervalMs,
  finReconcileBatchLimit,
  finStaleJobMinutes,
} = resolveWorkerRuntimeConfig(process.env);

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

const { handleRuntimeProbe, handleVideoReconcile } = createJobHandlers({
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
});

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

export async function runWorker() {
  await main();
}
