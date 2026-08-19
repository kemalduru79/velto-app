import fs from "node:fs";
import { spawnSync } from "node:child_process";

const supported = /\.(?:cjs|js|jsx|mjs|ts|tsx)$/i;

function git(args, options = {}) {
  const result = spawnSync("git", args, { encoding: "utf8", ...options });
  if (result.status !== 0) return null;
  return result.stdout;
}

function existingCommit(value) {
  return value && !/^0+$/.test(value) && git(["cat-file", "-e", `${value}^{commit}`]) !== null;
}

function eventBase() {
  if (process.env.GITHUB_ACTIONS !== "true") return "HEAD";
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    if (existingCommit(event.pull_request?.base?.sha)) return event.pull_request.base.sha;
    if (existingCommit(event.before)) return event.before;
  }

  for (const candidate of ["origin/main", "main"]) {
    if (git(["rev-parse", "--verify", `${candidate}^{commit}`]) !== null) {
      const base = git(["merge-base", "HEAD", candidate])?.trim();
      if (base) return base;
    }
  }
  return null;
}

const files = new Set();
const base = eventBase();
const committed = base
  ? git(["diff", "--name-only", "--diff-filter=ACMR", "-z", base, "HEAD", "--"])
  : git(["show", "--pretty=format:", "--name-only", "--diff-filter=ACMR", "-z", "HEAD", "--"]);

for (const output of [committed, git(["diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD", "--"]), git(["ls-files", "--others", "--exclude-standard", "-z"])]) {
  for (const file of (output ?? "").split("\0").filter(Boolean)) {
    if (supported.test(file) && fs.existsSync(file)) files.add(file);
  }
}

const targets = [...files].sort();
if (targets.length === 0) {
  console.log("NO_NEW_LINT_DEBT=PASS (no changed source files)");
  process.exit(0);
}

console.log(`Linting ${targets.length} changed source file(s):`);
for (const file of targets) console.log(`- ${file}`);
const result = spawnSync(process.execPath, ["node_modules/eslint/bin/eslint.js", "--", ...targets], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("NO_NEW_LINT_DEBT=PASS");
