import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const validationPath = path.join(
  root,
  "lib/creator/publishReadyPackage.ts",
);
const source = fs.readFileSync(validationPath, "utf8");
const compiled = ts.transpileModule(source, {
  fileName: validationPath,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);

const { createCreatorPublishReadyPackageReport } = module.exports;

const readyInput = {
  productionPackage: {
    title: "Professional creator project",
    scenes: [{ id: 1 }],
  },
  videoUrl: "https://cdn.example.com/final.mp4",
  thumbnail: {
    imageUrl: "data:image/png;base64,AAAA",
  },
  metadata: {
    recommendedTitle: "Publish-ready title",
    description: "A publish-ready description.",
  },
  scenes: [
    {
      id: 1,
      narration: "Narration text",
    },
  ],
  targetPlatforms: ["youtube"],
  releaseChecklist: {
    systemChecks: [
      { key: "finalVideo", ready: true },
      { key: "thumbnail", ready: true },
      { key: "captions", ready: true },
      { key: "metadata", ready: true },
      { key: "ratio", ready: true },
    ],
    userConfirmations: {
      videoReviewed: true,
      claimsVerified: true,
      rightsConfirmed: true,
      thumbnailApproved: true,
    },
  },
};

const ready = createCreatorPublishReadyPackageReport(readyInput);
assert.equal(ready.version, "3R");
assert.equal(ready.status, "ready");
assert.equal(ready.canExport, true);
assert.deepEqual(ready.missingRequirementCodes, []);

const blocked = createCreatorPublishReadyPackageReport({
  ...readyInput,
  videoUrl: "",
  thumbnail: {},
  targetPlatforms: [],
});
assert.equal(blocked.status, "blocked");
assert.equal(blocked.canExport, false);
assert.deepEqual(
  blocked.missingRequirementCodes,
  ["final_video", "thumbnail", "target_platform"],
);

const confirmationBlocked = createCreatorPublishReadyPackageReport({
  ...readyInput,
  releaseChecklist: {
    ...readyInput.releaseChecklist,
    userConfirmations: {
      ...readyInput.releaseChecklist.userConfirmations,
      rightsConfirmed: false,
    },
  },
});
assert.equal(confirmationBlocked.canExport, false);
assert.deepEqual(
  confirmationBlocked.missingRequirementCodes,
  ["creator_confirmations"],
);

const packageRoute = fs.readFileSync(
  path.join(root, "app/api/export-creator-package/route.ts"),
  "utf8",
);
const metadataRoute = fs.readFileSync(
  path.join(root, "app/api/creator-youtube-metadata/route.ts"),
  "utf8",
);
const thumbnailRoute = fs.readFileSync(
  path.join(root, "app/api/creator-thumbnail/route.ts"),
  "utf8",
);
const createPage = fs.readFileSync(
  path.join(root, "app/create/page.tsx"),
  "utf8",
);

assert.match(packageRoute, /3R PUBLISH-READY PACKAGE/);
assert.match(packageRoute, /status: 409/);
assert.match(packageRoute, /3R-publish-ready-v1/);
assert.match(packageRoute, /X-Velto-Publish-Ready/);
assert.match(metadataRoute, /professional 18\+ creators/);
assert.match(metadataRoute, /Selected publishing platforms/);
assert.doesNotMatch(metadataRoute, /child-safe educational/);
assert.match(thumbnailRoute, /professional 18\+ creator content/);
assert.doesNotMatch(thumbnailRoute, /Joe|10-year-old|kids science/);
assert.match(createPage, /targetPlatforms: creatorTargetPlatforms/);

console.log("3R Publish-Ready Package smoke test passed.");
