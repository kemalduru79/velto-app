import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { buildActivationProposal } from "./issue50-build-activation-proposal.mjs";
import { inspectCombinedCandidate } from "./quality/issue50-combined-admission.mjs";
const output = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), "issue50-activation-"));
const { fixture, record } = buildActivationProposal(process.cwd(), output);
const verify = () => inspectCombinedCandidate(fixture, record.manifestSha256);
const runGit = (...args) => execFileSync("git", args, { cwd: fixture, stdio: "pipe" });
let assertions = 0; const check = (fn) => { fn(); assertions++; };
try {
  const accepted = verify(); check(() => assert.equal(Object.keys(accepted).length, record.exactCandidateChangedPaths + 3));
  const manifest = JSON.parse(fs.readFileSync(path.join(fixture, "docs/admission/issue50-combined-source-v1.json")));
  check(() => assert.equal(Object.values(manifest.files).filter((r) => r.scope === "EDITORIAL_V2").length, 5));
  check(() => assert.equal(Object.values(manifest.files).filter((r) => r.scope === "STAGE_0_6A_TEST_ONLY").length, 1));
  for (const relative of Object.keys(manifest.files)) {
    const file = path.join(fixture, relative); const bytes = fs.readFileSync(file); fs.appendFileSync(file, "\nDRIFT"); check(() => assert.throws(verify)); fs.writeFileSync(file, bytes);
  }
  for (const relative of ["scripts/quality/p0-scope-admission.json", ".github/workflows/ci.yml", ".github/workflows/scientific-ci.yml", "scripts/scientific-review/scientific_compute_v1.py", "lib/creator/scientificReview/scientificComputeRuntime.v1.json", "scripts/quality/p0-workspace-scope.mjs", "scripts/p0-quality-gate-test.mjs", "docs/admission/issue50-combined-source-v1.json"]) {
    const file = path.join(fixture, relative); const bytes = fs.readFileSync(file); fs.appendFileSync(file, "\nDRIFT"); check(() => assert.throws(verify)); fs.writeFileSync(file, bytes);
  }
  fs.writeFileSync(path.join(fixture, "unreviewed.ts"), "unexpected"); check(() => assert.throws(verify)); fs.unlinkSync(path.join(fixture, "unreviewed.ts"));
  const subject = path.join(fixture, "lib/creator/creatorScript.ts"); const original = fs.readFileSync(subject);
  fs.appendFileSync(subject, "\nSTAGED_DRIFT"); runGit("add", "--", "lib/creator/creatorScript.ts"); fs.writeFileSync(subject, original); check(() => assert.throws(verify)); runGit("reset", "--quiet", "HEAD", "--", "lib/creator/creatorScript.ts");
  const guard = path.join(fixture, "scripts/stage-0-6-smart-asset-reuse-smoke-test.mjs"); const guardBytes = fs.readFileSync(guard);
  fs.appendFileSync(guard, "\nSTAGED_GUARD_DRIFT"); runGit("add", "--", "scripts/stage-0-6-smart-asset-reuse-smoke-test.mjs"); fs.writeFileSync(guard, guardBytes); check(() => assert.throws(verify)); runGit("reset", "--quiet", "HEAD", "--", "scripts/stage-0-6-smart-asset-reuse-smoke-test.mjs");
  fs.unlinkSync(subject); check(() => assert.throws(verify)); fs.symlinkSync(path.join(process.cwd(), "lib/creator/creatorScript.ts"), subject); check(() => assert.throws(verify)); fs.unlinkSync(subject); fs.writeFileSync(subject, original);
  check(() => assert.throws(() => inspectCombinedCandidate(fixture, null)));
  check(() => assert.throws(() => inspectCombinedCandidate(fixture, "0".repeat(64))));
  check(() => assert.equal(verify()["scripts/stage-0-6-smart-asset-reuse-smoke-test.mjs"], "3f669262d78a5bf5b03ce6e92afbbb76020bb69d55d317ea23d89308360d71ce"));
  // Exercise the actual amended scope/gate only in this disposable fixture.
  const gate = execFileSync(process.execPath, ["scripts/p0-quality-gate-test.mjs"], { cwd: fixture, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 180000 });
  fs.writeFileSync(path.join(output, "PROSPECTIVE_P0_GATE.log"), gate); check(() => assert.match(gate, /P0_QUALITY_GATE_CONTRACTS=PASS/));
  console.log(JSON.stringify({ status: "PASS", assertions, fullChangedSet: record.exactCandidateChangedPaths, prospectiveOnly: true, activatedInPR: false, patchSha256: record.patchSha256 }));
} finally { if (!process.argv[2]) fs.rmSync(output, { recursive: true, force: true }); }
