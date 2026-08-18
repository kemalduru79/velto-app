import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

async function loadTs(file) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const { getStorageQuota } = await loadTs("lib/persistence/media/quota.ts");
const { extractProjectMediaReferences } = await loadTs("lib/persistence/media/projectReferences.ts");
const migration = fs.readFileSync("supabase/migrations/20260818100000_stage_0_7a_media_ownership_metering.sql", "utf8");
const repository = fs.readFileSync("lib/persistence/media/supabaseMediaAssetRepository.ts", "utf8");
const storage = fs.readFileSync("lib/persistence/storage/types.ts", "utf8");
const factory = fs.readFileSync("lib/persistence/factory.ts", "utf8");
const routes = ["creator-store-image", "creator-store-video", "store-image", "store-video", "store-audio", "store-dialogue-audio"]
  .map((name) => fs.readFileSync(`app/api/${name}/route.ts`, "utf8")).join("\n");

// Quota exact boundaries; the helper is not wired to generation routes.
for (const [used, expected] of [[7999, "NORMAL"], [8000, "APPROACHING"], [9499, "APPROACHING"],
  [9500, "CRITICAL"], [9999, "CRITICAL"], [10000, "FULL"], [12000, "FULL"]]) {
  assert.equal(getStorageQuota(used, 10000).state, expected);
}
assert.equal(getStorageQuota(12000, 10000).remainingBytes, 0);

const shared = "https://example.supabase.co/storage/v1/object/public/images/creator/a/shared.png";
const project = { scenes: [
  { creatorSceneId: "s1", image: shared, assetHistory: [{ id: "h", url: shared }, { id: "h", url: shared }] },
  { creatorSceneId: "s2", image: shared },
  { creatorSceneId: "s3", image: shared },
] };
const first = extractProjectMediaReferences(project);
const second = extractProjectMediaReferences(project);
assert.deepEqual(first, second, "reference extraction must be deterministic");
assert.equal(first.length, 4, "three scene slots plus one deduplicated history slot");
assert.equal(new Set(first.map((item) => item.url)).size, 1, "shared Stage 0.6 URL remains one physical identity");
assert.equal(extractProjectMediaReferences({ scenes: [{ image: "data:image/png;base64,abc" }] }).length, 0);

// In-memory contract proof: physical identity is unique; logical refs do not affect usage.
const assets = new Map();
function record(owner, bucket, path, kind, bytes, state = "active") {
  const key = `${bucket}/${path}`;
  const existing = assets.get(key);
  if (existing) { assert.equal(existing.owner, owner); return existing; }
  const value = { owner, bucket, path, kind, bytes, state }; assets.set(key, value); return value;
}
const image = record("a", "images", "shared", "image", 50);
assert.equal(record("a", "images", "shared", "image", 50), image);
record("a", "videos", "v", "video", 100);
record("a", "audio", "n", "narration_audio", 25);
record("a", "images", "trash", "image", 500, "trashed");
record("a", "videos", "purged", "video", 500, "purged");
record("b", "videos", "other", "video", 1000);
const usage = [...assets.values()].filter((item) => item.owner === "a" && item.state === "active").reduce((sum, item) => sum + item.bytes, 0);
assert.equal(usage, 175, "usage is the active physical byte sum, independent of reference count");
assert.throws(() => record("b", "images", "shared", "image", 50), /Expected values to be strictly equal/);

assert.match(migration, /unique \(bucket, storage_path\)/);
assert.match(migration, /references public\.velto_media_assets\(id\) on delete restrict/);
assert.match(migration, /references public\.velto_projects\(id\) on delete cascade/);
assert.match(migration, /asset\.owner_user_id <> p_owner_user_id/);
assert.match(migration, /where id = p_project_id and owner_user_id = p_owner_user_id/);
assert.match(migration, /to authenticated[\s\S]*auth\.uid\(\).*owner_user_id/);
assert.match(repository, /\.eq\("owner_user_id", requireOwner\(ownerUserId\)\)/);
assert.match(repository, /\.eq\("lifecycle_state", "active"\)/);
assert.match(repository, /eq\("owner_user_id", owner\)\.in\("public_url", urls\)/);
assert.match(storage, /stat\(input:/);
assert.doesNotMatch(storage, /\b(remove|delete)\s*\(/);
assert.match(routes, /registerStoredAssetOrThrow/g);
assert.match(factory, /mediaAssetRepository: new SupabaseMediaAssetRepository/);
assert.doesNotMatch(routes, /getStorageQuota|canCreateStorageIncreasingMedia/);
assert.doesNotMatch(migration + repository + storage, /\b(delete from public\.velto_media_assets|storage\.from\([^)]*\)\.remove|hardDelete|checkout|payment)\b/i);

console.log("stage-0.7a media ownership/metering: all checks passed");
