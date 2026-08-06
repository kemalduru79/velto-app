import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const read = (file) => fs.readFileSync(file, "utf8");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const boundarySource = read("lib/security/jobProjectOwnershipBoundary.ts");
const route = read("app/api/jobs/route.ts");

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "velto-job-project-policy-"));
try {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const compiledPath = path.join(temporaryDirectory, "jobProjectOwnershipBoundary.cjs");
  fs.writeFileSync(compiledPath, ts.transpileModule(boundarySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const {
    MAX_JOB_REQUEST_BODY_BYTES,
    parseBoundedJobRequestJson,
    validatePublicJobEnqueuePolicy,
  } = require(compiledPath);
  const validProjectId = "c806716b-77f5-4952-89a6-5f7fdd62fdf1";
  assert.equal(validatePublicJobEnqueuePolicy({ jobType: "video_reconcile", projectId: validProjectId }).ok, false);
  assert.deepEqual(validatePublicJobEnqueuePolicy({ jobType: "runtime_probe" }), { ok: true, jobType: "runtime_probe", projectId: null });
  assert.deepEqual(validatePublicJobEnqueuePolicy({ jobType: "runtime_probe", projectId: null }), { ok: true, jobType: "runtime_probe", projectId: null });
  for (const projectId of [validProjectId, {}, 42, true]) {
    assert.equal(validatePublicJobEnqueuePolicy({ jobType: "runtime_probe", projectId }).ok, false);
  }
  assert.equal(validatePublicJobEnqueuePolicy({ jobType: "unknown", projectId: validProjectId }).ok, false);
  const input = { jobType: "runtime_probe" };
  const snapshot = structuredClone(input);
  const result = validatePublicJobEnqueuePolicy(input);
  assert.deepEqual(input, snapshot);
  for (const key of ["userId", "user_id", "ownerUserId", "owner_user_id"]) assert.ok(!(key in result));

  for (const field of ["userId", "user_id", "ownerUserId", "owner_user_id"]) {
    assert.equal(validatePublicJobEnqueuePolicy({ ...input, [field]: "attacker" }).code, "client_identity_not_allowed");
    assert.equal(validatePublicJobEnqueuePolicy({ ...input, payload: { ordinary: true, [field]: "attacker" } }).code, "client_identity_not_allowed");
  }
  assert.equal(validatePublicJobEnqueuePolicy({ ...input, payload: { prompt: "compatible" } }).ok, true);
  for (const payload of [
    { projectId: "any-value" },
    { projectId: null },
    { projectId: "" },
    { project_id: "any-value" },
  ]) {
    const nestedInput = { jobType: "runtime_probe", payload };
    const nestedSnapshot = structuredClone(nestedInput);
    const nestedResult = validatePublicJobEnqueuePolicy(nestedInput);
    assert.equal(nestedResult.ok, false);
    assert.equal(nestedResult.message, "runtime_probe does not accept projectId.");
    assert.deepEqual(nestedInput, nestedSnapshot);
  }

  const requestFor = (body, contentLength = null) => ({
    headers: { get: (name) => name.toLowerCase() === "content-length" ? contentLength : null },
    body,
  });
  const encoded = new TextEncoder().encode(JSON.stringify({ jobType: "runtime_probe", payload: { ordinary: true } }));
  const validStream = new ReadableStream({ start(controller) { controller.enqueue(encoded); controller.close(); } });
  assert.deepEqual(await parseBoundedJobRequestJson(requestFor(validStream)), {
    ok: true, body: { jobType: "runtime_probe", payload: { ordinary: true } },
  });

  let declaredReads = 0;
  const declaredStream = new ReadableStream({ pull() { declaredReads += 1; } }, { highWaterMark: 0 });
  assert.equal((await parseBoundedJobRequestJson(requestFor(declaredStream, String(MAX_JOB_REQUEST_BODY_BYTES + 1)))).status, 413);
  assert.equal(declaredReads, 0, "declared oversize must fail before stream consumption");

  const streamChunks = [new Uint8Array(40_000), new Uint8Array(30_000), new Uint8Array(1)];
  let chunkIndex = 0;
  let cancelled = false;
  const oversizedStream = new ReadableStream({
    pull(controller) {
      controller.enqueue(streamChunks[chunkIndex]);
      chunkIndex += 1;
      if (chunkIndex === streamChunks.length) controller.close();
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  assert.equal((await parseBoundedJobRequestJson(requestFor(oversizedStream))).status, 413);
  assert.equal(cancelled, true, "oversized chunked stream must be cancelled");
  assert.equal(chunkIndex, 2, "later chunks must not be consumed after the limit");

  const malformedStream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("{bad")); controller.close(); } });
  assert.equal((await parseBoundedJobRequestJson(requestFor(malformedStream))).status, 400);
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

const authentication = route.indexOf("authenticateRequest(req)");
const boundedParse = route.indexOf("parseBoundedJobRequestJson(req)", authentication);
const policy = route.indexOf("validatePublicJobEnqueuePolicy(body)");
const services = route.indexOf("const services = getPersistenceServices()");
const enqueue = route.indexOf("services.jobQueue.enqueue(");
assert.ok(authentication >= 0 && authentication < boundedParse && boundedParse < policy && policy < services && services < enqueue);
assert.match(boundarySource, /request\.body\.getReader\(\)/);
assert.match(boundarySource, /await reader\.cancel\(\)/);
assert.doesNotMatch(route, /req\.(?:text|json|arrayBuffer|formData)\(/);
assert.doesNotMatch(boundarySource, /request\.(?:text|json|arrayBuffer|formData)\(/);
assert.doesNotMatch(route, /projectRepository|getForOwner/);
assert.match(route, /userId:\s*principal\.id/);
assert.match(route, /projectId:\s*null/);
assert.match(boundarySource, /hasOwnProperty\.call\(payload, "projectId"\)/);
assert.match(boundarySource, /hasOwnProperty\.call\(payload, "project_id"\)/);
assert.doesNotMatch(route, /userId:\s*body|user_id:\s*body|ownerUserId:\s*body|owner_user_id:\s*body/);
assert.match(boundarySource, /jobType !== "runtime_probe"/);
assert.match(boundarySource, /runtime_probe does not accept projectId/);
assert.doesNotMatch(route, /getById|\.from\(["']velto_projects["']\)|listForOwner/);
assert.doesNotMatch(boundarySource, /supabase|provider|NextRequest|process\.env/i);

const protectedHashes = {
  "app/api/jobs/[jobId]/route.ts": "a3818dd7283e5bc8e0e24c942ba501db4563c280afe63e0abecc869198631e12",
  "scripts/scale-worker.mjs": "b8606c705de3f5f114c51d4041cb194a93fa438b01514fed5f91a10a015d00ba",
  "app/create/page.tsx": "f4377807f3e9031e3939bfd624cdd520e955f6631595ccdb2a5650ff6c87f257",
  "app/api/public-project/[shareId]/route.ts": "a081b5c63737c16414847071de61bc546fdc2248d0ce92a46f3fc8e197b969f6",
  "app/api/share-project/route.ts": "8ce1a207ef7261346f82e9f7d921c54c3e243366dacd7eddbf1224466e93f597",
  "lib/security/publicStoryverseProjection.ts": "a7753dcab05b7737c1278edba7deb9cc3171ab70a0fca670ab7e081ff295ed18",
  "scripts/beta-data-p1b-3a-smoke-test.mjs": "8c85f733c4ca7b90dfea25d6f81e629ad120690157c8b1f5fcd094792975deb0",
};
for (const [file, expected] of Object.entries(protectedHashes)) assert.equal(hash(file), expected, `${file} changed`);
assert.equal(JSON.parse(read("package.json")).scripts["test:beta-data-p1b-3b-1"], "node scripts/beta-data-p1b-3b-1-smoke-test.mjs");
assert.deepEqual(execFileSync("git", ["diff", "--name-only", "--", "supabase/migrations"], { encoding: "utf8" }), "");
console.log("BETA-DATA-P1B-3B-1 job/project ownership smoke test passed.");
