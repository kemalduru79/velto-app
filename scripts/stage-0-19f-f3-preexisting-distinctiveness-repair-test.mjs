import assert from "node:assert/strict";
import fs from "node:fs";

const coordinator = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts", import.meta.url),
  "utf8",
);

assert.match(
  coordinator,
  /const targetMustDifferentiate =\s*target\.direction === "differentiate_sections" \|\|\s*target\.strategy === "differentiate"/u,
);
assert.match(
  coordinator,
  /getCreatorScriptEditorialDistinctivenessDiagnostics\(\s*input\.currentScript/u,
);
assert.match(
  coordinator,
  /candidateIntroducedRegression/u,
);
assert.match(
  coordinator,
  /!existingFailureKeys\.has\(failureKey\(failure\)\)/u,
);
assert.match(
  coordinator,
  /if \(candidateIntroducedRegression\) \{\s*return diagnostic\("distinctiveness_rejection"/u,
);

await import("./stage-0-19e3b-script-repair-coordinator-test.mjs");

console.log("stage-0-19f-f3-preexisting-distinctiveness-repair-test: PASS");
