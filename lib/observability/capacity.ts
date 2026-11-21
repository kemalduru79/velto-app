import { performance } from "node:perf_hooks";
import { incrementCounter, observeHistogram } from "./metrics.ts";

const SAFE_LABEL = /^[a-z0-9][a-z0-9._-]{0,47}$/;

function boundedLabel(value: string, fallback = "other") {
  const normalized = value.trim().toLowerCase();
  return SAFE_LABEL.test(normalized) ? normalized : fallback;
}

export async function observePersistenceOperation<T>(
  kind: "query" | "rpc" | "storage",
  operation: string,
  callback: () => PromiseLike<T>,
) {
  const startedAt = performance.now();
  const labels = { kind, operation: boundedLabel(operation) };
  try {
    const result = await callback();
    observeHistogram("velto_persistence_duration_ms", performance.now() - startedAt, {
      ...labels,
      outcome: "success",
    });
    return result;
  } catch (error) {
    observeHistogram("velto_persistence_duration_ms", performance.now() - startedAt, {
      ...labels,
      outcome: "error",
    });
    incrementCounter("velto_persistence_errors_total", 1, labels);
    throw error;
  }
}

export function recordMediaTransfer(input: {
  operation: string;
  direction: "upload" | "download";
  bytes: number;
  durationMs: number;
  outcome: "success" | "error";
}) {
  const labels = {
    operation: boundedLabel(input.operation),
    direction: input.direction,
    outcome: input.outcome,
  };
  const bytes = Math.max(0, Math.min(Math.round(input.bytes), 500 * 1024 * 1024));
  const durationMs = Math.max(0, Math.min(input.durationMs, 10 * 60_000));
  observeHistogram("velto_media_transfer_bytes", bytes, labels);
  observeHistogram("velto_media_transfer_duration_ms", durationMs, labels);
  if (bytes > 0 && durationMs > 0) {
    observeHistogram("velto_media_transfer_bytes_per_second", bytes / (durationMs / 1000), labels);
  }
}

export function startResourceMeasurement(operation: string) {
  const startedAt = performance.now();
  const startedCpu = process.cpuUsage();
  const startedMemory = process.memoryUsage();
  const safeOperation = boundedLabel(operation);
  return (outcome: "success" | "error") => {
    const durationMs = performance.now() - startedAt;
    const cpu = process.cpuUsage(startedCpu);
    const memory = process.memoryUsage();
    const labels = { operation: safeOperation, outcome };
    observeHistogram("velto_workload_duration_ms", durationMs, labels);
    observeHistogram("velto_workload_cpu_user_us", cpu.user, labels);
    observeHistogram("velto_workload_cpu_system_us", cpu.system, labels);
    observeHistogram("velto_workload_rss_bytes", memory.rss, labels);
    observeHistogram("velto_workload_heap_used_bytes", memory.heapUsed, labels);
    observeHistogram(
      "velto_workload_heap_delta_bytes",
      Math.max(0, memory.heapUsed - startedMemory.heapUsed),
      labels,
    );
  };
}

export function recordQueueWait(jobType: string, createdAt: string, claimedAt = Date.now()) {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return;
  observeHistogram(
    "velto_queue_wait_ms",
    Math.max(0, Math.min(claimedAt - createdMs, 24 * 60 * 60_000)),
    { jobType: boundedLabel(jobType) },
  );
}
