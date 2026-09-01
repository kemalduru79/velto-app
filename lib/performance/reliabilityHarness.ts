export const RELIABILITY_LIMITS = Object.freeze({ maxAttempts: 3, maxTimeoutMs: 55_000 });

export type ReliabilityFailure = "timeout" | "rate_limited" | "server_error" | "network_error" | "malformed_response" | "terminal";

export async function runBoundedReliabilityOperation<T>(input: {
  maxAttempts: number;
  timeoutMs: number;
  operation: (attempt: number) => Promise<T>;
  retryable: (error: unknown) => boolean;
}) {
  if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > RELIABILITY_LIMITS.maxAttempts) {
    throw new Error("RELIABILITY_RETRY_LIMIT_EXCEEDED");
  }
  if (!Number.isFinite(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > RELIABILITY_LIMITS.maxTimeoutMs) {
    throw new Error("RELIABILITY_TIMEOUT_LIMIT_EXCEEDED");
  }
  let lastError: unknown;
  let attempts = 0;
  for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    attempts = attempt;
    try {
      const result = await Promise.race([
        input.operation(attempt),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), input.timeoutMs)),
      ]);
      return { ok: true as const, result, attempts: attempt, retries: attempt - 1 };
    } catch (error) {
      lastError = error;
      if (attempt === input.maxAttempts || !input.retryable(error)) break;
    }
  }
  return { ok: false as const, error: lastError, attempts, retries: Math.max(0, attempts - 1) };
}

export function createIdempotentReliabilityExecutor<T>() {
  const operations = new Map<string, Promise<T>>();
  return {
    execute(key: string, operation: () => Promise<T>) {
      if (!/^[a-z0-9][a-z0-9:_-]{7,127}$/i.test(key)) throw new Error("INVALID_IDEMPOTENCY_KEY");
      const existing = operations.get(key);
      if (existing) return existing;
      const pending = operation().catch((error) => {
        operations.delete(key);
        throw error;
      });
      operations.set(key, pending);
      return pending;
    },
    size: () => operations.size,
  };
}

export function simulateSerialWorkerRecovery(input: {
  enqueueAtMs: number;
  firstClaimAtMs: number;
  crashAtMs: number;
  leaseExpiresAtMs: number;
  reclaimAtMs: number;
  completedAtMs: number;
  maxAttempts: number;
}) {
  if (input.maxAttempts < 1 || input.maxAttempts > RELIABILITY_LIMITS.maxAttempts) {
    throw new Error("RELIABILITY_RETRY_LIMIT_EXCEEDED");
  }
  if (input.reclaimAtMs < input.leaseExpiresAtMs || input.completedAtMs < input.reclaimAtMs) {
    throw new Error("INVALID_LEASE_RECOVERY_SEQUENCE");
  }
  return {
    enqueueToClaimMs: Math.max(0, input.firstClaimAtMs - input.enqueueAtMs),
    firstExecutionMs: Math.max(0, input.crashAtMs - input.firstClaimAtMs),
    recoveryMs: Math.max(0, input.reclaimAtMs - input.crashAtMs),
    recoveredExecutionMs: Math.max(0, input.completedAtMs - input.reclaimAtMs),
    retryCount: 1,
    duplicateExecutions: 0,
    terminalFailures: 0,
    serialActiveJobs: 1,
  };
}
