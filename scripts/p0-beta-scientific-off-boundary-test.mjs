import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.cwd();
const files = [];
const scientificDir = "lib/creator/scientificReview/";
const ext = /\.(ts|tsx|js|jsx|mjs|mts|cjs|cts)$/;

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (name.startsWith(scientificDir)) continue;
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${name}`);
    if (entry.isDirectory()) scan(name);
    else if (entry.isFile() && ext.test(name)) files.push(name);
  }
}
for (const dir of ["app", "lib", "export-service/src"]) scan(dir);

const blocked = /scientificReview|runScientificCalculation|calculationRunner|scientificCompute|scientific_compute_v1/;

function analyze(file, source) {
  const ast = ts.createSourceFile(
    file, source, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const violations = [];

  if (blocked.test(source)) violations.push("SCIENTIFIC_REFERENCE");

  function visit(node) {
    let spec = null;

    if ((ts.isImportDeclaration(node) ||
         ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      spec = node.moduleSpecifier;
    }

    if (ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
         (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))) {
      if (node.arguments.length !== 1 ||
          !ts.isStringLiteralLike(node.arguments[0])) {
        violations.push("UNRESOLVED_DYNAMIC_MODULE");
      } else {
        spec = node.arguments[0];
      }
    }

    if (spec && ts.isStringLiteralLike(spec) &&
        blocked.test(spec.text)) {
      violations.push("SCIENTIFIC_IMPORT");
    }

    ts.forEachChild(node, visit);
  }

  visit(ast);
  return [...new Set(violations)];
}

assert.ok(files.length >= 400, "Insufficient source coverage");
const routes = files.filter(p => /^app\/api\/.*\/route\.(ts|js)$/.test(p));
assert.ok(routes.length >= 79, "Insufficient route coverage");

const findings = files.flatMap(file =>
  analyze(file, fs.readFileSync(file, "utf8"))
    .map(code => ({ file, code }))
);

const negativeSamples = [
  'import { runScientificCalculation } from "@/lib/creator/scientificReview/calculationRunner";',
  'const runner = await import("@/lib/creator/scientificReview/calculationRunner");',
  'const runner = require("./scientificReview/calculationRunner");',
  'const runner = await import(moduleName);'
];

for (const sample of negativeSamples) {
  assert.ok(analyze("negative-test.ts", sample).length > 0,
    "Negative control unexpectedly accepted");
}

const container = JSON.parse(fs.readFileSync(
  "lib/creator/scientificReview/scientificComputeContainerRuntime.v1.json",
  "utf8"
));

assert.equal(container.status, "BLOCKED_UNPROVISIONED");
assert.ok(Object.values(container.image).every(v => v === null));

const scientificCI = fs.readFileSync(
  ".github/workflows/scientific-ci.yml", "utf8"
);
assert.match(scientificCI, /npm run test:ci-scientific/);
assert.doesNotMatch(
  scientificCI, /continue-on-error:\s*true|\|\|\s*true/
);

console.log(JSON.stringify({
  status: findings.length
    ? "P0_RUNTIME_OFF_REVIEW_REQUIRED"
    : "P0_RUNTIME_OFF_STATIC_NEGATIVE_TEST_PASS",
  files: files.length,
  routes: routes.length,
  negativeControls: negativeSamples.length,
  findings,
  scientificRuntime: container.status,
  liveExecution: false,
  releaseAuthorization: false
}, null, 2));

if (findings.length) process.exitCode = 1;
