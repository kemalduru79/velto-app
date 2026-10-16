import assert from "node:assert/strict";
import { createJobHandlers } from "../lib/worker/jobHandlers.mjs";

const calls = [];
let response = { status: 202, body: { ok: true, status: "rendering" } };
global.fetch = async () => ({
  status: response.status,
  ok: response.status >= 200 && response.status < 300,
  json: async () => response.body,
});
const handlers = createJobHandlers({
  cancellationWon: async () => false, clampNumber: Number,
  completeJob: async (...args) => calls.push(["complete", ...args]),
  failJob: async (...args) => calls.push(["fail", ...args]),
  internalBaseUrl: "http://non-production.invalid", internalWorkerToken: "fixture-token",
  log() {}, releaseJobCredit: async () => null,
  rescheduleJob: async (...args) => calls.push(["reschedule", ...args]),
  retryBaseSeconds: 5, retryDelayForAttempt: () => 5,
  settleJobCredit: async (...args) => { calls.push(["settle", ...args]); return { settled: true }; },
  workerId: "stage2b-worker",
});
const job = { id: "job-1", attempts: 1, max_attempts: 20 };

await handlers.handleCreatorFinalExport(job);
assert.deepEqual(calls.map(([name]) => name), ["reschedule"], "a long-running render is polled without settlement or duplicate completion");
calls.length = 0;
response = { status: 200, body: { ok: true, status: "completed", outputReady: true, movie: { finalExportJobId: "job-1" } } };
await handlers.handleCreatorFinalExport(job);
assert.deepEqual(calls.map(([name]) => name), ["settle", "complete"], "completion settles then completes once");
calls.length = 0;
response = { status: 503, body: { error: "ambiguous export response" } };
await handlers.handleCreatorFinalExport(job);
assert.deepEqual(calls.map(([name]) => name), ["fail"], "ambiguous completion is retained for bounded durable retry, not marked complete");
assert.equal(calls[0][4], true, "temporary ambiguity stays retryable through the same durable job");

console.log("STAGE_2B_WORKER_LIFECYCLE=PASS");
