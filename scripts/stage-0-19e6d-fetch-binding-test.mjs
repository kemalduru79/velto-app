import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const sourcePath = path.join(
  repo,
  "lib/creator/creatorScriptBuildClient.ts",
);
const source = fs.readFileSync(sourcePath, "utf8");

assert.match(
  source,
  /const fetchImpl: FetchLike =\s*input\.fetchImpl \|\|\s*\(\(\.\.\.args\) => fetch\(\.\.\.args\)\);/m,
  "default fetch must be invoked through a wrapper so browser Window binding is preserved",
);

assert.doesNotMatch(
  source,
  /const fetchImpl = input\.fetchImpl \|\| fetch;/,
  "detached browser fetch reference must not be restored",
);

assert.match(
  source,
  /url: "\/api\/creator-script-build"/,
  "V2 client must continue using the outer build boundary",
);

assert.match(
  source,
  /CREATOR_SCRIPT_BUILD_NETWORK_ERROR/,
  "network recovery contract must remain intact",
);

console.log("stage-0-19e6d-fetch-binding-test: PASS");
