import assert from "node:assert/strict";
import fs from "node:fs";

const coordinator = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts", import.meta.url),
  "utf8",
);

assert.match(
  coordinator,
  /getCreatorScriptEditorialDistinctivenessDiagnostics/u,
);
assert.match(
  coordinator,
  /const targetMustDifferentiate =\s*target\.direction === "differentiate_sections" \|\|\s*target\.strategy === "differentiate"/u,
);
assert.match(
  coordinator,
  /candidateIntroducedRegression/u,
);
assert.match(
  coordinator,
  /!existingFailureKeys\.has\(failureKey\(failure\)\)/u,
);

console.log("stage-0-19f-f2-heading-debt-repair-test: PASS");
