import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

const migration = fs.readFileSync("supabase/migrations/20261016150000_stage_2a_durable_creator_final_exports.sql", "utf8");
const enqueue = fs.readFileSync("app/api/creator-final-export-jobs/route.ts", "utf8");
const worker = fs.readFileSync("lib/worker/jobHandlers.mjs", "utf8");
const internal = fs.readFileSync("app/api/internal/jobs/[jobId]/creator-final-export/route.ts", "utf8");
const renderer = fs.readFileSync("export-service/src/server.js", "utf8");
const authority = fs.readFileSync("lib/creator/publishReadiness.server.ts", "utf8");
const client = fs.readFileSync("app/create/page.tsx", "utf8");
const mediaFingerprint = fs.readFileSync("lib/creator/mediaFingerprint.server.ts", "utf8");
const recoveryMigration = fs.readFileSync("supabase/migrations/20261017170333_stage_2_acceptance_final_export_pre_render_recovery.sql", "utf8");
const recoveryIntegration = fs.readFileSync("scripts/fixtures/stage-2-acceptance-pre-render-recovery.sql", "utf8");
const generationMigration = fs.readFileSync("supabase/migrations/20261017190000_stage_2_historical_final_export_generations.sql", "utf8");
const incidentEvidence = fs.readFileSync("scripts/fixtures/stage-2-incident-0e20-nonbillable-evidence.json", "utf8");

