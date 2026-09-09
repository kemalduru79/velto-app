import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  acceptGeneratedCreatorScript,
  acceptCreatorScriptWithDurationRepair,
  createCreatorScript,
  createCreatorStrategyFingerprint,
  CreatorScriptDurationUnsatisfiedError,
  generateCreatorScriptWithDurationContract,
  getCreatorScriptDurationContract,
  getCreatorScriptDurationContractForScript,
  getCreatorScriptMetrics,
  getCreatorScriptStatus,
  normalizeCreatorScript,
  regenerateCreatorScriptSection,
  validateCreatorScriptGenerationDuration,
} from "../lib/creator/creatorScript.ts";

const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Explain material claims accurately and preserve uncertainty.",
  readiness: { status: "ready", editorialReadinessScore: 92, reviewReasons: [] },
  claims: [{ claimId: "claim-1", claimType: "FACT", text: "Supported claim", supportingEvidenceIds: ["evidence-1"], counterEvidenceIds: [], contextualEvidenceIds: [] }],
  evidence: [{ evidenceId: "evidence-1", sourceId: "source-1", excerpt: "Verified excerpt", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }],
  sources: [{ sourceId: "source-1", title: "Primary", url: "https://example.test", publisher: "Example", author: null, publishedAt: null, directness: "primary", reviewStatus: "usable" }],
};
const fingerprint = createCreatorStrategyFingerprint({ topic: "Grounded question", durationSec: 960 });
const makeScript = (wordCount, targetDurationSec = 960) => createCreatorScript({
  title: "Canonical script",
  sections: [
    { id: "opening", kind: "opening", text: words(Math.floor(wordCount / 3)), claimIds: [], evidenceReviewRequired: false },
    { id: "body", kind: "body", text: words(Math.floor(wordCount / 3)), claimIds: ["claim-1"], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", text: words(wordCount - 2 * Math.floor(wordCount / 3)), claimIds: [], evidenceReviewRequired: false },
  ],
  targetDurationSec,
  strategyFingerprint: fingerprint,
  grounding: { context },
  generatedAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:00.000Z",
});

const en = getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 549 });
assert.equal(en.wordsPerSecond, 2.35);
assert.equal(en.targetWordCount, 2256);
assert.equal(en.minimumAcceptableWordCount, 2031);
assert.equal(en.maximumAcceptableWordCount, 2481);
assert.equal(en.status, "too_short");
assert.equal(en.estimatedDurationSec, 233.6);
assert.equal(en.targetDurationSec, 960);
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 2030 }).status, "too_short");
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 2031 }).status, "compliant");
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 2481 }).status, "compliant");
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "en", actualWordCount: 2482 }).status, "too_long");
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 240, language: "tr", actualWordCount: 516 }).wordsPerSecond, 2.15);
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "tr", actualWordCount: 1857 }).status, "too_short");
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "tr", actualWordCount: 1858 }).status, "compliant");
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "tr", actualWordCount: 2270 }).status, "compliant");
assert.equal(getCreatorScriptDurationContract({ targetDurationSec: 960, language: "tr", actualWordCount: 2271 }).status, "too_long");
for (const targetDurationSec of [30, 240, 480, 960, 1200]) {
  const budget = getCreatorScriptDurationContract({ targetDurationSec, language: "en", actualWordCount: Math.round(targetDurationSec * 2.35) });
  assert.equal(budget.status, "compliant");
  assert.ok(budget.minimumAcceptableWordCount <= budget.targetWordCount);
  assert.ok(budget.maximumAcceptableWordCount >= budget.targetWordCount);
}

let calls = 1;
const repaired = await acceptCreatorScriptWithDurationRepair({
  firstScript: makeScript(549),
  language: "en",
  repair: async (diagnostics) => {
    calls += 1;
    assert.equal(diagnostics.status, "too_short");
    return makeScript(diagnostics.targetWordCount);
  },
});
assert.equal(calls, 2);
assert.equal(repaired.repaired, true);
assert.equal(repaired.creatorScript.targetDurationSec, 960);
assert.equal(repaired.diagnostics.status, "compliant");
assert.equal(repaired.diagnostics.actualWordCount, 2256);
assert.equal(repaired.diagnostics.estimatedDurationSec, 960);
assert.equal(acceptGeneratedCreatorScript({
  generatedScript: repaired.creatorScript,
  origin: { projectId: "project-a", generation: 1 },
  active: { projectId: "project-b", generation: 2 },
  workspaceStep: 2,
  scenes: [],
}), null);

calls = 1;
const fast = await acceptCreatorScriptWithDurationRepair({ firstScript: makeScript(2256), language: "en", repair: async () => { calls += 1; return makeScript(2256); } });
assert.equal(fast.repaired, false);
assert.equal(calls, 1);

