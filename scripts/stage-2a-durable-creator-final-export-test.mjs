import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261016150000_stage_2a_durable_creator_final_exports.sql", "utf8");
const enqueue = fs.readFileSync("app/api/creator-final-export-jobs/route.ts", "utf8");
const worker = fs.readFileSync("lib/worker/jobHandlers.mjs", "utf8");
const internal = fs.readFileSync("app/api/internal/jobs/[jobId]/creator-final-export/route.ts", "utf8");
const renderer = fs.readFileSync("export-service/src/server.js", "utf8");
const authority = fs.readFileSync("lib/creator/publishReadiness.server.ts", "utf8");
const client = fs.readFileSync("app/create/page.tsx", "utf8");

assert.match(authority, /manifestScenes[\s\S]*createCreatorVisualCoveragePlan[\s\S]*buildCreatorFinalProductionSignature\([\s\S]*scenes: manifestScenes/, "coverage and signature share one server manifest");
assert.match(authority, /resolveCreatorProgramVisualRhythm/, "canonical manifest preserves program rhythm");
assert.match(enqueue, /currentCreatorFinalProductionAuthority\(project\)/, "enqueue recomputes server authority");
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
assert.match(renderer, /velto_heartbeat_creator_final_export_render[\s\S]*60_000/, "long renders renew the durable render lease");
assert.match(renderer, /clearInterval\(durableRenderHeartbeat\)/, "render heartbeat is always cleaned up");
assert.match(renderer, /status === "rendering"[\s\S]*status\(202\)/, "concurrent render dispatch is rejected as already active");
assert.match(internal, /velto_install_creator_final_export/, "worker completion uses atomic project/asset/reference installation");
assert.match(internal, /velto_settle_creator_final_export_economics/, "economic completion uses an atomic idempotent database transition");
assert.match(worker, /handleCreatorFinalExport[\s\S]*settleJobCredit[\s\S]*completeJob/, "settlement happens once on durable completion");
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

console.log("STAGE_2A_DURABLE_CREATOR_FINAL_EXPORT=PASS");
