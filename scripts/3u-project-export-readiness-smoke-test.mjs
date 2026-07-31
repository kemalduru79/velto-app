import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const lifecyclePath = path.join(
  root,
  "lib/creator/projectExportReadiness.ts",
);
const source = fs.readFileSync(lifecyclePath, "utf8");
const compiled = ts.transpileModule(source, {
  fileName: lifecyclePath,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const lifecycleModule = { exports: {} };
new Function("module", "exports", compiled)(
  lifecycleModule,
  lifecycleModule.exports,
);

const {
  createCreatorArtifactHistory,
  createCreatorProjectExportReadiness,
  createCreatorProjectLifecycleSnapshot,
  createCreatorPublishArtifactSignature,
  parseCreatorProjectLifecycleSnapshot,
} = lifecycleModule.exports;

const base = {
  hasProductionStage: false,
  totalScenes: 0,
  visualReadyCount: 0,
  voiceReadyCount: 0,
  hasFinalVideo: false,
  currentExportSignature: "",
  storedExportSignature: "",
  publishReady: false,
  packageDownloaded: false,
  currentPublishSignature: "",
  storedPublishSignature: "",
};

const draft = createCreatorProjectExportReadiness(base);
assert.equal(draft.version, "3U");
assert.equal(draft.status, "draft");

const productionInProgress = createCreatorProjectExportReadiness({
  ...base,
  hasProductionStage: true,
  totalScenes: 4,
  visualReadyCount: 2,
  voiceReadyCount: 1,
});
assert.equal(productionInProgress.status, "production_in_progress");

const productionReady = createCreatorProjectExportReadiness({
  ...base,
  hasProductionStage: true,
  totalScenes: 4,
  visualReadyCount: 4,
  voiceReadyCount: 4,
});
assert.equal(productionReady.status, "production_ready");

const finalVideoReady = createCreatorProjectExportReadiness({
  ...base,
  hasProductionStage: true,
  totalScenes: 4,
  visualReadyCount: 4,
  voiceReadyCount: 4,
  hasFinalVideo: true,
  currentExportSignature: "final-v1",
  storedExportSignature: "final-v1",
});
assert.equal(finalVideoReady.status, "final_video_ready");
assert.equal(finalVideoReady.finalVideo.current, true);

const publishReady = createCreatorProjectExportReadiness({
  ...base,
  hasProductionStage: true,
  totalScenes: 4,
  visualReadyCount: 4,
  voiceReadyCount: 4,
  hasFinalVideo: true,
  currentExportSignature: "final-v1",
  storedExportSignature: "final-v1",
  publishReady: true,
});
assert.equal(publishReady.status, "publish_ready");

const exported = createCreatorProjectExportReadiness({
  ...base,
  hasProductionStage: true,
  totalScenes: 4,
  visualReadyCount: 4,
  voiceReadyCount: 4,
  hasFinalVideo: true,
  currentExportSignature: "final-v1",
  storedExportSignature: "final-v1",
  publishReady: true,
  packageDownloaded: true,
  currentPublishSignature: "package-v1",
  storedPublishSignature: "package-v1",
  artifactHistory: {
    hadFinalVideo: true,
    finalVideoSignature: "final-v1",
    hadPublishPackage: true,
    publishPackageSignature: "package-v1",
    packageDownloaded: true,
  },
});
assert.equal(exported.status, "exported");
assert.equal(exported.progress, 100);

const finalOutdated = createCreatorProjectExportReadiness({
  ...base,
  hasProductionStage: true,
  totalScenes: 4,
  visualReadyCount: 4,
  voiceReadyCount: 4,
  currentExportSignature: "final-v2",
  artifactHistory: {
    hadFinalVideo: true,
    finalVideoSignature: "final-v1",
  },
});
assert.equal(finalOutdated.status, "export_outdated");
assert.deepEqual(finalOutdated.outdatedReasons, ["final_video_changed"]);

const packageOutdated = createCreatorProjectExportReadiness({
  ...base,
  hasProductionStage: true,
  totalScenes: 4,
  visualReadyCount: 4,
  voiceReadyCount: 4,
  hasFinalVideo: true,
  currentExportSignature: "final-v1",
  storedExportSignature: "final-v1",
  packageDownloaded: false,
  currentPublishSignature: "package-v2",
  storedPublishSignature: "package-v1",
  artifactHistory: {
    hadFinalVideo: true,
    finalVideoSignature: "final-v1",
    hadPublishPackage: true,
    publishPackageSignature: "package-v1",
    packageDownloaded: true,
  },
});
assert.equal(packageOutdated.status, "export_outdated");
assert.deepEqual(packageOutdated.outdatedReasons, [
  "publish_package_changed",
]);

const signatureA = createCreatorPublishArtifactSignature({
  title: "A",
  metadata: { description: "B", tags: ["x", "y"] },
});
const signatureB = createCreatorPublishArtifactSignature({
  metadata: { tags: ["x", "y"], description: "B" },
  title: "A",
});
const signatureChanged = createCreatorPublishArtifactSignature({
  title: "A",
  metadata: { description: "Changed", tags: ["x", "y"] },
});
assert.equal(signatureA, signatureB);
assert.notEqual(signatureA, signatureChanged);

const history = createCreatorArtifactHistory(exported);
const snapshot = createCreatorProjectLifecycleSnapshot({
  report: exported,
  artifactHistory: history,
  updatedAt: "2026-07-31T20:00:00.000Z",
});
const restored = parseCreatorProjectLifecycleSnapshot(snapshot);
assert.equal(restored?.status, "exported");
assert.equal(restored?.artifactHistory.packageDownloaded, true);

const createPage = fs.readFileSync(
  path.join(root, "app/create/page.tsx"),
  "utf8",
);
const repository = fs.readFileSync(
  path.join(root, "lib/persistence/projects/supabaseProjectRepository.ts"),
  "utf8",
);

assert.match(createPage, /3U PROJECT & EXPORT READINESS/);
assert.match(createPage, /projectLifecycle/);
assert.match(createPage, /creatorPackageSignature/);
assert.match(createPage, /export_outdated/);
assert.match(repository, /exported_movie_result/);

console.log("3U Project & Export Readiness smoke test passed.");
