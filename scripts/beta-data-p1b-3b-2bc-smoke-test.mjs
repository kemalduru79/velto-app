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
const worker = read("lib/worker/jobHandlers.mjs");
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
assert.match(queuePoll, /videoStorageInFlightRef\.current\[pollKey\]/);
assert.match(queuePoll, /delete videoStorageInFlightRef\.current\[pollKey\]/);
assert.doesNotMatch(queuePoll, /providerSucceeded/);
assert.match(queuePoll, /attempts > maxAttempts/);
const queueStore = queuePoll.indexOf("await storeCompletedVideo({ queueJobId })");
const queueClear = queuePoll.indexOf("clearVideoPollForScene(sceneId, creatorSceneId)", queueStore);
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
assert.match(reloadEffect, /else failClosedLegacyCreatorVideo\(scene\.id, scene\.creatorSceneId\)/);

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
const uploadStart = storage.indexOf("services.objectStorage.uploadPublic({");
assert.ok(uploadStart >= 0, "creator video storage upload missing");
const uploadEnd = storage.indexOf("});", uploadStart);
assert.ok(uploadEnd > uploadStart, "creator video storage upload malformed");
const uploadOptions = storage.slice(uploadStart, uploadEnd);
assert.equal((uploadOptions.match(/\bupsert\s*:/g) || []).length, 1, "exactly one upsert option required");
assert.match(uploadOptions, /\bupsert:\s*false\b/);
assert.doesNotMatch(uploadOptions, /\bupsert:\s*true\b/);
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

// The token belongs to the runtime, not to the extracted handler factory.
// Verify the full runtime -> factory -> outbound-authentication chain.
const workerTokenRuntimeSource = read("lib/worker/runtime.mjs");
const checkWorkerTokenWiring = (runtimeSource, handlerSource) => {
  assert.match(runtimeSource, /const internalWorkerToken = process\.env\.VELTO_INTERNAL_WORKER_TOKEN;/);
  assert.match(runtimeSource, /if\s*\(!supabaseUrl\s*\|\|\s*!serviceRoleKey\s*\|\|\s*!internalWorkerToken\)/);
  const callStart = runtimeSource.indexOf("createJobHandlers({");
  assert.ok(callStart >= 0, "worker handler factory call missing");
  const callEnd = runtimeSource.indexOf("});", callStart);
  assert.ok(callEnd > callStart, "worker handler factory call boundary missing");
  assert.match(runtimeSource.slice(callStart, callEnd), /\binternalWorkerToken\s*,/);
  const factoryStart = handlerSource.indexOf("export function createJobHandlers({");
  assert.ok(factoryStart >= 0, "worker handler factory missing");
  const factoryEnd = handlerSource.indexOf("}) {", factoryStart);
  assert.ok(factoryEnd > factoryStart, "worker handler argument boundary missing");
  assert.match(handlerSource.slice(factoryStart, factoryEnd), /\binternalWorkerToken\s*,/);
  // Verify each outbound operation separately: a surviving header in one route
  // must never mask loss of authentication in the other.
  const videoHandlerStart = handlerSource.indexOf("async function handleVideoReconcile(");
  const exportHandlerStart = handlerSource.indexOf("async function handleCreatorFinalExport(");
  assert.ok(videoHandlerStart >= 0 && exportHandlerStart > videoHandlerStart, "worker handler boundaries missing");
  const bearerHeader = /Authorization:\s*`Bearer \$\{internalWorkerToken\}`/;
  assert.match(handlerSource.slice(videoHandlerStart, exportHandlerStart), bearerHeader);
  assert.match(handlerSource.slice(exportHandlerStart), bearerHeader);
};
checkWorkerTokenWiring(workerTokenRuntimeSource, worker);
// Reversible, synthetic negative controls: no runtime or handler files are edited.
const missingWorkerToken = workerTokenRuntimeSource.replace(
  "const internalWorkerToken = process.env.VELTO_INTERNAL_WORKER_TOKEN;",
  "const internalWorkerToken = undefined;",
);
assert.notEqual(missingWorkerToken, workerTokenRuntimeSource);
assert.throws(() => checkWorkerTokenWiring(missingWorkerToken, worker));
const factoryCallStart = workerTokenRuntimeSource.indexOf("createJobHandlers({");
const factoryCallEnd = workerTokenRuntimeSource.indexOf("});", factoryCallStart);
const originalFactoryCall = workerTokenRuntimeSource.slice(factoryCallStart, factoryCallEnd);
const missingInjectionCall = originalFactoryCall.replace(/\binternalWorkerToken\s*,/, "");
assert.notEqual(missingInjectionCall, originalFactoryCall);
assert.throws(() => checkWorkerTokenWiring(
  workerTokenRuntimeSource.slice(0, factoryCallStart) + missingInjectionCall + workerTokenRuntimeSource.slice(factoryCallEnd),
  worker,
));
const missingAuthorization = worker.replace("Authorization: `Bearer ${internalWorkerToken}`", "Authorization: `Bearer MISSING`");
assert.notEqual(missingAuthorization, worker);
assert.throws(() => checkWorkerTokenWiring(workerTokenRuntimeSource, missingAuthorization));
// Separately prove that removing the final-export bearer header is detected.
const exportStartForMutation = worker.indexOf("async function handleCreatorFinalExport(");
assert.ok(exportStartForMutation >= 0, "final-export handler missing");
const missingExportAuthorization = worker.slice(0, exportStartForMutation) +
  worker.slice(exportStartForMutation).replace("Authorization: `Bearer ${internalWorkerToken}`", "Authorization: `Bearer MISSING`");
