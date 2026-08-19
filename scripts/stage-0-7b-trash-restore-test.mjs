import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

async function loadTs(file) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const { classifyMediaReferenceSafety } = await loadTs("lib/persistence/media/referenceSafety.ts");
const { removeExactAssetHistoryUrl } = await loadTs("lib/persistence/projects/mediaHistoryCleanup.ts");
const inventoryRoute = fs.readFileSync("app/api/media-assets/route.ts", "utf8");
const trashRoute = fs.readFileSync("app/api/media-assets/[assetId]/trash/route.ts", "utf8");
const restoreRoute = fs.readFileSync("app/api/media-assets/[assetId]/restore/route.ts", "utf8");
const mediaRepository = fs.readFileSync("lib/persistence/media/supabaseMediaAssetRepository.ts", "utf8");
const projectRepository = fs.readFileSync("lib/persistence/projects/supabaseProjectRepository.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260818160000_stage_0_7b_safe_media_trash.sql", "utf8");
const visualCleanupUi = fs.readFileSync("components/create/CreatorVisualAssetCleanupAction.tsx", "utf8");
const projectAssetsUi = fs.readFileSync("components/create/CreatorProjectAssets.tsx", "utf8");
const createPage = fs.readFileSync("app/create/page.tsx", "utf8");

const state = (lifecycle, ...types) => classifyMediaReferenceSafety(lifecycle, types.map((referenceType) => ({ referenceType })));
for (const type of ["scene_image", "scene_video", "thumbnail", "final_video", "narration_audio", "dialogue_audio", "future_reference"]) {
  assert.equal(state("active", type).cleanupState, "IN_USE", `${type} fails closed`);
}
assert.equal(state("active", "asset_history").cleanupState, "HISTORY_ONLY");
assert.equal(state("active").cleanupState, "UNREFERENCED");
assert.equal(state("trashed", "asset_history").cleanupState, "TRASHED");
assert.throws(() => state("purged"));
assert.equal(state("active", "scene_image", "asset_history").cleanupState, "IN_USE");
assert.deepEqual(state("active", "asset_history", "asset_history"), { cleanupState: "HISTORY_ONLY", referenceCount: 2, blockingReferenceCount: 0, historyReferenceCount: 2 });

const old = "https://media.test/old.png#preview";
const scenes = [{ id: 1, image: "https://media.test/current.png", videoUrl: "https://media.test/current.mp4", audioUrl: "audio", dialogueAudioUrl: "dialogue", assetHistory: [
  { id: "old", kind: "image", url: old }, { id: "keep", kind: "image", url: "https://media.test/keep.png" },
] }, { id: 2, assetHistory: [{ id: "same", kind: "video", url: "https://media.test/old.png" }] }];
const cleaned = removeExactAssetHistoryUrl(scenes, "https://media.test/old.png");
assert.equal(cleaned.removedCount, 2);
assert.equal(cleaned.scenes[0].assetHistory.length, 1);
assert.equal(cleaned.scenes[0].assetHistory[0].id, "keep");
assert.equal(cleaned.scenes[0].image, scenes[0].image);
assert.equal(cleaned.scenes[0].videoUrl, scenes[0].videoUrl);
assert.equal(cleaned.scenes[0].audioUrl, scenes[0].audioUrl);
assert.equal(cleaned.scenes[0].dialogueAudioUrl, scenes[0].dialogueAudioUrl);
assert.equal(scenes[0].assetHistory.length, 2, "pure cleanup does not mutate input");

