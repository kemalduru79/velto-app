import assert from "node:assert/strict";
import fs from "node:fs";

import {
  DEFAULT_CREATOR_MEDIA_ORPHAN_GRACE_HOURS,
  resolveCreatorMediaOrphanTrashEligibility,
} from "../lib/creator/mediaCostHygiene.ts";

const now = Date.parse("2026-10-07T12:00:00.000Z");

const asset = (overrides = {}) => ({
  id: "asset-1",
  mediaKind: "image",
  sizeBytes: 100,
  lifecycleState: "active",
  createdAt: "2026-10-01T00:00:00.000Z",
  cleanupState: "UNREFERENCED",
  ...overrides,
});

const eligible = resolveCreatorMediaOrphanTrashEligibility(
  asset(),
  { now },
);

assert.equal(DEFAULT_CREATOR_MEDIA_ORPHAN_GRACE_HOURS, 72);
assert.equal(eligible.eligible, true);
assert.equal(eligible.graceHours, 72);
assert.ok(eligible.ageHours >= 72);

const exactBoundary = resolveCreatorMediaOrphanTrashEligibility(
  asset({
    createdAt: "2026-10-04T12:00:00.000Z",
  }),
  { now },
);

assert.equal(
  exactBoundary.eligible,
  true,
  "exactly 72 hours old must be eligible",
);

const recent = resolveCreatorMediaOrphanTrashEligibility(
  asset({
    createdAt: "2026-10-06T12:00:00.000Z",
  }),
  { now },
);

assert.deepEqual(
  {
    eligible: recent.eligible,
    reason: recent.eligible ? null : recent.reason,
  },
  {
    eligible: false,
    reason: "grace_not_met",
  },
);

const future = resolveCreatorMediaOrphanTrashEligibility(
  asset({
    createdAt: "2026-10-08T12:00:00.000Z",
  }),
  { now },
);

assert.equal(future.eligible, false);
assert.equal(future.reason, "grace_not_met");

const missingAge = resolveCreatorMediaOrphanTrashEligibility(
  asset({ createdAt: null }),
  { now },
);

assert.equal(missingAge.eligible, false);
assert.equal(missingAge.reason, "age_unknown");

const invalidAge = resolveCreatorMediaOrphanTrashEligibility(
  asset({ createdAt: "not-a-date" }),
  { now },
);

assert.equal(invalidAge.eligible, false);
assert.equal(invalidAge.reason, "age_unknown");

const inUse = resolveCreatorMediaOrphanTrashEligibility(
  asset({ cleanupState: "IN_USE" }),
  { now },
);

assert.equal(inUse.eligible, false);
assert.equal(inUse.reason, "in_use");

const historyOnly = resolveCreatorMediaOrphanTrashEligibility(
  asset({ cleanupState: "HISTORY_ONLY" }),
  { now },
);

assert.equal(historyOnly.eligible, false);
assert.equal(historyOnly.reason, "history_only");

for (const lifecycleState of ["trashed", "purged"]) {
  const stateChanged = resolveCreatorMediaOrphanTrashEligibility(
    asset({ lifecycleState }),
    { now },
  );

  assert.equal(stateChanged.eligible, false);
  assert.equal(stateChanged.reason, "state_changed");
}

for (const mediaKind of [
  "narration_audio",
  "dialogue_audio",
  "thumbnail",
  "music",
  "other",
]) {
  const unsupported = resolveCreatorMediaOrphanTrashEligibility(
    asset({ mediaKind }),
    { now },
  );

  assert.equal(unsupported.eligible, false);
  assert.equal(unsupported.reason, "unsupported_kind");
}

const route = fs.readFileSync(
  new URL(
    "../app/api/media-assets/[assetId]/orphan-trash/route.ts",
    import.meta.url,
  ),
  "utf8",
);

assert.match(route, /authenticateRequest\(request\)/);
assert.match(route, /confirmOrphanTrash !== true/);
assert.match(route, /key !== "confirmOrphanTrash"/);

const authAt = route.indexOf("authenticateRequest(request)");
const bodyAt = route.indexOf("request.json()");
assert.ok(
  authAt >= 0 && bodyAt > authAt,
  "authentication must happen before request-body parsing",
);

const assetReadAt = route.indexOf("getForOwner");
const referencesAt = route.indexOf(
  "getReferenceSummaryForOwner",
  assetReadAt,
);
const classificationAt = route.indexOf(
  "classifyMediaReferenceSafety",
  referencesAt,
);
const eligibilityAt = route.indexOf(
  "resolveCreatorMediaOrphanTrashEligibility",
  classificationAt,
);
const persistedProjectListAt = route.indexOf(
  "projectRepository.listForOwner",
  eligibilityAt,
);
const persistedProjectReadAt = route.indexOf(
  "projectRepository.getForOwner",
  persistedProjectListAt,
);
const persistedReferenceCheckAt = route.indexOf(
  "extractProjectMediaReferences",
  persistedProjectReadAt,
);
const trashAt = route.indexOf(
  "trashForOwner",
  persistedReferenceCheckAt,
);

assert.ok(assetReadAt >= 0);
assert.ok(referencesAt > assetReadAt);
assert.ok(classificationAt > referencesAt);
assert.ok(eligibilityAt > classificationAt);
assert.ok(persistedProjectListAt > eligibilityAt);
assert.ok(persistedProjectReadAt > persistedProjectListAt);
assert.ok(persistedReferenceCheckAt > persistedProjectReadAt);
assert.ok(trashAt > persistedReferenceCheckAt);

assert.match(route, /asset\.createdAt/);
assert.match(route, /classification\.cleanupState/);
assert.match(route, /result === "in_use"/);
assert.match(route, /Media became referenced before cleanup completed/);
assert.match(route, /REFERENCE_AUTHORITY_UNAVAILABLE/);
assert.match(route, /PERSISTED_REFERENCE_FOUND/);
assert.match(route, /extractProjectMediaReferences\(project\)/);
assert.match(route, /reference\.url === authoritativePublicUrl/);

assert.doesNotMatch(
  route,
  /purgeMediaAssetForOwner|beginPurgeForOwner|completePurgeForOwner|removeObject|confirmPermanentDeletion/,
  "F2 must stop at reversible Trash",
);

assert.doesNotMatch(
  route,
  /removeAssetHistoryUrlForOwner/,
  "F2 orphan cleanup must never mutate project history",
);

assert.doesNotMatch(
  route,
  /cleanupCandidateAssetIds/,
  "F1 candidate telemetry must not become direct mutation authority",
);

const manualTrashRoute = fs.readFileSync(
  new URL(
    "../app/api/media-assets/[assetId]/trash/route.ts",
    import.meta.url,
  ),
  "utf8",
);

assert.match(
  manualTrashRoute,
  /cleanupState === "HISTORY_ONLY"/,
  "existing explicit history cleanup must remain separate",
);

console.log("STAGE_0_20F2_SAFE_ORPHAN_TRASH_AUTHORITY=PASS");
