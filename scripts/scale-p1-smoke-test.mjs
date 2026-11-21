import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Smoke test requires SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

function firstRow(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value && typeof value === "object" ? value : null;
}

async function enqueue(idempotencyKey) {
  const { data, error } = await supabase.rpc("velto_job_enqueue", {
    p_job_type: "runtime_probe",
    p_payload: {
      source: "scale-p1-smoke-test",
      requestedAt: new Date().toISOString(),
    },
    p_user_id: null,
    p_project_id: null,
    p_priority: 1000,
    p_max_attempts: 3,
    p_available_at: new Date().toISOString(),
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    throw new Error(`Smoke job could not be queued: ${error.message}`);
  }

  return firstRow(data);
}

const idempotencyKey = `scale-p1-smoke:${Date.now()}:${crypto.randomUUID()}`;
const job = await enqueue(idempotencyKey);
const duplicate = await enqueue(idempotencyKey);

if (!job?.id || duplicate?.id !== job.id) {
  throw new Error("Queue idempotency verification failed.");
}

console.log(`Queued idempotent smoke job: ${job.id}`);

const { data: queueHealth, error: healthError } = await supabase.rpc(
  "velto_job_queue_health",
  { p_worker_stale_seconds: 90 },
);

if (healthError) {
  throw new Error(`Queue health could not be read: ${healthError.message}`);
}

for (const field of ["queued", "running", "activeWorkers", "healthy"]) {
  if (!(field in (queueHealth || {}))) {
    throw new Error(`Queue health field is missing: ${field}`);
  }
}

const deadline = Date.now() + 45000;

while (Date.now() < deadline) {
  const { data: current, error: readError } = await supabase
    .from("velto_jobs")
    .select("*")
    .eq("id", job.id)
    .single();

  if (readError) {
    throw new Error(`Smoke job could not be read: ${readError.message}`);
  }

  console.log(
    JSON.stringify(
      {
        id: current.id,
        status: current.status,
        attempts: current.attempts,
        leaseOwner: current.lease_owner,
        result: current.result,
        errorCode: current.error_code,
        errorMessage: current.error_message,
      },
      null,
      2,
    ),
  );

  if (current.status === "succeeded") {
    console.log("SCALE-P1 queue, worker and idempotency smoke test passed.");
    process.exit(0);
  }

  if (["failed", "cancelled"].includes(current.status)) {
    console.error("SCALE-P1 smoke job failed.");
    process.exit(2);
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
}

console.error("SCALE-P1 smoke job timed out. Confirm the worker service is running.");
process.exit(3);
