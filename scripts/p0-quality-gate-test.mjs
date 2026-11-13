import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { validateLintProcessResult, LINT_TIMEOUT_MS, LINT_HEAP_MIB } from "./quality/lint-result.mjs";
import { P0_FILE_HASHES, GATE_FILES, parseWorkspaceStatus, unreviewedWorkspacePaths } from "./quality/p0-workspace-scope.mjs";

let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log("PASS " + name); };
const target = path.resolve("scripts/quality/lint-result.mjs");
const report = { filePath: target, messages: [], errorCount: 0, warningCount: 0, fatalErrorCount: 0 };
const success = { status: 0, signal: null, stdout: JSON.stringify([report]), stderr: "" };
check("only complete successful per-file lint report passes", () => assert.equal(validateLintProcessResult(success, target).ok, true));
for (const status of [1, 2, 3, 127, -1, null, undefined]) {
  for (const stdout of ["", success.stdout]) check("nonzero/missing exit fails with any output: " + status, () => {
    assert.equal(validateLintProcessResult({ ...success, status, stdout }, target).ok, false);
  });
}
for (const signal of ["SIGABRT", "SIGSEGV", "SIGTERM", "SIGKILL"]) check("signal always fails: " + signal, () => {
  assert.equal(validateLintProcessResult({ ...success, signal }, target).ok, false);
});
for (const error of [{ code: "ETIMEDOUT" }, { code: "ENOBUFS" }, { code: "ENOENT" }]) check("process error fails: " + error.code, () => {
  assert.equal(validateLintProcessResult({ ...success, error }, target).ok, false);
});
for (const output of ["", "[]", "null", "{}", "not-json", JSON.stringify([report, report]), JSON.stringify([{ ...report, filePath: "/wrong-file.ts" }]), JSON.stringify([{ ...report, errorCount: 1 }]), JSON.stringify([{ ...report, fatalErrorCount: 1 }]), JSON.stringify([{ ...report, messages: [{ severity: 1, ruleId: null, message: "File ignored because no matching configuration was supplied." }], warningCount: 1 }])]) {
  check("missing/malformed/fatal/ignored/misattributed report rejected", () => assert.equal(validateLintProcessResult({ ...success, stdout: output }, target).ok, false));
}
check("fixed lint budgets are finite and explicit", () => { assert.equal(LINT_TIMEOUT_MS, 120_000); assert.equal(LINT_HEAP_MIB, 1536); });
check("heap diagnostics expose only a fixed reason, never raw stderr", () => {
  const result = validateLintProcessResult({ ...success, status: null, signal: "SIGABRT", stderr: "Allocation failed - JavaScript heap out of memory; synthetic-private-marker" }, target);
  assert.equal(result.reason, "heap-exhausted"); assert(!JSON.stringify(result).includes("synthetic-private-marker"));
});
check("actual lintFile wrapper rejects abnormal child results and sets fixed bounds", () => {
  const source = fs.readFileSync("scripts/stage-0-8a-changed-lint.mjs", "utf8");
  const body = source.slice(source.indexOf("function lintFile("), source.indexOf("\nconst base = eventBase()"));
  for (const response of [{ ...success, status: 1 }, { ...success, status: null, signal: "SIGABRT", stdout: "" }, { ...success, error: { code: "ETIMEDOUT" } }]) {
    const context = { process, ESLINT_BIN: "not-executed", LINT_TIMEOUT_MS, LINT_HEAP_MIB, LINT_MAX_OUTPUT_BYTES: 32 * 1024 * 1024, validateLintProcessResult, acceptsReviewedLegacyLint: () => false, console: { error() {} }, overlapsChangedLine: () => true,
      spawnSync: (_bin, args, options) => { assert(args.includes("--max-old-space-size=1536")); assert.equal(options.timeout, 120_000); assert.equal(options.killSignal, "SIGKILL"); return response; } };
    vm.createContext(context); vm.runInContext(body + '\nthis.result=lintFile(' + JSON.stringify(target) + ',[]);', context);
    assert.equal(context.result, false);
  }
});

