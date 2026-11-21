import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  // Inspect the actual queued producer, never markers elsewhere in the handler.
  const accessPath = (node) => {
    if (node && ts.isIdentifier(node)) return [node.text];
    if (node && ts.isPropertyAccessExpression(node) && !node.questionDotToken) {
      const parent = accessPath(node.expression);
      if (parent) return [...parent, node.name.text];
    }
    return null;
  };
  const properties = (node) => {
    assert.ok(node && ts.isObjectLiteralExpression(node), "queue contract requires an explicit object initializer");
    const result = new Map();
    for (const property of node.properties) {
      assert.ok(ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property), "queue properties cannot be overridden by spreads or accessors");
      assert.ok(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name), "queue keys must be explicit");
      const key = property.name.text;
      assert.ok(!result.has(key), `duplicate queue property: ${key}`);
      result.set(key, ts.isPropertyAssignment(property) ? property.initializer : property.name);
    }
    return result;
  };
  const assertQueuedProducerAuthority = (source) => {
    const ast = ts.createSourceFile("creator-video.ts", source, ts.ScriptTarget.Latest, true);
    assert.equal(ast.parseDiagnostics.length, 0, "creator route must parse before queue inspection");
    const handlers = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === "postHandler");
    assert.equal(handlers.length, 1, "one authoritative postHandler is required");
    assert.ok(handlers[0].body, "postHandler must have an implementation");
    const execution = handlers[0].body.statements.filter(ts.isTryStatement);
    assert.equal(execution.length, 1, "one authoritative handler execution block is required");
    const declaration = (name) => {
      const found = execution[0].tryBlock.statements.filter(ts.isVariableStatement).flatMap((statement) =>
        statement.declarationList.declarations.filter((node) => ts.isIdentifier(node.name) && node.name.text === name)
          .map((node) => ({ node, statement })),
      );
      assert.equal(found.length, 1, `one direct ${name} declaration is required`);
      assert.ok(found[0].statement.declarationList.flags & ts.NodeFlags.Const, `${name} must retain const binding`);
      return found[0];
    };
    const producer = declaration("canonicalQueueInput");
    const call = producer.node.initializer;
    assert.ok(call && ts.isCallExpression(call) && !call.questionDotToken, "queue producer must call the canonical builder");
    assert.deepEqual(accessPath(call.expression), ["buildCanonicalCreatorVideoQueueInput"]);
    assert.equal(call.arguments.length, 1, "canonical builder requires one explicit input");
    const input = properties(call.arguments[0]);
    assert.deepEqual(accessPath(input.get("userId")), ["principal", "id"], "queued owner must be the authenticated principal");
    const runtime = properties(input.get("runtimeProfile"));
    assert.deepEqual(accessPath(runtime.get("model")), ["profile", "model"], "queued model must be the server-selected profile model");
    const queued = declaration("queueJob").node.initializer;
    assert.ok(queued && ts.isAwaitExpression(queued) && ts.isCallExpression(queued.expression), "queue job must await enqueue");
    assert.deepEqual(accessPath(queued.expression.expression), ["services", "jobQueue", "enqueue"]);
    assert.equal(queued.expression.arguments.length, 1);
    const enqueueInput = properties(queued.expression.arguments[0]);
    for (const key of ["userId", "projectId", "payload"]) {
      assert.deepEqual(accessPath(enqueueInput.get(key)), ["canonicalQueueInput", key], `enqueue ${key} must consume the inspected producer`);
    }
    return { owner: input.get("userId"), model: runtime.get("model"), call, statement: producer.statement, ast };
  };
  const producer = assertQueuedProducerAuthority(creatorRoute);
  const rewrite = (edits) => edits.toSorted((a, b) => b.node.getStart(producer.ast) - a.node.getStart(producer.ast))
    .reduce((source, { node, text }) => source.slice(0, node.getStart(producer.ast)) + text + source.slice(node.end), creatorRoute);
  for (const edits of [
    [{ node: producer.owner, text: '"forged-owner"' }],
    [{ node: producer.model, text: '"forged-model"' }],
    [{ node: producer.owner, text: '"forged-owner"' }, { node: producer.model, text: '"forged-model"' }],
    [{ node: producer.statement, text: "" }],
    [{ node: producer.call.expression, text: "unreviewedQueueBuilder" }],
  ]) assert.throws(() => assertQueuedProducerAuthority(rewrite(edits)), assert.AssertionError);
  const economicRecords = [];
  const findEconomicRecord = (node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isIdentifier(node.left) && node.left.text === "economicAttempt" && ts.isObjectLiteralExpression(node.right)) {
      economicRecords.push(node.right);
    }
    ts.forEachChild(node, findEconomicRecord);
  };
  findEconomicRecord(producer.ast);
  assert.equal(economicRecords.length, 1, "locate the unrelated economic-record control");
  const unrelated = properties(economicRecords[0]);
  assertQueuedProducerAuthority(rewrite([
    { node: unrelated.get("userId"), text: '"misleading-economic-owner"' },
    { node: unrelated.get("model"), text: '"misleading-economic-model"' },
  ]));
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
    "creatorSceneId", "creditReservationId", "creditSettlementMode", "nativeTaskId", "provider",
    "qualityMode", "reservedCredits", "runtimeProfile", "sceneId", "taskId", "traceId",
  ]);
  // Absent legacy fields remain explicit nulls, not missing or client-controlled authority.
  assert.equal(queue.payload.creatorSceneId, null);
  assert.equal(queue.payload.runtimeProfile, null);
  assert.equal(queue.payload.creditReservationId, "server-reservation");
  assert.equal(queue.payload.reservedCredits, 3);
  assert.equal(queue.payload.creditSettlementMode, "provider_dispatch");
  assert.equal(queue.payload.traceId, "server-trace");
  const creatorSceneId = "11111111-1111-4111-8111-111111111111";
  assert.equal(creator.validateCreatorVideoRequestBoundary({ creatorSceneId }).ok, true);
  for (const invalid of [null, 42, "", "bad-scene"]) {
    assert.equal(creator.validateCreatorVideoRequestBoundary({ creatorSceneId: invalid }).ok, false);
  }
  const runtimeProfile = Object.freeze({ model: "server-model", economicAttemptKey: "server-attempt" });
  const qualifiedQueue = creator.buildCanonicalCreatorVideoQueueInput({
    userId: "principal", canonicalProjectId: validProjectId, publicTaskId: "server-token",
    nativeTaskId: "server-native", provider: "runway", sceneId: 7, creatorSceneId,
    qualityMode: "standard", creditReservationId: "server-reservation", reservedCredits: 3,
    traceId: "server-trace", runtimeProfile, clientObject: { runtimeProfile: { model: "attacker" } },
  });
  assert.deepEqual(Object.keys(qualifiedQueue.payload).sort(), Object.keys(queue.payload).sort());
  assert.equal(qualifiedQueue.payload.creatorSceneId, creatorSceneId);
  assert.equal(qualifiedQueue.payload.runtimeProfile, runtimeProfile);
  assert.ok(!JSON.stringify(qualifiedQueue).includes("attacker"));
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

