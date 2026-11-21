import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const providerSource = await readFile(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);
const scriptSource = await readFile(
  new URL("../lib/creator/creatorScript.ts", import.meta.url),
  "utf8",
);

for (const contractName of [
  "CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT",
  "CREATOR_SCRIPT_DOCUMENTARY_WRITING_CONTRACT",
  "CREATOR_SCRIPT_FIRST_PASS_BUDGET_CONTRACT",
]) {
  assert.match(
    providerSource,
    new RegExp(`\\.\\.\\.${contractName}`, "u"),
    `${contractName} must be bound into generation prompts`,
  );
  assert.ok(
    providerSource.split(`...${contractName}`).length - 1 >= 2,
    `${contractName} must apply to both standard and section-native generation`,
  );
}

const standardStart = providerSource.indexOf("const GENERATION_SYSTEM");
const standardEnd = providerSource.indexOf("].join(", standardStart);
assert.ok(standardStart >= 0 && standardEnd > standardStart);
const standardPrompt = providerSource.slice(standardStart, standardEnd);

const nativeStart = providerSource.indexOf("const SECTION_NATIVE_GENERATION_SYSTEM");
const nativeEnd = providerSource.indexOf("].join(", nativeStart);
assert.ok(nativeStart >= 0 && nativeEnd > nativeStart);
const nativePrompt = providerSource.slice(nativeStart, nativeEnd);

for (const promptSource of [standardPrompt, nativePrompt]) {
  assert.match(promptSource, /CREATOR_SCRIPT_DOCUMENTARY_WRITING_CONTRACT/u);
  assert.match(promptSource, /CREATOR_SCRIPT_AUDIENCE_NARRATOR_CONTRACT/u);
  assert.match(promptSource, /CREATOR_SCRIPT_FIRST_PASS_BUDGET_CONTRACT/u);
}

assert.match(
  scriptSource,
  /Treat established premises as known\. Do not restate a thesis merely to transition/u,
  "documentary contract must explicitly suppress paraphrased repetition",
);
assert.match(
  scriptSource,
  /do not default to generic 'studies show' or 'evidence suggests'/u,
  "documentary contract must preserve concrete evidence discipline",
);
assert.match(
  scriptSource,
  /For an opening,[\s\S]*avoid generic 'Imagine\.\.\.'/u,
  "documentary contract must prevent generic Imagine openings",
);
assert.match(
  scriptSource,
  /For a conclusion,[\s\S]*make the final sentence one natural open question/u,
  "documentary contract must preserve forward-moving unresolved endings",
);

assert.match(
  providerSource,
  /schemaName:\s*"creator_script_build_script_generation"/u,
  "standard structured-output schema remains in use",
);
assert.match(
  providerSource,
  /schemaName:\s*"creator_script_build_script_generation_section"/u,
  "section-native structured-output schema remains in use",
);
assert.doesNotMatch(
  providerSource,
  /schemaName:\s*"creator_script_build_script_generation_v2"/u,
  "editorial hardening must not change the structured-output contract",
);

console.log("stage-0-19f-editorial-writing-contract-binding-test: PASS");
