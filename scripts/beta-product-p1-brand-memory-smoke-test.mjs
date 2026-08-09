import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const baseline = "a8ab24c42070acae17b2fdaf0b6833037517cd1d";
const read = (path) => readFileSync(resolve(root, path), "utf8");

const pageSource = read("app/create/page.tsx");
const profileSource = read("lib/creator/creatorProfile.ts");

const brandStart = pageSource.indexOf('<details id="creatorlab-brand-memory"');
assert(brandStart >= 0, "Brand Memory must exist in the CreatorLab Brief");

const brandEnd = pageSource.indexOf("</details>", brandStart);
assert(brandEnd > brandStart, "Brand Memory details must close");
const brandSection = pageSource.slice(brandStart, brandEnd);

assert.match(brandSection, /Brand Memory/);
assert.match(brandSection, /Marka Hafızası/);
assert.match(brandSection, /Brand \/ Creator Name/);
assert.match(brandSection, /Primary Audience/);
assert.match(brandSection, /Remember for future projects/);
assert.match(brandSection, /Gelecek projeler için hatırla/);
assert.match(
  brandSection,
  /Format, platform, duration and quality stay project-specific/,
);

assert.doesNotMatch(
  brandSection,
  /Brand voice|Marka sesi|Default visual direction|Varsayılan görsel yön/,
);
assert.doesNotMatch(
  brandSection,
  /targetMarket|Target Market|Hedef Pazar/,
);

assert.doesNotMatch(
  pageSource,
  /Context & creator defaults|Bağlam ve creator varsayılanları/,
);
assert.doesNotMatch(
  pageSource,
  /const applyCreatorProfile|creatorProfileAutoAppliedRef|creatorProfileLoaded/,
);

const saveFunctionMatch = pageSource.match(
  /const saveCreatorProfile = \(\) => \{([\s\S]*?)\n  \};/,
);
assert(saveFunctionMatch, "Brand Memory save function must exist");
assert.match(saveFunctionMatch[1], /parseCreatorProfile\(creatorProfile\)/);
assert.doesNotMatch(
  saveFunctionMatch[1],
  /defaultCountry: creatorCountry|defaultFormat: creatorFormat|defaultQualityMode: creatorQualityMode/,
);

const settingsStart = pageSource.indexOf('id="creatorlab-brief-settings"');
assert(settingsStart >= 0, "Essential Decisions section must exist");
const settingsSlice = pageSource.slice(settingsStart, settingsStart + 9000);
assert.match(settingsSlice, /\{ui\.targetMarket\}/);

assert.match(profileSource, /brandVoice: string;/);
assert.match(profileSource, /defaultVisualStyle: string;/);
assert.match(
  profileSource,
  /CREATOR_PROFILE_STORAGE_KEY = "velto\.creator-profile\.v1"/,
);

assert(
  (pageSource.match(/\bcreatorProfile,\n/g) || []).length >= 2,
  "Creator profile context must continue reaching CreatorLab AI requests",
);

assert.match(pageSource, /<CreatorOutcomeStart/);
assert.match(pageSource, /\| "outcome_selected"/);
assert.match(pageSource, /outcome: creatorOutcome/);

const trackedChangedFiles = execFileSync(
  "git",
  ["diff", "--name-only", baseline, "--"],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);

const untrackedFiles = execFileSync(
  "git",
  ["ls-files", "--others", "--exclude-standard"],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);

const changedFiles = [...new Set([...trackedChangedFiles, ...untrackedFiles])];
const allowedFiles = new Set([
  "app/create/page.tsx",
  "scripts/beta-product-p1-brand-memory-smoke-test.mjs",
]);

const unexpectedFiles = changedFiles.filter((file) => !allowedFiles.has(file));
assert.deepEqual(
  unexpectedFiles,
  [],
  `Unexpected Stage 0.4B scope changes: ${unexpectedFiles.join(", ")}`,
);
assert.deepEqual(
  [...changedFiles].sort(),
  [...allowedFiles].sort(),
  "Stage 0.4B expected file scope is incomplete",
);
assert(
  changedFiles.every(
    (file) =>
      !file.toLowerCase().includes("storyverse") &&
      !file.toLowerCase().includes("migration"),
  ),
  "Stage 0.4B must not change Storyverse or database migrations",
);

console.log("Stage 0.4B Basic Brand Memory smoke test passed.");
