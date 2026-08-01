import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function compileModule(filePath, dependencies = {}) {
  const source = fs.readFileSync(filePath, "utf8");
  const result = ts.transpileModule(source, {
    fileName: filePath,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
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

  const module = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };

  new Function("require", "module", "exports", result.outputText)(
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
const reporting = compileModule(
  path.join(root, "lib/creator/projectPerformanceReport.ts"),
  {
    "../credits/operationPolicy": operationPolicy,
    "./projectExportReadiness": lifecycle,
  },
);

const lifecycleReady = lifecycle.createCreatorProjectExportReadiness({
  hasProductionStage: true,
  totalScenes: 1,
  visualReadyCount: 1,
  voiceReadyCount: 1,
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

const report = reporting.createCreatorProjectPerformanceReport({
  locale: "en",
  title: "Clarity Project",
  projectId: "clarity-1",
  qualityMode: "standard",
  format: "short_form",
  targetPlatforms: ["youtube"],
  scenes: [
    {
      id: 1,
      renderMode: "image",
      image: "https://example.com/image.png",
      narration: "Narration",
      audioUrl: "https://example.com/audio.mp3",
      timing: {
        targetSceneDuration: 8,
        durationMatchStatus: "matched",
      },
    },
  ],
  lifecycle: lifecycleReady,
  timelineApproved: true,
  continuity: {
    status: "ready",
    safeScenes: 1,
    warningScenes: 0,
    highRiskScenes: 0,
  },
  finalGate: { status: "ready" },
  publish: {
    finalVideoReady: true,
    thumbnailReady: true,
    metadataReady: true,
    captionsReady: true,
    systemChecksReady: 4,
    systemChecksTotal: 4,
    confirmationsReady: 4,
    confirmationsTotal: 4,
    packageDownloaded: true,
  },
});

const html = reporting.createCreatorProjectPerformanceReportHtml(report);

assert.match(html, /Project Status and Readiness Report/);
assert.match(html, /Project readiness score/);
assert.match(html, /Estimated project total/);
assert.match(html, /Estimated required to complete/);
assert.match(html, /Visual generation/);
assert.match(html, /No open consistency risk/);
assert.doesNotMatch(html, />\d+\s*\+\s*\d+</);

const reportsComponent = fs.readFileSync(
  path.join(root, "components/reports/CreatorReportsCenter.tsx"),
  "utf8",
);
const createPage = fs.readFileSync(
  path.join(root, "app/create/page.tsx"),
  "utf8",
);

assert.match(reportsComponent, /All Projects Overview/);
assert.match(reportsComponent, /Tüm Projelerin Özeti/);
assert.match(reportsComponent, /Project Readiness Score/);
assert.match(reportsComponent, /Proje Hazırlık Puanı/);
assert.match(reportsComponent, /Estimated project total/);
assert.match(reportsComponent, /Tahmini proje toplamı/);
assert.match(reportsComponent, /Estimated required to complete/);
assert.match(reportsComponent, /Tamamlamak için tahmini gereken/);
assert.match(reportsComponent, /These values are estimates/);
assert.match(reportsComponent, /Kesin kredi hareketlerini veya hesap bakiyesini göstermez/);
assert.match(reportsComponent, /Project Status and Readiness Report/);
assert.match(reportsComponent, /Proje Durum ve Hazırlık Raporu/);
assert.doesNotMatch(
  reportsComponent,
  /estimatedUsedCredits\}\s*\+\s*\{/,
);
assert.doesNotMatch(
  reportsComponent,
  /completedUnits\}\s*\+\s*\{/,
);

assert.match(createPage, /Current Project Status/);
assert.match(createPage, /Mevcut Proje Durumu/);

console.log("REPORT-P1R UX Clarity Pass smoke test passed.");