const run = (code, timeout = 2000) => spawnSync(process.execPath, ["-e", code], { encoding: "utf8", timeout, killSignal: "SIGKILL" });
check("real child status-1 with empty output rejected", () => assert.equal(validateLintProcessResult(run("process.exit(1)"), target).ok, false));
check("real child signal rejected", () => assert.equal(validateLintProcessResult(run("process.kill(process.pid,'SIGTERM')"), target).ok, false));
check("real child timeout rejected", () => { const r = run("setInterval(()=>{},1000)", 100); assert.equal(r.error.code, "ETIMEDOUT"); assert.equal(validateLintProcessResult(r, target).ok, false); });
check("real ESLint complete success accepted", () => {
  const r = spawnSync(process.execPath, ["node_modules/eslint/bin/eslint.js", "--format", "json", "--", target], { encoding: "utf8", timeout: 20000 });
  assert.equal(validateLintProcessResult(r, target).ok, true);
});
check("real ESLint parse-fatal exit rejected", () => {
  const r = spawnSync(process.execPath, ["node_modules/eslint/bin/eslint.js", "--format", "json", "--stdin", "--stdin-filename", target], { input: "const = ;", encoding: "utf8", timeout: 20000 });
  assert.equal(r.status, 1); assert.equal(validateLintProcessResult(r, target).ok, false);
});

check("exact reviewed scope preserves 99 original entries plus five exact dependency-security pins", () => { assert.equal(Object.keys(P0_FILE_HASHES).length, 104); assert(Object.hasOwn(P0_FILE_HASHES, "app/api/story/route.ts")); assert.equal(GATE_FILES.length, 11); assert(Object.isFrozen(P0_FILE_HASHES)); assert.equal(P0_FILE_HASHES["package.json"], "4fc0a29353bca1f0dba78ca3e3b6651926e697e6f48912d4ceb1986c28451b7e"); assert.equal(P0_FILE_HASHES["package-lock.json"], "0cc49f1066100518a98bdc5c78fdb05434858d8ef0046abb66f22c6009990b52"); });
check("gate exceptions retain their exact original membership", () => {
  assert.deepEqual(GATE_FILES, [
    ".github/workflows/ci.yml", "scripts/stage-0-8a-changed-lint.mjs",
    "scripts/stage-0-8g-architecture-closure-test.mjs", "scripts/stage-0-10i-b-visual-system-test.mjs",
    "scripts/stage-0-10i-f-visual-consolidation-test.mjs", "scripts/stage-0-11e-azure-readiness-gate-test.mjs",
    "scripts/quality/lint-result.mjs", "scripts/quality/p0-workspace-scope.mjs",
    "scripts/quality/p0-scope-admission.json", "scripts/p0-quality-gate-test.mjs",
    "docs/P0_QUALITY_GATE_CLOSURE.md",
  ]);
  assert(Object.isFrozen(GATE_FILES));
});
check("NUL status retains newlines and both rename sides", () => assert.deepEqual(parseWorkspaceStatus(" M app/create/page.tsx\0R  approved.ts\0unrelated.ts\0?? line\nbreak.ts\0"), ["app/create/page.tsx", "approved.ts", "unrelated.ts", "line\nbreak.ts"]));
check("empty git population is valid", () => assert.deepEqual(parseWorkspaceStatus(""), []));
check("truncated rename fails closed", () => assert.throws(() => parseWorkspaceStatus("R  approved.ts\0"), /INVALID/));

