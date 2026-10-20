import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const script = "scripts/stage-4b2-local-live-probe.mjs";
const run = (args, env = {}) => spawnSync(process.execPath, [script, ...args], {
  cwd: process.cwd(), encoding: "utf8", timeout: 10000,
  env: { PATH: process.env.PATH || "", NODE_ENV: "test", ...env },
});
for (const scenario of [
  { args: [], env: {} },
  { args: ["--execute"], env: {} },
  { args: [], env: { STAGE4B2_EXECUTION_CONSENT: "confirmed-5usd-arxiv2304" } },
  { args: ["--execute"], env: { STAGE4B2_EXECUTION_CONSENT: "incorrect-approval" } },
  { args: ["--execute"], env: {
    STAGE4B2_EXECUTION_ID: "stage4b2-future-trial-1",
    STAGE4B2_APPROVED_EXECUTION_ID: "stage4b2-future-trial-1",
    STAGE4B2_EXECUTION_CONSENT: "confirmed-5usd-arxiv2304",
  } },
]) {
  const result = run(scenario.args, scenario.env);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "REVIEW_REQUIRED");
  assert.equal(report.reason, "DRY_RUN_ONLY");
  assert.equal(report.exaCalls, 0);
  assert.equal(report.openAiCalls, 0);
  assert.equal(report.estimatedReservedUsd, 0);
  assert.equal(report.zeroWriteProof.unchanged, true);
  assert.equal(report.applyPerformed, false);
}
console.log("STAGE_4B2_LOCAL_LIVE_PROBE_OFFLINE=PASS");
