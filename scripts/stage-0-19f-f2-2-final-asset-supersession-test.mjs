import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

import { DEFAULT_TRASH_RETENTION_DAYS } from "../lib/persistence/media/purgePolicy.ts";

const helperSource = fs.readFileSync(new URL("../lib/persistence/media/supersededFinalVideo.server.ts", import.meta.url), "utf8").replace('import "server-only";', "");
const helperCompiled = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { reconcileSupersededFinalVideosForProject } = await import(`data:text/javascript;base64,${Buffer.from(helperCompiled).toString("base64")}`);

const finalAsset = (id, overrides = {}) => ({
  id, ownerUserId: "owner-1", bucket: "movies",
  storagePath: `creator/owner-1/final/project-1/${id}.mp4`,
  publicUrl: `https://media.example/${id}.mp4`, mediaKind: "final_video",
  mimeType: "video/mp4", sizeBytes: 1_000, lifecycleState: "active",
  trashedAt: null, purgeStartedAt: null, metadata: { projectId: "project-1" },
  ...overrides,
});

function dependencies(assets, input = {}) {
  const calls = [];
  const byId = new Map(assets.map((item) => [item.id, item]));
  return { calls, value: {
    mediaAssetRepository: {
      listFinalVideosForProject: async (...args) => { calls.push(["list", ...args]); return assets; },
      getForOwner: async (id, owner) => { calls.push(["get", id, owner]); return byId.get(id) || null; },
      trashForOwner: async (id, owner) => { calls.push(["trash", id, owner]); return input.trashStatuses?.[id] || "trashed"; },
      beginPurgeForOwner: async (id, owner, days) => {
        calls.push(["begin", id, owner, days]);
        return { status: "ready", assetId: id, bucket: "movies", storagePath: byId.get(id).storagePath, purgeToken: `purge-${id}`, sizeBytes: 1_000, mediaKind: "final_video" };
      },
      completePurgeForOwner: async (id, owner, token) => { calls.push(["complete", id, owner, token]); if (input.completeErrors?.[id]) throw input.completeErrors[id]; return "purged"; },
      abortPurgeForOwner: async (...args) => { calls.push(["abort", ...args]); return "aborted"; },
    },
    objectStorage: {
      removeObject: async (location) => {
        const id = assets.find((item) => item.storagePath === location.path)?.id;
        calls.push(["remove", id, location]);
        if (id && input.removeErrors?.[id]) throw input.removeErrors[id];
      },
    },
  } };
}

async function reconcile(assets, currentId, input) {
  const deps = dependencies(assets, input);
  const result = await reconcileSupersededFinalVideosForProject({ ownerUserId: "owner-1", projectId: "project-1", authoritativePublicUrl: `https://media.example/${currentId}.mp4`, dependencies: deps.value });
  return { deps, result };
}

const first = await reconcile([finalAsset("v1")], "v1");
assert.deepEqual(first.result.results, []);
assert.equal(first.deps.calls.some(([name]) => name === "trash"), false);

const direct = await reconcile([finalAsset("v1"), finalAsset("v2")], "v2");
assert.deepEqual(direct.result.results.map(({ assetId, status }) => [assetId, status]), [["v1", "purged"]]);
assert.equal(direct.deps.calls.some(([name, id]) => name === "trash" && id === "v2"), false);

// Project metadata discovers V1 even when an intermediate invalidation cleared exported_movie_url.
const clearedLineage = await reconcile([finalAsset("v1"), finalAsset("v2")], "v2");
assert.deepEqual(clearedLineage.result.results.map(({ assetId }) => assetId), ["v1"]);

// An unchanged authoritative V2 URL remains a safe retry opportunity for stale V1.
const sameUrlRetry = await reconcile([finalAsset("v1"), finalAsset("v2")], "v2");
assert.deepEqual(sameUrlRetry.result.results.map(({ assetId }) => assetId), ["v1"]);
assert.equal(sameUrlRetry.deps.calls.some(([name, id]) => name === "remove" && id === "v2"), false);

