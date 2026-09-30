import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCreatorScript } from "../lib/creator/creatorScript.ts";
import {
  createCreatorProductionInvalidationIdentity,
  creatorProjectHasMeaningfulProduction,
  getCreatorProductionSnapshotScenes,
  requireCreatorProductionSnapshotBeforeInvalidation,
} from "../lib/creator/creatorProductionHistory.ts";

const script = createCreatorScript({
  title: "History authority",
  revision: 2,
  targetDurationSec: 30,
  strategyFingerprint: "strategy-v2",
  generatedAt: "2026-09-30T18:00:00.000Z",
  updatedAt: "2026-09-30T18:00:00.000Z",
  grounding: { context: { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve grounded authority.", claims: [], evidence: [], sources: [], readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [] } } },
  sections: [
    { id: "opening", kind: "opening", heading: "Opening", text: "Canonical opening text remains stable for this production history authority test.", claimIds: [], evidenceReviewRequired: false },
    { id: "body", kind: "body", heading: "Body", text: "Canonical body text remains stable for this production history authority test.", claimIds: [], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", heading: "Conclusion", text: "Canonical conclusion text remains stable for this production history authority test.", claimIds: [], evidenceReviewRequired: false },
  ],
});
const nextScript = { ...script, revision: 3, updatedAt: "2026-09-30T18:01:00.000Z", sections: script.sections.map((section) => section.id === "body" ? { ...section, text: `${section.text} Revised.` } : section) };

const populated = {
  scenes: [{ id: 1, creatorSceneId: "scene-a", clipInSec: 1, clipOutSec: 6, videoUrl: "https://example.test/video.mp4", visualCoveragePlan: [{ startSec: 0, endSec: 5 }] }],
  refined_creator_scenes: [],
  creator_production_package: { scenes: [{ creatorSceneId: "scene-a" }] },
  exported_movie_url: "https://example.test/final.mp4",
  export_signature: "signature-v2",
  exported_movie_result: { creatorProjectState: { createReview: { scenes: [{ id: 1, creatorSceneId: "scene-a" }] }, production: { refinedScenes: [], audioTimeline: { placements: [{ id: "music-a" }] } } } },
};
assert.equal(creatorProjectHasMeaningfulProduction(populated), true);
assert.equal(creatorProjectHasMeaningfulProduction({ scenes: [], refined_creator_scenes: [], creator_production_package: { scenes: [] }, exported_movie_result: {} }), false);
assert.equal(getCreatorProductionSnapshotScenes({ project: populated }).length, 1);

const identity = createCreatorProductionInvalidationIdentity({ projectId: "project-a", reason: "manual_document_edit", fromRevision: 2, toRevision: 3, nextScript });
assert.equal(identity, createCreatorProductionInvalidationIdentity({ projectId: "project-a", reason: "manual_document_edit", fromRevision: 2, toRevision: 3, nextScript }));
assert.notEqual(identity, createCreatorProductionInvalidationIdentity({ projectId: "project-a", reason: "manual_document_edit", fromRevision: 3, toRevision: 4, nextScript: { ...nextScript, revision: 4 } }));

let invalidated = false;
await assert.rejects(() => requireCreatorProductionSnapshotBeforeInvalidation({
  capture: async () => { throw new Error("SNAPSHOT_WRITE_FAILED"); },
  invalidate: () => { invalidated = true; return true; },
}), /SNAPSHOT_WRITE_FAILED/);
assert.equal(invalidated, false);
const order = [];
await requireCreatorProductionSnapshotBeforeInvalidation({
  capture: async () => { order.push("snapshot"); },
  invalidate: () => { order.push("invalidate"); return true; },
});
assert.deepEqual(order, ["snapshot", "invalidate"]);

const migration = await readFile(new URL("../supabase/migrations/20260930193000_stage_0_18a6j_creator_production_history.sql", import.meta.url), "utf8");
const saveRoute = await readFile(new URL("../app/api/save-project/route.ts", import.meta.url), "utf8");
const refineRoute = await readFile(new URL("../app/api/creator-script/refine/route.ts", import.meta.url), "utf8");
const historyRoute = await readFile(new URL("../app/api/creator-production-history/[projectId]/route.ts", import.meta.url), "utf8");
const historyUi = await readFile(new URL("../components/create/CreatorProductionHistory.tsx", import.meta.url), "utf8");
const approval = await readFile(new URL("../lib/creator/creatorScriptApproval.ts", import.meta.url), "utf8");

assert.match(migration, /unique \(project_id, mutation_id\)/);
assert.match(migration, /before update on public\.velto_creator_production_snapshots/);
assert.match(migration, /for update/);
assert.match(migration, /updated_at is distinct from p_expected_updated_at/);
assert.match(migration, /insert into public\.velto_creator_production_snapshot_media_refs/);
assert.match(migration, /snapshot_json[\s\S]*to_jsonb\(v_project\)/);
assert.match(migration, /asset_id uuid not null references public\.velto_media_assets\(id\) on delete restrict/);
assert.match(migration, /grant select on table public\.velto_creator_production_snapshots to authenticated/);

for (const route of [saveRoute, refineRoute]) {
  assert.match(route, /requireCreatorProductionSnapshotBeforeInvalidation/);
  assert.match(route, /captureCreatorProductionSnapshotBeforeInvalidation/);
}
assert.ok(saveRoute.indexOf("captureCreatorProductionSnapshotBeforeInvalidation") < saveRoute.indexOf("invalidateCreatorSceneAuthorityForScriptChange(authoritativeCreatorState"));
assert.match(saveRoute, /PROJECT_REVISION_REQUIRED/);
assert.match(saveRoute, /suppressStaleCreatorFinalProjection/);
assert.match(saveRoute, /creatorSceneOutputIsCurrent/);
assert.match(saveRoute, /finalVideoUrl: ""/);
assert.match(historyRoute, /authenticateRequest/);
assert.match(historyRoute, /projectId, snapshotId, ownerUserId: principal\.id/);
assert.doesNotMatch(historyRoute, /export async function (POST|PUT|PATCH|DELETE)/);
assert.match(historyUi, /Historical, read-only, and no longer current/);
assert.match(historyUi, /Return to current production/);
assert.doesNotMatch(historyUi, /api\/save-project|persistProject\(/i);
assert.doesNotMatch(approval, /creatorProductionSnapshot|productionHistory/);

console.log("STAGE_0_18A6J_PRODUCTION_HISTORY=PASS");
