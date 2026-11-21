import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { buildCreatorProjectState } from "../lib/creator/projectState.ts";
import { EMPTY_CREATOR_AUDIO_TIMELINE } from "../lib/creator/audioTimeline.ts";

const apiBase = process.env.STAGE2_HTTP_APP_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(apiBase && supabaseUrl && anonKey && serviceKey, "isolated HTTP integration environment is required");

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const browser = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const marker = crypto.randomUUID();
const email = `stage2-${marker}@example.test`;
const password = `Stage2-${marker}!Aa1`;
const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
assert.ifError(createError);
const ownerId = created.user.id;
const { data: session, error: sessionError } = await browser.auth.signInWithPassword({ email, password });
assert.ifError(sessionError);
const token = session.session.access_token;
const projectId = crypto.randomUUID();
const revision = "2026-10-17T20:00:00.000Z";
const scenes = Array.from({ length: 36 }, (_, index) => ({
  id: index + 1,
  creatorSceneId: `scene-${index + 1}`,
  text: `Synthetic scene ${index + 1}`,
  image: `https://offline.invalid/stage2/${marker}/scene-${index + 1}.jpg`,
  exportSource: "image",
  renderMode: "image",
  timing: { targetSceneDuration: 10, maxSpeechDuration: 9.25, speechTailBuffer: 0.75 },
}));
const state = buildCreatorProjectState({
  brief: { topic: "Offline admission test", language: "en", country: "global", ageGroup: "broad_18", contentType: "educational", format: "youtube_video", durationPreset: "custom", durationSec: 360, customDurationSec: 360, qualityMode: "standard", targetPlatforms: ["youtube"] },
  strategy: { mentorResult: null, selectedDirectionId: "direction", selectedHook: "hook", script: null },
  production: { package: null, refinedScenes: [], backgroundMusic: null, audioTimeline: EMPTY_CREATOR_AUDIO_TIMELINE, projectContinuityMode: "independent", sceneContinuityModes: {}, voicePreferences: null },
  createReview: { scenes },
  publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
});
const insertProject = async (id, title) => {
  const { error } = await admin.from("velto_projects").insert({
    id, owner_user_id: ownerId, title, flow_type: "creator_lab", scenes: [],
    exported_movie_url: "https://offline.invalid/previous-final.mp4",
    exported_movie_result: { creatorProjectState: state }, updated_at: revision,
  });
  assert.ifError(error);
};
await insertProject(projectId, "Stage 2 HTTP concurrency");
await admin.from("velto_credit_accounts").update({ balance_credits: 20, lifetime_granted_credits: 20 }).eq("user_id", ownerId);

const post = (operationId) => fetch(`${apiBase}/api/creator-final-export-jobs`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "x-creator-cost-guard": "creator-cost-guard-v1", "x-idempotency-key": operationId },
  body: JSON.stringify({ projectId, manualConfirmationGranted: true }),
}).then(async (response) => ({ status: response.status, body: await response.json() }));

const before = await admin.from("velto_credit_accounts").select("balance_credits,reserved_credits").eq("user_id", ownerId).single();
const economicBarrier = admin.rpc("stage2_http_hold_economic_boundary", { p_seconds: 2 }).then(({ error })=>assert.ifError(error));
await new Promise((resolve)=>setTimeout(resolve,250));
const [differentA, differentB] = await Promise.all([post(`different-a:${marker}`), post(`different-b:${marker}`)]);
await economicBarrier;
const requests = [differentA, differentB];
assert.equal(requests.filter((result) => result.status === 202).length, 1, JSON.stringify(requests));
assert.equal(requests.filter((result) => result.status !== 202).length, 1, JSON.stringify(requests));

