import assert from "node:assert/strict";
import {
  CreatorDirectUploadError,
  createCreatorDirectUploadIntent,
  finalizeCreatorDirectUpload,
  verifyCreatorDirectUploadIntent,
} from "../lib/creator/directUpload.ts";
import {
  createIdempotentReliabilityExecutor,
  runBoundedReliabilityOperation,
  simulateSerialWorkerRecovery,
} from "../lib/performance/reliabilityHarness.ts";
import { getMetricSnapshot } from "../lib/observability/metrics.ts";
import { observePersistenceOperation } from "../lib/observability/capacity.ts";

const secret = "test-only-direct-upload-secret";
const ownerUserId = "owner-1";
const projectId = "11111111-1111-4111-8111-111111111111";
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const created = createCreatorDirectUploadIntent({ ownerUserId, projectId, originalFilename: "photo.jpg", mediaKind: "image", mimeType: "image/jpeg", sizeBytes: jpeg.byteLength, rightsConfirmed: true }, secret, { now: 1_000, nonce: "22222222-2222-4222-8222-222222222222" });
assert.equal(created.payload.path, `creator/${ownerUserId}/${projectId}/upload/22222222-2222-4222-8222-222222222222.jpg`);
assert.equal(verifyCreatorDirectUploadIntent(created.intentToken, { ownerUserId, secret, now: 1_001 }).sizeBytes, jpeg.byteLength);
assert.throws(() => verifyCreatorDirectUploadIntent(created.intentToken, { ownerUserId: "other", secret, now: 1_001 }), /invalid/i);
assert.throws(() => verifyCreatorDirectUploadIntent(created.intentToken, { ownerUserId, secret, now: 1_000 + 16 * 60_000 }), (error) => error instanceof CreatorDirectUploadError && error.code === "intent_expired");
assert.throws(() => createCreatorDirectUploadIntent({ ownerUserId, projectId, originalFilename: "huge.mp4", mediaKind: "video", mimeType: "video/mp4", sizeBytes: 51 * 1024 * 1024, rightsConfirmed: true }, secret), /too large/i);

function dependencies(overrides = {}) {
  const calls = { download: 0, remove: 0, register: 0 };
  return { calls, value: {
    stat: async () => ({ exists: true, sizeBytes: jpeg.byteLength, contentType: "image/jpeg" }),
    download: async () => { calls.download += 1; return jpeg; },
    remove: async () => { calls.remove += 1; },
    publicUrl: () => "https://storage.test/photo.jpg",
    findExisting: async () => null,
    register: async (input) => { calls.register += 1; return { id: "asset-1", publicUrl: input.publicUrl, mediaKind: input.mediaKind, mimeType: input.mimeType, sizeBytes: input.sizeBytes, metadata: input.metadata }; },
    ...overrides,
  }};
}

const valid = dependencies();
const finalized = await finalizeCreatorDirectUpload({ intentToken: created.intentToken, ownerUserId, secret, now: 1_002 }, valid.value);
assert.equal(finalized.asset.assetId, "asset-1");
assert.equal(finalized.asset.publicUrl, "https://storage.test/photo.jpg");
assert.equal(valid.calls.register, 1);
assert.equal(valid.calls.remove, 0);

const missing = dependencies({ stat: async () => ({ exists: false, sizeBytes: null, contentType: null }) });
await assert.rejects(finalizeCreatorDirectUpload({ intentToken: created.intentToken, ownerUserId, secret, now: 1_002 }, missing.value), (error) => error.code === "upload_missing");
assert.equal(missing.calls.register, 0, "missing/interrupted upload never becomes Ready");

for (const mismatch of [
  { stat: async () => ({ exists: true, sizeBytes: jpeg.byteLength + 1, contentType: "image/jpeg" }) },
  { stat: async () => ({ exists: true, sizeBytes: jpeg.byteLength, contentType: "video/mp4" }) },
  { download: async () => new Uint8Array([0, 0, 0, 0]) },
]) {
  const state = dependencies(mismatch);
  await assert.rejects(finalizeCreatorDirectUpload({ intentToken: created.intentToken, ownerUserId, secret, now: 1_002 }, state.value));
  assert.equal(state.calls.register, 0);
  assert.equal(state.calls.remove, 1, "invalid uploaded objects are cleaned up");
}

const dbFailure = dependencies({ register: async () => { throw new Error("db unavailable"); } });
await assert.rejects(finalizeCreatorDirectUpload({ intentToken: created.intentToken, ownerUserId, secret, now: 1_002 }, dbFailure.value), (error) => error.code === "registration_failed");
assert.equal(dbFailure.calls.remove, 1, "object is cleaned up when canonical metadata persistence fails");

const duplicate = dependencies({ findExisting: async () => ({ id: "asset-existing", publicUrl: "https://storage.test/photo.jpg", mediaKind: "image", mimeType: "image/jpeg", sizeBytes: jpeg.byteLength, metadata: { uploadedAt: "2026-01-01T00:00:00.000Z" } }) });
const replay = await finalizeCreatorDirectUpload({ intentToken: created.intentToken, ownerUserId, secret, now: 1_002 }, duplicate.value);
assert.equal(replay.reused, true);
assert.equal(duplicate.calls.download, 0);
assert.equal(duplicate.calls.register, 0);

