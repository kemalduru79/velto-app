import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");

const buildPath = path.join(repo, "lib/creator/creatorScriptBuild.ts");
const snapshotPath = path.join(
  repo,
  "lib/creator/creatorScriptBuildSnapshot.server.ts",
);

const build = fs.readFileSync(buildPath, "utf8");
const snapshot = fs.readFileSync(snapshotPath, "utf8");

assert.match(
  build,
  /export const CREATOR_SCRIPT_BUILD_TOPIC_MAX_CHARS = 20_000 as const;/,
  "shared topic ceiling must be explicit and version-controlled",
);

assert.match(
  build,
  /topic:\s*requireText\(\s*input\.strategy\.topic,\s*"topic",\s*CREATOR_SCRIPT_BUILD_TOPIC_MAX_CHARS,\s*\)/m,
  "core build snapshot must use the shared topic ceiling",
);

assert.match(
  snapshot,
  /CREATOR_SCRIPT_BUILD_TOPIC_MAX_CHARS,\s*createCreatorScriptBuildSnapshot/m,
  "server snapshot must import the shared topic ceiling",
);

assert.match(
  snapshot,
  /topic:\s*requiredText\(\s*state\.brief\.topic,\s*"CREATOR_SCRIPT_BUILD_TOPIC_REQUIRED",\s*CREATOR_SCRIPT_BUILD_TOPIC_MAX_CHARS,\s*\)/m,
  "server project snapshot must use the same shared topic ceiling",
);

assert.doesNotMatch(
  build,
  /topic:\s*requireText\(input\.strategy\.topic,\s*"topic",\s*4_000\)/m,
  "legacy 4,000-character core topic ceiling must not remain",
);

assert.doesNotMatch(
  snapshot,
  /"CREATOR_SCRIPT_BUILD_TOPIC_REQUIRED",\s*4_000/m,
  "legacy 4,000-character server topic ceiling must not remain",
);

console.log("stage-0-19e6e-topic-authority-contract-test: PASS");