const creatorPost = creatorRoute.slice(creatorRoute.indexOf("async function postHandler"), creatorRoute.indexOf("async function noStorePostHandler"));
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
assert.doesNotMatch(creatorPost, /body\.projectId/);
assert.doesNotMatch(creatorPost, /\.\.\.body|\.\.\.body\.payload/);
assert.match(creatorPost, /taskId:\s*publicTaskId|publicTaskId,/);
assert.match(creatorPost, /nativeTaskId:\s*task\.nativeTaskId/);
assert.match(creatorPost, /provider:\s*selection\.provider\.key/);
assert.match(creatorPost, /creatorSceneId: typeof body\.creatorSceneId === "string" \? body\.creatorSceneId : null/);
assert.match(creatorPost, /runtimeProfile: \{ profileKey: routedProfile\?\.profileKey/);
assert.match(creatorPost, /economicAttemptKey: economicAttempt\.attemptKey/);
assert.doesNotMatch(creatorPost, /runtimeProfile: body\.runtimeProfile/);
assert.match(creatorPost, /queueJobId:\s*queueJob\.id/);
const authenticationCatch = creatorPost.indexOf("error instanceof AuthenticationError");
const creditCatch = creatorPost.indexOf("if (reservation)", creatorPost.indexOf("} catch (error: unknown)"));
const genericCreditError = creatorPost.indexOf("getCreditErrorResponse(error)");
const genericPublicError = creatorPost.indexOf("publicError(error)", genericCreditError);
assert.ok(authenticationCatch >= 0 && authenticationCatch < creditCatch && authenticationCatch < genericCreditError && authenticationCatch < genericPublicError);
const authenticationResponse = creatorPost.slice(authenticationCatch, creditCatch);
assert.match(authenticationResponse, /status:\s*401/);
assert.match(authenticationResponse, /"Cache-Control":\s*"no-store"/);
assert.match(authenticationResponse, /error:\s*"Authentication required\."/);
assert.doesNotMatch(authenticationResponse, /error\.message/);
const successResponseStart = creatorPost.indexOf("return NextResponse.json({", creatorPost.indexOf("reservation = null"));
assert.doesNotMatch(creatorPost.slice(successResponseStart, creatorPost.indexOf("  } catch", successResponseStart)), /nativeTaskId|provider:/);
assert.doesNotMatch(creatorRoute, /export const GET/);

assert.equal((read("app/create/page.tsx").match(/projectId:\s*currentProjectId \|\| undefined/g) || []).length >= 2, true);
const protectedHashes = {
  "app/api/video/route.ts": "301227c72ae7fbe7c338afb8533fc0f8dbced41c119898f832f053f17aabe3b8",
  "lib/video/providers/providerRegistry.ts": "79852da8ee6216e706c8294c5f00807f36aca7089515f98cbcf4b10c20c5a8db",
  "lib/video/providers/index.ts": "24503f121f2185064792d04e4109d9a5500e5238df4654142c3001c0179555ca",
  "lib/video/providers/types.ts": "a2d6a13d70563a2573b2818ce381e2d8fdc8a3be3047a9934cdc2274c99fffae",
  "lib/providers/mediaProviderFacade.ts": "6c7353d2d96ce24abf558ab23e6bf72382f0a728f291f0f25be4df70d629a46b",
  "lib/credits/serverMetering.ts": "0d9ecb466f09052a90d844ec361166e86a52c63ca274da3e4de3c9f02324f693",
  "lib/persistence/projects/types.ts": "107a5c59ee76c57db63287ed34eccc741531c1d18b74ad05bf54c014137e3493",
  "lib/persistence/projects/supabaseProjectRepository.ts": "3fd8a023ac0d0e3abe98f20724c4263619cbd3d75e8e11acf1dee6a9cb1d9a6e",
  "package-lock.json": "0cc49f1066100518a98bdc5c78fdb05434858d8ef0046abb66f22c6009990b52",
  "app/api/public-project/[shareId]/route.ts": "a081b5c63737c16414847071de61bc546fdc2248d0ce92a46f3fc8e197b969f6",
  "app/api/share-project/route.ts": "966214d8f7f826a5e8a0a84fbff64b53566b938fcf436a40bf3e2a96bedd1bef",
  "lib/security/publicStoryverseProjection.ts": "a7753dcab05b7737c1278edba7deb9cc3171ab70a0fca670ab7e081ff295ed18",
  "app/episode/public/[shareId]/page.tsx": "c890688c06e40db2d0a2b66c387065842d10fc1864fa742b40945b37357b9a92",
  "app/episode/[projectId]/page.tsx": "5bdfd767400592e91bb09c7773935dd666f467cd0febf72d9be7d578ca273cf9",
  "supabase/migrations/20260728090000_foundation_p1_auth_credit_ledger.sql": "459cb55c26e55c60ce28435bb9bad4b3f7da35e1b1464daf600d08742f0fefc9",
  "supabase/migrations/20260730110000_cancel_p1_job_cancellation.sql": "8f37b245577cdaec57049d2fd1db73ce5010a5079596d819b08e763943feb55f",
  "supabase/migrations/20260730120000_fin_p1c_credit_reconciliation.sql": "50862a6f4150d28a9d456dbc675c78980eef3b2f8747039a87b562a67c8b7dff",
  "supabase/migrations/20260730100000_scale_p1_job_queue.sql": "99ef660fb49f40a06d19a753a38110db086dc64eca5f206c15b9021be9e8dac3",
  "supabase/migrations/20260731090000_scale_p1_worker_hardening.sql": "ee6ddff9756d1bc0ac7fcda86155078dc5c41aa354526ab37eb45ccfff230e73",
};
for (const [file, expected] of Object.entries(protectedHashes)) assert.equal(hash(file), expected, `${file} changed`);
assert.equal(JSON.parse(read("package.json")).scripts["test:beta-data-p1b-3b-2a"], "node scripts/beta-data-p1b-3b-2a-smoke-test.mjs");
assert.doesNotMatch(boundarySource, /supabase|NextRequest|NextResponse|process\.env|getMediaProviderFacade|createTask|fetch\(/i);
console.log("BETA-DATA-P1B-3B-2A draft-compatible canonical binding smoke test passed.");
