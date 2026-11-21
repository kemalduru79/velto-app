import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Additive, offline subject verifier. NOT imported by any active admission gate.
// This module has no activation route: exact owner acceptance and a separately
// reviewed gate integration are still required. Caller-supplied approval is not authority.
const PROPOSAL = "docs/admission/issue50-editorial-v2.proposal.json";
const PROPOSAL_SHA = "5b77d33277e8a4d45f8c86986c5e9db068af54c0ae2a5bf13b160a0cfcf1ceec";
const POLICY = "scripts/quality/p0-scope-admission.json";
const POLICY_SHA = "938eb04b677476f903b493adc8d42e68e32513ff2d22de2cb48b3b001686cf73";
const SUBJECTS = Object.freeze([
  "lib/creator/creatorScript.ts",
  "lib/creator/creatorScriptEditorialRewriteProviders.server.ts",
  "lib/creator/creatorEditorialNarrativeReview.ts",
  "scripts/post-script-duration-workflow-authority-test.mjs",
  "scripts/post-strategy-script-long-form-acceptance-test.mjs",
]);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
function readRegular(root, relative) {
  if (!relative || path.isAbsolute(relative) || relative.split("/").some((part) => !part || part === "." || part === "..")) throw Error("INVALID_PATH");
  let current = root;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw Error("SYMLINK_DENIED");
  }
  if (!fs.lstatSync(current).isFile() || !fs.realpathSync(current).startsWith(root + path.sep)) throw Error("NONREGULAR_OR_ESCAPE");
  return fs.readFileSync(current);
}
export function verifyEditorialV2Subjects(rootPath, selectedPaths) {
  try {
    const root = fs.realpathSync(rootPath);
    if (!Array.isArray(selectedPaths) || selectedPaths.length !== 5 || new Set(selectedPaths).size !== 5 || SUBJECTS.some((p) => !selectedPaths.includes(p))) throw Error("EXACT_SUBJECT_SET_REQUIRED");
    const proposalBytes = readRegular(root, PROPOSAL);
    if (digest(proposalBytes) !== PROPOSAL_SHA) throw Error("PROPOSAL_IDENTITY_MISMATCH");
    const policyBytes = readRegular(root, POLICY);
    if (digest(policyBytes) !== POLICY_SHA) throw Error("ORIGINAL_POLICY_IDENTITY_MISMATCH");
    const proposal = JSON.parse(proposalBytes);
    const git = (args) => execFileSync("git", args, { cwd: root, maxBuffer: 8 * 1024 * 1024, env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } });
    const staged = new Set(git(["diff", "--cached", "--name-only", "--no-renames", "-z"]).toString().split("\0").filter(Boolean));
    // Unrelated files are never admitted by this five-subject mechanism.
    // This check proves only the selected editorial subset, not the whole PR.
    for (const subject of proposal.subjects) {
      if (digest(readRegular(root, subject.path)) !== subject.proposedSha256) throw Error("SUBJECT_HASH_MISMATCH:" + subject.path);
      const base = git(["ls-tree", proposal.referenceBaseCommit, "--", subject.path]).toString();
      if (subject.baseSha256 === "ABSENT" ? base.length !== 0 : digest(git(["show", proposal.referenceBaseCommit + ":" + subject.path])) !== subject.baseSha256) throw Error("BASE_IDENTITY_MISMATCH");
      if (staged.has(subject.path)) {
        if (!git(["ls-files", "--stage", "--", subject.path]).toString().startsWith("100644 ")) throw Error("STAGED_MODE_DENIED");
        if (digest(git(["show", ":" + subject.path])) !== subject.proposedSha256) throw Error("STAGED_HASH_MISMATCH");
      }
    }
    for (const relative of [PROPOSAL, POLICY]) {
      if (staged.has(relative) && digest(git(["show", ":" + relative])) !== digest(readRegular(root, relative))) throw Error("STAGED_POLICY_MISMATCH");
    }
    return { subjectVerification: "EXACT_FIVE_SUBJECTS_PASS", proposalSha256: PROPOSAL_SHA, admission: "DENIED_OWNER_ACCEPTANCE_AND_GATE_INTEGRATION_REQUIRED", activated: false, scientificAuthority: false };
  } catch (error) {
    return { subjectVerification: "DENY", reason: error.message, admission: "DENIED", activated: false, scientificAuthority: false };
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyEditorialV2Subjects(process.cwd(), process.argv.slice(2));
  console.log(JSON.stringify(result));
  process.exitCode = result.subjectVerification === "EXACT_FIVE_SUBJECTS_PASS" ? 0 : 1;
}
