import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "lib/video/providers/runwayAdapter.ts",
  "utf8",
);

const start = source.indexOf(
  "async function createRunwayTask("
);
const end = source.indexOf(
  "\nexport class RunwayVideoProvider",
  start,
);

assert.ok(start >= 0 && end > start);

const block = source.slice(start, end);

assert.equal(
  (block.match(/client\.imageToVideo\.create\(\{/g) || []).length,
  2,
);

assert.equal(
  (block.match(/maxRetries:\s*0/g) || []).length,
  2,
);

assert.equal(
  (block.match(
    /duration:\s*input\.durationSec,\s*},\s*\{\s*maxRetries:\s*0\s*}\);/g
  ) || []).length,
  2,
);

console.log("PASS: BOTH_RUNWAY_CREATE_PATHS_NO_AUTO_RETRY");
console.log("P0_RUNWAY_RETRY_GUARD=PASS");
console.log("ACTUAL_PROVIDER_CALLS=0");