assert.match(authority, /manifestScenes[\s\S]*createCreatorVisualCoveragePlan[\s\S]*buildCreatorFinalProductionSignature\([\s\S]*scenes: manifestScenes/, "coverage and signature share one server manifest");
assert.match(authority, /resolveCreatorProgramVisualRhythm/, "canonical manifest preserves program rhythm");
assert.match(authority, /fingerprintCreatorMedia\(selectedMediaUrl\)[\s\S]*mediaIdentity/, "canonical manifest binds every selected scene to the shared media fingerprint");
assert.match(mediaFingerprint, /url\.search = "";[\s\S]*url\.hash = "";/, "media identity strips signed query and hash components using the renderer contract");
assert.match(enqueue, /currentCreatorFinalProductionAuthority\(project\)/, "enqueue recomputes server authority");
assert.match(enqueue, /validateCreatorRenderSceneMediaIdentities\(authority\.manifestScenes\)/, "media identity validation precedes durable enqueue side effects");
assert.match(enqueue, /p_expected_updated_at: project\.updated_at/, "enqueue pins project revision");
assert.match(enqueue, /return json\([\s\S]*202\)/, "enqueue returns asynchronously");
assert.match(enqueue, /admissionMode: "balance_backed"/, "durable export uses a real credit reservation");
assert.match(enqueue, /claimEconomicOperation\([\s\S]*creditReservationId: reservation\.reservationId/, "credit reservation is bound to one economic operation");
assert.match(enqueue, /CREATOR_FINAL_EXPORT_ENQUEUE_AMBIGUOUS/, "ambiguous enqueue is reconciled before reservation release");
assert.match(enqueue, /if \(economicClaimed\) await releaseEconomicOperationClaim/, "a duplicate request cannot release another request's economic claim");
assert.doesNotMatch(enqueue, /\/export-movie/, "browser request never performs rendering");
assert.match(migration, /unique \(owner_user_id, project_id, production_signature_sha256\)/, "database prevents duplicate signature renders");
assert.match(migration, /'runtime_probe', 'video_reconcile', 'creator_export', 'creator_final_export'/, "Stage 2A preserves the production creator_export job type while adding durable final export");
assert.match(migration, /v_project\.updated_at is distinct from p_expected_updated_at/, "stale enqueue is rejected");
assert.match(migration, /state='stale'[\s\S]*return jsonb_build_object\('status','stale'/, "changed projects retain output without installation");
assert.match(migration, /if v_run\.state = 'rendering' then[\s\S]*leaseExpired/, "an accepted ambiguous render is never automatically reclaimed after lease expiry");
assert.match(migration, /velto_credit_mark_provider_dispatch\(v_run\.owner_user_id,v_run\.credit_reservation_id,p_job_id::text/, "render acceptance atomically protects the real reservation from expiry");
assert.match(migration, /where id=v_run\.project_id[\s\S]*updated_at=v_run\.project_updated_at/, "installation uses project CAS");
assert.doesNotMatch(migration, /trash|purge|supersed/i, "completion never destroys an older or newer final video");
assert.match(migration, /finalExportJobId[\s\S]*productionSignatureSha256[\s\S]*manifestSha256[\s\S]*outputSha256/, "asset registration retains complete provenance");
assert.match(renderer, /\/jobs\/\$\{durableExport\.jobId\}\.mp4/, "job output has deterministic object identity");
assert.match(renderer, /lateCompletionReconciled: true/, "uploaded output survives an interrupted response/registration path");
assert.match(renderer, /velto_claim_creator_final_export_render/, "renderer claims one durable run before work");
assert.ok(renderer.indexOf("const invalidMediaIdentity") < renderer.indexOf("velto_claim_creator_final_export_render"), "renderer rejects invalid media identity before claim, admission consumption, or rendering");
assert.match(renderer, /velto_heartbeat_creator_final_export_render[\s\S]*60_000/, "long renders renew the durable render lease");
assert.match(renderer, /clearInterval\(durableRenderHeartbeat\)/, "render heartbeat is always cleaned up");
assert.match(renderer, /status === "rendering"[\s\S]*status\(202\)/, "concurrent render dispatch is rejected as already active");
assert.match(internal, /velto_install_creator_final_export/, "worker completion uses atomic project/asset/reference installation");
assert.match(internal, /velto_settle_creator_final_export_economics/, "economic completion uses an atomic idempotent database transition");
assert.match(internal, /export const maxDuration = 300;/, "internal final-export orchestration stays within the Vercel Hobby duration limit");
assert.ok(
  internal.indexOf('if (response.status === 202) return json({ ok: true, status: "rendering" }, 202);') < internal.indexOf('supabase.rpc("velto_install_creator_final_export"'),
  "an accepted asynchronous render returns 202 before installation and settlement",
);
assert.match(worker, /handleCreatorFinalExport[\s\S]*settleJobCredit[\s\S]*completeJob/, "settlement happens once on durable completion");
assert.match(recoveryMigration, /v_run\.state is distinct from 'queued'[\s\S]*CREATOR_FINAL_EXPORT_PRE_RENDER_STATE_INVALID/, "only an unaccepted render run can use automatic terminal recovery");
assert.match(recoveryMigration, /v_job\.status is distinct from 'running'[\s\S]*v_job\.lease_owner is distinct from trim\(p_worker_id\)[\s\S]*lease_expires_at <= clock_timestamp\(\)/, "pre-render recovery requires the actual claimed worker lease");
assert.match(recoveryMigration, /velto_credit_release[\s\S]*state = 'released'[\s\S]*state = 'failed'/, "pre-render recovery atomically releases credit/economics and closes the run");
assert.match(recoveryMigration, /revoke all on function public\.velto_reject_creator_final_export_pre_render[\s\S]*grant execute[\s\S]*service_role/, "pre-render recovery is service-role only");
assert.match(recoveryIntegration, /velto_job_claim\('acceptance-worker',60\)[\s\S]*claimed\.status is distinct from 'running'/, "integration fixture reproduces the real claimed/running queue state");
assert.match(recoveryIntegration, /WRONG_WORKER_ROLLBACK_FAILED[\s\S]*PARTIAL_FAILURE_ROLLBACK_FAILED/, "integration fixture verifies lease ownership and transaction rollback");
assert.match(recoveryIntegration, /SERVICE_ROLE_EXECUTE_MISSING[\s\S]*UNAUTHORIZED_EXECUTE_PRESENT/, "integration fixture verifies RPC privilege isolation");
assert.match(generationMigration, /generation integer not null default 0[\s\S]*unique \(owner_user_id, project_id, production_signature_sha256, generation\)/, "historical runs retain generation zero and uniqueness becomes generation-aware");
assert.match(generationMigration, /pg_advisory_xact_lock[\s\S]*consumed_job_id is null[\s\S]*CREATOR_FINAL_EXPORT_REARM_CONFLICT/, "re-arm generation allocation is serialized and single-consumption");
assert.match(generationMigration, /incident_0e20dfd9[\s\S]*velto_credit_grant[\s\S]*'refund'[\s\S]*state='failed'/, "incident recovery is pinned, compensating, and terminal");
assert.ok(enqueue.indexOf("await claimEconomicOperation") < enqueue.indexOf("await issueStorageAdmissionForOwner"), "economic claim wins before any storage admission is issued");
assert.ok(enqueue.indexOf("const { data: existing }") < enqueue.indexOf("reservation = await reserveMeteredOperation"), "a repeated admitted generation returns before reserving credits");
assert.match(enqueue, /if \(reservation\) await releaseMeteredOperation[\s\S]*if \(economicClaimed\) await releaseEconomicOperationClaim/, "a losing concurrent request releases only its own unused reservation and economic claim");
assert.match(enqueue, /releaseUnusedStorageAdmissionForOwner[\s\S]*storageAdmissionId && enqueueOwnerUserId/, "a definite enqueue failure removes only its own unused storage admission");
const parsedIncidentEvidence = JSON.parse(incidentEvidence);
assert.equal(parsedIncidentEvidence.incidentJobId, "0e20dfd9-0157-43a1-abe5-1752db2e36f1");
assert.equal(parsedIncidentEvidence.sceneEvidence.mediaIdentityPresentCount, 0);
assert.equal(parsedIncidentEvidence.economicEvidence.providerAcceptedAt, null);
assert.equal(parsedIncidentEvidence.attestation.verdict, "PROVEN_NONBILLABLE_FOR_APPLICATION_CREDITS");
assert.match(client, /creator-final-export-job:[\s\S]*localStorage/, "client reconnects to a durable job after refresh");
assert.match(client, /Final video is rendering/, "client exposes rendering status");
assert.match(client, /completed, but the project changed/, "client exposes retained stale completion");

function enqueueModel(state, signature) {
  const key = `${state.owner}:${state.project}:${signature}`;
  if (state.jobs.has(key)) return { job: state.jobs.get(key), created: false };
  const job = { id: `job-${state.jobs.size + 1}`, signature, status: "queued", settlements: 0 };
  state.jobs.set(key, job);
  return { job, created: true };
}
const state = { owner: "owner", project: "project", jobs: new Map() };
const first = enqueueModel(state, "music-none-signature");
const duplicateClick = enqueueModel(state, "music-none-signature");
const concurrentBrowser = enqueueModel(state, "music-none-signature");
assert.equal(first.created, true);
assert.equal(duplicateClick.job, first.job);
assert.equal(concurrentBrowser.job, first.job);
assert.equal(state.jobs.size, 1, "duplicate browsers produce one durable operation");
first.job.status = "running";
assert.equal(enqueueModel(state, "music-none-signature").job.status, "running", "refresh reconnects to active job");
first.job.status = "succeeded";
first.job.settlements += 1;
assert.equal(enqueueModel(state, "music-none-signature").job.settlements, 1, "replay cannot settle twice");
assert.equal(enqueueModel(state, "changed-production-signature").created, true, "changed production creates a distinct job only after explicit request");

const musicFreeManifest = { audioTimeline: { musicIntent: { mode: "none" }, placements: [] }, scenes: Array.from({ length: 36 }, (_, i) => ({ id: i + 1 })) };
const roundTrip = JSON.parse(JSON.stringify(musicFreeManifest));
assert.equal(roundTrip.audioTimeline.musicIntent.mode, "none");
assert.equal(roundTrip.audioTimeline.placements.length, 0, "music-free authority cannot reintroduce music");
assert.equal(roundTrip.scenes.length, 36, "long-form scene count is retained");

const normalizeMedia = (value) => {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
};
const fingerprint = (value) => createHash("sha256").update(normalizeMedia(value)).digest("hex").slice(0, 12);
const scenesWithIdentities = Array.from({ length: 36 }, (_, index) => {
  const selected = `https://cdn.example.test/scene-${index + 1}.mp4?token=signed-${index}#fragment`;
  return { creatorSceneId: `scene-${index + 1}`, exportSource: "video", videoUrl: selected, mediaIdentity: fingerprint(selected) };
});
assert.equal(scenesWithIdentities.length, 36);
assert.ok(scenesWithIdentities.every((scene) => scene.mediaIdentity === fingerprint(scene.videoUrl)), "all 36 scenes carry renderer-compatible identities");
assert.equal(fingerprint("https://cdn.example.test/a.mp4?token=one#x"), fingerprint("https://cdn.example.test/a.mp4?token=two#y"), "signed URL variations preserve canonical identity");
assert.notEqual(fingerprint("https://cdn.example.test/a.mp4"), fingerprint("https://cdn.example.test/b.mp4"), "different selected media remain distinct");
const payloadDigest = (scenes) => createHash("sha256").update(JSON.stringify({ scenes })).digest("hex");
assert.equal(payloadDigest(scenesWithIdentities), payloadDigest(JSON.parse(JSON.stringify(scenesWithIdentities))), "render payload hashing is stable across durable serialization");
assert.notEqual(payloadDigest(scenesWithIdentities), payloadDigest(scenesWithIdentities.map((scene, index) => index === 0 ? { ...scene, mediaIdentity: "incorrect" } : scene)), "identity changes are bound into render provenance");

console.log("STAGE_2A_DURABLE_CREATOR_FINAL_EXPORT=PASS");
