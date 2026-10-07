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
  ["stale-unreferenced-a", "stale-unreferenced-b"],
  "stale unreferenced assets must be deterministic cleanup candidates",
);

assert.deepEqual(
  audit.reviewRequiredAssetIds,
  ["missing-created-at"],
  "missing age authority must fail closed to manual review",
);

assert.deepEqual(audit.metrics, {
  totalAssetCount: 7,
  activeAssetCount: 6,
  trashedAssetCount: 1,
  inUseAssetCount: 1,
  historyOnlyAssetCount: 1,
  recentUnreferencedAssetCount: 1,
  cleanupCandidateCount: 2,
  reviewRequiredCount: 1,
  totalBytes: 2800,
  activeBytes: 2100,
  trashedBytes: 700,
  inUseBytes: 100,
  historyOnlyBytes: 200,
  recentUnreferencedBytes: 300,
  potentialReclaimableBytes: 900,
  reviewRequiredBytes: 600,
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
