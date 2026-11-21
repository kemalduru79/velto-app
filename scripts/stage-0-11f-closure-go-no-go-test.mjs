import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const closure = read("docs/STAGE-0.11F-CLOSURE-GO-NO-GO.md");
const critical = read("scripts/stage-0-8a-critical-regression.mjs");

for (const stage of ["0.11A", "0.11B", "0.11C", "0.11D", "0.11E"]) {
  assert.match(closure, new RegExp(`${stage.replace(".", "\\.")}[^\\n]*CLOSED`), `${stage} remains closed`);
}

assert.match(closure, /Pre-0\.11F CreatorLab credit-gating cleanup[^\n]*CLOSED/);
assert.match(closure, /Vercel \+ Supabase \+ Railway remains canonical/);
assert.match(closure, /plan upgrade[^\n]*(?:measured|evidence|trigger)/i);
assert.match(closure, /STAGE 0\.12 AZURE STAGING REHEARSAL: DEFERRED/);
assert.match(closure, /### Measured[\s\S]*### Defensible[\s\S]*### Modeled[\s\S]*### Unknown/);
assert.match(closure, /Modeled capacity must not be represented as measured production evidence/);
assert.match(closure, /AMBER[^\n]*must not be relabeled GREEN without evidence/);
assert.match(closure, /Reopen Stage 0\.12 only with evidence plus an owner and budget/);
assert.match(closure, /Target gross margin: \*\*at least 65%\*\*/);
assert.match(closure, /P90 warning floor: \*\*approximately 60%\*\*/);
assert.match(closure, /PRIVATE\/INTERNAL USE: GO/);
assert.match(closure, /CONTROLLED EARLY BETA: CONDITIONAL GO/);
assert.match(closure, /10-user deployment: \*\*NOT PROVEN\*\*/);
assert.match(closure, /25-user deployment: \*\*NOT PROVEN\*\*/);
assert.match(closure, /\*\*STAGE 0\.11 GO\.\*\*/);

assert.equal(
  (critical.match(/scripts\/stage-0-11f-closure-go-no-go-test\.mjs/g) || []).length,
  1,
  "Stage 0.11F closure test is registered exactly once",
);

console.log("STAGE_0_11F_CLOSURE_GO_NO_GO=PASS");
