import { spawnSync } from "node:child_process";

const tests = [
  "scripts/stage-0-6-smart-asset-reuse-smoke-test.mjs",
  "scripts/stage-0-7a-media-ownership-metering-test.mjs",
  "scripts/stage-0-7a-2-final-movie-migration-test.mjs",
  "scripts/stage-0-7b-trash-restore-test.mjs",
  "scripts/stage-0-7c-storage-quota-test.mjs",
  "scripts/stage-0-7d-1-safe-purge-test.mjs",
  "scripts/stage-0-7d-2-storage-entitlement-admission-test.mjs",
  "scripts/stage-0-7d-3-storage-activation-test.mjs",
  "scripts/stage-0-7d-3a-final-export-admission-schema-test.mjs",
  "scripts/stage-0-7d-3b-final-export-admission-test.mjs",
  "scripts/beta-edit-regression-creator-video-generation-lifecycle-smoke-test.mjs",
  "scripts/beta-edit-p1e-final-video-lifecycle-smoke-test.mjs",
  "scripts/beta-fin-p1-cost-guard-smoke-test.mjs",
  "scripts/stage-0-8c-slice-a-modularization-test.mjs",
  "scripts/stage-0-8c-slice-b-stitch-modularization-test.mjs",
  "scripts/stage-0-8d-a-runtime-config-test.mjs",
  "scripts/stage-0-8d-b-provider-environment-test.mjs",
  "scripts/stage-0-8e-a-export-runtime-test.mjs",
  "scripts/stage-0-8e-b-cloud-portability-test.mjs",
  "scripts/stage-0-8f-a-health-observability-test.mjs",
  "scripts/stage-0-8f-b-recovery-operator-test.mjs",
  "scripts/stage-0-8g-architecture-closure-test.mjs",
  "scripts/stage-0-9a-security-consent-baseline-test.mjs",
  "scripts/stage-0-10h-2g-editorial-analysis-api-test.mjs",
  "scripts/stage-0-10h-2h-script-planner-editorial-context-test.mjs",
  "scripts/stage-0-10h-2i-creator-editorial-orchestration-test.mjs",
  "scripts/stage-0-10h-3a-source-media-rights-contract-test.mjs",
  "scripts/stage-0-10h-3b-source-metadata-read-surface-test.mjs",
  "scripts/stage-0-10h-3c-stock-source-media-canonicalization-test.mjs",
  "scripts/stage-0-10h-3d-research-source-media-reference-test.mjs",
  "scripts/stage-0-10h-3e-source-media-trim-bridge-test.mjs",
  "scripts/stage-0-10h-3f-source-media-rights-closure-test.mjs",
  "scripts/stage-0-10h-4a-documentary-treatment-taxonomy-test.mjs",
  "scripts/stage-0-10h-4b-documentary-source-context-test.mjs",
  "scripts/stage-0-10h-4c-authentic-source-first-routing-test.mjs",
  "scripts/stage-0-10h-4d-evidence-visual-context-test.mjs",
  "scripts/stage-0-10h-4e-evidence-visual-routing-test.mjs",
  "scripts/stage-0-10h-4f-production-intelligence-context-api-test.mjs",
];

for (const test of tests) {
  console.log(`\n[offline regression] ${test}`);
  const result = spawnSync(process.execPath, [test], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nSTAGE_0_8A_CRITICAL_REGRESSION=PASS (${tests.length} tests)`);
