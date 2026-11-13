import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Owner-authorized reviewed P0 artifact, not a workspace-generated allowlist.
const POLICY_SHA256 = "938eb04b677476f903b493adc8d42e68e32513ff2d22de2cb48b3b001686cf73";
const bytes = fs.readFileSync(new URL("./p0-scope-admission.json", import.meta.url));
if (createHash("sha256").update(bytes).digest("hex") !== POLICY_SHA256) {
  throw Error("P0_SCOPE_POLICY_INTEGRITY_FAILED");
}
const policy = JSON.parse(bytes);
export const P0_FILE_HASHES = Object.freeze(policy.files);
// Original 11 gate-only paths, unchanged. All extraction/safety/reconciliation
// additions are exact content pins above, never new prefixes or exemptions.
export const GATE_FILES = Object.freeze([
  ".github/workflows/ci.yml",
  "scripts/stage-0-8a-changed-lint.mjs",
  "scripts/stage-0-8g-architecture-closure-test.mjs",
  "scripts/stage-0-10i-b-visual-system-test.mjs",
  "scripts/stage-0-10i-f-visual-consolidation-test.mjs",
  "scripts/stage-0-11e-azure-readiness-gate-test.mjs",
  "scripts/quality/lint-result.mjs",
  "scripts/quality/p0-workspace-scope.mjs",
  "scripts/quality/p0-scope-admission.json",
  "scripts/p0-quality-gate-test.mjs",
  "docs/P0_QUALITY_GATE_CLOSURE.md",
]);

export function parseWorkspaceStatus(output) {
  const entries = output.split("\0");
  if (entries.pop() !== "") throw Error("WORKSPACE_STATUS_INVALID");
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.length < 4 || entry[2] !== " ") throw Error("WORKSPACE_STATUS_INVALID");
    paths.push(entry.slice(3));
    if (/[RC]/.test(entry.slice(0, 2))) {
      if (!entries[i + 1]) throw Error("WORKSPACE_STATUS_INVALID");
      paths.push(entries[++i]); // Both sides of a rename/copy must be admitted.
    }
  }
  return [...new Set(paths)];
}

export function readWorkspaceChangePaths() {
  return parseWorkspaceStatus(execFileSync("git", [
    "status", "--porcelain=v1", "--untracked-files=all", "-z",
  ], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }));
}

export function unreviewedWorkspacePaths(paths, allowed, prefixes = [], options = {}) {
  const root = fs.realpathSync(options.root || process.cwd());
  // An explicit fixture root must never inherit another worktree's Git index.
  const gitOptions = { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, ...(options.root ? {
    env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
  } : {}) };
  const staged = new Set(execFileSync("git", [
    "diff", "--cached", "--name-only", "--no-renames", "-z",
  ], gitOptions).split("\0").filter(Boolean));
  return paths.filter((file) => {
    if (path.isAbsolute(file) || file.split("/").some((part) => !part || part === "." || part === "..")) return true;
    const expected = P0_FILE_HASHES[file];
    if (expected) {
      try {
        const target = path.join(root, file);
        if (!fs.lstatSync(target).isFile() || !fs.realpathSync(target).startsWith(root + path.sep)) return true;
        if (createHash("sha256").update(fs.readFileSync(target)).digest("hex") !== expected) return true;
        // A reviewed working file must not hide a different staged candidate.
        const index = staged.has(file) ? execFileSync("git", ["show", `:${file}`], { ...gitOptions, encoding: undefined }) : null;
        return index !== null && createHash("sha256").update(index).digest("hex") !== expected;
      } catch { return true; }
    }
    return !GATE_FILES.includes(file) && !allowed.has(file) && !prefixes.some((prefix) => file.startsWith(prefix));
  });
}
