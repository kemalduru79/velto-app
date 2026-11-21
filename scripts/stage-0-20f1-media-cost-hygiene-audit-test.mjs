import assert from "node:assert/strict";
import fs from "node:fs";

import {
  auditCreatorMediaCostHygiene,
  DEFAULT_CREATOR_MEDIA_ORPHAN_GRACE_HOURS,
} from "../lib/creator/mediaCostHygiene.ts";

const now = Date.parse("2026-10-07T12:00:00.000Z");

const audit = auditCreatorMediaCostHygiene(
  [
    {
      id: "in-use",
      mediaKind: "video",
      sizeBytes: 100,
      lifecycleState: "active",
      createdAt: "2026-10-01T00:00:00.000Z",
      cleanupState: "IN_USE",
    },
    {
      id: "history-only",
      mediaKind: "image",
      sizeBytes: 200,
      lifecycleState: "active",
      createdAt: "2026-10-01T00:00:00.000Z",
      cleanupState: "HISTORY_ONLY",
    },
    {
      id: "recent-unreferenced",
      mediaKind: "image",
      sizeBytes: 300,
      lifecycleState: "active",
      createdAt: "2026-10-06T12:00:00.000Z",
      cleanupState: "UNREFERENCED",
    },
    {
      id: "stale-unreferenced-b",
      mediaKind: "video",
      sizeBytes: 400,
      lifecycleState: "active",
      createdAt: "2026-10-01T00:00:00.000Z",
      cleanupState: "UNREFERENCED",
    },
    {
      id: "stale-unreferenced-a",
      mediaKind: "final_video",
      sizeBytes: 500,
      lifecycleState: "active",
      createdAt: "2026-09-30T00:00:00.000Z",
      cleanupState: "UNREFERENCED",
    },
    {
      id: "missing-created-at",
      mediaKind: "image",
      sizeBytes: 600,
      lifecycleState: "active",
      createdAt: null,
      cleanupState: "UNREFERENCED",
    },
    {
      id: "future-created-at",
      mediaKind: "dialogue_audio",
      sizeBytes: 650,
      lifecycleState: "active",
      createdAt: "2026-10-08T12:00:00.000Z",
      cleanupState: "UNREFERENCED",
    },
    {
      id: "narration-audio-stale",
      mediaKind: "narration_audio",
      sizeBytes: 150,
      lifecycleState: "active",
      createdAt: "2026-10-01T00:00:00.000Z",
      cleanupState: "UNREFERENCED",
    },
    {
      id: "trashed",
      mediaKind: "video",
      sizeBytes: 700,
      lifecycleState: "trashed",
      createdAt: "2026-09-01T00:00:00.000Z",
      cleanupState: "TRASHED",
    },
    {
      id: "purged",
      mediaKind: "video",
      sizeBytes: 800,
      lifecycleState: "purged",
      createdAt: "2026-09-01T00:00:00.000Z",
      cleanupState: "TRASHED",
    },
  ],
  { now },
);

assert.equal(DEFAULT_CREATOR_MEDIA_ORPHAN_GRACE_HOURS, 72);
assert.equal(audit.version, "0.20F1");
assert.equal(audit.status, "attention");
assert.equal(audit.requiresManualReview, true);
assert.equal(audit.graceHours, 72);

assert.deepEqual(
  audit.cleanupCandidateAssetIds,
  ["narration-audio-stale", "stale-unreferenced-a", "stale-unreferenced-b"],
  "stale unreferenced assets must be deterministic cleanup candidates",
);

assert.deepEqual(
  audit.reviewRequiredAssetIds,
  ["future-created-at", "missing-created-at"],
  "missing or future age authority must fail closed to manual review",
);

assert.equal(audit.cleanupCandidateAssetIds.includes("future-created-at"), false);
assert.equal(audit.metrics.recentUnreferencedAssetCount, 1, "future media must not be classified as recent");
assert.ok(audit.cleanupCandidateAssetIds.includes("narration-audio-stale"), "non-visual media must contribute to all-media hygiene classification");

assert.deepEqual(audit.metrics, {
  totalAssetCount: 9,
  activeAssetCount: 8,
  trashedAssetCount: 1,
  inUseAssetCount: 1,
  historyOnlyAssetCount: 1,
  recentUnreferencedAssetCount: 1,
  cleanupCandidateCount: 3,
  reviewRequiredCount: 2,
  totalBytes: 3600,
  activeBytes: 2900,
  trashedBytes: 700,
  inUseBytes: 100,
  historyOnlyBytes: 200,
  recentUnreferencedBytes: 300,
  potentialReclaimableBytes: 1050,
  reviewRequiredBytes: 1250,
});

const zeroGrace = auditCreatorMediaCostHygiene(
  [
    {
      id: "immediate",
      mediaKind: "image",
      sizeBytes: 10,
      lifecycleState: "active",
      createdAt: "2026-10-07T12:00:00.000Z",
      cleanupState: "UNREFERENCED",
    },
  ],
  { now, graceHours: 0 },
);

assert.deepEqual(zeroGrace.cleanupCandidateAssetIds, ["immediate"]);

const helperSource = fs.readFileSync(
  new URL("../lib/creator/mediaCostHygiene.ts", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  helperSource,
  /trashForOwner|purgeMediaAssetForOwner|beginPurgeForOwner|removeObject|fetch\(/,
  "F1 audit must remain read-only",
);

const route = fs.readFileSync(
  new URL("../app/api/media-assets/route.ts", import.meta.url),
  "utf8",
);

assert.match(route, /auditCreatorMediaCostHygiene/);
assert.match(route, /createdAt:\s*asset\.createdAt \?\? null/);
assert.match(route, /const nonPurgedAssets = .*listForOwner[\s\S]*lifecycleState !== "purged"/);
assert.match(route, /const classifiedAssets = await Promise\.all\(nonPurgedAssets\.map/);
assert.match(route, /const inventory = classifiedAssets\.filter[\s\S]*mediaKind === "image"[\s\S]*mediaKind === "video"[\s\S]*mediaKind === "final_video"/);
assert.match(route, /auditCreatorMediaCostHygiene\(\s*classifiedAssets\.map/);
assert.doesNotMatch(route, /auditCreatorMediaCostHygiene\(\s*inventory\.map/);
assert.match(route, /return NextResponse\.json\(\{ assets: inventory, costHygiene \}\)/);

assert.doesNotMatch(
  route,
  /trashForOwner|purgeMediaAssetForOwner|beginPurgeForOwner|removeObject/,
  "media inventory GET must not perform cleanup mutations",
);

const repository = fs.readFileSync(
  new URL("../lib/persistence/media/supabaseMediaAssetRepository.ts", import.meta.url),
  "utf8",
);

assert.match(repository, /metadata,created_at/);
assert.match(repository, /createdAt:\s*row\.created_at \?\? null/);

console.log("STAGE_0_20F1_MEDIA_COST_HYGIENE_AUDIT=PASS");
