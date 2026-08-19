import fs from "node:fs";
import { spawnSync } from "node:child_process";

const supported = /\.(?:cjs|js|jsx|mjs|ts|tsx)$/i;
const PRE_0_8A_BASELINE = "704bc5fa449269244f717a3967dcbcb54f1bb42f";
const ESLINT_BIN = "node_modules/eslint/bin/eslint.js";

function git(args, options = {}) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

function existingCommit(value) {
  return Boolean(value) && !/^0+$/.test(value) && git(["cat-file", "-e", `${value}^{commit}`]) !== null;
}

function isAncestor(ancestor, descendant) {
  if (!ancestor || !descendant) return false;
  const result = spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { stdio: "ignore" });
  return result.status === 0;
}

function applyHistoricalFloor(base) {
  if (
    existingCommit(base) &&
    existingCommit(PRE_0_8A_BASELINE) &&
    isAncestor(base, PRE_0_8A_BASELINE) &&
    isAncestor(PRE_0_8A_BASELINE, "HEAD")
  ) {
    return PRE_0_8A_BASELINE;
  }
  return base;
}

function eventBase() {
  if (process.env.GITHUB_ACTIONS !== "true") {
    return existingCommit("HEAD^") ? "HEAD^" : null;
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    if (existingCommit(event.pull_request?.base?.sha)) {
      return applyHistoricalFloor(event.pull_request.base.sha);
    }
    if (existingCommit(event.before)) {
      return applyHistoricalFloor(event.before);
    }
  }

  for (const candidate of ["origin/main", "main"]) {
    if (existingCommit(candidate)) {
      const mergeBase = git(["merge-base", "HEAD", candidate])?.trim();
      if (mergeBase) return applyHistoricalFloor(mergeBase);
    }
  }
  return existingCommit(PRE_0_8A_BASELINE) ? PRE_0_8A_BASELINE : null;
}

function namesFrom(output) {
  return (output ?? "").split("\0").filter(Boolean);
}

function changedFiles(base) {
  const files = new Set();
  const committed = base
    ? git(["diff", "--name-only", "--diff-filter=ACMR", "-z", base, "HEAD", "--"])
    : git(["show", "--pretty=format:", "--name-only", "--diff-filter=ACMR", "-z", "HEAD", "--"]);

  for (const output of [
    committed,
    git(["diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD", "--"]),
    git(["ls-files", "--others", "--exclude-standard", "-z"]),
  ]) {
    for (const file of namesFrom(output)) {
      if (supported.test(file) && fs.existsSync(file)) files.add(file);
    }
  }
  return [...files].sort();
}

function rangesFromPatch(patch) {
  const ranges = [];
  const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
  let match;
  while ((match = hunk.exec(patch ?? "")) !== null) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(count) || count <= 0) continue;
    ranges.push({ start, end: start + count - 1 });
  }
  return ranges;
}

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.start > previous.end + 1) {
      merged.push({ ...range });
    } else {
      previous.end = Math.max(previous.end, range.end);
    }
  }
  return merged;
}

function changedRanges(file, base) {
  const ranges = [];
  if (base) {
    ranges.push(...rangesFromPatch(git([
      "diff", "--unified=0", "--no-color", "--no-ext-diff", "--diff-filter=ACMR", base, "HEAD", "--", file,
    ])));
  } else {
    ranges.push(...rangesFromPatch(git([
      "show", "--format=", "--unified=0", "--no-color", "--no-ext-diff", "HEAD", "--", file,
    ])));
  }
  ranges.push(...rangesFromPatch(git([
    "diff", "--unified=0", "--no-color", "--no-ext-diff", "HEAD", "--", file,
  ])));

  const untracked = new Set(namesFrom(git(["ls-files", "--others", "--exclude-standard", "-z"])));
  if (untracked.has(file)) {
    const lineCount = fs.readFileSync(file, "utf8").split(/\r?\n/).length;
    if (lineCount > 0) ranges.push({ start: 1, end: lineCount });
  }
  return mergeRanges(ranges);
}

function overlapsChangedLine(message, ranges) {
  if (message.fatal || !Number.isFinite(message.line) || message.line <= 0) return true;
  const start = Number(message.line);
  const end = Number.isFinite(message.endLine) && message.endLine >= start ? Number(message.endLine) : start;
  return ranges.some((range) => start <= range.end && end >= range.start);
}

function lintFile(file, ranges) {
  const result = spawnSync(process.execPath, [ESLINT_BIN, "--format", "json", "--", file], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;

  let reports;
  try {
    reports = JSON.parse(result.stdout || "[]");
  } catch {
    console.error(result.stdout || result.stderr || `ESLint output could not be parsed for ${file}.`);
    return false;
  }

  if (result.status === 2) {
    console.error(result.stderr || `ESLint configuration failed for ${file}.`);
    return false;
  }

  const failures = reports.flatMap((report) =>
    (report.messages || [])
      .filter((message) => message.severity === 2 && overlapsChangedLine(message, ranges))
      .map((message) => ({ ...message, filePath: report.filePath || file })),
  );

  if (failures.length === 0) return true;
  for (const failure of failures) {
    const location = failure.line ? `${failure.line}${failure.column ? `:${failure.column}` : ""}` : "unknown";
    console.error(`${file}:${location} ${failure.message} ${failure.ruleId ? `(${failure.ruleId})` : ""}`.trim());
  }
  return false;
}

const base = eventBase();
const files = changedFiles(base);
const targets = files
  .map((file) => ({ file, ranges: changedRanges(file, base) }))
  .filter((target) => target.ranges.length > 0);

if (targets.length === 0) {
  console.log("NO_NEW_LINT_DEBT=PASS (no changed source lines)");
  process.exit(0);
}

console.log(`No-new-lint-debt baseline: ${base || "single-commit fallback"}`);
console.log(`Linting changed lines in ${targets.length} source file(s).`);
let passed = true;
for (const target of targets) {
  const label = target.ranges.map((range) => `${range.start}-${range.end}`).join(",");
  console.log(`- ${target.file}: ${label}`);
  if (!lintFile(target.file, target.ranges)) passed = false;
}

if (!passed) process.exit(1);
console.log("NO_NEW_LINT_DEBT=PASS");
