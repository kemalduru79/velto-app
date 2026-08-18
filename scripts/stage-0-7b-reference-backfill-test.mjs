import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

async function loadTs(file) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const { extractProjectMediaReferences, inspectProjectMediaReferences } = await loadTs(
  "lib/persistence/media/projectReferences.ts",
);
const { classifyMediaReferenceSafety } = await loadTs("lib/persistence/media/referenceSafety.ts");
const backfill = fs.readFileSync("scripts/stage-0-7b-backfill-media-references.mjs", "utf8");
const repository = fs.readFileSync("lib/persistence/media/supabaseMediaAssetRepository.ts", "utf8");
const storage = fs.readFileSync("lib/persistence/storage/types.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260818100000_stage_0_7a_media_ownership_metering.sql", "utf8");

const shared = "https://example.supabase.co/storage/v1/object/public/images/shared.png";
const video = "https://example.supabase.co/storage/v1/object/public/videos/v.mp4";
const finalVideo = "https://example.supabase.co/storage/v1/object/public/movies/final.mp4";
const thumbnail = "https://example.supabase.co/storage/v1/object/public/images/thumb.png";
const project = {
  id: "project-a",
  owner_user_id: "user-a",
  scenes: [
    { creatorSceneId: "s1", image: shared, imageUrl: shared, videoUrl: video,
      assetHistory: [{ id: "history", url: shared }, { id: "history", url: shared }] },
    { creatorSceneId: "s2", image: shared },
    { creatorSceneId: "s3", image: shared },
  ],
  exported_movie_url: finalVideo,
  youtube_thumbnail: { imageUrl: thumbnail, sourceImageUrl: thumbnail },
};
const references = extractProjectMediaReferences(project);
assert.equal(references.filter((reference) => reference.referenceType === "scene_image").length, 3);
assert.equal(references.filter((reference) => reference.referenceType === "asset_history").length, 1);
assert.equal(references.filter((reference) => reference.referenceType === "scene_video").length, 1);
assert.equal(references.filter((reference) => reference.referenceType === "final_video").length, 1);
assert.equal(references.filter((reference) => reference.referenceType === "thumbnail").length, 2);
assert.equal(new Set(references.filter((reference) => reference.url === shared).map((reference) => reference.referenceKey)).size, 4);
assert.deepEqual(references, extractProjectMediaReferences(project), "extraction is deterministic");

const discarded = inspectProjectMediaReferences({ scenes: [{ image: "data:image/png;base64,a" }, { videoUrl: "not a URL" }] });
assert.equal(discarded.references.length, 0);
assert.equal(discarded.unknownReferenceCount, 2);

// Resolution contract: exact URL plus project owner, never URL alone.
const assets = [
  { id: "shared", owner_user_id: "user-a", public_url: shared },
  { id: "video", owner_user_id: "user-a", public_url: video },
  { id: "final", owner_user_id: "user-a", public_url: finalVideo },
  { id: "thumb", owner_user_id: "user-a", public_url: thumbnail },
];
const byUrl = new Map(assets.map((asset) => [asset.public_url, asset]));
const resolved = references.flatMap((reference) => {
  const asset = byUrl.get(reference.url);
  return asset?.owner_user_id === project.owner_user_id ? [{ ...reference, assetId: asset.id }] : [];
});
assert.equal(new Set(resolved.map((reference) => reference.assetId)).size, 4, "logical reuse does not duplicate physical assets");
assert.equal(resolved.length, references.length);
assert.equal(byUrl.has("https://external.example/image.png"), false, "external URL is not promoted");
assert.equal(byUrl.has("https://example.supabase.co/storage/v1/object/public/images/unregistered.png"), false, "unregistered first-party URL is not guessed");
assert.equal(byUrl.get(shared).owner_user_id === "user-b", false, "User A cannot resolve User B ownership");

const graph = new Map();
const replace = (projectId, rows) => graph.set(projectId, JSON.stringify(rows));
replace(project.id, resolved);
const firstApply = graph.get(project.id);
replace(project.id, resolved);
assert.equal(graph.get(project.id), firstApply, "second replacement is idempotent");

assert.equal(classifyMediaReferenceSafety("active", 1), "IN_USE");
assert.equal(classifyMediaReferenceSafety("active", 0), "UNREFERENCED");
assert.equal(classifyMediaReferenceSafety("trashed", 10), "TRASHED");
assert.throws(() => classifyMediaReferenceSafety("purged", 0));

assert.match(backfill, /NEXT_PUBLIC_SUPABASE_URL/);
assert.match(backfill, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(backfill, /const apply = process\.argv\.includes\("--apply"\)/);
assert.match(backfill, /lib\/persistence\/media\/projectReferences\.ts/);
assert.ok(backfill.indexOf("if (apply && conflicts.length)") < backfill.indexOf("supabase.rpc"), "owner conflict blocks every apply RPC");
assert.match(backfill, /\.eq\("owner_user_id"|asset\.owner_user_id !== project\.owner_user_id/);
assert.match(backfill, /velto_replace_project_media_references/);
assert.match(backfill, /physicalAfter\.count !== physicalBefore\.count/);
for (const field of ["projectCount", "projectsWithTrackedReferences", "trackedAssetCount", "resolvedReferenceCount",
  "unresolvedRegisteredReferenceCount", "externalReferenceCount", "unknownReferenceCount", "projectsWithOwnerConflicts",
  "ownerConflictCount", "activeTrackedAssetCount", "activeTrackedAssetsWithReferences", "activeTrackedAssetsWithoutReferences"]) {
  assert.match(backfill, new RegExp(`\\b${field}\\b`));
}
assert.match(repository, /getReferenceSummaryForOwner/);
assert.match(repository, /\.eq\("asset_id", assetId\)\.eq\("owner_user_id", owner\)/);
assert.match(migration, /asset\.owner_user_id <> p_owner_user_id/);
assert.doesNotMatch(backfill + repository + storage, /storage\.from\([^)]*\)\.remove|objectStorage\.remove|hardDelete/);
assert.doesNotMatch(backfill, /lifecycle_state\s*:|\.from\("velto_media_assets"\)[\s\S]{0,120}\.(?:insert|update|upsert|delete)\(/i);
assert.doesNotMatch(backfill + repository, /canCreateStorageIncreasingMedia|checkout|billing|payment/i);

console.log("stage-0.7b reference backfill: all checks passed");