const worker = simulateSerialWorkerRecovery({ enqueueAtMs: 0, firstClaimAtMs: 2_000, crashAtMs: 3_000, leaseExpiresAtMs: 63_000, reclaimAtMs: 64_000, completedAtMs: 65_000, maxAttempts: 3 });
assert.deepEqual(worker, { enqueueToClaimMs: 2_000, firstExecutionMs: 1_000, recoveryMs: 61_000, recoveredExecutionMs: 1_000, retryCount: 1, duplicateExecutions: 0, terminalFailures: 0, serialActiveJobs: 1 });
const terminalJob = await runBoundedReliabilityOperation({ maxAttempts: 3, timeoutMs: 100, retryable: () => false, operation: async () => { throw new Error("terminal"); } });
assert.deepEqual({ ok: terminalJob.ok, attempts: terminalJob.attempts, retries: terminalJob.retries }, { ok: false, attempts: 1, retries: 0 });

let providerCalls = 0;
const transient = await runBoundedReliabilityOperation({ maxAttempts: 3, timeoutMs: 100, retryable: (error) => ["rate_limited", "server_error", "network_error", "timeout"].includes(error.message), operation: async () => { providerCalls += 1; if (providerCalls < 3) throw new Error(providerCalls === 1 ? "rate_limited" : "server_error"); return { ok: true }; } });
assert.equal(transient.ok, true);
assert.equal(transient.attempts, 3);
await assert.rejects(() => runBoundedReliabilityOperation({ maxAttempts: 4, timeoutMs: 100, retryable: () => true, operation: async () => true }), /RETRY_LIMIT/);
const malformed = await runBoundedReliabilityOperation({ maxAttempts: 3, timeoutMs: 100, retryable: () => false, operation: async () => { throw new Error("malformed_response"); } });
assert.equal(malformed.attempts, 1);
assert.equal(malformed.retries, 0);
for (const failure of ["timeout", "network_error", "server_error", "rate_limited"]) {
  let calls = 0;
  const result = await runBoundedReliabilityOperation({
    maxAttempts: 2,
    timeoutMs: 20,
    retryable: (error) => error.message === failure || error.message === "timeout",
    operation: async () => {
      calls += 1;
      if (failure === "timeout" && calls === 1) return new Promise(() => undefined);
      if (calls === 1) throw new Error(failure);
      return "recovered";
    },
  });
  assert.equal(result.ok, true, `${failure} recovers within the bounded ceiling`);
  assert.equal(calls, 2);
}

const exports = createIdempotentReliabilityExecutor();
let exportCalls = 0;
const first = exports.execute("export:project-1:attempt-1", async () => { exportCalls += 1; return "movie"; });
const second = exports.execute("export:project-1:attempt-1", async () => { exportCalls += 1; return "duplicate"; });
assert.equal(await first, "movie");
assert.equal(await second, "movie");
assert.equal(exportCalls, 1, "duplicate export operation is coalesced");
const normalExport = await runBoundedReliabilityOperation({ maxAttempts: 1, timeoutMs: 50, retryable: () => false, operation: async () => Buffer.alloc(4 * 1024 * 1024) });
assert.equal(normalExport.ok && normalExport.result.byteLength, 4 * 1024 * 1024, "large-but-safe package fixture completes");
const delayedExport = await runBoundedReliabilityOperation({ maxAttempts: 1, timeoutMs: 50, retryable: () => false, operation: async () => { await new Promise((resolve) => setTimeout(resolve, 5)); return "delayed"; } });
assert.equal(delayedExport.ok, true);
const timedOutExport = await runBoundedReliabilityOperation({ maxAttempts: 1, timeoutMs: 5, retryable: () => false, operation: async () => new Promise(() => undefined) });
assert.equal(timedOutExport.ok, false);
let temporaryExportArtifact = true;
const failedExport = await runBoundedReliabilityOperation({ maxAttempts: 1, timeoutMs: 50, retryable: () => false, operation: async () => { try { throw new Error("railway_failure"); } finally { temporaryExportArtifact = false; } } });
assert.equal(failedExport.ok, false);
assert.equal(temporaryExportArtifact, false, "failed export cleans its synthetic temporary artifact");
let restartCalls = 0;
const restartedExport = await runBoundedReliabilityOperation({ maxAttempts: 2, timeoutMs: 50, retryable: (error) => error.message === "connection_lost", operation: async () => { restartCalls += 1; if (restartCalls === 1) throw new Error("connection_lost"); return "restarted"; } });
assert.equal(restartedExport.ok, true);
assert.equal(restartCalls, 2);

await assert.rejects(observePersistenceOperation("rpc", "queue_claim", async () => { throw new Error("rpc unavailable"); }), /rpc unavailable/);
const metrics = getMetricSnapshot();
for (const metric of [...metrics.counters, ...metrics.histograms]) {
  assert.equal(JSON.stringify(metric.labels).includes(ownerUserId), false);
  assert.ok(Object.values(metric.labels).every((value) => String(value).length <= 80));
}

console.log("STAGE_0_11C_BOTTLENECK_RELIABILITY_RECOVERY=PASS");
