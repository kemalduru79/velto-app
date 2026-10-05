import assert from "node:assert/strict";
import fs from "node:fs";

const provider = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildProviders.server.ts", import.meta.url),
  "utf8",
);

assert.match(
  provider,
  /const MODEL = \(\) => process\.env\.OPENAI_MODEL \|\| "gpt-4\.1-mini"/u,
);
assert.match(
  provider,
  /const SCRIPT_MODEL = \(\) =>\s*process\.env\.OPENAI_SCRIPT_MODEL \|\| "gpt-6\.1-sol"/u,
);
assert.match(
  provider,
  /const model = input\.model \|\| MODEL\(\)/u,
);

const generation = provider.slice(
  provider.indexOf("export async function executeCreatorScriptBuildScriptGenerationProvider"),
  provider.indexOf("function repairSchema"),
);
assert.ok(
  (generation.match(/model: SCRIPT_MODEL\(\)/g) || []).length >= 2,
  "both generation paths must use SCRIPT_MODEL",
);

const repair = provider.slice(
  provider.indexOf("export async function executeCreatorScriptBuildScriptRepairProvider"),
  provider.indexOf("export function createCreatorScriptBuildProviderExecutors"),
);
assert.match(repair, /model: SCRIPT_MODEL\(\)/u);

const editorial = provider.slice(
  provider.indexOf("export async function executeCreatorScriptBuildEditorialProposalProvider"),
  provider.indexOf("function generationSchema"),
);
assert.doesNotMatch(
  editorial,
  /model: SCRIPT_MODEL\(\)/u,
  "editorial/authority baseline must remain on OPENAI_MODEL",
);

console.log("stage-0-19f-f2-script-model-upgrade-test: PASS");
