import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const read = (file) => fs.readFileSync(file, "utf8");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const boundarySource = read("lib/security/creatorVideoTaskBindingBoundary.ts");
const publicPolicySource = read("lib/security/jobProjectOwnershipBoundary.ts");
const jobsRoute = read("app/api/jobs/route.ts");
const creatorRoute = read("app/api/creator-video/route.ts");

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "velto-creator-binding-"));
try {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const compile = (source, name) => {
    const output = path.join(temporaryDirectory, `${name}.cjs`);
    fs.writeFileSync(output, ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText);
    return require(output);
  };
  const creator = compile(boundarySource, "creatorVideoTaskBindingBoundary");
  const publicPolicy = compile(publicPolicySource, "jobProjectOwnershipBoundary");
  const validProjectId = "c806716b-77f5-4952-89a6-5f7fdd62fdf1";

  for (const body of [{}, { projectId: null }, { projectId: "" }, { projectId: "  " }]) {
    const snapshot = structuredClone(body);
    const result = creator.validateCreatorVideoRequestBoundary(body);
    assert.equal(result.ok, true);
    assert.deepEqual(result.projectBinding, { mode: "authenticated_draft", requestedProjectId: null });
    assert.deepEqual(body, snapshot);
  }
  const saved = creator.validateCreatorVideoRequestBoundary({ projectId: ` ${validProjectId} ` });
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.projectBinding, { mode: "saved_project", requestedProjectId: validProjectId });
  for (const projectId of [1, true, {}, [], "bad/id", "x".repeat(129)]) {
    assert.equal(creator.validateCreatorVideoRequestBoundary({ projectId }).ok, false);
  }
  assert.equal(creator.validateCreatorVideoRequestBoundary([]).ok, false);
  for (const field of creator.CREATOR_VIDEO_RESERVED_CLIENT_FIELDS) {
    assert.equal(creator.validateCreatorVideoRequestBoundary({ [field]: "client" }).ok, false, field);
    assert.equal(creator.validateCreatorVideoRequestBoundary({ payload: { [field]: "client" } }).ok, false, `payload.${field}`);
  }

  const queue = creator.buildCanonicalCreatorVideoQueueInput({
    userId: "principal", canonicalProjectId: null, publicTaskId: "server-token",
    nativeTaskId: "server-native", provider: "runway", sceneId: 7,
    qualityMode: "standard", creditReservationId: "server-reservation",
    reservedCredits: 3, traceId: "server-trace", clientObject: { taskId: "attacker" },
  });
  assert.deepEqual(Object.keys(queue).sort(), ["payload", "projectId", "userId"]);
  assert.equal(queue.userId, "principal");
  assert.equal(queue.projectId, null);
  assert.deepEqual(Object.keys(queue.payload).sort(), [
    "creditReservationId", "creditSettlementMode", "nativeTaskId", "provider",
    "qualityMode", "reservedCredits", "sceneId", "taskId", "traceId",
  ]);
  assert.equal(queue.payload.taskId, "server-token");
  assert.equal(queue.payload.nativeTaskId, "server-native");
  assert.equal(queue.payload.provider, "runway");
  assert.ok(!JSON.stringify(queue).includes("attacker"));
  assert.equal(creator.buildCanonicalCreatorVideoQueueInput({ ...queue, canonicalProjectId: validProjectId, publicTaskId: "x", nativeTaskId: "y", provider: "veo", sceneId: null, qualityMode: "cinematic", creditReservationId: null, reservedCredits: 0, traceId: null }).projectId, validProjectId);

  assert.deepEqual(publicPolicy.validatePublicJobEnqueuePolicy({ jobType: "runtime_probe" }), { ok: true, jobType: "runtime_probe", projectId: null });
  assert.deepEqual(publicPolicy.validatePublicJobEnqueuePolicy({ jobType: "runtime_probe", projectId: null }), { ok: true, jobType: "runtime_probe", projectId: null });
  assert.equal(publicPolicy.validatePublicJobEnqueuePolicy({ jobType: "runtime_probe", projectId: validProjectId }).ok, false);
  assert.equal(publicPolicy.validatePublicJobEnqueuePolicy({ jobType: "video_reconcile" }).ok, false);
  assert.equal(publicPolicy.validatePublicJobEnqueuePolicy({ jobType: "unknown" }).ok, false);
  for (const payload of [
    { projectId: "any-value" }, { projectId: null }, { projectId: "" }, { project_id: "any-value" },
  ]) {
    const nestedInput = { jobType: "runtime_probe", payload };
    const nestedSnapshot = structuredClone(nestedInput);
    const nestedResult = publicPolicy.validatePublicJobEnqueuePolicy(nestedInput);
    assert.equal(nestedResult.ok, false);
    assert.equal(nestedResult.message, "runtime_probe does not accept projectId.");
    assert.deepEqual(nestedInput, nestedSnapshot);
  }
  for (const field of ["userId", "user_id", "ownerUserId", "owner_user_id"]) {
    assert.equal(publicPolicy.validatePublicJobEnqueuePolicy({ jobType: "runtime_probe", [field]: "x" }).ok, false);
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

const auth = jobsRoute.indexOf("authenticateRequest(req)");
const parse = jobsRoute.indexOf("parseBoundedJobRequestJson(req)");
const policy = jobsRoute.indexOf("validatePublicJobEnqueuePolicy(body)");
const services = jobsRoute.indexOf("getPersistenceServices()");
const enqueue = jobsRoute.indexOf("jobQueue.enqueue(");
assert.ok(auth < parse && parse < policy && policy < services && services < enqueue);
assert.doesNotMatch(jobsRoute, /video\/providers|mediaProvider|projectRepository|getForOwner/);
assert.match(jobsRoute, /userId:\s*principal\.id/);
assert.match(jobsRoute, /projectId:\s*null/);
assert.match(jobsRoute, /headers:\s*NO_STORE_HEADERS/);
assert.match(publicPolicySource, /hasOwnProperty\.call\(payload, "projectId"\)/);
assert.match(publicPolicySource, /hasOwnProperty\.call\(payload, "project_id"\)/);

const creatorPost = creatorRoute.slice(creatorRoute.indexOf("async function postHandler"), creatorRoute.indexOf("async function getHandler"));
const creatorGet = creatorRoute.slice(creatorRoute.indexOf("async function getHandler"));
const creatorAuth = creatorPost.indexOf("authenticateRequest(req)");
const creatorJson = creatorPost.indexOf("await req.json()");
const creatorBoundary = creatorPost.indexOf("validateCreatorVideoRequestBoundary(requestValue)");
const creatorServices = creatorPost.indexOf("getPersistenceServices()");
const ownerLookup = creatorPost.indexOf("projectRepository.getForOwner(");
const facade = creatorPost.indexOf("getMediaProviderFacade()");
const reserve = creatorPost.indexOf("reserveMeteredOperation(req");
const createTask = creatorPost.indexOf("provider.createTask(");
const creatorEnqueue = creatorPost.indexOf("jobQueue.enqueue(");
assert.ok(creatorAuth < creatorJson && creatorJson < creatorBoundary && creatorBoundary < creatorServices);
assert.ok(creatorServices < ownerLookup && ownerLookup < facade && ownerLookup < reserve && ownerLookup < createTask && ownerLookup < creatorEnqueue);
assert.match(creatorPost, /projectBinding\.mode === "saved_project"/);
assert.match(creatorPost, /projectBinding\.requestedProjectId,\s*principal\.id/);
assert.equal((creatorPost.match(/Project was not found\./g) || []).length, 1);
assert.match(creatorPost, /canonicalProjectId = ownedProject\.id/);
assert.match(creatorPost, /userId:\s*principal\.id/);
assert.doesNotMatch(creatorPost, /body\.projectId/);
assert.doesNotMatch(creatorPost, /\.\.\.body|\.\.\.body\.payload/);
assert.match(creatorPost, /taskId:\s*publicTaskId|publicTaskId,/);
assert.match(creatorPost, /nativeTaskId:\s*task\.nativeTaskId/);
assert.match(creatorPost, /provider:\s*selection\.provider\.key/);
assert.match(creatorPost, /taskId:\s*publicTaskId/);
assert.match(creatorPost, /queueJobId:\s*queueJob\.id/);
const authenticationCatch = creatorPost.indexOf("error instanceof AuthenticationError");
const creditCatch = creatorPost.indexOf("if (reservation)", creatorPost.indexOf("} catch (error: unknown)"));
const genericCreditError = creatorPost.indexOf("getCreditErrorResponse(error)");
const genericPublicError = creatorPost.indexOf("publicError(error)", genericCreditError);
assert.ok(authenticationCatch >= 0 && authenticationCatch < creditCatch && authenticationCatch < genericCreditError && authenticationCatch < genericPublicError);
const authenticationResponse = creatorPost.slice(authenticationCatch, creditCatch);
assert.match(authenticationResponse, /status:\s*401/);
assert.match(authenticationResponse, /"Cache-Control":\s*"no-store"/);
assert.match(authenticationResponse, /error:\s*error\.message/);
const successResponseStart = creatorPost.indexOf("return NextResponse.json({", creatorPost.indexOf("reservation = null"));
assert.doesNotMatch(creatorPost.slice(successResponseStart, creatorPost.indexOf("  } catch", successResponseStart)), /nativeTaskId|provider:/);
const baselineCreatorRoute = execFileSync("git", ["show", "HEAD:app/api/creator-video/route.ts"], { encoding: "utf8" });
const baselineGet = baselineCreatorRoute.slice(baselineCreatorRoute.indexOf("async function getHandler"), baselineCreatorRoute.indexOf("export const POST"));
assert.equal(creatorGet.slice(0, creatorGet.indexOf("export const POST")), baselineGet);

assert.equal((read("app/create/page.tsx").match(/projectId:\s*currentProjectId \|\| undefined/g) || []).length >= 2, true);
const protectedHashes = {
  "app/api/video/route.ts": "42ca514236fa78839401bab1ce9c48b586aafd58c2bc1c23a8da8cae450f770c",
  "app/api/jobs/[jobId]/route.ts": "a3818dd7283e5bc8e0e24c942ba501db4563c280afe63e0abecc869198631e12",
  "scripts/scale-worker.mjs": "b8606c705de3f5f114c51d4041cb194a93fa438b01514fed5f91a10a015d00ba",
  "app/create/page.tsx": "f4377807f3e9031e3939bfd624cdd520e955f6631595ccdb2a5650ff6c87f257",
  "lib/video/providers/providerRegistry.ts": "792105370b1368da2608a9fd909999fc6331ee0c90d20c1553208238c4d591e8",
  "lib/video/providers/index.ts": "24503f121f2185064792d04e4109d9a5500e5238df4654142c3001c0179555ca",
  "lib/video/providers/types.ts": "99236f7eac6222f0c36203b24cda3d4a48e2b2f57ad236aadfd1efb840fe6d62",
  "lib/providers/mediaProviderFacade.ts": "6c7353d2d96ce24abf558ab23e6bf72382f0a728f291f0f25be4df70d629a46b",
  "lib/credits/serverMetering.ts": "fdda6744b9663da637668e526a7a022f9adb9a31ea6963e13f893cb83fdf4ec7",
  "lib/persistence/jobs/types.ts": "5dbe0b7e589ec572f7e63977a506aec9157d2c87f69deaf67aea8aa55f5afbc7",
  "lib/persistence/jobs/supabaseJobQueueRepository.ts": "8127806e5f62cb9fe228af4739f4bc6996672efb2e1b473e8674ae2edeb99e51",
  "lib/persistence/projects/types.ts": "c5113c0cd18dc387caf9ca8af27ca55fe89c325e038934e53614e32675bd3e50",
  "lib/persistence/projects/supabaseProjectRepository.ts": "83cb306a51c31bc3d7ff40d29e757e5cdb760f0218cdf6aa31d07974f9ebdb87",
  "package-lock.json": "c806716b77f5d95279a65f7fdd62fdfaed454e3042989caa68f2fc09d0f287db",
  "app/api/public-project/[shareId]/route.ts": "a081b5c63737c16414847071de61bc546fdc2248d0ce92a46f3fc8e197b969f6",
  "app/api/share-project/route.ts": "8ce1a207ef7261346f82e9f7d921c54c3e243366dacd7eddbf1224466e93f597",
  "lib/security/publicStoryverseProjection.ts": "a7753dcab05b7737c1278edba7deb9cc3171ab70a0fca670ab7e081ff295ed18",
  "app/episode/public/[shareId]/page.tsx": "8571a245416e5b5b9f9f65197a988788c634b631941a3da817f29a2172630b55",
  "app/episode/[projectId]/page.tsx": "5bdfd767400592e91bb09c7773935dd666f467cd0febf72d9be7d578ca273cf9",
  "supabase/migrations/20260728_foundation_p1_auth_credit_ledger.sql": "459cb55c26e55c60ce28435bb9bad4b3f7da35e1b1464daf600d08742f0fefc9",
  "supabase/migrations/20260730_cancel_p1_job_cancellation.sql": "8f37b245577cdaec57049d2fd1db73ce5010a5079596d819b08e763943feb55f",
  "supabase/migrations/20260730_fin_p1c_credit_reconciliation.sql": "50862a6f4150d28a9d456dbc675c78980eef3b2f8747039a87b562a67c8b7dff",
  "supabase/migrations/20260730_scale_p1_job_queue.sql": "99ef660fb49f40a06d19a753a38110db086dc64eca5f206c15b9021be9e8dac3",
  "supabase/migrations/20260731_scale_p1_worker_hardening.sql": "ee6ddff9756d1bc0ac7fcda86155078dc5c41aa354526ab37eb45ccfff230e73",
};
for (const [file, expected] of Object.entries(protectedHashes)) assert.equal(hash(file), expected, `${file} changed`);
assert.equal(JSON.parse(read("package.json")).scripts["test:beta-data-p1b-3b-2a"], "node scripts/beta-data-p1b-3b-2a-smoke-test.mjs");
assert.doesNotMatch(boundarySource, /supabase|NextRequest|NextResponse|process\.env|getMediaProviderFacade|createTask|fetch\(/i);
console.log("BETA-DATA-P1B-3B-2A draft-compatible canonical binding smoke test passed.");