const jobs = await admin.from("velto_jobs").select("id,status,payload,idempotency_key").eq("user_id", ownerId).eq("job_type", "creator_final_export");
const runs = await admin.from("velto_creator_final_export_runs").select("job_id,generation").eq("owner_user_id", ownerId);
const economics = await admin.from("velto_creator_economic_operations").select("attempt_key,state,credit_reservation_id").eq("user_id", ownerId).eq("operation_type", "creator_export");
const reservations = await admin.from("velto_credit_reservations").select("id,status,reserved_credits,idempotency_key").eq("user_id", ownerId).eq("operation_type", "creator_export");
const admissions = await admin.from("velto_storage_admissions").select("id,consumed_at,consumption_started_at").eq("owner_user_id", ownerId).eq("purpose", "final_movie_export");
const ledger = await admin.from("velto_credit_ledger").select("entry_type,balance_delta,reserved_delta,reservation_id").eq("user_id", ownerId);
const after = await admin.from("velto_credit_accounts").select("balance_credits,reserved_credits").eq("user_id", ownerId).single();
for (const result of [jobs,runs,economics,reservations,admissions,ledger,after]) assert.ifError(result.error);
assert.equal(jobs.data.length, 1);
assert.equal(runs.data.length, 1);
assert.equal(economics.data.length, 1);
assert.equal(admissions.data.length, 1);
assert.equal(reservations.data.filter((item) => item.status === "reserved").length, 1);
assert.equal(reservations.data.filter((item) => item.status === "released").length, 1);
const winningReservation = reservations.data.find((item) => item.status === "reserved");
assert.ok(winningReservation);
assert.equal(after.data.reserved_credits, winningReservation.reserved_credits);
assert.equal(after.data.balance_credits, before.data.balance_credits);
assert.equal(ledger.data.filter((item) => item.entry_type === "reserve").length, 2);
assert.equal(ledger.data.filter((item) => item.entry_type === "release").length, 1);

const acceptedKey = requests.find((result) => result.status === 202).body.job.id;
const [sameA, sameB] = await Promise.all([post(`same:${marker}`), post(`same:${marker}`)]);
assert.ok([sameA,sameB].every((result) => result.status === 202 && result.body.job.id === acceptedKey));
const finalJobs = await admin.from("velto_jobs").select("id", { count: "exact" }).eq("user_id", ownerId).eq("job_type", "creator_final_export");
const finalReservations = await admin.from("velto_credit_reservations").select("id,status").eq("user_id", ownerId).eq("operation_type", "creator_export");
const finalAdmissions = await admin.from("velto_storage_admissions").select("id").eq("owner_user_id", ownerId).eq("purpose", "final_movie_export");
assert.equal(finalJobs.data.length, 1);
assert.equal(finalReservations.data.length, 2);
assert.equal(finalAdmissions.data.length, 1);

const generationZeroJob = jobs.data[0];
const generationZeroRun = (await admin.from("velto_creator_final_export_runs").select("*").eq("job_id",generationZeroJob.id).single()).data;
const generationZeroEconomic = economics.data[0];
await admin.rpc("velto_credit_release", {
  p_user_id: ownerId, p_reservation_id: winningReservation.id,
  p_reason: "isolated_authorized_recovery", p_metadata: { test: "stage2-http" },
});
await admin.from("velto_creator_economic_operations").update({ state: "reconciled", cost_status: "not_billable", reconciled_at: new Date().toISOString() }).eq("attempt_key",generationZeroEconomic.attempt_key);
await admin.from("velto_storage_admissions").delete().eq("id",generationZeroJob.payload.storageAdmissionId);
await admin.from("velto_jobs").update({ status: "failed", lease_owner: null, lease_expires_at: null, completed_at: new Date().toISOString() }).eq("id",generationZeroJob.id);
await admin.from("velto_creator_final_export_runs").update({ state: "failed", render_lease_expires_at: null }).eq("job_id",generationZeroJob.id);
const { error: authorizationError } = await admin.from("velto_creator_final_export_rearm_authorizations").insert({
  predecessor_job_id: generationZeroJob.id, owner_user_id: ownerId, project_id: projectId,
  production_signature_sha256: generationZeroRun.production_signature_sha256, generation: 1,
  evidence_sha256: "a".repeat(64), reason: "isolated_authorized_recovery",
});
assert.ifError(authorizationError);
const generationBefore = {
  finalVideo: (await admin.from("velto_projects").select("exported_movie_url,updated_at").eq("id",projectId).single()).data,
  generationZero: structuredClone(generationZeroRun),
};
const [generationA,generationB] = await Promise.all([post(`generation-a:${marker}`),post(`generation-b:${marker}`)]);
assert.equal([generationA,generationB].filter((result) => result.status === 202).length,1,JSON.stringify([generationA,generationB]));
const generationRuns = await admin.from("velto_creator_final_export_runs").select("job_id,generation,manifest_sha256").eq("owner_user_id",ownerId).eq("project_id",projectId).order("generation");
const generationJobs = await admin.from("velto_jobs").select("id,payload").eq("user_id",ownerId).eq("project_id",projectId);
const generationAdmissions = await admin.from("velto_storage_admissions").select("id").eq("owner_user_id",ownerId).eq("project_reference",projectId);
const generationEconomics = await admin.from("velto_creator_economic_operations").select("attempt_key,state").eq("user_id",ownerId).eq("project_id",projectId);
const generationReservations = await admin.from("velto_credit_reservations").select("id,status").eq("user_id",ownerId).eq("reference_id",projectId);
assert.deepEqual(generationRuns.data.map((run) => run.generation),[0,1]);
assert.equal(generationJobs.data.length,2);
assert.equal(generationAdmissions.data.length,1);
assert.equal(generationEconomics.data.filter((item) => item.state === "reserved").length,1);
assert.equal(generationReservations.data.filter((item) => item.status === "reserved").length,1);
assert.equal(generationReservations.data.filter((item) => item.status === "released").length,3);
const generationAfter = (await admin.from("velto_projects").select("exported_movie_url,updated_at").eq("id",projectId).single()).data;
assert.deepEqual(generationAfter,generationBefore.finalVideo);
const oldRunAfter = (await admin.from("velto_creator_final_export_runs").select("production_signature_sha256,manifest_sha256,render_payload_sha256,generation").eq("job_id",generationZeroJob.id).single()).data;
assert.equal(oldRunAfter.generation,0);
assert.equal(oldRunAfter.manifest_sha256,generationBefore.generationZero.manifest_sha256);

