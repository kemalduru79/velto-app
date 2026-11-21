export const WORKER_RUNTIME_DEFAULTS = Object.freeze({
  pollMs: 2000,
  leaseSeconds: 60,
  workerHeartbeatMs: 15000,
  retryBaseSeconds: 5,
  retryMaxSeconds: 300,
  finReconcileIntervalMs: 60000,
  finReconcileBatchLimit: 200,
  finStaleJobMinutes: 10,
});

export function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.round(parsed), max));
}

export function resolveWorkerRuntimeConfig(environment = process.env) {
  const leaseSeconds = clampNumber(
    environment.VELTO_QUEUE_LEASE_SECONDS,
    WORKER_RUNTIME_DEFAULTS.leaseSeconds,
    15,
    900,
  );
  const retryBaseSeconds = clampNumber(
    environment.VELTO_QUEUE_RETRY_BASE_SECONDS,
    WORKER_RUNTIME_DEFAULTS.retryBaseSeconds,
    1,
    300,
  );

  return {
    pollMs: clampNumber(
      environment.VELTO_QUEUE_POLL_MS,
      WORKER_RUNTIME_DEFAULTS.pollMs,
      250,
      30000,
    ),
    leaseSeconds,
    jobHeartbeatMs: clampNumber(
      environment.VELTO_QUEUE_HEARTBEAT_MS,
      Math.max(5000, Math.floor((leaseSeconds * 1000) / 3)),
      3000,
      Math.max(5000, leaseSeconds * 500),
    ),
    workerHeartbeatMs: clampNumber(
      environment.VELTO_WORKER_HEARTBEAT_MS,
      WORKER_RUNTIME_DEFAULTS.workerHeartbeatMs,
      5000,
      60000,
    ),
    retryBaseSeconds,
    retryMaxSeconds: clampNumber(
      environment.VELTO_QUEUE_RETRY_MAX_SECONDS,
      WORKER_RUNTIME_DEFAULTS.retryMaxSeconds,
      retryBaseSeconds,
      3600,
    ),
    finReconcileIntervalMs: clampNumber(
      environment.VELTO_FIN_RECONCILE_INTERVAL_MS,
      WORKER_RUNTIME_DEFAULTS.finReconcileIntervalMs,
      10000,
      3600000,
    ),
    finReconcileBatchLimit: clampNumber(
      environment.VELTO_FIN_RECONCILE_BATCH_LIMIT,
      WORKER_RUNTIME_DEFAULTS.finReconcileBatchLimit,
      1,
      1000,
    ),
    finStaleJobMinutes: clampNumber(
      environment.VELTO_FIN_STALE_JOB_MINUTES,
      WORKER_RUNTIME_DEFAULTS.finStaleJobMinutes,
      1,
      1440,
    ),
  };
}