for (const route of [inventoryRoute, trashRoute, restoreRoute]) {
  assert.match(route, /authenticateRequest\(request\)/);
  assert.doesNotMatch(route, /ownerUserId\s*[:=].*(?:body|request)/);
}
assert.match(inventoryRoute, /listForOwner\(principal\.id\)/);
assert.match(inventoryRoute, /getReferenceSummaryForOwner\(asset\.id, principal\.id\)/);
assert.match(trashRoute, /getForOwner\(assetId, principal\.id\)/);
assert.ok(trashRoute.indexOf("getReferenceSummaryForOwner") < trashRoute.indexOf("trashForOwner"), "stale client state is never trusted");
assert.ok(trashRoute.indexOf("removeAssetHistoryUrlForOwner") < trashRoute.indexOf("replaceProjectReferences"));
assert.ok(trashRoute.indexOf("replaceProjectReferences") < trashRoute.lastIndexOf("getReferenceSummaryForOwner"));
assert.ok(trashRoute.lastIndexOf("getReferenceSummaryForOwner") < trashRoute.indexOf("trashForOwner"));
assert.match(trashRoute, /projectIds\.length !== 1/);
assert.match(trashRoute, /projectId !== projectIds\[0\]/);
assert.match(trashRoute, /remaining\.length > 0/);
assert.match(restoreRoute, /lifecycleState !== "trashed"/);
assert.match(mediaRepository, /\.eq\("id", assetId\)\.eq\("owner_user_id", requireOwner\(ownerUserId\)\)\.eq\("lifecycle_state", "trashed"\)/);
assert.match(mediaRepository, /\.neq\("lifecycle_state", "purged"\)/);
assert.match(mediaRepository, /usage\.trashedBytes \+= bytes/);
assert.match(projectRepository, /removeExactAssetHistoryUrl/);
assert.match(projectRepository, /\.eq\("id", projectId\)\.eq\("owner_user_id", ownerUserId\)/);
assert.match(projectRepository, /\.eq\("scenes", existing\.scenes\)/);
assert.match(migration, /for update of asset/);
assert.match(migration, /asset\.lifecycle_state <> 'active'/);
assert.match(migration, /if exists[\s\S]*velto_media_asset_references[\s\S]*return 'in_use'/);
assert.match(migration, /lifecycle_state = 'trashed', trashed_at = now\(\)/);
assert.match(migration, /revoke all on function public\.velto_trash_media_asset_if_unreferenced[\s\S]*grant execute[\s\S]*service_role/);
assert.doesNotMatch(inventoryRoute + trashRoute + restoreRoute + mediaRepository + migration, /storage\.from\([^)]*\)\.(?:remove|delete)|objectStorage\.(?:remove|delete)|lifecycle_state\s*=\s*'purged'/i);

// Stage 0.7 trash/restore UX now lives with the media itself in each scene's Visual tab.
assert.match(visualCleanupUi, /fetch\("\/api\/media-assets"/);
assert.match(visualCleanupUi, /Move to Trash/);
assert.match(visualCleanupUi, /Delete this version/);
assert.match(visualCleanupUi, /window\.confirm/);
assert.match(visualCleanupUi, /Restore from Trash/);
assert.match(visualCleanupUi, /In use · protected from deletion/);
assert.match(visualCleanupUi, /cleanupState === "IN_USE"/);
assert.match(visualCleanupUi, /cleanupState === "HISTORY_ONLY"/);
assert.match(visualCleanupUi, /cleanupState === "UNREFERENCED"/);
assert.match(visualCleanupUi, /cleanupState === "TRASHED"/);
assert.doesNotMatch(visualCleanupUi, /Permanent(?:ly)? delete|Delete forever/i);
assert.match(createPage, /CreatorVisualAssetCleanupAction/);
assert.match(createPage, /data-visual-media-cleanup="asset-version"/);
assert.match(createPage, /onHistoryRemoved=\{removeCreatorProjectHistoryUrl\}/);
assert.doesNotMatch(projectAssetsUi, /data-creator-media-storage|Available media|Cleanup status/);

// Physical accounting is invariant across logical Trash/Restore.
const physical = [{ state: "active", bytes: 10 }, { state: "trashed", bytes: 20 }, { state: "purged", bytes: 30 }];
const usage = (rows) => rows.filter((row) => row.state !== "purged").reduce((sum, row) => sum + row.bytes, 0);
assert.equal(usage(physical), 30);
physical[0].state = "trashed";
assert.equal(usage(physical), 30);
physical[0].state = "active";
assert.equal(usage(physical), 30);

console.log("stage-0.7b trash/restore: all checks passed");
