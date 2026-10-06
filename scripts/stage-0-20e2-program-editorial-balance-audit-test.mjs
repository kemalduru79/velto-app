import assert from "node:assert/strict";
import fs from "node:fs";
import {
  auditCreatorProgramEditorialBalance,
} from "../lib/creator/programEditorialPolish.ts";

const scene = (
  creatorSceneId,
  selectedMediaUrl,
  selectedSource = "image",
) => ({
  creatorSceneId,
  selectedMediaUrl,
  selectedSource,
});

const issueCodes = (audit) =>
  audit.issues.map((issue) => issue.code);

const empty = auditCreatorProgramEditorialBalance([]);

assert.equal(empty.version, "0.20E2");
assert.equal(empty.status, "balanced");
assert.equal(empty.requiresManualReview, false);
assert.deepEqual(empty.metrics, {
  sceneCount: 0,
  selectedMediaSceneCount: 0,
  imageSceneCount: 0,
  videoSceneCount: 0,
  uniqueSelectedMediaCount: 0,
  adjacentRepeatedMediaPairs: 0,
  longestSameMediaRun: 0,
  longestImageOnlyRun: 0,
});
assert.deepEqual(empty.issues, []);

const balanced = auditCreatorProgramEditorialBalance([
  scene("s1", "https://assets.test/a.jpg", "image"),
  scene("s2", "https://assets.test/b.jpg", "image"),
  scene("s3", "https://assets.test/c.mp4", "video"),
  scene("s4", "https://assets.test/d.jpg", "image"),
  scene("s5", "https://assets.test/e.mp4", "video"),
  scene("s6", "https://assets.test/f.jpg", "image"),
  scene("s7", "https://assets.test/g.mp4", "video"),
]);

assert.equal(balanced.status, "balanced");
assert.equal(balanced.requiresManualReview, false);
assert.deepEqual(balanced.issues, []);

const repeatedRun = auditCreatorProgramEditorialBalance([
  scene("r1", "https://assets.test/open.mp4", "video"),
  scene("r2", "https://assets.test/repeat.jpg", "image"),
  scene("r3", "https://assets.test/repeat.jpg?token=one", "image"),
  scene("r4", "https://assets.test/repeat.jpg?token=two", "image"),
  scene("r5", "https://assets.test/other.mp4", "video"),
  scene("r6", "https://assets.test/close.jpg", "image"),
]);

assert.equal(repeatedRun.status, "review");
assert.equal(repeatedRun.metrics.adjacentRepeatedMediaPairs, 2);
assert.equal(repeatedRun.metrics.longestSameMediaRun, 3);
assert.ok(
  issueCodes(repeatedRun).includes("long_same_media_run"),
);
assert.deepEqual(
  repeatedRun.issues.find(
    (issue) => issue.code === "long_same_media_run",
  )?.sceneIds,
  ["r2", "r3", "r4"],
  "long-run issue must retain the complete affected run",
);

const imageStreak = auditCreatorProgramEditorialBalance([
  scene("i1", "https://assets.test/open.mp4", "video"),
  scene("i2", "https://assets.test/1.jpg", "image"),
  scene("i3", "https://assets.test/2.jpg", "image"),
  scene("i4", "https://assets.test/3.jpg", "image"),
  scene("i5", "https://assets.test/4.jpg", "image"),
  scene("i6", "https://assets.test/close.mp4", "video"),
]);

assert.equal(imageStreak.metrics.longestImageOnlyRun, 4);
assert.ok(
  issueCodes(imageStreak).includes("long_image_only_run"),
);
assert.equal(
  issueCodes(imageStreak).includes("image_only_program"),
  false,
);

const imageOnly = auditCreatorProgramEditorialBalance(
  Array.from({ length: 7 }, (_, index) =>
    scene(
      `io${index + 1}`,
      `https://assets.test/image-${index + 1}.jpg`,
      "image",
    ),
  ),
);

assert.ok(issueCodes(imageOnly).includes("image_only_program"));
assert.ok(issueCodes(imageOnly).includes("long_image_only_run"));
assert.equal(imageOnly.metrics.videoSceneCount, 0);

const singleMedia = auditCreatorProgramEditorialBalance(
  Array.from({ length: 6 }, (_, index) =>
    scene(
      `sm${index + 1}`,
      "https://assets.test/same.jpg",
      "image",
    ),
  ),
);