const root = fs.mkdtempSync(path.join(os.tmpdir(), "velto-p0-gate-fixture-")); fs.chmodSync(root, 0o700);
const file = "lib/creator/creatorScriptSceneConfiguration.ts";
const bytes = fs.readFileSync(file);
const legacy = new Set(["legacy-reviewed.ts"]);
const inspect = (paths, options = {}) => unreviewedWorkspacePaths(paths, legacy, ["legacy-prefix/"], { root, ...options });
const fixtureGit = (args) => execFileSync("git", args, {
  cwd: root, env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
});
try {
  fixtureGit(["init", "--quiet", root]);
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), bytes);
  check("reviewed exact content admitted", () => assert.deepEqual(inspect([file]), []));
  check("unrelated files and traversal remain rejected", () => assert.deepEqual(inspect(["unrelated.ts", "scripts/dev-owner-audit/new.ts", "../escape.ts", "/absolute.ts"]), ["unrelated.ts", "scripts/dev-owner-audit/new.ts", "../escape.ts", "/absolute.ts"]));
  check("legacy rules retained without new prefixes", () => assert.deepEqual(inspect(["legacy-reviewed.ts", "legacy-prefix/old.ts", "legacy-other/new.ts"]), ["legacy-other/new.ts"]));
  fs.appendFileSync(path.join(root, file), "\n// unreviewed alteration\n");
  check("altered approved path rejected", () => assert.deepEqual(inspect([file]), [file]));
  fixtureGit(["add", "--", file]);
  fs.writeFileSync(path.join(root, file), bytes);
  check("unreviewed staged content cannot hide under reviewed working bytes", () => assert.deepEqual(inspect([file]), [file]));
  fixtureGit(["add", "--", file]);
  check("reviewed staged and working content admitted", () => assert.deepEqual(inspect([file]), []));
  const largeFile = "app/create/page.tsx";
  fs.mkdirSync(path.dirname(path.join(root, largeFile)), { recursive: true });
  fs.writeFileSync(path.join(root, largeFile), fs.readFileSync(largeFile));
  fixtureGit(["add", "--", largeFile]);
  check("exact reviewed large page can be verified after staging", () => assert.deepEqual(inspect([largeFile]), []));
  for (const approved of Object.keys(P0_FILE_HASHES)) {
    const destination = path.join(root, approved);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, fs.readFileSync(approved));
  }
  check("every exact composed-candidate pin admits only its reviewed bytes", () => {
    assert.deepEqual(inspect(Object.keys(P0_FILE_HASHES)), []);
  });
  // Security-update acceptance cannot turn dependency pins into wildcard scope.
  for (const dependencyFile of ["package.json", "package-lock.json"]) {
    const dependencyPath = path.join(root, dependencyFile);
    const original = fs.readFileSync(dependencyPath);
    fs.appendFileSync(dependencyPath, "\n__unauthorized_dependency_mutation__\n");
    check("dependency content tamper rejected: " + dependencyFile, () => assert.deepEqual(inspect([dependencyFile]), [dependencyFile]));
    fs.writeFileSync(dependencyPath, original);
    check("reviewed dependency restored: " + dependencyFile, () => assert.deepEqual(inspect([dependencyFile]), []));
  }
  // The previously vulnerable Next.js release must fail through the same pin gate.
  {
    const dependencyPath = path.join(root, "package.json");
    const original = fs.readFileSync(dependencyPath);
    const downgraded = original.toString("utf8").replace('"next": "16.4.6"', '"next": "16.2.3"');
    assert.notEqual(downgraded, original.toString("utf8"));
    fs.writeFileSync(dependencyPath, downgraded);
    check("vulnerable Next.js version regression rejected", () => assert.deepEqual(inspect(["package.json"]), ["package.json"]));
    fs.writeFileSync(dependencyPath, original);
  }
  for (const approved of ["components/create/CreatorProductionPanel.tsx", "scripts/fixtures/create-workspace-panel-authority.mjs", "scripts/creator-export-duration-mounted-test.mjs"]) {
    const destination = path.join(root, approved), original = fs.readFileSync(destination);
    fs.appendFileSync(destination, "\n// unreviewed candidate mutation\n");
    check("moved/safety/reconciliation content tamper rejected: " + approved, () => assert.deepEqual(inspect([approved]), [approved]));
    fixtureGit(["add", "--", approved]);
    fs.writeFileSync(destination, original);
    check("new exact pins reject mismatched staged bytes: " + approved, () => assert.deepEqual(inspect([approved]), [approved]));
    fixtureGit(["add", "--", approved]);
    check("new exact pins admit matching staged and working bytes: " + approved, () => assert.deepEqual(inspect([approved]), []));
  }
  check("no new sibling or controller path is admitted", () => {
    const unknown = ["components/create/CreatorProductionPanelUnreviewed.tsx", "components/create/useCreatorProjectSession.ts", "scripts/fixtures/create-workspace-unreviewed.mjs"];
    assert.deepEqual(inspect(unknown), unknown);
  });
  fs.unlinkSync(path.join(root, file)); fs.symlinkSync(target, path.join(root, file));
  check("symlink at approved path rejected", () => assert.deepEqual(inspect([file]), [file]));
  fs.unlinkSync(path.join(root, file));
  check("deleting approved file rejected", () => assert.deepEqual(inspect([file]), [file]));
  fs.writeFileSync(path.join(root, "p0-workspace-scope.mjs"), fs.readFileSync("scripts/quality/p0-workspace-scope.mjs"));
  fs.writeFileSync(path.join(root, "p0-scope-admission.json"), fs.readFileSync("scripts/quality/p0-scope-admission.json", "utf8") + " ");
  await assert.rejects(() => import(pathToFileURL(path.join(root, "p0-workspace-scope.mjs")).href), /P0_SCOPE_POLICY_INTEGRITY_FAILED/); checks++;
  console.log("PASS policy-byte alteration cannot self-admit new scope");
} finally { fs.rmSync(root, { recursive: true, force: true }); }

