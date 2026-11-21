import assert from "node:assert/strict";
import { createJobHandlers } from "../lib/worker/jobHandlers.mjs";

const calls = [];
let response = { status: 202, body: { ok: true, status: "rendering" } };
let lastRequest;
global.fetch = async (url, options) => {
  lastRequest = { url, options };
  return ({
  status: response.status,
  ok: response.status >= 200 && response.status < 300,
  json: async () => response.body,
  });
};
const handlers = createJobHandlers({
  cancellationWon: async () => false, clampNumber: Number,
  completeJob: async (...args) => calls.push(["complete", ...args]),
  failJob: async (...args) => calls.push(["fail", ...args]),
  internalBaseUrl: "http://non-production.invalid", internalWorkerToken: "fixture-token",
  log() {}, releaseJobCredit: async (...args) => { calls.push(["release", ...args]); return null; },
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
calls.length = 0;
response = { status: 409, body: { error: "invalid media identity", failureStage: "pre_render_validation", renderAccepted: false } };
await handlers.handleCreatorFinalExport(job);
assert.deepEqual(calls.map(([name]) => name), ["release", "fail"], "certain pre-render rejection releases once before terminal failure");
assert.equal(calls[1][4], false, "certain pre-render rejection is not retried into a duplicate render");
assert.equal(lastRequest.options.headers["x-velto-worker-id"], "stage2b-worker", "claimed worker identity is bound into pre-render recovery");
calls.length = 0;
response = { status: 409, body: { error: "ambiguous renderer rejection" } };
await handlers.handleCreatorFinalExport(job);
assert.deepEqual(calls.map(([name]) => name), ["fail"], "an unclassified rejection is never treated as safely refundable");

console.log("STAGE_2B_WORKER_LIFECYCLE=PASS");
