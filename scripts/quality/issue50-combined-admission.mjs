// Inactive until the separately supplied exact activation patch is owner accepted.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function normalizedActivationBytes(bytes) {
  return Buffer.from(bytes.toString().replace(/const ISSUE50_COMBINED_MANIFEST_SHA = "[a-f0-9]{64}";/g, 'const ISSUE50_COMBINED_MANIFEST_SHA = "MANIFEST_SHA256";'));
}
function regular(root, relative) {
  if (path.isAbsolute(relative) || relative.split("/").some((p) => !p || p === "." || p === "..")) throw Error("COMBINED_PATH_DENIED");
  let current = root;
  for (const p of relative.split("/")) { current = path.join(current, p); if (fs.lstatSync(current).isSymbolicLink()) throw Error("COMBINED_SYMLINK_DENIED"); }
  if (!fs.lstatSync(current).isFile()) throw Error("COMBINED_NONREGULAR_DENIED");
  return fs.readFileSync(current);
}
export function inspectCombinedCandidate(rootPath, expectedManifestSha) {
  const root = fs.realpathSync(rootPath);
  if (!/^[a-f0-9]{64}$/.test(expectedManifestSha || "")) throw Error("COMBINED_OWNER_ACCEPTED_IDENTITY_REQUIRED");
  const manifestPath = "docs/admission/issue50-combined-source-v1.json";
  const bytes = regular(root, manifestPath);
  if (digest(bytes) !== expectedManifestSha) throw Error("COMBINED_MANIFEST_DRIFT");
  const manifest = JSON.parse(bytes);
  if (manifest.schema !== "velto-issue50-combined-exact-admission/v1" || manifest.base !== "bc30a72440cfbeaafa5c3aac283bdaa5efd70656") throw Error("COMBINED_SCHEMA_DENIED");
  const git = (args) => execFileSync("git", args, { cwd: root, maxBuffer: 16 * 1024 * 1024, env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } });
  const changed = [...new Set([...git(["diff", "--name-only", "--no-renames", "-z", manifest.base]).toString().split("\0"), ...git(["ls-files", "--others", "--exclude-standard", "-z"]).toString().split("\0")].filter(Boolean))].sort();
  const activationPaths = ["scripts/quality/p0-workspace-scope.mjs", "scripts/p0-quality-gate-test.mjs"];
  const expected = [...Object.keys(manifest.files), ...activationPaths, manifestPath].sort();
  if (new Set(expected).size !== expected.length || JSON.stringify(changed) !== JSON.stringify(expected)) throw Error("COMBINED_FULL_CHANGED_SET_MISMATCH");
  const originalPolicy = "scripts/quality/p0-scope-admission.json";
  if (digest(regular(root, originalPolicy)) !== "938eb04b677476f903b493adc8d42e68e32513ff2d22de2cb48b3b001686cf73") throw Error("COMBINED_ORIGINAL_POLICY_DRIFT");
  for (const [relative, historicalHash] of Object.entries(manifest.safetyBaseHashes)) {
    if (activationPaths.includes(relative)) continue;
    const expectedHash = manifest.files[relative]?.sha256 || historicalHash;
    if (digest(regular(root, relative)) !== expectedHash) throw Error("COMBINED_FROZEN_OR_SCIENTIFIC_DRIFT:" + relative);
  }
  const staged = new Set(git(["diff", "--cached", "--name-only", "--no-renames", "-z"]).toString().split("\0").filter(Boolean));
  const hashes = {};
  for (const relative of expected) {
    const content = regular(root, relative);
    if (relative !== manifestPath) {
      const pin = manifest.files[relative] || manifest.activation[relative];
      const actual = pin.normalized ? normalizedActivationBytes(content) : content;
      if (digest(actual) !== pin.sha256) throw Error("COMBINED_CONTENT_DRIFT:" + relative);
      if (pin.baseSha256 !== undefined) {
        const exists = git(["ls-tree", manifest.base, "--", relative]).length > 0;
        if (pin.baseSha256 === "ABSENT" ? exists : !exists || digest(git(["show", manifest.base + ":" + relative])) !== pin.baseSha256) throw Error("COMBINED_BASE_DRIFT");
      }
    }
    if (staged.has(relative)) {
      if (!git(["ls-files", "--stage", "--", relative]).toString().startsWith("100644 ") || !git(["show", ":" + relative]).equals(content)) throw Error("COMBINED_STAGED_DRIFT:" + relative);
    }
    hashes[relative] = digest(content);
  }
  return Object.freeze(hashes);
}