for (const code of [
  "adjacent_selected_media_repeat",
  "long_same_media_run",
  "long_image_only_run",
  "single_media_program",
  "image_only_program",
  "anchor_media_repeat",
]) {
  assert.ok(
    issueCodes(singleMedia).includes(code),
    `single-media program must surface ${code}`,
  );
}

assert.equal(singleMedia.metrics.adjacentRepeatedMediaPairs, 5);
assert.equal(singleMedia.metrics.longestSameMediaRun, 6);
assert.equal(singleMedia.metrics.longestImageOnlyRun, 6);

const anchorRepeat = auditCreatorProgramEditorialBalance([
  scene("a1", "https://assets.test/anchor.jpg", "video"),
  scene("a2", "https://assets.test/2.jpg", "image"),
  scene("a3", "https://assets.test/3.mp4", "video"),
  scene("a4", "https://assets.test/anchor.jpg?token=mid", "image"),
  scene("a5", "https://assets.test/5.mp4", "video"),
  scene("a6", "https://assets.test/6.jpg", "image"),
  scene("a7", "https://assets.test/anchor.jpg?token=end", "video"),
]);

assert.deepEqual(
  anchorRepeat.issues.find(
    (issue) => issue.code === "anchor_media_repeat",
  )?.sceneIds,
  ["a1", "a4", "a7"],
);
assert.equal(
  anchorRepeat.metrics.adjacentRepeatedMediaPairs,
  0,
);

const missingMedia = auditCreatorProgramEditorialBalance(
  Array.from({ length: 6 }, (_, index) =>
    scene(`m${index + 1}`, "", "image"),
  ),
);

assert.equal(missingMedia.status, "balanced");
assert.equal(missingMedia.metrics.selectedMediaSceneCount, 0);
assert.equal(
  issueCodes(missingMedia).includes("single_media_program"),
  false,
);
assert.equal(
  issueCodes(missingMedia).includes("image_only_program"),
  false,
);

const mutationInput = [
  scene("p1", "https://assets.test/a.jpg", "image"),
  scene("p2", "https://assets.test/b.mp4", "video"),
];
const mutationSnapshot = structuredClone(mutationInput);

auditCreatorProgramEditorialBalance(mutationInput);

assert.deepEqual(
  mutationInput,
  mutationSnapshot,
  "program audit must remain read-only",
);

const polishSource = fs.readFileSync(
  new URL("../lib/creator/programEditorialPolish.ts", import.meta.url),
  "utf8",
);
const exportRoute = fs.readFileSync(
  new URL("../app/api/creator-export/route.ts", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  polishSource,
  /fetch\(|supabase|assetHistory|generateImage|generateVideo|acquireStock/,
  "E2 audit must not acquire, generate, persist, or substitute media",
);

assert.match(
  exportRoute,
  /auditCreatorProgramEditorialBalance/,
);
assert.match(
  exportRoute,
  /const resolvedExportScenes = canonicalExportScenes\.map/,
  "E2 must audit the resolved export scene set",
);

assert.match(
  exportRoute,
  /exportPayload\.scenes = resolvedExportScenes;/,
  "the same resolved scene set must remain authoritative for export",
);

assert.match(
  exportRoute,
  /authoritativeCreatorFormat === "youtube_video"[\s\S]{0,300}auditCreatorProgramEditorialBalance\(\s*resolvedExportScenes\.map/,
  "E2 audit must remain long-form CreatorLab-only and use resolved export scenes",
);

assert.match(
  exportRoute,
  /selectedMediaUrl:\s*scene\.exportSource === "video"\s*\?\s*scene\.videoUrl\s*:\s*scene\.image/,
  "E2 must inspect the selected media actually bound into the resolved export scene",
);
assert.match(
  exportRoute,
  /programEditorialPolish,/,
  "E2 result must be returned as telemetry",
);
assert.doesNotMatch(
  exportRoute,
  /if\s*\(\s*programEditorialPolish/,
  "E2 review telemetry must not become an export blocker",
);
assert.doesNotMatch(
  exportRoute,
  /programEditorialPolish\.status\s*===/,
  "E2 review status must not control export execution",
);

console.log(
  "STAGE_0_20E2_PROGRAM_EDITORIAL_BALANCE_AUDIT=PASS",
);
