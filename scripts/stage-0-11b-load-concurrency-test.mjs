import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LOAD_LIMITS,
  REAL_PROVIDER_OPT_IN,
  REAL_PROVIDER_OPT_IN_VALUE,
  assertLoadSafety,
  createProviderStub,
  realProvidersEnabled,
  requireRealProviderOptIn,
  runLoadScenario,
} from "../lib/performance/loadHarness.ts";
import { getMetricSnapshot } from "../lib/observability/metrics.ts";
import {
  observePersistenceOperation,
  recordMediaTransfer,
  recordQueueWait,
  startResourceMeasurement,
} from "../lib/observability/capacity.ts";

assert.equal(LOAD_LIMITS.maxConcurrency, 10);
assert.throws(() => assertLoadSafety({ concurrency: 11, iterations: 1, timeoutMs: 100 }), /LOAD_CONCURRENCY/);
assert.throws(() => assertLoadSafety({ concurrency: 1, iterations: 201, timeoutMs: 100 }), /LOAD_ITERATION/);
assert.throws(() => assertLoadSafety({ concurrency: 1, iterations: 1, timeoutMs: 100, fixtureBytes: LOAD_LIMITS.maxFixtureBytes + 1 }), /LOAD_FIXTURE/);
assert.equal(realProvidersEnabled({}), false);
assert.throws(() => requireRealProviderOptIn({}), /REAL_PROVIDER_LOAD_DISABLED/);
assert.equal(realProvidersEnabled({ [REAL_PROVIDER_OPT_IN]: REAL_PROVIDER_OPT_IN_VALUE }), true);

const stub = createProviderStub({ provider: "openai", latencyMs: 0, outcomes: ["success", "rate_limited"] });
assert.equal((await stub()).stubbed, true);
await assert.rejects(stub(), /STUB_RATE_LIMITED/);

const result = await runLoadScenario({
  name: "behavioral-safety",
  concurrency: 5,
  iterations: 10,
  timeoutMs: 250,
  operation: async ({ requestId, traceId }) => {
    assert.match(requestId, /^[0-9a-f-]{36}$/);
    assert.match(traceId, /^[0-9a-f-]{36}$/);
  },
});
assert.equal(result.errorRate, 0);
assert.equal(result.providers, "stubbed");
assert.ok(result.latencyMs.p99 >= result.latencyMs.p50);

await observePersistenceOperation("rpc", "job_enqueue", async () => "ok");
recordMediaTransfer({ operation: "creator_upload", direction: "upload", bytes: 1024, durationMs: 10, outcome: "success" });
recordQueueWait("runtime_probe", new Date(Date.now() - 20).toISOString());
const finish = startResourceMeasurement("creator_package");
finish("success");
const metrics = getMetricSnapshot();
assert.ok(metrics.histograms.some((item) => item.name === "velto_persistence_duration_ms"));
assert.ok(metrics.histograms.some((item) => item.name === "velto_media_transfer_bytes_per_second"));
assert.ok(metrics.histograms.some((item) => item.name === "velto_queue_wait_ms"));
assert.ok(metrics.histograms.some((item) => item.name === "velto_workload_rss_bytes"));
assert.equal(JSON.stringify(metrics).includes("secret"), false);

const source = readFileSync(new URL("../lib/performance/loadHarness.ts", import.meta.url), "utf8");
assert.doesNotMatch(source, /process\.env\.(OPENAI|EXA|RUNWAY|ELEVENLABS|SUPABASE)/);

console.log("STAGE_0_11B_LOAD_CONCURRENCY=PASS");
