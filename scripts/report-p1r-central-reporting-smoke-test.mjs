import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "velto-report-p1r-"),
);

const sourceFiles = [
  "lib/creator/centralReporting.ts",
  "lib/creator/projectPerformanceReport.ts",
  "lib/creator/projectExportReadiness.ts",
  "lib/credits/operationPolicy.ts",
];

for (const relative of sourceFiles) {
  const sourcePath = path.join(root, relative);
  assert.equal(
    fs.existsSync(sourcePath),
    true,
    `Missing source file: ${relative}`,
  );

  const outputPath = path.join(
    tempRoot,
    relative.replace(/\.ts$/, ".js"),
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const source = fs.readFileSync(sourcePath, "utf8");
  const result = ts.transpileModule(source, {
    fileName: relative,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });
  const errors = (result.diagnostics || []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );

  assert.equal(
    errors.length,
    0,
    errors
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      )
      .join("\n"),
  );

  fs.writeFileSync(outputPath, result.outputText, "utf8");
}

const require = createRequire(import.meta.url);
const central = require(
  path.join(tempRoot, "lib/creator/centralReporting.js"),
);

const readyProject = {
  id: "project-ready",
  title: "Ready launch",
  flow_type: "creator_lab",
  created_at: "2026-07-01T10:00:00.000Z",
  updated_at: "2026-08-01T10:00:00.000Z",
  scenes: [
    {
      id: 1,
      renderMode: "image",
      image: "https://example.com/image-1.png",
      narration: "Opening narration",
      audioUrl: "https://example.com/audio-1.mp3",
      timing: { targetSceneDuration: 8, durationMatchStatus: "matched" },
    },
    {
      id: 2,
      renderMode: "video",
      image: "https://example.com/image-2.png",
      videoUrl: "https://example.com/video-2.mp4",
      videoStatus: "done",
      narration: "",
      dialogue: "",
      timing: { targetSceneDuration: 10, durationMatchStatus: "matched" },
    },
  ],
  exported_movie_url: "https://example.com/final.mp4",
  export_signature: "3U-final-signature",
  exported_movie_result: {
    projectLifecycle: {
      version: "3U",
      status: "exported",
      progress: 100,
      totalScenes: 2,
      visualReadyCount: 2,
      voiceReadyCount: 2,
      assetsReady: true,
      artifactHistory: {
        hadFinalVideo: true,
        finalVideoSignature: "3U-final-signature",
        hadPublishPackage: true,
        publishPackageSignature: "3U-publish-signature",
        packageDownloaded: true,
      },
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
    projectPerformanceHistory: [
      { status: "production_ready", recordedAt: "2026-07-30T10:00:00.000Z" },
      { status: "exported", recordedAt: "2026-08-01T10:00:00.000Z" },
    ],
  },
  creator_production_package: {
    durationSec: 18,
    qualityMode: "pro",
    targetPlatforms: ["youtube_shorts", "instagram_reels"],
    timelineSyncPlan: { status: "approved" },
  },
  youtube_metadata: {
    recommendedTitle: "Ready launch",
    description: "Publishing description",
  },
  youtube_thumbnail: {
    imageUrl: "https://example.com/thumbnail.png",
  },
};

const outdatedProject = {
  id: "project-outdated",
  title: "Needs rebuild",
  flow_type: "creator_lab",
  updated_at: "2026-07-31T10:00:00.000Z",
  scenes: [{ id: 1, text: "Changed scene" }],
  exported_movie_result: {
    projectLifecycle: {
      version: "3U",
      status: "export_outdated",
      progress: 72,
      totalScenes: 1,
      visualReadyCount: 0,
      voiceReadyCount: 1,
      assetsReady: false,
      artifactHistory: {
        hadFinalVideo: true,
        finalVideoSignature: "old-final",
        hadPublishPackage: true,
        publishPackageSignature: "old-package",
        packageDownloaded: false,
      },
      updatedAt: "2026-07-31T10:00:00.000Z",
    },
  },
};

const storyverseProject = {
  id: "storyverse",
  title: "Storyverse project",
  flow_type: "storyverse",
  scenes: [],
};

const portfolio = central.createCreatorCentralPortfolioSummary([
  readyProject,
  outdatedProject,
  storyverseProject,
]);

assert.equal(portfolio.totalProjects, 2);
assert.equal(portfolio.exportedProjects, 1);
assert.equal(portfolio.outdatedProjects, 1);
assert.equal(portfolio.totalScenes, 3);
assert.equal(portfolio.finalVideos, 1);
assert.equal(portfolio.projects[0].id, "project-ready");

const report = central.createCreatorProjectPerformanceReportFromRecord({
  project: readyProject,
  locale: "en",
});

assert.equal(report.version, "REPORT-P1");
assert.equal(report.project.id, "project-ready");
assert.equal(report.lifecycle.status, "exported");
assert.equal(report.production.totalScenes, 2);
assert.equal(report.publish.finalVideoReady, true);
assert.equal(report.publish.thumbnailReady, true);
assert.equal(report.publish.metadataReady, true);
assert.equal(report.publish.packageDownloaded, true);
assert.equal(report.credits.estimateOnly, true);
assert.equal(report.lifecycle.history.length >= 2, true);

assert.equal(
  central.getCreatorCentralStatusLabel("export_outdated", "tr"),
  "Çıktı güncel değil",
);
assert.equal(
  central.getCreatorCentralStatusLabel("publish_ready", "en"),
  "Publish Ready",
);

fs.rmSync(tempRoot, { recursive: true, force: true });

console.log("REPORT-P1R Central Reporting Center smoke test passed.");
