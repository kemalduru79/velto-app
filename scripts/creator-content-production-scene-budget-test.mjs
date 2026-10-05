import assert from "node:assert/strict";
import fs from "node:fs";
import { createCreatorSceneSpeechBudget } from "../lib/creator/creatorSceneSpeechBudget.ts";

const words = (count) => Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");
const adultGuardSource = fs.readFileSync(
  new URL("../lib/creator/adultContentGuard.ts", import.meta.url),
  "utf8",
);
const productionSource = fs.readFileSync(
  new URL("../lib/creator/services/creatorProduction.server.ts", import.meta.url),
  "utf8",
);
const timelineSource = fs.readFileSync(
  new URL("../lib/video/timelineSync.ts", import.meta.url),
  "utf8",
);

{
  const budget = createCreatorSceneSpeechBudget({
    narration: words(43),
    language: "en",
    minimumPlannedDurationSec: 18.3,
  });
  assert.equal(budget.status, "ready");
  assert.ok(budget.targetDurationSec >= 19.9);
  assert.ok(budget.maxWords >= 43);
}

{
  const budget = createCreatorSceneSpeechBudget({
    narration: words(56),
    language: "en",
    minimumPlannedDurationSec: 18.3,
  });
  assert.equal(budget.status, "ready");
  assert.ok(budget.targetDurationSec > 20);
  assert.ok(budget.targetDurationSec < 30);
}

{
  const budget = createCreatorSceneSpeechBudget({
    narration: words(80),
    language: "en",
    minimumPlannedDurationSec: 18.3,
  });
  assert.equal(budget.status, "too_long");
  assert.equal(budget.targetDurationSec, 30);
}

assert.match(
  productionSource,
  /createCreatorSceneSpeechBudget\(\{[\s\S]*minimumPlannedDurationSec:\s*targetSceneDurationSec/,
  "production scene assembly must size each scene from its speech budget",
);
assert.match(
  productionSource,
  /targetDurationSec:\s*speechBudget\.targetDurationSec/,
  "production scene output must persist the narration-sized target duration",
);
assert.match(
  adultGuardSource,
  /createCreatorSceneSpeechBudget\(\{[\s\S]*minimumPlannedDurationSec:\s*scene\.targetDurationSec/,
  "hydration must refresh historic scene speech budgets",
);
assert.match(
  adultGuardSource,
  /scriptHealth:\s*\{[\s\S]*status:\s*speechBudget\.status[\s\S]*maxWords:\s*speechBudget\.maxWords/,
  "hydration must replace stale scriptHealth metadata",
);
assert.match(
  timelineSource,
  /Number\.isFinite\(scene\.targetDurationSec\)[\s\S]*scenePlannedDurationSeconds/,
  "timeline planning must honor per-scene narration-sized duration",
);
assert.match(
  timelineSource,
  /durationMatch\?\.splitRecommended[\s\S]*\?\s*"tight"/,
  "recommended visual splitting inside the hard limit must not be treated as over-target",
);

console.log("creator-content-production-scene-budget-test: PASS");
