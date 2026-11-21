// Independent black-box negative controls: invokes the verifier CLI in isolated
// Git fixtures. Does not import its path list, digest constants or implementation.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
const root = process.cwd();
const verifier = path.join(root, "scripts/quality/issue50-editorial-admission-v2.mjs");
const files = ["lib/creator/creatorScript.ts", "lib/creator/creatorScriptEditorialRewriteProviders.server.ts", "lib/creator/creatorEditorialNarrativeReview.ts", "scripts/post-script-duration-workflow-authority-test.mjs", "scripts/post-strategy-script-long-form-acceptance-test.mjs"];
const policy = "scripts/quality/p0-scope-admission.json";
const proposal = "docs/admission/issue50-editorial-v2.proposal.json";
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "issue50-admission-test-"));
const git = (...args) => execFileSync("git", args, { cwd: scratch, stdio: "pipe" });
let checks = 0;
function run(paths = files) { const r = spawnSync(process.execPath, [verifier, ...paths], { cwd: scratch, encoding: "utf8" }); assert.equal(r.error, undefined); return JSON.parse(r.stdout); }
function check(value, expected) { assert.equal(value, expected); checks++; }
function reset(relative) { fs.writeFileSync(path.join(scratch, relative), fs.readFileSync(path.join(root, relative))); }
try {
  git("init", "--quiet");
  git("fetch", "--quiet", root, "bc30a72440cfbeaafa5c3aac283bdaa5efd70656");
  git("checkout", "--quiet", "--detach", "FETCH_HEAD");
  for (const relative of [...files, policy, proposal]) { fs.mkdirSync(path.dirname(path.join(scratch, relative)), { recursive: true }); reset(relative); }
  check(run().subjectVerification, "EXACT_FIVE_SUBJECTS_PASS");
  check(run().activated, false);
  check(run().admission, "DENIED_OWNER_ACCEPTANCE_AND_GATE_INTEGRATION_REQUIRED");
  check(run().scientificAuthority, false);
  for (const relative of files) { fs.appendFileSync(path.join(scratch, relative), "\n// changed\n"); check(run().subjectVerification, "DENY"); reset(relative); }
  check(run(files.slice(1)).subjectVerification, "DENY");
  check(run([...files, "scripts/scientific-review/scientific_compute_v1.py"]).subjectVerification, "DENY");
  check(run([...files.slice(1), files[1]]).subjectVerification, "DENY");
  check(run([...files.slice(1), "../creatorScript.ts"]).subjectVerification, "DENY");
  for (const relative of [policy, proposal]) { fs.appendFileSync(path.join(scratch, relative), " "); check(run().subjectVerification, "DENY"); reset(relative); }
  fs.appendFileSync(path.join(scratch, files[0]), "\n// staged drift\n"); git("add", "--", files[0]); reset(files[0]);
  check(run().subjectVerification, "DENY"); git("reset", "--quiet");
  fs.unlinkSync(path.join(scratch, files[0])); fs.symlinkSync(path.join(root, files[0]), path.join(scratch, files[0]));
  check(run().subjectVerification, "DENY"); fs.unlinkSync(path.join(scratch, files[0])); reset(files[0]);
  fs.unlinkSync(path.join(scratch, files[2])); check(run().subjectVerification, "DENY"); reset(files[2]);
  const p = JSON.parse(fs.readFileSync(path.join(scratch, proposal))); p.activation.enabled = true; p.activation.ownerAcceptance = "APPROVED"; fs.writeFileSync(path.join(scratch, proposal), JSON.stringify(p));
  check(run().subjectVerification, "DENY"); reset(proposal);
  check(run([...files, "scripts/stage-0-6-smart-asset-reuse-smoke-test.mjs"]).subjectVerification, "DENY");
  console.log(JSON.stringify({ checks, status: "PASS", scope: "BLACK_BOX_CONTENT_AND_DENIAL_ONLY_NOT_OWNER_SIGNOFF", activated: false }));
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
