import assert from "node:assert/strict";
import fs from "node:fs";
import {
  editorialPrimaryCoverageSelectionDiagnostic,
  isRecoverableEditorialPrimaryCoverageSelectionError,
} from "../lib/research/editorialPrimaryCoverageSelectionFallback.ts";

const recoverable = [
  "EDITORIAL_PRIMARY_COVERAGE_SELECTION_INVALID",
  "EDITORIAL_PRIMARY_COVERAGE_SELECTION_LIMIT_EXCEEDED",
  "EDITORIAL_PRIMARY_COVERAGE_TARGET_NOT_ALLOWED:claim-x",
  "EDITORIAL_PRIMARY_COVERAGE_SPAN_NOT_ALLOWED:span-x",
  "EDITORIAL_PRIMARY_COVERAGE_TARGET_DUPLICATE:claim-1",
  "EDITORIAL_PRIMARY_COVERAGE_SOURCE_NOT_PRIMARY:primary:source-x",
];

for (const diagnostic of recoverable) {
  const error = new Error(diagnostic);
  assert.equal(
    isRecoverableEditorialPrimaryCoverageSelectionError(error),
    true,
    `${diagnostic} must degrade to the server-owned empty-selection path`,
  );
  assert.equal(
    editorialPrimaryCoverageSelectionDiagnostic(error),
    diagnostic,
  );
}

const failClosed = [
  "EDITORIAL_PRIMARY_COVERAGE_LINK_CONFLICT:claim-1:evidence-1",
  "EDITORIAL_PRIMARY_COVERAGE_SOURCE_ID_CONFLICT:source-1",
  "EDITORIAL_PRIMARY_COVERAGE_REQUIRED_CLAIMS_CHANGED",
  "EDITORIAL_PRIMARY_COVERAGE_SAFE_GRAPH_INVALID",
  "EDITORIAL_PRIMARY_COVERAGE_NO_SAFE_CLAIMS",
];

for (const diagnostic of failClosed) {
  assert.equal(
    isRecoverableEditorialPrimaryCoverageSelectionError(
      new Error(diagnostic),
    ),
    false,
    `${diagnostic} must remain fail-closed`,
  );
}

assert.equal(
  editorialPrimaryCoverageSelectionDiagnostic("not-an-error"),
  "EDITORIAL_PRIMARY_COVERAGE_SELECTION_INVALID",
);

const route = fs.readFileSync(
  "app/api/creator-editorial-primary-coverage/route.ts",
  "utf8",
);

assert.match(
  route,
  /CREATOR_EDITORIAL_PRIMARY_COVERAGE_SELECTION_FALLBACK/,
);
assert.match(
  route,
  /EDITORIAL_PRIMARY_COVERAGE_SELECTION_PARSE_INVALID/,
);
assert.match(
  route,
  /isRecoverableEditorialPrimaryCoverageSelectionError\(\s*selectionError/,
);
assert.match(
  route,
  /selection:\s*\{\s*repairs:\s*\[\]\s*\}/,
  "recoverable provider-selection failures must use the existing empty-selection safe degradation",
);
assert.match(
  route,
  /server-owned safe script graph/,
);
assert.match(
  route,
  /excludedPrimaryClaimIds/,
);

console.log("stage-0-19e6b-primary-coverage-selection-fallback-test: PASS");