assert.notEqual(missingExportAuthorization, worker);
assert.throws(() => checkWorkerTokenWiring(workerTokenRuntimeSource, missingExportAuthorization));
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

// Historical baseline remains independently verifiable, while the reviewed
// security candidate is admitted by its exact content hash before integration.
const historicPackageLock = execFileSync("git", ["show", "ba55a5bdc65d9016f88f65b6411de35c9acbff97:package-lock.json"]);
assert.equal(
  createHash("sha256").update(historicPackageLock).digest("hex"),
  "1353ee06f284925a87ff1bcf3e7e22bcbd45ad853961dfdf285bdda96e852afe",
  "historical lockfile provenance changed",
);
const currentPackageLock = fs.readFileSync("package-lock.json");
assert.equal(
  createHash("sha256").update(currentPackageLock).digest("hex"),
  "0cc49f1066100518a98bdc5c78fdb05434858d8ef0046abb66f22c6009990b52",
  "dependency security candidate lockfile differs from the reviewed exact bytes",
);

// Later owner-reviewed P0 scope independently approved this exact public page.
// Keep every other historical file pinned to HEAD; never grant a prefix exception.
const REVIEWED_PUBLIC_EPISODE_PAGE = "app/episode/public/[shareId]/page.tsx";
const REVIEWED_PUBLIC_EPISODE_SHA256 = "c890688c06e40db2d0a2b66c387065842d10fc1864fa742b40945b37357b9a92";
const digestReviewedPage = (bytes) => createHash("sha256").update(bytes).digest("hex");
const assertReviewedPage = (bytes) => assert.equal(
  digestReviewedPage(bytes), REVIEWED_PUBLIC_EPISODE_SHA256,
  `${REVIEWED_PUBLIC_EPISODE_PAGE} changed`,
);
for (const file of [
  ...execFileSync("git", ["ls-files", "supabase/migrations", "app/episode", "app/api/video/route.ts", "app/api/public-project", "app/api/share-project", "lib/security/publicStoryverseProjection.ts"], { encoding: "utf8" }).trim().split("\n"),
].filter(Boolean)) {
  const bytes = fs.readFileSync(file);
  if (file === REVIEWED_PUBLIC_EPISODE_PAGE) {
    assertReviewedPage(bytes);
  } else {
    const baseline = execFileSync("git", ["show", `HEAD:${file}`]);
    assert.equal(digestReviewedPage(bytes), digestReviewedPage(baseline), `${file} changed`);
  }
}
// Negative control: an unreviewed change to the approved page must fail.
const approvedPageBytes = fs.readFileSync(REVIEWED_PUBLIC_EPISODE_PAGE);
assertReviewedPage(approvedPageBytes);
assert.throws(() => assertReviewedPage(Buffer.concat([
  approvedPageBytes, Buffer.from("\n// synthetic unreviewed change\n"),
])), /changed/);

assert.match(read(".env.container.example"), /^VELTO_INTERNAL_WORKER_TOKEN=/m);
console.log("BETA-DATA-P1B-3B-2B-2C queue-job owner/worker smoke test passed.");
