import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { validateLintProcessResult, LINT_TIMEOUT_MS, LINT_HEAP_MIB, LINT_MAX_OUTPUT_BYTES } from "./quality/lint-result.mjs";

const supported = /\.(?:cjs|js|jsx|mjs|ts|tsx)$/i;
const PRE_0_8A_BASELINE = "704bc5fa449269244f717a3967dcbcb54f1bb42f";
const ESLINT_BIN = "node_modules/eslint/bin/eslint.js";

const REVIEWED_LEGACY_LINT = Object.freeze({
  "app/api/creator-mentor/route.ts": {
    "sha256": "9067e5a319ba6a745779bdbe41c32a6c272887f8ac686b96af0ab70b45bca99f",
    "diagnosticSha256": "009aef30fcd5150d341c75f444efb6cecd9bf9589abe382b9956d2735a585918",
    "errors": 1,
    "warnings": 0
  },
  "app/api/creator-youtube-metadata/route.ts": {
    "sha256": "a97adac94bab9071b9f57fa01ea4bf08aee0379cd35122a7197f8bd88c53a329",
    "diagnosticSha256": "188ebc27afbd78171f974132f7149b26cb03999f7ddf1c3d72e0983aa2f1f27a",
    "errors": 1,
    "warnings": 0
  },
  "app/api/export-creator-package/route.ts": {
    "sha256": "11789345e42335b7ef9a65146e0423293bef6754290ca44105cf8690fb376360",
    "diagnosticSha256": "6146a0c87426e395fbfa6eaf9b7f3d94a0d552e219a2672f2466ac7f9f5533da",
    "errors": 4,
    "warnings": 0
  },
  "app/api/tts/route.ts": {
    "sha256": "3de906186ea06ebdab06728f57d04d922aa461dad9ef11a4f7621dca0581a5f3",
    "diagnosticSha256": "67ce779f3fe3192e905bc5388127b863539f57da3b18692c216abad46e064881",
    "errors": 1,
    "warnings": 0
  },
  "app/api/youtube-research/route.ts": {
    "sha256": "aaac6f0d5189f0a647d628d0592c2580e600665a9789f5daaae2cb9204b4c498",
    "diagnosticSha256": "cb0405391985076802245bd5c688eef05ab6a333167fc7bf13a5fae78b4e04bc",
    "errors": 1,
    "warnings": 2
  },
  "app/create/page.tsx": {
    "sha256": "5b2e0d8658b5b424c69ed353fe5f36e77109c67ff63ef45158eb22f94880976d",
    "diagnosticSha256": "14d0e70edef2e348c8963a2a11ad3b81ad9b847429bb900e1d5a8cb5785e0f33",
    "errors": 74,
    "warnings": 82
  },
  "app/episode/public/[shareId]/page.tsx": {
    "sha256": "c890688c06e40db2d0a2b66c387065842d10fc1864fa742b40945b37357b9a92",
    "diagnosticSha256": "1a5a676a293efbae48b62ab5c613619162b956fbd376aa7cb952cc990b872c68",
    "errors": 1,
    "warnings": 3
  }
});

function acceptsReviewedLegacyLint(file, result) {
  const approved = Object.hasOwn(REVIEWED_LEGACY_LINT, file) ? REVIEWED_LEGACY_LINT[file] : null;
  // Babel emits this informational note for the exact reviewed >500KB page.
  // Permit only its full known text, never arbitrary warnings/configuration stderr.
  const reviewedNote = file === "app/create/page.tsx"
    ? `[BABEL] Note: The code generator has deoptimised the styling of ${path.resolve(file)} as it exceeds the max of 500KB.\n`
    : "";
  if (!approved || result.error || result.signal || result.killed ||
      result.status !== 1 || (result.stderr && result.stderr !== reviewedNote)) return false;

  try {
    if (!fs.lstatSync(file).isFile()) return false;
    if (createHash("sha256").update(fs.readFileSync(file)).digest("hex") !==
        approved.sha256) return false;

    const reports = JSON.parse(result.stdout);
    if (!Array.isArray(reports) || reports.length !== 1) return false;

    const report = reports[0];
    if (report.filePath !== path.resolve(file) ||
        !Array.isArray(report.messages) ||
        report.fatalErrorCount !== 0 ||
        report.errorCount !== approved.errors ||
        report.warningCount !== approved.warnings) return false;

    const errors = report.messages.filter(m => m && m.severity === 2);
    const warnings = report.messages.filter(m => m && m.severity === 1);
    if (errors.length !== approved.errors ||
        warnings.length !== approved.warnings ||
        report.messages.some(m => !m || m.fatal ||
          ![1, 2].includes(m.severity) ||
          typeof m.message !== "string")) return false;

    const diagnostics = report.messages.map(m => ({
      rule: m.ruleId,
      severity: m.severity,
      line: m.line ?? null,
      column: m.column ?? null,
      endLine: m.endLine ?? null,
      endColumn: m.endColumn ?? null,
      // React Compiler embeds the absolute file name in a diagnostic paragraph.
      // Remove only this exact current-file prefix, never arbitrary paths/text.
      message: m.message.replaceAll("\n\n" + path.resolve(file) + ":", "\n\n" + file + ":")
    })).sort((a, b) => {
      const left = JSON.stringify(a), right = JSON.stringify(b);
      return left < right ? -1 : left > right ? 1 : 0;
    });

    return createHash("sha256")
      .update(JSON.stringify(diagnostics))
      .digest("hex") === approved.diagnosticSha256;
  } catch {
    return false;
  }
}


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
  const result = spawnSync(process.execPath, [`--max-old-space-size=${LINT_HEAP_MIB}`, ESLINT_BIN, "--format", "json", "--", file], {
    encoding: "utf8",
    maxBuffer: LINT_MAX_OUTPUT_BYTES,
    timeout: LINT_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  const validation = validateLintProcessResult(result, file);
  if (!validation.ok) {
    if (validation.code === "ESLINT_PROCESS_FAILED" &&
        acceptsReviewedLegacyLint(file, result)) {
      console.log(file + ": REVIEWED_PINNED_LEGACY_LINT=PASS");
      return true;
    }
    console.error(`${file}: ${validation.code}; reason=${validation.reason || "invalid-report"}; status=${result.status}; signal=${result.signal || "none"}; error=${result.error?.code || "none"}. No successful lint report was accepted.`);
    return false;
  }
  const failures = validation.reports.flatMap((report) =>
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
