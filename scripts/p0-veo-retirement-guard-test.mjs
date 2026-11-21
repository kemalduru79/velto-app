import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const veo = readFileSync(
  "lib/video/providers/veoAdapter.ts",
  "utf8",
);

const routing = readFileSync(
  "lib/video/creatorSmartRouting.ts",
  "utf8",
);

assert.match(
  veo,
  /isAvailable\(\)\s*\{[^}]*return false;/,
);

assert.match(
  veo,
  /function assertGeminiVeoCreationDisabled\(\): void\s*\{\s*throw new Error/,
);

assert.match(
  veo,
  /async createTask\(input: VideoProviderCreateInput\): Promise<VideoProviderTask>\s*\{\s*assertGeminiVeoCreationDisabled\(\);/,
);

assert.match(
  routing,
  /veoAvailable:\s*false/,
);

assert.doesNotMatch(
  routing,
  /veoAvailable:\s*isProviderConfigured/,
);

console.log("PASS: VEO_PROVIDER_UNAVAILABLE");
console.log("PASS: DIRECT_VEO_CREATION_FAIL_CLOSED");
console.log("PASS: VEO_SMART_ROUTING_DISABLED");
console.log("P0_VEO_RETIREMENT_GUARD=PASS");
console.log("ACTUAL_PROVIDER_CALLS=0");
