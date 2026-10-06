import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/creator-export/route.ts", import.meta.url),
  "utf8",
);

assert.match(
  route,
  /export const maxDuration = 800;/,
  "CreatorLab final export must use the generally available Pro/Enterprise Vercel function ceiling.",
);

assert.match(
  route,
  /const EXPORT_HEALTH_TIMEOUT_MS\s*=\s*4_000;/,
  "Export health probe must remain short and fail fast.",
);

assert.match(
  route,
  /const EXPORT_RENDER_TIMEOUT_MS\s*=\s*12\s*\*\s*60_000;/,
  "Long-form final render must leave headroom inside the Vercel function ceiling.",
);

assert.match(
  route,
  /signal:\s*AbortSignal\.timeout\(EXPORT_RENDER_TIMEOUT_MS\)/,
  "Final export dispatch must use the long-form render timeout.",
);

assert.doesNotMatch(
  route,
  /AbortSignal\.timeout\(55_000\)/,
  "Legacy 55-second final render timeout must not return.",
);

console.log("STAGE_0_19F_F2_FINAL_EXPORT_TIMEOUT_CONTRACT=PASS");