const multiple = await reconcile([finalAsset("v1"), finalAsset("v2"), finalAsset("v3")], "v3");
assert.deepEqual(multiple.result.results.map(({ assetId }) => assetId), ["v1", "v2"]);
assert.equal(multiple.deps.calls.some(([name, id]) => name === "trash" && id === "v3"), false);
assert.ok(multiple.deps.calls.filter(([name]) => name === "begin").every((call) => call[3] === 0));

const referenced = await reconcile([finalAsset("v1"), finalAsset("v2")], "v2", { trashStatuses: { v1: "in_use" } });
assert.equal(referenced.result.results[0].status, "in_use");
assert.equal(referenced.deps.calls.some(([name]) => name === "remove"), false);

for (const invalid of [
  finalAsset("foreign", { ownerUserId: "owner-2" }),
  finalAsset("wrong-project", { metadata: { projectId: "project-2" } }),
  finalAsset("wrong-kind", { mediaKind: "video" }),
]) {
  const guarded = await reconcile([invalid, finalAsset("v2")], "v2");
  assert.equal(guarded.result.results[0].status, "asset_mismatch");
  assert.equal(guarded.deps.calls.some(([name]) => name === "remove"), false);
}

const removalFailure = await reconcile([finalAsset("v1"), finalAsset("v2")], "v2", { removeErrors: { v1: new Error("remove failed") } });
assert.equal(removalFailure.result.results[0].status, "storage_remove_failed");
assert.equal(removalFailure.deps.calls.some(([name]) => name === "abort"), true);
assert.equal(removalFailure.deps.calls.some(([name]) => name === "complete"), false);

const completionFailure = await reconcile([finalAsset("v1"), finalAsset("v2")], "v2", { completeErrors: { v1: new Error("complete failed") } });
assert.equal(completionFailure.result.results[0].status, "recovery_required");
assert.equal(completionFailure.deps.calls.some(([name]) => name === "abort"), false);
assert.equal(DEFAULT_TRASH_RETENTION_DAYS, 30);

const repository = fs.readFileSync(new URL("../lib/persistence/media/supabaseMediaAssetRepository.ts", import.meta.url), "utf8");
assert.match(repository, /listFinalVideosForProject/u);
assert.match(repository, /\.eq\("owner_user_id", requireOwner\(ownerUserId\)\)/u);
assert.match(repository, /\.eq\("media_kind", "final_video"\)/u);
assert.match(repository, /\.neq\("lifecycle_state", "purged"\)/u);
assert.match(repository, /\.contains\("metadata", \{ projectId \}\)/u);

const route = fs.readFileSync(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
const saveAt = route.indexOf("projectRepository.saveForOwner");
const referencesAt = route.indexOf("replaceProjectReferences", saveAt);
const cleanupAt = route.indexOf("reconcileSupersededFinalVideosForProject", referencesAt);
const cleanupTryAt = route.lastIndexOf("try {", cleanupAt);
const responseAt = route.indexOf("return NextResponse.json({ success: true, ...result, mediaReferenceSync });", cleanupAt);
assert.ok(saveAt >= 0 && referencesAt > saveAt && cleanupAt > referencesAt);
assert.match(route, /flowType === "creator_lab" && mediaReferenceSync === "ok" &&[\s\S]*authoritativeExportedMovieUrl/u);
assert.match(route, /creatorProjectMismatch = flowType === "creator_lab" && projectId &&[\s\S]*finalMovieAsset\?\.metadata\?\.projectId !== projectId/u);
assert.match(route, /SUPERSEDED_FINAL_VIDEO_PURGED/u);
assert.match(route, /SUPERSEDED_FINAL_VIDEO_CLEANUP_DEFERRED/u);
assert.match(route.slice(cleanupTryAt, responseAt), /try \{[\s\S]*reconcileSupersededFinalVideosForProject[\s\S]*\} catch \(cleanupError\)/u);
assert.doesNotMatch(route, /previousExportedMovieUrl|supersededFinalVideoUrl/u);

console.log("stage-0-19f-f2-2-final-asset-supersession-test: PASS");
