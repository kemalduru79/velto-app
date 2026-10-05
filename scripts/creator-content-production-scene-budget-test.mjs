import assert from "node:assert/strict";
import { createCreatorSceneSpeechBudget } from "../lib/creator/creatorSceneSpeechBudget.ts";
import { normalizeCreatorAdultScene } from "../lib/creator/adultContentGuard.ts";
import { createTimelineSyncPlan } from "../lib/video/timelineSync.ts";

const words = (count) => Array.from({ length: count }, (_, index) => `word${index + 1}`).join(" ");

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

  const timeline = createTimelineSyncPlan({
    product: "creatorlab",
    qualityTier: "pro",
    durationSec: 660,
    sceneCount: 36,
    scenes: [{
      id: 1,
      narration: words(56),
      speechWordCount: budget.speechWordCount,
      estimatedSpeechSeconds: budget.estimatedSpeechSec,
      targetDurationSec: budget.targetDurationSec,
    }],
  });
  assert.notEqual(timeline.scenes[0].speechFit, "too_long");
  assert.equal(timeline.scenes[0].durationMatch?.fitsWithinHardLimit, true);
}

{
  const hydrated = normalizeCreatorAdultScene({
    id: 1,
    text: words(43),
    narration: words(43),
    dialogue: "",
    targetDurationSec: 20.3,
    scriptHealth: {
      status: "too_long",
      speechWordCount: 43,
      estimatedSpeechSec: 19.1,
      targetDurationSec: 20.3,
      minWords: 16,
      targetWords: 30,
      maxWords: 37,
    },
  }, {
    language: "en",
    isOpeningScene: true,
    allowDialogue: false,
  });
  assert.equal(hydrated.scriptHealth?.status, "ready");
  assert.ok((hydrated.scriptHealth?.maxWords || 0) >= 43);
  assert.ok((hydrated.targetDurationSec || 0) >= 20.3);
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

console.log("creator-content-production-scene-budget-test: PASS");
