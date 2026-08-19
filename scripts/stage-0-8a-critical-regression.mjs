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
];

for (const test of tests) {
  console.log(`\n[offline regression] ${test}`);
  const result = spawnSync(process.execPath, [test], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nSTAGE_0_8A_CRITICAL_REGRESSION=PASS (${tests.length} tests)`);
