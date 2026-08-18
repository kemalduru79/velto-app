import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const creatorRoute = read("app/api/creator-export/route.ts");
const storyverseRoute = read("app/api/export-movie/route.ts");
const saveRoute = read("app/api/save-project/route.ts");
const exportService = read("export-service/src/server.js");
const ownership = read("lib/creator/finalMovieOwnership.server.ts");
const page = read("app/create/page.tsx");
const registry = read("lib/persistence/media/registerStoredAsset.ts");

// Authentication and owner-scoped project lookup precede export dispatch.
for (const route of [creatorRoute, storyverseRoute]) {
  assert.ok(route.indexOf("authenticateRequest(") >= 0);
  assert.ok(route.indexOf("authenticateRequest(") < route.indexOf("projectRepository.getForOwner"));
  assert.ok(route.indexOf("projectRepository.getForOwner") < route.indexOf("/export-movie"));
  assert.match(route, /if \(!project\)[\s\S]*status: 404/);
  assert.doesNotMatch(route, /body\.(?:ownerUserId|userId)\s+as/);
  assert.match(route, /registerOwnedFinalMovieResponse/);
}
assert.match(page, /const exportAccessToken = await getAccessTokenOrThrow\(\)/);
assert.match(page, /: "\/api\/export-movie"/);
assert.doesNotMatch(page.slice(page.indexOf("const exportEndpoint"), page.indexOf("const exportRequestKey")), /exportApiBase/);

// Railway accepts only the server-authenticated identity and never derives ownership from the body/path.
assert.match(exportService, /internalExportIdentity\(req\)/);
assert.match(exportService, /timingSafeEqual/);
assert.match(exportService, /body\.projectId = ownership\.projectId/);
assert.match(exportService, /creator\/\$\{ownership\.ownerUserId\}\/final\/\$\{projectId\}\/\$\{randomUUID\(\)\}\.mp4/);
assert.match(exportService, /storageBucket: "movies"/);
assert.match(exportService, /storagePath: moviePath/);
assert.match(exportService, /upsert: false/);
assert.doesNotMatch(exportService.slice(exportService.indexOf("const moviePath"), exportService.indexOf("return res.json", exportService.indexOf("const moviePath"))), /safeTitle.*moviePath|safeProjectId/);

assert.match(ownership, /mediaKind: "final_video"/);
assert.match(ownership, /mimeType: "video\/mp4"/);
assert.match(ownership, /sizeBytes: Number\(sizeBytes\)/);
assert.match(ownership, /expectedPrefix = `creator\/\$\{input\.ownerUserId\}\/final\/\$\{input\.projectId\}\//);
assert.match(registry, /Stored object registration failed; object requires reconciliation/);
assert.match(saveRoute, /findByPublicUrl\(principal\.id, exportedMovieUrl\)/);
assert.match(saveRoute, /finalMovieAsset\.mediaKind !== "final_video"/);
assert.match(saveRoute, /finalMovieAsset\.lifecycleState !== "active"/);

// Migration versions are unique, normalized, deterministic, and SQL bytes are unchanged.
const migrationFiles = fs.readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort();
assert.equal(migrationFiles.length, 9);
for (const file of migrationFiles) assert.match(file, /^\d{14}_[a-z0-9_]+\.sql$/);
const versions = migrationFiles.map((file) => file.slice(0, 14));
assert.equal(new Set(versions).size, versions.length);
assert.deepEqual(migrationFiles, [...migrationFiles].sort());
assert.equal(migrationFiles.at(-1), "20260818160000_stage_0_7b_safe_media_trash.sql");

const expectedHashes = {
  "20260728090000_foundation_p1_auth_credit_ledger.sql": "459cb55c26e55c60ce28435bb9bad4b3f7da35e1b1464daf600d08742f0fefc9",
  "20260730100000_scale_p1_job_queue.sql": "99ef660fb49f40a06d19a753a38110db086dc64eca5f206c15b9021be9e8dac3",
  "20260730110000_cancel_p1_job_cancellation.sql": "8f37b245577cdaec57049d2fd1db73ce5010a5079596d819b08e763943feb55f",
  "20260730120000_fin_p1c_credit_reconciliation.sql": "50862a6f4150d28a9d456dbc675c78980eef3b2f8747039a87b562a67c8b7dff",
  "20260731090000_scale_p1_worker_hardening.sql": "ee6ddff9756d1bc0ac7fcda86155078dc5c41aa354526ab37eb45ccfff230e73",
  "20260811100000_audio_p1_creator_music_entitlements.sql": "4443276f2623ac02cc42192e2e8a3ab58af2d7ea6cb1e76ef5d18e3a54a6afac",
  "20260811110000_audio_p2_creator_music_usage_outbox.sql": "297d7bc15fb550055fdd47b3cdd80941db67133be8ae5da7630a8823885149c3",
  "20260818100000_stage_0_7a_media_ownership_metering.sql": "3e251bea8d0c98c0fea59b68bc0fcf8e4684b9ab9474f08cc51a4bdc670d68c4",
};
for (const [file, expected] of Object.entries(expectedHashes)) assert.equal(hash(`supabase/migrations/${file}`), expected, `${file} SQL changed`);

const implementation = creatorRoute + storyverseRoute + saveRoute + exportService + ownership + registry;
assert.doesNotMatch(implementation, /\.storage\.from\([^)]*\)\.remove|hardDelete|checkout|payment|canCreateStorageIncreasingMedia/);
assert.doesNotMatch(implementation, /supabase\s+db\s+(?:push|reset)|migration\s+repair/);

console.log("stage-0.7a-2 final movie/migration baseline: all checks passed");
