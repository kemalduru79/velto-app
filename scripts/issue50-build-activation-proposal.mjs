import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { normalizedActivationBytes } from "./quality/issue50-combined-admission.mjs";
const digest = (b) => createHash("sha256").update(b).digest("hex");
export function buildActivationProposal(source, output) {
  const base = "bc30a72440cfbeaafa5c3aac283bdaa5efd70656";
  const git = (args, cwd = source) => execFileSync("git", args, { cwd, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  if (git(["status", "--porcelain"]).length) throw Error("PROPOSAL_REQUIRES_CLEAN_REVIEWED_CANDIDATE");
  const head = git(["rev-parse", "HEAD"]).toString().trim();
  const v2 = JSON.parse(fs.readFileSync(path.join(source, "docs/admission/issue50-editorial-v2.proposal.json")));
  for (const row of v2.subjects) if (digest(fs.readFileSync(path.join(source, row.path))) !== row.proposedSha256) throw Error("FROZEN_V2_SUBJECT_DRIFT");
  const guard = "scripts/stage-0-6-smart-asset-reuse-smoke-test.mjs";
  if (digest(fs.readFileSync(path.join(source, guard))) !== "3f669262d78a5bf5b03ce6e92afbbb76020bb69d55d317ea23d89308360d71ce") throw Error("SEPARATE_GUARD_DELTA_DRIFT");
  fs.mkdirSync(output, { recursive: true });
  const fixture = path.join(output, "prospective");
  git(["clone", "--quiet", "--shared", source, fixture]);
  git(["checkout", "--quiet", "--detach", head], fixture);
  fs.symlinkSync(path.join(source, "node_modules"), path.join(fixture, "node_modules"));
  const scopePath = "scripts/quality/p0-workspace-scope.mjs";
  const testPath = "scripts/p0-quality-gate-test.mjs";
  let scope = fs.readFileSync(path.join(fixture, scopePath), "utf8");
  scope = 'import { inspectCombinedCandidate } from "./issue50-combined-admission.mjs";\nconst ISSUE50_COMBINED_MANIFEST_SHA = "' + "0".repeat(64) + '";\n' + scope;
  scope = scope.replace('  return paths.filter((file) => {', '  let composed = {};\n  try { composed = inspectCombinedCandidate(root, ISSUE50_COMBINED_MANIFEST_SHA); } catch { /* Original historical/fixture policy remains fail-closed. */ }\n  return paths.filter((file) => {').replace('const expected = P0_FILE_HASHES[file];', 'const expected = composed[file] || P0_FILE_HASHES[file];');
  let test = fs.readFileSync(path.join(fixture, testPath), "utf8");
  test = 'import { inspectCombinedCandidate } from "./quality/issue50-combined-admission.mjs";\nconst ISSUE50_COMBINED_MANIFEST_SHA = "' + "0".repeat(64) + '";\ninspectCombinedCandidate(process.cwd(), ISSUE50_COMBINED_MANIFEST_SHA);\n' + test;
  const oldCopy = 'fs.writeFileSync(destination, fs.readFileSync(approved));';
  if (!test.includes(oldCopy)) throw Error("ACTIVATION_PATCH_CONTEXT_DRIFT");
  test = test.replace('  fs.writeFileSync(path.join(root, "p0-workspace-scope.mjs"),', '  fs.writeFileSync(path.join(root, "issue50-combined-admission.mjs"), fs.readFileSync("scripts/quality/issue50-combined-admission.mjs"));\n  fs.writeFileSync(path.join(root, "p0-workspace-scope.mjs"),');
  test = test.replace(oldCopy, 'fs.writeFileSync(destination, execFileSync("git", ["show", "' + base + ':" + approved], { maxBuffer: 16 * 1024 * 1024 }));');
  fs.writeFileSync(path.join(fixture, scopePath), scope); fs.writeFileSync(path.join(fixture, testPath), test);
  const changed = git(["diff", "--name-only", "--no-renames", "-z", base, head]).toString().split("\0").filter(Boolean).sort();
  const files = {};
  for (const relative of changed) {
    const current = fs.readFileSync(path.join(source, relative));
    const exists = git(["ls-tree", base, "--", relative]).length > 0;
    files[relative] = { sha256: digest(current), baseSha256: exists ? digest(git(["show", base + ":" + relative])) : "ABSENT", scope: v2.subjects.some((r) => r.path === relative) ? "EDITORIAL_V2" : relative === guard ? "STAGE_0_6A_TEST_ONLY" : "EXACT_REVIEW_SUPPORTING_FILE" };
  }
  const historical = JSON.parse(fs.readFileSync(path.join(source, "scripts/quality/p0-scope-admission.json"))).files;
  const safetyPaths = [...new Set([...Object.keys(historical), scopePath, testPath, ".github/workflows/ci.yml", ".github/workflows/scientific-ci.yml", "scripts/stage-0-8a-changed-lint.mjs", "scripts/scientific-review/scientific_compute_v1.py", "lib/creator/scientificReview/scientificComputeRuntime.v1.json", "lib/creator/scientificReview/scientificComputeContainerRuntime.v1.json"])];
  const safetyBaseHashes = {};
  for (const relative of safetyPaths) {
    const original = digest(git(["show", base + ":" + relative])); safetyBaseHashes[relative] = original;
    if (![scopePath, testPath].includes(relative) && !v2.subjects.some((r) => r.path === relative) && relative !== guard && digest(fs.readFileSync(path.join(source, relative))) !== original) throw Error("UNAUTHORIZED_SAFETY_BASE_DRIFT:" + relative);
  }
  const activation = Object.fromEntries([scopePath, testPath].map((relative) => [relative, { normalized: true, sha256: digest(normalizedActivationBytes(fs.readFileSync(path.join(fixture, relative)))) }]));
  const manifest = { schema: "velto-issue50-combined-exact-admission/v1", status: "PROPOSED_NOT_OWNER_ACCEPTED", base, reviewedCandidateCommit: head, editorialV2Sha256: "5b77d33277e8a4d45f8c86986c5e9db068af54c0ae2a5bf13b160a0cfcf1ceec", separateGuard: { path: guard, sha256: files[guard].sha256 }, files, safetyBaseHashes, activation, trustBoundary: "Owner must accept the exact detached activation patch SHA; running this generator does not authorize any generated content. Only the manifest-digest literal is normalized to break a hash cycle; every other activation-code byte is pinned.", scientificAuthority: false, providerAuthority: false };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n"); const manifestSha = digest(manifestBytes);
  for (const relative of [scopePath, testPath]) fs.writeFileSync(path.join(fixture, relative), fs.readFileSync(path.join(fixture, relative), "utf8").replace('"' + "0".repeat(64) + '"', '"' + manifestSha + '"'));
  const manifestPath = "docs/admission/issue50-combined-source-v1.json";
  fs.writeFileSync(path.join(fixture, manifestPath), manifestBytes);
  git(["add", "--", scopePath, testPath, manifestPath], fixture);
  const patch = git(["diff", "--cached", "--binary", "--full-index"], fixture); fs.writeFileSync(path.join(output, "ACTIVATION.diff"), patch);
  const record = { state: "PROPOSED_NOT_ACCEPTED_NOT_APPLIED_TO_PR", reviewedCandidateCommit: head, patchSha256: digest(patch), manifestSha256: manifestSha, files: [scopePath, testPath, manifestPath], exactCandidateChangedPaths: changed.length, historicalPinCount: Object.keys(historical).length, ownerAcceptance: "PENDING", scientificAuthority: false, providerAuthority: false };
  fs.writeFileSync(path.join(output, "ACTIVATION_RECORD.json"), JSON.stringify(record, null, 2) + "\n"); return { fixture, record };
}
