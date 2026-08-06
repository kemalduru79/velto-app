import { createServerSupabaseClient } from "@/lib/supabase/server";
import { incrementCounter, setGauge } from "@/lib/observability";
import type {
  CancelVeltoJobInput,
  EnqueueVeltoJobInput,
  JobQueueRepository,
  VeltoJobRecord,
  VeltoJobStatus,
  VeltoJobType,
  VeltoQueueHealth,
} from "./types";

type JobRow = Record<string, unknown>;

function firstRow(value: unknown): JobRow | null {
  if (Array.isArray(value)) {
    return (value[0] as JobRow | undefined) || null;
  }

  return value && typeof value === "object" ? (value as JobRow) : null;
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapJob(row: JobRow): VeltoJobRecord {
  return {
    id: String(row.id),
    userId: asNullableString(row.user_id),
    projectId: asNullableString(row.project_id),
    jobType: String(row.job_type) as VeltoJobType,
    status: String(row.status) as VeltoJobStatus,
    priority: Number(row.priority || 0),
    payload: asRecord(row.payload),
    result: row.result == null ? null : asRecord(row.result),
    errorCode: asNullableString(row.error_code),
    errorMessage: asNullableString(row.error_message),
    attempts: Number(row.attempts || 0),
    maxAttempts: Number(row.max_attempts || 0),
    availableAt: String(row.available_at),
    leaseOwner: asNullableString(row.lease_owner),
    leaseExpiresAt: asNullableString(row.lease_expires_at),
    idempotencyKey: asNullableString(row.idempotency_key),
    startedAt: asNullableString(row.started_at),
    completedAt: asNullableString(row.completed_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapQueueHealth(value: unknown): VeltoQueueHealth {
  const row = asRecord(value);
  const nullableNumber = (field: string) => {
    const candidate = row[field];
    return candidate == null ? null : Number(candidate);
  };

  return {
    checkedAt:
      typeof row.checkedAt === "string"
        ? row.checkedAt
        : new Date().toISOString(),
    queued: Number(row.queued || 0),
    running: Number(row.running || 0),
    succeededLastHour: Number(row.succeededLastHour || 0),
    failedLastHour: Number(row.failedLastHour || 0),
    cancelledLastHour: Number(row.cancelledLastHour || 0),
    oldestQueuedSeconds: nullableNumber("oldestQueuedSeconds"),
    expiredLeases: Number(row.expiredLeases || 0),
    activeWorkers: Number(row.activeWorkers || 0),
    staleWorkers: Number(row.staleWorkers || 0),
    healthy: Boolean(row.healthy),
  };
}

export class SupabaseJobQueueRepository implements JobQueueRepository {
  async cancelForUser(input: CancelVeltoJobInput): Promise<VeltoJobRecord> {
    const client = createServerSupabaseClient();
    const { data, error } = await client.rpc("velto_job_cancel", {
      p_job_id: input.jobId,
      p_user_id: input.userId,
      p_reason: input.reason || "user_requested",
      p_result: input.result || {},
    });

    if (error) {
      throw new Error(`Job could not be cancelled: ${error.message}`);
    }

    const row = firstRow(data);

    if (!row) {
      throw new Error("Job cancellation did not return a job record.");
    }

    const job = mapJob(row);
    incrementCounter("velto_queue_events_total", 1, {
      event: "cancelled",
      jobType: job.jobType,
    });
    return job;
  }

  async enqueue(input: EnqueueVeltoJobInput): Promise<VeltoJobRecord> {
    const client = createServerSupabaseClient();
    const { data, error } = await client.rpc("velto_job_enqueue", {
      p_job_type: input.jobType,
      p_payload: input.payload || {},
      p_user_id: input.userId || null,
      p_project_id: input.projectId || null,
      p_priority: input.priority ?? 100,
      p_max_attempts: input.maxAttempts ?? 5,
      p_available_at: input.availableAt || new Date().toISOString(),
      p_idempotency_key: input.idempotencyKey || null,
    });

    if (error) {
      throw new Error(`Job could not be queued: ${error.message}`);
    }

    const row = firstRow(data);

    if (!row) {
      throw new Error("Job queue did not return a job record.");
    }

    const job = mapJob(row);
    incrementCounter("velto_queue_events_total", 1, {
      event: "enqueued",
      jobType: job.jobType,
    });
    return job;
  }

  async getHealth(workerStaleSeconds = 90): Promise<VeltoQueueHealth> {
    const client = createServerSupabaseClient();
    const safeStaleSeconds = Math.max(15, Math.min(Math.round(workerStaleSeconds), 3600));
    const { data, error } = await client.rpc("velto_job_queue_health", {
      p_worker_stale_seconds: safeStaleSeconds,
    });

    if (error) {
      throw new Error(`Queue health could not be read: ${error.message}`);
    }

    const health = mapQueueHealth(data);
    setGauge("velto_queue_backlog", health.queued, { state: "queued" });
    setGauge("velto_queue_backlog", health.running, { state: "running" });
    setGauge("velto_workers_active", health.activeWorkers);
    setGauge("velto_workers_stale", health.staleWorkers);
    setGauge("velto_queue_expired_leases", health.expiredLeases);
    return health;
  }

  async getForUser(
    jobId: string,
    userId: string,
  ): Promise<VeltoJobRecord | null> {
    const client = createServerSupabaseClient();
    const { data, error } = await client
      .from("velto_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Job could not be read: ${error.message}`);
    }

    return data ? mapJob(data as JobRow) : null;
  }

  async getInternal(jobId: string): Promise<VeltoJobRecord | null> {
    const client = createServerSupabaseClient();
    const { data, error } = await client
      .from("velto_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      throw new Error(`Job could not be read internally: ${error.message}`);
    }

    return data ? mapJob(data as JobRow) : null;
  }

  async listForUser(
    userId: string,
    limit = 20,
  ): Promise<VeltoJobRecord[]> {
    const client = createServerSupabaseClient();
    const safeLimit = Math.max(1, Math.min(Math.round(limit), 100));
    const { data, error } = await client
      .from("velto_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw new Error(`Jobs could not be listed: ${error.message}`);
    }

    return (data || []).map((row) => mapJob(row as JobRow));
  }
}
