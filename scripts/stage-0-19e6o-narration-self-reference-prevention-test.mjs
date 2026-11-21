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

const rule =
  "Never refer to the production itself in audience-facing narration:";

const occurrences = providerSource.split(rule).length - 1;
assert.ok(
  occurrences >= 3,
  `expected narration self-reference rule on standard generation, section-native generation, and repair prompts; found ${occurrences}`,
);

const sectionNativeStart = providerSource.indexOf(
  "const SECTION_NATIVE_GENERATION_SYSTEM",
);
assert.ok(sectionNativeStart >= 0, "section-native generation system must exist");
const sectionNativeEnd = providerSource.indexOf(
  "].join(",
  sectionNativeStart,
);
assert.ok(sectionNativeEnd > sectionNativeStart);
assert.match(
  providerSource.slice(sectionNativeStart, sectionNativeEnd),
  /do not say 'this video', 'this documentary', 'this episode', 'this script'/u,
);

const repairStart = providerSource.indexOf("export async function executeCreatorScriptBuildScriptRepairProvider(");
assert.ok(repairStart >= 0, "repair executor must exist");
const repairEnd = providerSource.indexOf("\nexport function createCreatorScriptBuildProviderExecutors", repairStart);
assert.ok(repairEnd > repairStart);
assert.match(
  providerSource.slice(repairStart, repairEnd),
  /Never refer to the production itself in audience-facing narration/u,
);

assert.match(
  scriptSource,
  /marker:\s*"production_self_reference"/u,
  "production_self_reference validator must remain present",
);
assert.match(
  scriptSource,
  /\(\?:this\|our\).*?\(\?:script\|documentary\|episode\|video\|section\|content\|production\|narrative\)/su,
  "production self-reference safety pattern must remain intact",
);

console.log("stage-0-19e6o-narration-self-reference-prevention-test: PASS");
