import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const baseline = "1d8c9c0845f4bc487a65165bdccf9fe8bb38ece7";
const read = (path) => readFileSync(resolve(root, path), "utf8");

const outcomeSource = read("lib/creator/creatorOutcome.ts");
const componentSource = read("components/create/CreatorOutcomeStart.tsx");
const pageSource = read("app/create/page.tsx");
const analyticsSource = read("app/api/creator-analytics/route.ts");

const typeMatch = outcomeSource.match(
  /export type CreatorOutcome\s*=([\s\S]*?);/,
);
assert(typeMatch, "CreatorOutcome type must exist");
const outcomes = [...typeMatch[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
assert.deepEqual(outcomes, ["short", "long_form", "explainer", "promotion"]);
assert(!outcomes.includes("youtube"), "A platform must not be a CreatorOutcome");

assert.match(outcomeSource, /CREATOR_OUTCOME_DEFINITIONS/);
assert.match(outcomeSource, /Long-form Video/);
assert.match(
  outcomeSource,
  /value: "long_form"[\s\S]*?format: "youtube_video"/,
  "long_form must retain the legacy internal format mapping",
);
assert.match(outcomeSource, /normalizeCreatorOutcome/);

assert.match(pageSource, /<CreatorOutcomeStart/);
assert.match(pageSource, /outcome\?: CreatorOutcome/);
assert.match(pageSource, /format\?: CreatorFormat/);
assert.match(pageSource, /contentType\?: CreatorContentType/);
assert.match(pageSource, /durationPreset\?: CreatorDurationPreset/);
assert.match(pageSource, /outcome: creatorOutcome/);
assert.match(pageSource, /normalizeCreatorOutcome\(draft\.outcome\)/);
assert.match(
  pageSource,
  /if \(draft\.version === 1 && typeof draft\.input === "string"\)/,
  "Version-1 drafts must remain loadable without an outcome",
);
assert.match(pageSource, /\| "outcome_selected"/);
assert.match(analyticsSource, /"outcome_selected"/);

const persistProjectSource = pageSource.match(
  /const persistProject = async \([\s\S]*?\n  const loadProject = async/,
)?.[0];
assert(persistProjectSource, "Project persistence implementation must exist");
for (const field of [
  "outcome: creatorOutcome",
  "format: creatorFormat",
  "contentType: creatorContentType",
  "durationPreset: creatorDurationPreset",
  "durationSec: creatorVideoDurationSec",
  "qualityMode: creatorQualityMode",
  "targetPlatforms: creatorTargetPlatforms",
]) {
  assert(
    persistProjectSource.includes(field),
    `Creator project persistence must include ${field}`,
  );
}

const loadProjectSource = pageSource.match(
  /const loadProject = async \([\s\S]*?\n  const getProjectChildId/,
)?.[0];
assert(loadProjectSource, "Project hydration implementation must exist");
assert.match(loadProjectSource, /setCreatorFormat\(savedFormat\)/);
assert.match(loadProjectSource, /setCreatorContentType\(savedContentType/);
assert.match(loadProjectSource, /setCreatorDurationPreset\(savedDurationPreset/);
assert.match(loadProjectSource, /normalizeCreatorTargetPlatforms\([\s\S]*?restoredFormat/);
assert.doesNotMatch(
  loadProjectSource,
  /handleCreatorOutcomeSelect|getCreatorOutcomeDefinition/,
  "Project hydration must not reapply outcome defaults",
);

assert.match(componentSource, /aria-pressed=/);
assert.doesNotMatch(
  componentSource.toLowerCase(),
  /openai|runway|veo|elevenlabs|youtube|instagram|tiktok|linkedin|fetch\(/,
  "The outcome component must remain provider- and platform-neutral",
);

const trackedChangedFiles = execFileSync(
  "git",
  ["diff", "--name-only", baseline, "--"],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
const untrackedFiles = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(Boolean);
const changedFiles = [...new Set([...trackedChangedFiles, ...untrackedFiles])];
const allowedFiles = new Set([
  "app/api/creator-analytics/route.ts",
  "app/create/page.tsx",
  "components/create/CreatorOutcomeStart.tsx",
  "lib/creator/creatorOutcome.ts",
  "scripts/beta-product-p1-outcome-start-smoke-test.mjs",
]);
const unexpectedFiles = changedFiles.filter((file) => !allowedFiles.has(file));
assert.deepEqual(unexpectedFiles, [], `Unexpected scope changes: ${unexpectedFiles.join(", ")}`);
assert.deepEqual([...changedFiles].sort(), [...allowedFiles].sort(), "Expected file scope is incomplete");
assert(
  changedFiles.every((file) => !file.includes("migration") && !file.toLowerCase().includes("storyverse")),
  "No migration or Storyverse file may change",
);

console.log("Stage 0.4 outcome-start smoke test passed.");
