import { Buffer } from "node:buffer";
import process from "node:process";
import {
  createProviderStub,
  requireRealProviderOptIn,
  runLoadScenario,
} from "../lib/performance/loadHarness.ts";

if (process.argv.includes("--real-providers")) {
  requireRealProviderOptIn();
  throw new Error("REAL_PROVIDER_ADAPTER_NOT_CONFIGURED_FOR_BULK_LOAD");
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const openai = createProviderStub({ provider: "openai", latencyMs: 3 });
const exa = createProviderStub({ provider: "exa", latencyMs: 2 });
const image = createProviderStub({ provider: "image", latencyMs: 4 });
const video = createProviderStub({ provider: "video", latencyMs: 5 });
const voice = createProviderStub({ provider: "voice", latencyMs: 3 });

const definitions = [
  ...[1, 5, 10].map((concurrency) => ({
    name: `lightweight-api-c${concurrency}`,
    concurrency,
    iterations: 30,
    timeoutMs: 500,
    operation: () => wait(2),
  })),
  ...[1, 5, 10].map((concurrency) => ({
    name: `project-owner-storage-c${concurrency}`,
    concurrency,
    iterations: 20,
    timeoutMs: 500,
    operation: async () => { await wait(2); await wait(2); },
  })),
  ...[1, 5, 10].map((concurrency) => ({
    name: `grounded-orchestration-c${concurrency}`,
    concurrency,
    iterations: 10,
    timeoutMs: 1_000,
    operation: async () => { await exa(); await openai(); await openai(); },
  })),
  ...[1, 5, 10].map((concurrency) => ({
    name: `mixed-provider-c${concurrency}`,
    concurrency,
    iterations: 10,
    timeoutMs: 1_000,
    operation: async () => { await Promise.all([image(), video(), voice()]); },
  })),
  ...[1, 2, 3].map((concurrency) => ({
    name: `creator-package-c${concurrency}`,
    concurrency,
    iterations: 6,
    timeoutMs: 1_000,
    fixtureBytes: 1024 * 1024,
    operation: () => Promise.resolve(Buffer.concat([Buffer.alloc(512 * 1024), Buffer.alloc(512 * 1024)]).byteLength),
  })),
  ...[1, 5, 10].map((concurrency) => ({
    name: `queue-lifecycle-c${concurrency}`,
    concurrency,
    iterations: 20,
    timeoutMs: 500,
    operation: async ({ iteration }) => {
      const idempotency = new Set();
      const key = `job-${iteration}`;
      if (idempotency.has(key)) throw new Error("DUPLICATE_DISPATCH");
      idempotency.add(key);
      await wait(2); // enqueue -> claim
      await wait(1); // heartbeat
      if (iteration % 9 === 0) await wait(2); // one bounded retry/recovery cycle
    },
  })),
  ...[1, 4, Math.ceil(4.5 * 1024 * 1024) + 1].map((megabytesOrBytes) => {
    const bytes = megabytesOrBytes > 100 ? megabytesOrBytes : megabytesOrBytes * 1024 * 1024;
    return {
      name: `upload-boundary-${bytes}`,
      concurrency: 1,
      iterations: 3,
      timeoutMs: 1_000,
      fixtureBytes: bytes,
      operation: () => Promise.resolve(Buffer.alloc(bytes).byteLength),
    };
  }),
];

const startedCpu = process.cpuUsage();
const startedMemory = process.memoryUsage();
const results = [];
for (const scenario of definitions) results.push(await runLoadScenario(scenario));
const cpu = process.cpuUsage(startedCpu);
const memory = process.memoryUsage();

console.log(JSON.stringify({
  schemaVersion: "stage-0.11b-v1",
  generatedAt: new Date().toISOString(),
  execution: "local-synthetic",
  realProviderCalls: 0,
  paidProviderExposureUsd: 0,
  resources: {
    cpuUserUs: cpu.user,
    cpuSystemUs: cpu.system,
    rssBytes: memory.rss,
    heapUsedBytes: memory.heapUsed,
    heapDeltaBytes: Math.max(0, memory.heapUsed - startedMemory.heapUsed),
  },
  results,
}, null, 2));
