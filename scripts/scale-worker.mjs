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

let stopping = false;

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

async function claimJob() {
  return rpc("velto_job_claim", {
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
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
  await rpc("velto_job_fail", {
    p_job_id: job.id,
    p_worker_id: workerId,
    p_error_code: errorCode,
    p_error_message: errorMessage,
    p_retryable: retryable,
    p_retry_delay_seconds: retryDelaySeconds,
  });
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
    await failJob(
      job,
      "INVALID_PAYLOAD",
      "video_reconcile requires payload.taskId.",
      false,
    );
    return;
  }

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
    await completeJob(job, {
      taskId,
      status,
      videoUrl: body?.videoUrl || null,
      failureCode: body?.failureCode || null,
      failureMessage: body?.failureMessage || null,
    });
    return;
  }

  if (["FAILED", "ERROR", "CANCELLED", "CANCELED"].includes(status)) {
    await failJob(
      job,
      body?.failureCode || "VIDEO_GENERATION_FAILED",
      body?.failureMessage || "Video generation failed.",
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
      await failJob(job, "WORKER_HANDLER_ERROR", message, true, 15);
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
  });

  while (!stopping) {
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
