import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Multi-worker test requires SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const workers = [];
const jobIds = [];

function startWorker(suffix) {
  const child = spawn(process.execPath, ["scripts/scale-worker.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VELTO_WORKER_ID: `scale-p1-test-${runId}-${suffix}`,
      VELTO_QUEUE_POLL_MS: "250",
      VELTO_QUEUE_LEASE_SECONDS: "15",
      VELTO_QUEUE_HEARTBEAT_MS: "3000",
      VELTO_WORKER_HEARTBEAT_MS: "5000",
      VELTO_FIN_RECONCILE_INTERVAL_MS: "3600000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${suffix}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${suffix}] ${chunk}`));
  workers.push(child);
  return child;
}

async function enqueue(index) {
  const { data, error } = await supabase.rpc("velto_job_enqueue", {
    p_job_type: "runtime_probe",
    p_payload: {
      source: "scale-p1-multi-worker-test",
      runId,
      index,
      delayMs: 1000,
    },
    p_user_id: null,
    p_project_id: null,
    p_priority: 1000,
    p_max_attempts: 3,
    p_available_at: new Date().toISOString(),
    p_idempotency_key: `scale-p1-multi:${runId}:${index}`,
  });

  if (error) {
    throw new Error(`Multi-worker job ${index} could not be queued: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row?.id) {
    throw new Error(`Multi-worker job ${index} did not return an id.`);
  }

  jobIds.push(row.id);
}

async function stopWorkers() {
  for (const worker of workers) {
    if (!worker.killed) {
      worker.kill("SIGTERM");
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  for (const worker of workers) {
    if (worker.exitCode == null && !worker.killed) {
      worker.kill("SIGKILL");
    }
  }
}

try {
  startWorker("a");
  startWorker("b");
  await new Promise((resolve) => setTimeout(resolve, 1500));

  for (let index = 0; index < 6; index += 1) {
    await enqueue(index);
  }

  const deadline = Date.now() + 60000;
  let completed = [];

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("velto_jobs")
      .select("id,status,attempts,result")
      .in("id", jobIds);

    if (error) {
      throw new Error(`Multi-worker jobs could not be read: ${error.message}`);
    }

    completed = (data || []).filter((job) => job.status === "succeeded");

    if (completed.length === jobIds.length) {
      break;
    }

    const terminalFailure = (data || []).find((job) =>
      ["failed", "cancelled"].includes(job.status),
    );

    if (terminalFailure) {
      throw new Error(`Multi-worker job ended in ${terminalFailure.status}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (completed.length !== jobIds.length) {
    throw new Error("Multi-worker test timed out.");
  }

  const handlers = new Set(
    completed
      .map((job) => job.result?.handledBy)
      .filter((value) => typeof value === "string"),
  );

  if (handlers.size < 2) {
    throw new Error(
      `Scale-out verification expected two workers, but observed ${handlers.size}.`,
    );
  }

  if (completed.some((job) => Number(job.attempts) !== 1)) {
    throw new Error("At least one scale-out probe was claimed more than once.");
  }

  console.log(
    `SCALE-P1 multi-worker verification passed with ${handlers.size} workers.`,
  );
} finally {
  await stopWorkers();
}