calls = 1;
await assert.rejects(
  acceptCreatorScriptWithDurationRepair({ firstScript: makeScript(549), language: "en", repair: async () => { calls += 1; return makeScript(600); } }),
  (error) => error instanceof CreatorScriptDurationUnsatisfiedError && error.code === "CREATOR_SCRIPT_DURATION_UNSATISFIED" && error.diagnostics.status === "too_short",
);
assert.equal(calls, 2);

let repairDirection = "";
const compressed = await acceptCreatorScriptWithDurationRepair({ firstScript: makeScript(2700), language: "en", repair: async (diagnostics) => { repairDirection = diagnostics.status; return makeScript(2300); } });
assert.equal(repairDirection, "too_long");
assert.equal(compressed.diagnostics.status, "compliant");

for (const invalidDuration of [undefined, null, "", "960", Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -1, 4.9, 3600.1]) {
  let providerCalls = 0;
  await assert.rejects(
    generateCreatorScriptWithDurationContract({
      durationSec: invalidDuration,
      language: "en",
      generateInitial: async () => { providerCalls += 1; return makeScript(2256); },
      repair: async () => { providerCalls += 1; return makeScript(2256); },
    }),
    (error) => error?.code === "CREATOR_SCRIPT_DURATION_INVALID" && /valid target duration between 5 and 3600 seconds/.test(error.message),
  );
  assert.equal(providerCalls, 0);
}
assert.equal(validateCreatorScriptGenerationDuration(960), 960);

let providerCalls = 0;
let exaCalls = 0;
const routeFast = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async (durationSec) => { providerCalls += 1; assert.equal(durationSec, 960); return makeScript(2256, durationSec); },
  repair: async () => { providerCalls += 1; return makeScript(2256); },
});
assert.equal(routeFast.repaired, false);
assert.equal(providerCalls, 1);

providerCalls = 0;
const routeShort = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => { providerCalls += 1; return makeScript(549); },
  repair: async (_script, diagnostics) => { providerCalls += 1; assert.equal(diagnostics.status, "too_short"); return makeScript(2256); },
});
assert.equal(routeShort.repaired, true);
assert.equal(providerCalls, 2);

providerCalls = 0;
const routeLong = await generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => { providerCalls += 1; return makeScript(2700); },
  repair: async (_script, diagnostics) => { providerCalls += 1; assert.equal(diagnostics.status, "too_long"); return makeScript(2256); },
});
assert.equal(routeLong.repaired, true);
assert.equal(providerCalls, 2);

providerCalls = 0;
await assert.rejects(generateCreatorScriptWithDurationContract({
  durationSec: 960,
  language: "en",
  generateInitial: async () => { providerCalls += 1; return makeScript(549); },
  repair: async () => { providerCalls += 1; return makeScript(600); },
}), /requested duration/);
assert.equal(providerCalls, 2);
assert.equal(exaCalls, 0);

await assert.rejects(
  acceptCreatorScriptWithDurationRepair({
    firstScript: makeScript(549),
    language: "en",
    repair: async () => ({
      ...makeScript(2256),
      sections: makeScript(2256).sections.map((section, index) => index === 1 ? { ...section, claimIds: ["fabricated-claim"] } : section),
    }),
  }),
  /CREATOR_SCRIPT_CLAIM_UNKNOWN/,
);

const legacyShort = normalizeCreatorScript(makeScript(30));
assert.equal(getCreatorScriptDurationContractForScript(legacyShort, "en").status, "too_short");
assert.equal(getCreatorScriptStatus(legacyShort, fingerprint), "draft");
assert.equal(getCreatorScriptMetrics(legacyShort, "en").estimatedDurationSec, getCreatorScriptDurationContractForScript(legacyShort, "en").estimatedDurationSec);
const regenerated = regenerateCreatorScriptSection(legacyShort, "body", { ...legacyShort.sections[1], text: words(20) });
assert.equal(regenerated.targetDurationSec, 960);
assert.equal(getCreatorScriptStatus(regenerated, fingerprint), "draft");

const route = await readFile(new URL("../app/api/creator-script-plan/route.ts", import.meta.url), "utf8");
assert.match(route, /creator_full_script_duration_repair/);
assert.match(route, /generateCreatorScriptWithDurationContract/);
assert.match(route, /CreatorScriptDurationInvalidError/);
assert.match(route, /minimumAcceptableWordCount/);
assert.match(route, /maximumAcceptableWordCount/);
assert.match(route, /Never invent evidence or unsupported factual claims/);
assert.doesNotMatch(route, /Exa|creator-research/);

console.log("Post-0.13C-C Script Duration Contract regression passed.");
