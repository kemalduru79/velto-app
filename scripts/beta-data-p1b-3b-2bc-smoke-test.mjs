import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const read = (file) => fs.readFileSync(file, "utf8");
const creator = read("app/api/creator-video/route.ts");
const jobs = read("app/api/jobs/[jobId]/route.ts");
const output = read("app/api/jobs/[jobId]/output/route.ts");
const internal = read("app/api/internal/jobs/[jobId]/provider-status/route.ts");
const storage = read("app/api/creator-store-video/route.ts");
const boundedReader = read("lib/security/boundedVideoResponse.ts");
const creatorBoundary = read("lib/security/creatorApiBoundary.ts");
const safetySource = read("lib/security/videoJobPublicSafety.ts");
const worker = read("scripts/scale-worker.mjs");
const page = read("app/create/page.tsx");
const bindingSource = read("lib/security/persistedVideoJobBinding.ts");

const success = creator.slice(creator.indexOf("reservation = null"), creator.indexOf("} catch", creator.indexOf("reservation = null")));
assert.match(success, /queueJobId:\s*queueJob\.id/);
assert.doesNotMatch(success, /\btaskId\b|nativeTaskId|providerKey|providerRequestId|creditReservationId/);
assert.doesNotMatch(creator, /export const GET/);
assert.match(creator, /response\.headers\.set\("Cache-Control", "no-store"\)/);

