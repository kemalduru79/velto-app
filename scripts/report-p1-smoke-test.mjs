import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function compileModule(filePath, dependencies = {}) {
  const source = fs.readFileSync(filePath, "utf8");
  const compiled = ts.transpileModule(source, {
    fileName: filePath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };

  new Function("require", "module", "exports", compiled)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}

const operationPolicy = compileModule(
  path.join(root, "lib/credits/operationPolicy.ts"),
);
const lifecycle = compileModule(
  path.join(root, "lib/creator/projectExportReadiness.ts"),
);
const report = compileModule(
  path.join(root, "lib/creator/projectPerformanceReport.ts"),
  {
    "../credits/operationPolicy": operationPolicy,
    "./projectExportReadiness": lifecycle,
  },
);

const {
  appendCreatorProjectPerformanceHistory,
  createCreatorProjectPerformanceReport,
  createCreatorProjectPerformanceReportHtml,
  isCreatorProjectPerformanceReport,
  parseCreatorProjectPerformanceHistory,
} = report;

const lifecycleReady = lifecycle.createCreatorProjectExportReadiness({
  hasProductionStage: true,
  totalScenes: 2,
  visualReadyCount: 2,
  voiceReadyCount: 2,
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

const readyReport = createCreatorProjectPerformanceReport({
  locale: "en",
  title: "Launch Project",
  projectId: "project-1",
  generatedAt: "2026-08-01T00:00:00.000Z",
  qualityMode: "pro",
  format: "youtube_video",
  targetPlatforms: ["youtube", "linkedin"],
  scenes: [
    {
      id: 1,
      renderMode: "image",
      image: "https://example.com/1.png",
      narration: "Opening",
      audioUrl: "https://example.com/1.mp3",
      timing: { targetSceneDuration: 8, durationMatchStatus: "matched" },
    },
    {
      id: 2,
      renderMode: "video",
      image: "https://example.com/2.png",
      videoUrl: "https://example.com/2.mp4",
      videoStatus: "done",
      narration: "Result",
      audioUrl: "https://example.com/2.mp3",
      timing: { targetSceneDuration: 10, durationMatchStatus: "matched" },
    },
  ],
  lifecycle: lifecycleReady,
  lifecycleHistory: [
    { status: "draft", recordedAt: "2026-07-31T12:00:00.000Z" },
    { status: "production_ready", recordedAt: "2026-07-31T18:00:00.000Z" },
  ],
  timelineApproved: true,
  continuity: {
    status: "ready",
    safeScenes: 2,
    warningScenes: 0,
    highRiskScenes: 0,
    freezeRiskScenes: 0,
    unmeasuredAudioScenes: 0,
    totalUncoveredDurationSec: 0,
  },
  finalGate: { status: "ready" },
  publish: {
    finalVideoReady: true,
    thumbnailReady: true,
    metadataReady: true,
    captionsReady: true,
    systemChecksReady: 5,
    systemChecksTotal: 5,
    confirmationsReady: 4,
    confirmationsTotal: 4,
    packageDownloaded: true,
  },
  intelligence: { hookScore: 84, hookLevel: "strong" },
});

assert.equal(readyReport.version, "REPORT-P1");
assert.equal(readyReport.status, "ready");
assert.equal(readyReport.production.totalScenes, 2);
assert.equal(readyReport.production.targetDurationSec, 18);
assert.equal(readyReport.lifecycle.history.at(-1)?.status, "exported");
assert.equal(readyReport.credits.estimateOnly, true);
assert.ok(readyReport.credits.estimatedUsedCredits > 0);
assert.equal(isCreatorProjectPerformanceReport(readyReport), true);

const blockedReport = createCreatorProjectPerformanceReport({
  locale: "tr",
  title: "Eksik Proje",
  qualityMode: "standard",
  format: "short_form",
  targetPlatforms: [],
  scenes: [
    {
      id: 1,
      narration: "Eksik ses",
      timing: { targetSceneDuration: 10 },
    },
  ],
  timelineApproved: false,
  continuity: {
    status: "high_risk",
    highRiskScenes: 1,
    freezeRiskScenes: 1,
  },
  finalGate: { status: "blocked" },
  publish: {
    finalVideoReady: false,
    thumbnailReady: false,
    metadataReady: false,
    captionsReady: true,
    systemChecksReady: 1,
    systemChecksTotal: 5,
    confirmationsReady: 0,
    confirmationsTotal: 4,
    packageDownloaded: false,
  },
});

assert.equal(blockedReport.status, "blocked");
assert.ok(blockedReport.findings.blockers.length >= 3);
assert.ok(blockedReport.credits.estimatedRemainingCredits > 0);
assert.ok(blockedReport.nextActions.length > 0);

const history = appendCreatorProjectPerformanceHistory({
  history: [
    { status: "draft", recordedAt: "2026-07-31T12:00:00.000Z" },
  ],
  status: "production_in_progress",
  recordedAt: "2026-07-31T13:00:00.000Z",
});
assert.equal(history.length, 2);
assert.equal(parseCreatorProjectPerformanceHistory(history).length, 2);

const html = createCreatorProjectPerformanceReportHtml(readyReport);
assert.match(html, /REPORT-P1/);
assert.match(html, /Project Performance Report/);
assert.match(html, /Launch Project/);
assert.match(html, /Estimated used/);

const createPage = fs.readFileSync(
  path.join(root, "app/create/page.tsx"),
  "utf8",
);
const packageRoute = fs.readFileSync(
  path.join(root, "app/api/export-creator-package/route.ts"),
  "utf8",
);

assert.match(createPage, /REPORT-P1 PROJECT PERFORMANCE REPORT/);
assert.match(createPage, /creatorProjectPerformanceReport/);
assert.match(createPage, /handleDownloadProjectPerformanceReport/);
assert.match(createPage, /projectPerformanceHistory/);
assert.match(packageRoute, /project-performance-report\.html/);
assert.match(packageRoute, /X-Velto-Report-Version/);

console.log("REPORT-P1 Project Performance Report smoke test passed.");