const failureEvidence = {};
for (const boundary of ["credit","economic","admission","enqueue"]) {
  const failureProjectId = crypto.randomUUID();
  await insertProject(failureProjectId,`Stage 2 failure ${boundary}`);
  const beforeFailure = {
    reservationIds: new Set((await admin.from("velto_credit_reservations").select("id").eq("user_id",ownerId)).data.map((item)=>item.id)),
    admissions: (await admin.from("velto_storage_admissions").select("id").eq("owner_user_id",ownerId)).data.length,
    jobs: (await admin.from("velto_jobs").select("id").eq("user_id",ownerId)).data.length,
  };
  assert.ifError((await admin.from("stage2_http_failure_injection").insert({ boundary })).error);
  const failed = await fetch(`${apiBase}/api/creator-final-export-jobs`, {
    method:"POST", headers:{ "content-type":"application/json",authorization:`Bearer ${token}`,"x-creator-cost-guard":"creator-cost-guard-v1","x-idempotency-key":`failure-${boundary}:${marker}` },
    body:JSON.stringify({ projectId:failureProjectId,manualConfirmationGranted:true }),
  }).then(async (response)=>({status:response.status,body:await response.json()}));
  await admin.from("stage2_http_failure_injection").delete().eq("boundary",boundary);
  assert.equal(failed.status,500,`${boundary}: ${JSON.stringify(failed)}`);
  const afterFailure = {
    reservations: (await admin.from("velto_credit_reservations").select("id,status").eq("user_id",ownerId)).data,
    admissions: (await admin.from("velto_storage_admissions").select("id").eq("owner_user_id",ownerId)).data.length,
    jobs: (await admin.from("velto_jobs").select("id").eq("user_id",ownerId)).data.length,
  };
  assert.equal(afterFailure.admissions,beforeFailure.admissions,`${boundary} leaked an admission`);
  assert.equal(afterFailure.jobs,beforeFailure.jobs,`${boundary} leaked a job`);
  const addedReservations = afterFailure.reservations.filter((item)=>!beforeFailure.reservationIds.has(item.id));
  if (boundary === "credit") assert.equal(addedReservations.length,0);
  else assert.ok(addedReservations.every((item)=>item.status === "released"),`${boundary} leaked a reservation`);
  failureEvidence[boundary] = { status:failed.status,addedReservations:addedReservations.length };
}

console.log(JSON.stringify({
  status: "PASS", scenarios: ["different_operation_ids", "same_idempotency_key", "generation_one", "failure_boundaries"],
  outcomes: requests.map(({ status }) => status), jobs: jobs.data.length, runs: runs.data.length,
  economics: economics.data.length, admissions: admissions.data.length,
  reservations: { accepted: 1, released: 1 }, ledger: { reserve: 2, release: 1 }, generationOne:{ jobs:1,admissions:1 },failureEvidence,
}, null, 2));