assert.match(page, /fetch\(`\/api\/jobs\/\$\{encodeURIComponent\(queueJobId\)\}`/);
assert.match(page, /method:\s*"DELETE"/);
assert.doesNotMatch(page, /videoUrl:\s*(?:outputUrl|data\.job\.output)/);
assert.doesNotMatch(page, /const outputUrl = String\(data\.job\.output/);
assert.match(page, /videoJobId:\s*isCreatorLabFlow \? videoQueueJobId : data\.taskId/);
assert.doesNotMatch(page, /\/api\/creator-video\?taskId/);
const storeHelper = page.slice(page.indexOf("const storeCompletedVideo"), page.indexOf("const pollVideoQueueJob"));
assert.match(storeHelper, /fetch\(\s*"\/api\/creator-store-video"/);
assert.match(storeHelper, /JSON\.stringify\(\{\s*queueJobId,\s*\}\)/);
assert.doesNotMatch(storeHelper, /taskId|nativeTaskId|provider|videoUrl,/);
const queuePoll = page.slice(page.indexOf("const pollVideoQueueJob"), page.indexOf("const getCreatorCinematicVideoInputs"));
const queueWait = page.slice(page.indexOf("const waitForQueuedVideoAndStore"), page.indexOf("const generateSceneVideoAndWait"));
assert.match(queuePoll, /storeCompletedVideo\(\{ queueJobId \}\)/);
assert.match(queuePoll, /videoStorageInFlightRef\.current\[sceneId\]/);
assert.match(queuePoll, /delete videoStorageInFlightRef\.current\[sceneId\]/);
assert.match(queuePoll, /let providerSucceeded = false/);
assert.match(queuePoll, /attempts > maxAttempts && !providerSucceeded/);
const queueStore = queuePoll.indexOf("await storeCompletedVideo({ queueJobId })");
const queueClear = queuePoll.indexOf("clearVideoPollForScene(sceneId)", queueStore);
assert.ok(queueStore >= 0 && queueClear > queueStore, "polling must clear only after durable storage succeeds");
assert.doesNotMatch(queuePoll, /fetch\(getVideoApiEndpoint\(|method:\s*"POST"[\s\S]*creator-video/);
assert.match(queuePoll, /Video storage is temporarily unavailable\. Velto Studio will retry automatically\./);
assert.match(queueWait, /storeCompletedVideo\(\{ queueJobId \}\)/);
assert.doesNotMatch(queueWait, /fetch\(getVideoApiEndpoint\(|creator-video/);
assert.match(page, /data\.job\.failureMessage/);
assert.doesNotMatch(page, /data\.job\.errorMessage/);
assert.match(page, /const isQueueJobId/);
assert.match(page, /failClosedLegacyCreatorVideo/);
const reloadStart = page.lastIndexOf("useEffect(() => {", page.indexOf("scenes.forEach((scene)"));
const reloadEffect = page.slice(reloadStart, page.indexOf("useEffect(() => {", reloadStart + 20));
assert.match(reloadEffect, /isQueueJobId\(scene\.videoQueueJobId\)[\s\S]*isQueueJobId\(scene\.videoJobId\)/);
assert.match(reloadEffect, /else failClosedLegacyCreatorVideo\(scene\.id\)/);

for (const route of [jobs, output]) {
  assert.ok(route.indexOf("authenticateRequest(req)") < route.indexOf("getPersistenceServices()"));
  assert.ok(route.indexOf("isValidQueueJobId(jobId)") < route.indexOf("getForUser("));
  assert.match(route, /"Cache-Control":\s*"(?:private, )?no-store/);
}
assert.match(jobs, /jobQueue\.getForUser\([\s\S]*principal\.id/);
assert.match(jobs, /Job was not found\." \}, 404/);
const projection = jobs.slice(jobs.indexOf("function publicJob"), jobs.indexOf("function routeError"));
assert.doesNotMatch(projection, /\b(?:payload|result|leaseOwner|leaseExpiresAt|idempotencyKey|providerTaskId|creditReservationId|traceId):/);
assert.match(projection, /\/api\/jobs\/\$\{encodeURIComponent\(job\.id\)\}\/output/);
assert.doesNotMatch(output, /searchParams\.get|req\.json|req\.body/);
assert.doesNotMatch(jobs.slice(jobs.indexOf("async function deleteHandler")), /parseVideoJobToken|req\.json/);
assert.match(jobs, /released:\s*false[\s\S]*charged:\s*true/);
assert.doesNotMatch(jobs, /cancellation,\s*$/m);
assert.doesNotMatch(jobs, /cancellation\.message|error instanceof Error \? error\.message/);
assert.match(jobs, /canonicalVideoFailure\(job\.errorCode\)/);
assert.doesNotMatch(output, /console\.error\([^\n]*error\)/);

const storageAuth = storage.indexOf("enforceCreatorApiBoundary<Record<string, unknown>>(");
const storageOwner = storage.indexOf("jobQueue.getForUser(");
const storageProvider = storage.indexOf("getVideoProvider(binding.provider)");
const storageUpload = storage.indexOf("objectStorage.uploadPublic(");
assert.ok(storageAuth >= 0 && storageAuth < storageOwner && storageOwner < storageProvider && storageProvider < storageUpload);
assert.match(storage, /req,\s*"creator-store-video"/);
assert.match(creatorBoundary.slice(creatorBoundary.indexOf('"creator-store-video"')), /rateLimit:\s*6[\s\S]*windowMs:\s*60_000/);
assert.match(storage, /Object\.keys\(input\)\.some\(\(key\) => key !== "queueJobId"\)/);
assert.match(storage, /job\.status !== "succeeded"[\s\S]*job\.result\?\.outputReady !== true/);
assert.match(storage, /validatePersistedVideoJobBinding\(job\)/);
assert.match(storage, /MAX_CREATOR_VIDEO_BYTES/);
assert.match(storage, /readBoundedVerifiedVideoResponse\([\s\S]*MAX_CREATOR_VIDEO_BYTES/);
assert.match(storage, /queue-\$\{input\.queueJobId\}/);
assert.match(storage, /upsert:\s*true/);
assert.doesNotMatch(storage, /randomUUID|safeRemoteMediaFetch\(|input\.videoUrl|input\.taskId|input\.provider/);
assert.doesNotMatch(storage, /\.arrayBuffer\(\)/);
assert.doesNotMatch(storage, /console\.error\([^\n]*error\)|error\.message/);
assert.match(boundedReader, /response\.body\.getReader\(\)/);
assert.match(boundedReader, /total \+= value\.byteLength/);
assert.match(boundedReader, /if \(total > maxBytes\)[\s\S]*reader\.cancel\(\)/);
assert.match(boundedReader, /Buffer\.allocUnsafe\(total\)/);
assert.match(boundedReader, /verifyMediaBytes\(/);
assert.doesNotMatch(boundedReader, /arrayBuffer\(\)/);

const tokenCheck = internal.indexOf("tokenMatches(req)");
const internalRepo = internal.indexOf("getPersistenceServices()");
const internalProvider = internal.lastIndexOf("getVideoProvider(");
assert.ok(tokenCheck >= 0 && tokenCheck < internalRepo && tokenCheck < internalProvider);
assert.match(internal, /process\.env\.VELTO_INTERNAL_WORKER_TOKEN/);
assert.match(internal, /timingSafeEqual/);
assert.match(internal, /jobQueue\.getInternal\(jobId\)/);
assert.doesNotMatch(internal, /searchParams\.get|req\.json|nativeTaskId:\s*req|provider:\s*req/);
assert.match(internal, /canonicalProviderFailure\(\)/);
assert.doesNotMatch(internal, /failureCode:\s*task|failureMessage:\s*task|console\.error\([^\n]*error\)/);

assert.match(worker, /const internalWorkerToken = process\.env\.VELTO_INTERNAL_WORKER_TOKEN/);
assert.match(worker, /api\/internal\/jobs\/\$\{encodeURIComponent\(queueJobId\)\}\/provider-status/);
assert.doesNotMatch(worker, /creator-video\?taskId|encodeURIComponent\(taskId\)|\btaskId\b/);
assert.doesNotMatch(worker, /log\([^\n]*internalWorkerToken|console\.[^(]+\([^\n]*internalWorkerToken/);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "velto-2bc-binding-"));
try {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const stripped = bindingSource
    .replace(/import type \{ VeltoJobRecord \}[\s\S]*?;\n/, "type VeltoJobRecord = any;\n")
    .replace(/import \{[\s\S]*?\} from "@\/lib\/video\/providers";\n/, `type VideoProviderKey = "runway" | "veo";\nfunction parseVideoJobToken(value: string) {\n  if (!value.startsWith("velto_vp1_")) return null;\n  try { const parsed = JSON.parse(Buffer.from(value.slice(10), "base64url").toString("utf8")); return parsed; } catch { return null; }\n}\n`);
  const compiled = ts.transpileModule(stripped, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const target = path.join(temp, "binding.cjs");
  fs.writeFileSync(target, compiled);
  const boundary = require(target);
  const safetyTarget = path.join(temp, "videoJobPublicSafety.cjs");
  fs.writeFileSync(safetyTarget, ts.transpileModule(safetySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const safety = require(safetyTarget);
  const sensitive = "RUNWAY_SECRET native-task-123 https://provider.example/output";
  const safeFailure = safety.canonicalVideoFailure(sensitive);
  assert.equal(safeFailure.failureCode, "VIDEO_GENERATION_FAILED");
  assert.equal(safeFailure.failureMessage, "Video production could not be completed.");
  assert.doesNotMatch(JSON.stringify(safeFailure), /RUNWAY_SECRET|native-task-123|provider\.example/);
  const id = "c806716b-77f5-4952-89a6-5f7fdd62fdf1";
  const token = (provider, nativeTaskId) => `velto_vp1_${Buffer.from(JSON.stringify({ providerKey: provider, nativeTaskId })).toString("base64url")}`;
  const valid = { id, userId: "owner", jobType: "video_reconcile", payload: { provider: "runway", nativeTaskId: "native", taskId: token("runway", "native"), creditReservationId: "reservation", reservedCredits: 3, creditSettlementMode: "provider_dispatch" } };
  assert.ok(boundary.validatePersistedVideoJobBinding(valid));
  for (const mutation of [
    { id: "bad" }, { userId: null }, { jobType: "runtime_probe" },
    { payload: { ...valid.payload, provider: "bad" } },
    { payload: { ...valid.payload, nativeTaskId: "other" } },
    { payload: { ...valid.payload, taskId: token("veo", "native") } },
    { payload: { ...valid.payload, creditReservationId: 4 } },
    { payload: { ...valid.payload, reservedCredits: -1 } },
  ]) assert.equal(boundary.validatePersistedVideoJobBinding({ ...valid, ...mutation }), null);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

const currentPackageLock = fs.readFileSync("package-lock.json", "utf8");
const baselinePackageLock = execFileSync(
  "git",
  ["show", "HEAD:package-lock.json"],
  { encoding: "utf8" },
);
assert.equal(
  currentPackageLock,
  baselinePackageLock,
  "package-lock.json changed from the committed baseline",
);

for (const file of [
  ...execFileSync("git", ["ls-files", "supabase/migrations", "app/episode", "app/api/video/route.ts", "app/api/public-project", "app/api/share-project", "lib/security/publicStoryverseProjection.ts"], { encoding: "utf8" }).trim().split("\n"),
].filter(Boolean)) {
  const baseline = execFileSync("git", ["show", `HEAD:${file}`]);
  assert.equal(createHash("sha256").update(fs.readFileSync(file)).digest("hex"), createHash("sha256").update(baseline).digest("hex"), `${file} changed`);
}

assert.match(read(".env.container.example"), /^VELTO_INTERNAL_WORKER_TOKEN=/m);
console.log("BETA-DATA-P1B-3B-2B-2C queue-job owner/worker smoke test passed.");
