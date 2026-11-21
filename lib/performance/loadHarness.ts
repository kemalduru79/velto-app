import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

export const LOAD_LIMITS = Object.freeze({
  maxConcurrency: 10,
  maxIterations: 200,
  maxDurationMs: 60_000,
  maxFixtureBytes: 5 * 1024 * 1024,
});
export const REAL_PROVIDER_OPT_IN = "VELTO_LOAD_ALLOW_REAL_PROVIDERS";
export const REAL_PROVIDER_OPT_IN_VALUE = "I_UNDERSTAND_PAID_PROVIDER_COST";

export type StubOutcome = "success" | "timeout" | "rate_limited" | "provider_error";
export type LoadScenario = {
  name: string;
  concurrency: number;
  iterations: number;
  timeoutMs: number;
  fixtureBytes?: number;
  operation: (context: { requestId: string; traceId: string; iteration: number }) => Promise<unknown>;
};

export function assertLoadSafety(input: Pick<LoadScenario, "concurrency" | "iterations" | "timeoutMs" | "fixtureBytes">) {
  if (!Number.isInteger(input.concurrency) || input.concurrency < 1 || input.concurrency > LOAD_LIMITS.maxConcurrency) {
    throw new Error("LOAD_CONCURRENCY_LIMIT_EXCEEDED");
  }
  if (!Number.isInteger(input.iterations) || input.iterations < 1 || input.iterations > LOAD_LIMITS.maxIterations) {
    throw new Error("LOAD_ITERATION_LIMIT_EXCEEDED");
  }
  if (!Number.isFinite(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > LOAD_LIMITS.maxDurationMs) {
    throw new Error("LOAD_DURATION_LIMIT_EXCEEDED");
  }
  if ((input.fixtureBytes || 0) > LOAD_LIMITS.maxFixtureBytes) {
    throw new Error("LOAD_FIXTURE_LIMIT_EXCEEDED");
  }
}

export function realProvidersEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return environment[REAL_PROVIDER_OPT_IN] === REAL_PROVIDER_OPT_IN_VALUE;
}

export function requireRealProviderOptIn(environment: NodeJS.ProcessEnv = process.env) {
  if (!realProvidersEnabled(environment)) throw new Error("REAL_PROVIDER_LOAD_DISABLED");
}

export function createProviderStub(input: {
  provider: "openai" | "exa" | "image" | "video" | "voice" | "stock";
  latencyMs: number;
  outcomes?: StubOutcome[];
}) {
  const latencyMs = Math.max(0, Math.min(Math.round(input.latencyMs), 2_000));
  const outcomes = input.outcomes?.length ? input.outcomes : ["success"];
  let call = 0;
  return async () => {
    const outcome = outcomes[call++ % outcomes.length];
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    if (outcome !== "success") throw new Error(`STUB_${outcome.toUpperCase()}`);
    return { stubbed: true, providerClass: input.provider, requestId: `stub-${call}` };
  };
}

function percentile(sorted: number[], ratio: number) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

export async function runLoadScenario(scenario: LoadScenario) {
  assertLoadSafety(scenario);
  const durations: number[] = [];
  const errors: Record<string, number> = {};
  const startedAt = performance.now();
  let next = 0;
  async function worker() {
    while (next < scenario.iterations) {
      const iteration = next++;
      const itemStartedAt = performance.now();
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("HARNESS_TIMEOUT")), scenario.timeoutMs),
      );
      try {
        await Promise.race([
          scenario.operation({ requestId: randomUUID(), traceId: randomUUID(), iteration }),
          timeout,
        ]);
      } catch (error) {
        const code = error instanceof Error ? error.message.slice(0, 64) : "UNKNOWN_ERROR";
        errors[code] = (errors[code] || 0) + 1;
      } finally {
        durations.push(performance.now() - itemStartedAt);
      }
    }
  }
  await Promise.all(Array.from({ length: scenario.concurrency }, () => worker()));
  const totalDurationMs = performance.now() - startedAt;
  durations.sort((a, b) => a - b);
  const errorCount = Object.values(errors).reduce((sum, value) => sum + value, 0);
  return {
    schemaVersion: "stage-0.11b-v1",
    scenario: scenario.name.slice(0, 64),
    concurrency: scenario.concurrency,
    iterations: scenario.iterations,
    fixtureBytes: scenario.fixtureBytes || 0,
    providers: "stubbed",
    durationMs: Number(totalDurationMs.toFixed(2)),
    throughputPerSecond: Number((scenario.iterations / (totalDurationMs / 1000)).toFixed(2)),
    latencyMs: {
      p50: Number(percentile(durations, 0.5).toFixed(2)),
      p95: Number(percentile(durations, 0.95).toFixed(2)),
      p99: Number(percentile(durations, 0.99).toFixed(2)),
    },
    errors,
    errorRate: Number((errorCount / scenario.iterations).toFixed(4)),
    timeoutRate: Number(((errors.HARNESS_TIMEOUT || 0) / scenario.iterations).toFixed(4)),
  };
}
