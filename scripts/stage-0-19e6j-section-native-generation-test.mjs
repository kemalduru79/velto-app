import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const target = path.join(
  repo,
  "lib/creator/creatorScriptBuildProviders.server.ts",
);

const source = fs.readFileSync(target, "utf8");

assert.match(
  source,
  /export async function executeCreatorScriptBuildScriptGenerationProvider\(input:/m,
  "provider must expose the section-native generation dispatcher",
);

assert.match(
  source,
  /if\s*\(!input\.value\.sectionNative\)\s*\{[\s\S]*schemaName:\s*"creator_script_build_script_generation"[\s\S]*generationSchema\(input\.value\)/m,
  "short-form path must preserve the existing single-call generation contract",
);

assert.match(
  source,
  /for\s*\(const\s*\[index,\s*activeSection\]\s*of\s*input\.value\.sectionPlan\.entries\(\)\)\s*\{/m,
  "section-native path must iterate deterministically over the canonical section plan",
);

assert.match(
  source,
  /const completedSections = sections\.map\(/m,
  "section-native calls must receive already-completed sections for continuity",
);

assert.match(
  source,
  /logicalOperationId:\s*`\$\{baseIdentity\}:section:\$\{index \+ 1\}:\$\{activeSection\.id\}`/m,
  "each section-native model call must use a distinct logical operation identity",
);

assert.match(
  source,
  /schemaName:\s*"creator_script_build_script_generation_section"/m,
  "section-native calls must use the single-section structured-output schema",
);

assert.match(
  source,
  /"The active section text MUST contain at least activeSection\.minimumWords words,[\s\S]*activeSection\.targetWords[\s\S]*MUST NOT exceed activeSection\.maximumWords words\."/m,
  "section-native prompt must explicitly bind minimum, target, and maximum word budgets",
);

assert.match(
  source,
  /return\s*\{\s*version:\s*"0\.19E3A-script-generation-proposal-v1",\s*sections,\s*\};/m,
  "section-native calls must reassemble into the existing canonical proposal envelope",
);

assert.match(
  source,
  /executeScriptGeneration:\s*\(value:\s*CreatorScriptBuildScriptGenerationInput\)\s*=>\s*executeCreatorScriptBuildScriptGenerationProvider\(\{\s*\.\.\.input,\s*value,\s*\}\)/m,
  "runtime provider executor must delegate script generation through the dispatcher",
);

assert.doesNotMatch(
  source,
  /executeScriptGeneration:\s*\(value:\s*CreatorScriptBuildScriptGenerationInput\)\s*=>\s*runOpenAIJson\(/m,
  "runtime executor must not bypass the section-native dispatcher",
);

console.log("stage-0-19e6j-section-native-generation-test: PASS");