const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
check("gate regression step is required before lint", () => {
  assert(workflow.indexOf("run: node scripts/p0-quality-gate-test.mjs") < workflow.indexOf("run: npm run lint:changed"));
  assert(!workflow.includes("continue-on-error"));
});
console.log(`P0_QUALITY_GATE_CONTRACTS=PASS (${checks} checks; real child/ESLint tests plus explicit synthetic abnormal-result cases; no project access)`);


// Sprint 20: exercise the actual gate definitions with disposable process results.
// No external baseline is read, no reviewed source is changed, no provider runs.
const legacyStart = checks;
const gateSource = fs.readFileSync("scripts/stage-0-8a-changed-lint.mjs", "utf8");
const approvedGateSha256 = "0b087c9669cd0940b2a5436ec40901ac528d7e96a6d5d50aa388d383638728bf";
const gateDigest = (text) => createHash("sha256").update(text).digest("hex");
const gateApproved = (text) => gateDigest(text) === approvedGateSha256;
check("reviewed lint security gate bytes unchanged", () => assert(gateApproved(gateSource)));
check("unauthorized lint security gate alteration rejected", () => assert(!gateApproved(gateSource + "\n// unauthorized\n")));
function loadGate(response, filesystem = fs, source = gateSource) {
  const context = { fs: filesystem, path, createHash, process,
    validateLintProcessResult, LINT_TIMEOUT_MS, LINT_HEAP_MIB,
    LINT_MAX_OUTPUT_BYTES: 32 * 1024 * 1024,
    console: { log() {}, error() {} }, spawnSync: () => response };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("const supported ="), source.indexOf("\nconst base = eventBase()")) +
    "\nthis.accept = acceptsReviewedLegacyLint; this.lint = lintFile; this.records = REVIEWED_LEGACY_LINT;", context);
  return context;
}
const legacyFiles = Object.keys(loadGate(success).records);
check("legacy membership is exactly the seven reviewed files", () => assert.deepEqual(legacyFiles, [
  "app/api/creator-mentor/route.ts", "app/api/creator-youtube-metadata/route.ts",
  "app/api/export-creator-package/route.ts", "app/api/tts/route.ts",
  "app/api/youtube-research/route.ts", "app/create/page.tsx", "app/episode/public/[shareId]/page.tsx",
]));
for (const file of legacyFiles) {
  const actual = spawnSync(process.execPath, ["--max-old-space-size=1536", "node_modules/eslint/bin/eslint.js", "--format", "json", "--", file],
    { encoding: "utf8", timeout: LINT_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024, killSignal: "SIGKILL" });
  check("real exact legacy report accepted: " + file, () => {
    assert.equal(actual.status, 1); assert.equal(loadGate(actual).accept(file, actual), true);
    assert.equal(loadGate(actual).lint(file, [{ start: 1, end: Number.MAX_SAFE_INTEGER }]), true);
  });
  const parsed = JSON.parse(actual.stdout);
  const altered = (change) => { const copy = structuredClone(parsed); change(copy[0]); return { ...actual, stdout: JSON.stringify(copy) }; };
  const negative = (name, result, filesystem = fs, source = gateSource) => check(name + ": " + file, () => {
    const gate = loadGate(result, filesystem, source);
    assert.equal(gate.accept(file, result), false);
    assert.equal(gate.lint(file, [{ start: 1, end: Number.MAX_SAFE_INTEGER }]), false);
  });
  negative("added error", altered(r => { r.messages.push({ ...r.messages[0], severity: 2 }); r.errorCount++; }));
  negative("removed diagnostic with consistent counts", altered(r => { const m = r.messages.pop(); if (m.severity === 2) r.errorCount--; else r.warningCount--; }));
  negative("changed diagnostic text", altered(r => { r.messages[0].message += " altered"; }));
  negative("changed diagnostic location", altered(r => { r.messages[0].line++; }));
  negative("changed rule", altered(r => { r.messages[0].ruleId = "unreviewed/rule"; }));
  negative("fatal diagnostic", altered(r => { r.messages[0].fatal = true; r.fatalErrorCount = 1; }));
  negative("wrong attributed file", altered(r => { r.filePath += ".other"; }));
  negative("incomplete but consistent report", altered(r => { r.messages = []; r.errorCount = 0; r.warningCount = 0; }));
  negative("missing messages", altered(r => { delete r.messages; }));
  negative("bad count type", altered(r => { r.errorCount = String(r.errorCount); }));
  negative("missing fatal count", altered(r => { delete r.fatalErrorCount; }));
  for (const stdout of ["", "[]", "{}", "null", actual.stdout.slice(0, -2), JSON.stringify([parsed[0], parsed[0]])])
    negative("malformed/missing/truncated/multiple report", { ...actual, stdout });
  for (const status of [2, null, undefined]) negative("invalid exit " + status, { ...actual, status });
  for (const error of [{ code: "ETIMEDOUT" }, { code: "ENOENT" }, { code: "ENOBUFS" }]) negative("process failure " + error.code, { ...actual, error });
  negative("signal", { ...actual, signal: "SIGKILL" });
  negative("killed", { ...actual, killed: true });
  negative("configuration stderr", { ...actual, stderr: "configuration failure" });
  negative("extra stderr after informational note", { ...actual, stderr: (actual.stderr || "") + "unexpected warning\n" });
  negative("informational note cannot authorize another path", { ...actual,
    stderr: "[BABEL] Note: The code generator has deoptimised the styling of /wrong/file.tsx as it exceeds the max of 500KB.\n" });
  negative("zero exit cannot inherit legacy errors", { ...actual, status: 0 });
  const tamperedFs = { ...fs, readFileSync: (name, ...args) => name === file ? Buffer.from("changed source") : fs.readFileSync(name, ...args) };
  negative("modified protected source / wrong SHA", actual, tamperedFs);
  negative("symlink source", actual, { ...fs, lstatSync: () => ({ isFile: () => false }) });
  const approved = loadGate(actual).records[file];
  negative("altered embedded source baseline", actual, fs, gateSource.replace(approved.sha256, "0".repeat(64)));
  negative("altered embedded diagnostic baseline", actual, fs, gateSource.replace(approved.diagnosticSha256, "0".repeat(64)));
  negative("missing embedded baseline record", actual, fs, gateSource.replace(JSON.stringify(file) + ": {", JSON.stringify(file + ".missing") + ": {"));
  check("external baseline absent or altered has no authority: " + file, () => {
    const noBaselineFs = { ...fs, readFileSync: (name, ...args) => {
      assert.equal(name, file, "runtime may only read the expected source; never an external baseline");
      return fs.readFileSync(name, ...args);
    } };
    assert.equal(loadGate(actual, noBaselineFs).lint(file, [{ start: 1, end: 1 }]), true);
  });
  // Relocate only the current-file diagnostic paragraph to a synthetic checkout.
  check("same exact diagnostics work in another checkout: " + file, () => {
    const relocatedPath = "/synthetic-hosted-checkout/" + file;
    const relocated = altered(r => { r.filePath = relocatedPath; for (const m of r.messages)
      m.message = m.message.replaceAll("\n\n" + path.resolve(file) + ":", "\n\n" + relocatedPath + ":"); });
    relocated.stderr = (relocated.stderr || "").replaceAll(path.resolve(file), relocatedPath);
    const context = loadGate(relocated);
    context.path = { ...path, resolve: () => relocatedPath };
    assert.equal(context.accept(file, relocated), true);
  });
}
check("clean unlisted file uses normal strict policy", () => {
  const gate = loadGate(success);
  assert.equal(gate.accept(target, success), false);
  assert.equal(gate.lint(target, [{ start: 1, end: 1 }]), true);
});
check("unlisted nonzero result fails even outside changed lines", () => {
  assert.equal(loadGate({ ...success, status: 1 }).lint(target, []), false);
});
check("zero-error result still rejects ignored or invalid report", () => {
  for (const stdout of ["", "[]", JSON.stringify([{ ...report, fatalErrorCount: 1 }])])
    assert.equal(loadGate({ ...success, stdout }).lint(target, []), false);
});
console.log(`SPRINT20_LEGACY_LINT_CONTRACTS=PASS (${checks - legacyStart} additional checks; original 72 contracts retained)`);
