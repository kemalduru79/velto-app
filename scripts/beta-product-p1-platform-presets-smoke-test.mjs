import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CREATOR_PLATFORM_IDS,
  CREATOR_PLATFORM_PRESETS,
  createCreatorPlatformOutputPlan,
} from "../lib/creator/platformPresets.ts";

const root = process.cwd();
const baseline = "0727602d847192aa649fbed1bb1d70ae37ec2717";
const read = (path) => readFileSync(resolve(root, path), "utf8");

assert.deepEqual(CREATOR_PLATFORM_IDS, [
  "youtube",
  "youtube_shorts",
  "instagram_reels",
  "tiktok",
  "linkedin",
]);

assert.deepEqual(
  Object.fromEntries(CREATOR_PLATFORM_IDS.map((id) => [id, CREATOR_PLATFORM_PRESETS[id].recommendedAspectRatio])),
  {
    youtube: "16:9",
    youtube_shorts: "9:16",
    instagram_reels: "9:16",
    tiktok: "9:16",
    linkedin: "16:9",
  },
);

const plan = (targetPlatforms, primaryFormat) =>
  createCreatorPlatformOutputPlan({ targetPlatforms, primaryFormat, durationSec: 60 });

assert(plan(["youtube_shorts", "instagram_reels", "tiktok"], "short_form").every((item) => !item.needsAdaptation));
assert.equal(plan(["youtube"], "youtube_video")[0].needsAdaptation, false);
assert.equal(plan(["instagram_reels"], "youtube_video")[0].needsAdaptation, true);
assert.equal(plan(["youtube"], "short_form")[0].needsAdaptation, true);
assert.deepEqual(plan(["youtube", "instagram_reels"], "youtube_video").map((item) => item.platform), ["youtube", "instagram_reels"]);

const selectedFormat = "youtube_video";
plan(["instagram_reels"], selectedFormat);
assert.equal(selectedFormat, "youtube_video", "Plan derivation must not change the primary format");

const pageSource = read("app/create/page.tsx");
const outcomeSource = read("lib/creator/creatorOutcome.ts");

assert.match(
  pageSource,
  /CREATOR_PLATFORM_IDS/,
  "CreatorLab runtime platform UI must use the centralized platform IDs",
);
assert.doesNotMatch(
  pageSource,
  /CREATOR_PUBLISH_PLATFORM_OPTIONS/,
  "The legacy duplicate platform-options list must be removed",
);
assert.match(
  pageSource,
  /new Set<CreatorPublishPlatform>\(CREATOR_PLATFORM_IDS\)/,
  "Target-platform normalization must use the centralized platform IDs",
);
assert.match(
  pageSource,
  /CREATOR_PLATFORM_IDS\.map\(\(platform\)/,
  "Target-platform cards must render from the centralized platform IDs",
);

assert.match(pageSource, /platformOutputPlan\?: CreatorPlatformOutputPlan/);
assert.match(pageSource, /platformOutputPlan: creatorPlatformOutputPlan/);
assert.match(pageSource, /normalizedSavedCreatorPackage\?\.targetPlatforms/);
assert.doesNotMatch(pageSource, /normalizedSavedCreatorPackage\?\.platformOutputPlan[\s\S]{0,200}setCreatorFormat/);
assert.match(outcomeSource, /short[\s\S]*long_form[\s\S]*explainer[\s\S]*promotion/);

// Stage 0.4 behavior regression coverage without re-running its historical scope guard.
assert.match(pageSource, /<CreatorOutcomeStart/);
assert.match(pageSource, /outcome\?: CreatorOutcome/);
assert.match(pageSource, /format\?: CreatorFormat/);
assert.match(pageSource, /contentType\?: CreatorContentType/);
assert.match(pageSource, /durationPreset\?: CreatorDurationPreset/);
assert.match(pageSource, /normalizeCreatorOutcome\(draft\.outcome\)/);

const loadProjectSource = pageSource.match(
  /const loadProject = async \([\s\S]*?\n  const getProjectChildId/,
)?.[0];
assert(loadProjectSource, "Project hydration implementation must remain present");
assert.doesNotMatch(
  loadProjectSource,
  /handleCreatorOutcomeSelect|getCreatorOutcomeDefinition/,
  "Project hydration must not reapply outcome defaults",
);

// Stage 0.4B behavior regression coverage without re-running its historical scope guard.
const brandStart = pageSource.indexOf('<details id="creatorlab-brand-memory"');
assert(brandStart >= 0, "Brand Memory must remain present");
const brandEnd = pageSource.indexOf("</details>", brandStart);
assert(brandEnd > brandStart, "Brand Memory details must close");
const brandSection = pageSource.slice(brandStart, brandEnd);

assert.match(brandSection, /Brand \/ Creator Name/);
assert.match(brandSection, /Primary Audience/);
assert.doesNotMatch(
  brandSection,
  /Brand voice|Marka sesi|Default visual direction|Varsayılan görsel yön|Apply now|Şimdi uygula/,
  "Basic Brand Memory must remain simplified",
);

const saveProfileSource = pageSource.match(
  /const saveCreatorProfile = \(\) => \{([\s\S]*?)\n  \};/,
)?.[1];
assert(saveProfileSource, "Brand Memory save function must remain present");
assert.doesNotMatch(
  saveProfileSource,
  /defaultCountry: creatorCountry|defaultFormat: creatorFormat|defaultQualityMode: creatorQualityMode/,
  "Saving Brand Memory must not capture project production decisions",
);

const tracked = execFileSync("git", ["diff", "--name-only", baseline, "--"], { cwd: root, encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
const changedFiles = [...new Set([...tracked, ...untracked])].sort();
const expectedFiles = [
  "app/create/page.tsx",
  "lib/creator/creatorOutcome.ts",
  "lib/creator/platformPresets.ts",
  "scripts/beta-product-p1-platform-presets-smoke-test.mjs",
].sort();
assert.deepEqual(changedFiles, expectedFiles, "Changed-file scope must be exactly the Stage 0.4C files");
assert(changedFiles.every((file) => !file.toLowerCase().includes("storyverse")), "No Storyverse file changes");
assert(changedFiles.every((file) => !file.toLowerCase().includes("migration")), "No migration files");

console.log("Stage 0.4C Basic Platform Presets smoke test passed.");
