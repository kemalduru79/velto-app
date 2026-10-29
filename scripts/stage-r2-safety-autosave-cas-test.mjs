import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { resolveCreatorScriptMutationAuthority } from "../lib/creator/creatorScriptMutationAuthority.ts";
import * as finalExportPersistence from "../lib/creator/creatorFinalExportPersistence.ts";
import { createCreatorFinalExportProjectEnvelope, createCreatorFinalExportRevisionBinding, resolveCreatorFinalExportRevisionAdvance } from "../lib/creator/creatorFinalExportPersistence.ts";
import { CreatorProjectSaveError, readCreatorProjectSaveResponse, creatorProjectSaveFailureDiagnostic, creatorProjectSaveRecoveryMessage } from "../lib/creator/projectSaveErrors.ts";
import { EMPTY_CREATOR_AUDIO_TIMELINE } from "../lib/creator/audioTimeline.ts";
import { extractProjectMediaReferences } from "../lib/persistence/media/projectReferences.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createJiti } from "jiti";
import {
  createCreatorProjectAutosaveTicket,
  shouldDispatchCreatorProjectAutosave,
} from "../lib/creator/projectSaveCoordinator.ts";
import {
  createCreatorAutosaveSemanticKey,
  shouldPersistCreatorAutosaveIntent,
} from "../lib/creator/creatorHydrationPersistence.ts";
import { createCreatorScript } from "../lib/creator/creatorScript.ts";
import { attachCreatorProjectState, buildCreatorProjectState } from "../lib/creator/projectState.ts";

const projectId = "project-ai-growth";
const hydrated = createCreatorAutosaveSemanticKey({ title: "The Double-Edged Sword of Rapid AI Growth", scriptSections: 5, scenes: 36 });
const edited = createCreatorAutosaveSemanticKey({ title: "The Double-Edged Sword of Rapid AI Growth", scriptSections: 5, scenes: 36, localEdit: true });
const ticket = createCreatorProjectAutosaveTicket({ projectId, expectedUpdatedAt: "revision-1", generation: 7, semanticKey: edited });
const active = (overrides = {}) => ({ projectId, expectedUpdatedAt: "revision-1", generation: 7, semanticKey: edited, baselineKey: hydrated, conflictGeneration: null, ...overrides });

assert.equal(shouldPersistCreatorAutosaveIntent({ baselineKey: hydrated, currentKey: hydrated }), false, "hydration-only state never schedules persistence");
assert.equal(shouldDispatchCreatorProjectAutosave(ticket, active()), true, "a current user edit may autosave once");
assert.equal(shouldDispatchCreatorProjectAutosave(ticket, active({ baselineKey: edited })), false, "an already persisted semantic state is not saved again");
assert.equal(shouldDispatchCreatorProjectAutosave(ticket, active({ expectedUpdatedAt: "revision-2" })), false, "a delayed timer cannot dispatch after revision advancement");
assert.equal(shouldDispatchCreatorProjectAutosave(ticket, active({ semanticKey: createCreatorAutosaveSemanticKey({ newerEdit: true }) })), false, "a superseded timer cannot persist an older editor snapshot");
assert.equal(shouldDispatchCreatorProjectAutosave(ticket, active({ projectId: "project-b" })), false, "project switching invalidates the ticket");
assert.equal(shouldDispatchCreatorProjectAutosave(ticket, active({ generation: 8 })), false, "refresh/hydration generation advancement invalidates the ticket");
assert.equal(shouldDispatchCreatorProjectAutosave(ticket, active({ conflictGeneration: 7 })), false, "a CAS conflict fences automatic redispatch for the generation");

// Multiple timers captured against one revision: after the first successful
// save advances CAS authority, every remaining old ticket is stale.
const secondTicket = createCreatorProjectAutosaveTicket({ ...ticket });
assert.equal(shouldDispatchCreatorProjectAutosave(secondTicket, active({ expectedUpdatedAt: "revision-2" })), false);

// An external concurrent update that the client has not observed still reaches
// the server exactly once and is rejected by CAS. The conflict fence then
// prevents queued/timer retries until an explicit reload creates a generation.
let requests = 0;
let conflictGeneration = null;
const dispatchAgainstServer = (serverRevision) => {
  if (!shouldDispatchCreatorProjectAutosave(ticket, active({ conflictGeneration }))) return "suppressed";
  requests += 1;
  if (ticket.expectedUpdatedAt !== serverRevision) {
    conflictGeneration = ticket.generation;
    return "PROJECT_SAVE_CONFLICT";
  }
  return "saved";
};
assert.equal(dispatchAgainstServer("revision-external"), "PROJECT_SAVE_CONFLICT");
assert.equal(dispatchAgainstServer("revision-external"), "suppressed");
assert.equal(requests, 1, "conflicting state is never force-saved or automatically retried");
assert.equal(shouldDispatchCreatorProjectAutosave(ticket, active({ generation: 8, expectedUpdatedAt: "revision-external", conflictGeneration: null })), false, "old editor ticket cannot cross the reload boundary");

// Real asynchronous queue + actual save-project HTTP handler. Autosave A waits
// behind an in-flight operation. While waiting, revision R1 advances to R2 and
// intent advances A -> B. Releasing the queue must not send A or rebase its
// captured snapshot onto R2.
const words = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
const script = createCreatorScript({
  title: "The Double-Edged Sword of Rapid AI Growth",
  sections: [
    { id: "opening", kind: "opening", text: words("opening", 80), claimIds: [], evidenceReviewRequired: false },
    { id: "growth", kind: "body", text: words("growth", 180), claimIds: [], evidenceReviewRequired: false },
    { id: "benefits", kind: "body", text: words("benefits", 180), claimIds: [], evidenceReviewRequired: false },
    { id: "risks", kind: "body", text: words("risks", 180), claimIds: [], evidenceReviewRequired: false },
    { id: "ending", kind: "conclusion", text: words("ending", 80), claimIds: [], evidenceReviewRequired: false },
  ],
  targetDurationSec: 300,
  strategyFingerprint: "autosave-cas-fingerprint",
  grounding: { context: { version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Preserve authority.", readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] }, claims: [], evidence: [], sources: [] } },
  generatedAt: "2026-10-19T00:00:00.000Z",
  updatedAt: "2026-10-19T00:00:00.000Z",
});
const scenes = Array.from({ length: 36 }, (_, index) => ({ id: index + 1, creatorSceneId: `scene-${index + 1}`, narration: `Scene ${index + 1}`, dialogue: "", image: `https://assets.invalid/image-${index}.png`, audioUrl: `https://assets.invalid/audio-${index}.mp3`, assetHistory: [{id:`previous-${index}`,url:`https://assets.invalid/previous-${index}.png`}] }));
const makeSnapshot = (topic) => buildCreatorProjectState({
  brief: { topic, language: "en", country: "global", ageGroup: "professional_18", contentType: "educational_explainer", format: "youtube_video", durationPreset: "custom", durationSec: 300, customDurationSec: 300, qualityMode: "premium", targetPlatforms: ["youtube"] },
  strategy: { mentorResult: null, selectedDirectionId: "recommended", selectedHook: "", strategyFingerprint: script.strategyFingerprint, profileSnapshot: null, script },
  production: { package: null, refinedScenes: [], backgroundMusic: null, audioTimeline: structuredClone(EMPTY_CREATOR_AUDIO_TIMELINE), projectContinuityMode: "continuous", sceneContinuityModes: {}, voicePreferences: null },
  createReview: { scenes },
  publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" },
});
const stateA = makeSnapshot("Intent A");
const stateB = makeSnapshot("Intent B");
const jiti = createJiti(import.meta.url, { interopDefault: true, alias: { "@": new URL("..", import.meta.url).pathname.replace(/\/$/, ""), "server-only": new URL("../lib/creator/projectState.ts", import.meta.url).pathname } });
const { POST } = await jiti.import("../app/api/save-project/route.ts");
const routeHandler = POST.handleForTest;
let stored = { id: projectId, flow_type: "creator_lab", title: script.title, updated_at: "R1", scenes, exported_movie_result: attachCreatorProjectState({ preserved: true }, stateA), exported_movie_url: null, export_signature: null };
const httpBodies = [];
const services = {
  projectRepository: {
    getForOwner: async () => structuredClone(stored),
    saveForOwner: async (patch) => {
      if (patch.expectedUpdatedAt !== stored.updated_at) throw new Error("PROJECT_SAVE_CONFLICT");
      stored = { ...stored, updated_at: stored.updated_at === "R1" ? "R2" : "R3", exported_movie_result: patch.exportedMovieResult, scenes: patch.scenes ?? stored.scenes };
      return { project: structuredClone(stored), created: false };
    },
  },
  mediaAssetRepository: { findByPublicUrl: async () => null, replaceProjectReferences: async () => undefined, listFinalVideosForProject: async () => [] },
};
const sendHttp = async (snapshot, expectedUpdatedAt) => {
  const body = { projectId, flowType: "creator_lab", title: script.title, expectedUpdatedAt, creatorProjectState: snapshot, exportedMovieResult: { preserved: true } };
  httpBodies.push(body);
  const response = await routeHandler(new Request("http://localhost/api/save-project", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { authenticate: async () => ({ id: "owner-1", email: "owner@test.invalid", providerUser: { id: "owner-1" } }), persistence: () => services });
  return { status: response.status, body: await response.json() };
};
let releaseQueue;
const blocker = new Promise((resolve) => { releaseQueue = resolve; });
let live = { projectId, expectedUpdatedAt: "R1", generation: 10, semanticKey: "A", baselineKey: "hydrated", conflictGeneration: null };
const queuedTicketA = createCreatorProjectAutosaveTicket({ projectId, expectedUpdatedAt: "R1", generation: 10, semanticKey: "A" });
const queuedA = blocker.then(async () => shouldDispatchCreatorProjectAutosave(queuedTicketA, live) ? sendHttp(stateA, queuedTicketA.expectedUpdatedAt) : { status: "suppressed" });
live = { ...live, expectedUpdatedAt: "R2", semanticKey: "B" };
stored.updated_at = "R2";
releaseQueue();
assert.deepEqual(await queuedA, { status: "suppressed" });
assert.equal(httpBodies.length, 0, "deferred stale autosave never reaches HTTP");
assert.equal(stored.exported_movie_result.creatorProjectState.brief.topic, "Intent A", "suppression does not mutate persistence");

const queuedTicketB = createCreatorProjectAutosaveTicket({ projectId, expectedUpdatedAt: "R2", generation: 10, semanticKey: "B" });
const savedB = shouldDispatchCreatorProjectAutosave(queuedTicketB, live) ? await sendHttp(stateB, "R2") : { status: "suppressed" };
assert.equal(savedB.status, 200, "current legitimate edit persists through real HTTP handler");
assert.equal(httpBodies.length, 1);
assert.equal(stored.exported_movie_result.creatorProjectState.brief.topic, "Intent B");
assert.equal(stored.exported_movie_result.creatorProjectState.strategy.script.sections.length, 5);
assert.equal(stored.scenes.length, 36);

// External R4 is invisible to an R3 editor: one HTTP CAS conflict is allowed,
// then its generation fence suppresses every already-queued autosave.
live = { ...live, expectedUpdatedAt: "R3", semanticKey: "C" };
stored.updated_at = "R4";
const ticketC = createCreatorProjectAutosaveTicket({ projectId, expectedUpdatedAt: "R3", generation: 10, semanticKey: "C" });
const conflict = await sendHttp(makeSnapshot("Intent C"), "R3");
assert.equal(conflict.status, 409);
live = { ...live, conflictGeneration: 10 };
assert.equal(shouldDispatchCreatorProjectAutosave(ticketC, live), false);
assert.equal(stored.exported_movie_result.creatorProjectState.brief.topic, "Intent B");
assert.equal(stored.exported_movie_result.creatorProjectState.strategy.script.sections.length, 5);
assert.equal(stored.scenes.length, 36);

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(page, /const autosaveTicket = createCreatorProjectAutosaveTicket\(\{/);
assert.match(page, /shouldDispatchCreatorProjectAutosave\(autosaveTicket/);
assert.match(page, /executePersistProject\(showManualMessage, lifecycleOverrides, binding, autosaveTicket\)/);
assert.match(page, /const requestBinding = autosaveTicket[\s\S]*\? binding[\s\S]*: advanceCreatorProjectSaveBinding/);
assert.match(page, /if \(autosaveTicket && !shouldDispatchCreatorProjectAutosave\(autosaveTicket[\s\S]*const res = await fetch\("\/api\/save-project"/);
assert.match(page, /if \(result && saveAttempt === projectSaveAttemptRef\.current/, "a suppressed queue result cannot advance the semantic baseline");
assert.match(page, /projectSaveConflictGenerationRef\.current = binding\.generation/);
assert.match(page, /projectSaveConflictGenerationRef\.current = null/);
assert.doesNotMatch(page, /PROJECT_SAVE_CONFLICT[\s\S]{0,200}(retry|forceNewProject)/i);

console.log("STAGE_R2_SAFETY_AUTOSAVE_CAS=PASS");


// Reproduce the incident: the old installer drops the canonical envelope.
const beforeFinal = { ...structuredClone(stored), updated_at: "2026-10-29T20:36:56.445812+00:00" };
const movie = { movieUrl: "https://assets.invalid/final.mp4", downloadUrl: "https://assets.invalid/final.mp4", finalExportJobId: "job-final", productionSignature: "final-signature" };
stored = { ...beforeFinal, exported_movie_result: movie, exported_movie_url: movie.movieUrl, updated_at: "2026-10-29T20:43:36.412234+00:00" };
const brokenSnapshot = structuredClone(stored);
assert.throws(()=>resolveCreatorScriptMutationAuthority({persistedScript:null,candidateScript:stateB.strategy.script,commandValue:undefined}),/CREATOR_SCRIPT_MUTATION_AUTHORITY_REQUIRED/,
  "the pre-fix save handler rejects the open editor script after envelope loss before reaching CAS");
const rejectedAfterOldInstall = await sendHttp(stateB, beforeFinal.updated_at);
assert.equal(rejectedAfterOldInstall.status,409);
assert.equal(rejectedAfterOldInstall.body.code,"CREATOR_PROJECT_STATE_REPAIR_REQUIRED");
assert.deepEqual(stored,brokenSnapshot,"repair detection cannot write or recreate a missing snapshot");
assert.throws(()=>createCreatorFinalExportProjectEnvelope(stored,movie),/REPAIR_REQUIRED/);

// The fixed installer retains every nested production field and media reference.
const sourceBeforeInstall = JSON.stringify(beforeFinal);
const fixedEnvelope = createCreatorFinalExportProjectEnvelope(beforeFinal,movie);
const originalState = beforeFinal.exported_movie_result.creatorProjectState;
const finalState = fixedEnvelope.creatorProjectState;
assert.deepEqual(finalState.strategy, originalState.strategy);
assert.deepEqual(finalState.production, originalState.production);
assert.deepEqual(finalState.createReview, originalState.createReview);
assert.deepEqual(finalState.brief, originalState.brief);
assert.deepEqual(finalState.navigation, originalState.navigation);
assert.deepEqual(finalState.publish,{...originalState.publish,finalVideoUrl:movie.movieUrl,finalVideoSignature:movie.productionSignature});
assert.equal(fixedEnvelope.preserved,true,"unrelated envelope metadata survives installation");
assert.equal(JSON.stringify(beforeFinal),sourceBeforeInstall,"source is unchanged");
stored = {...beforeFinal,exported_movie_result:fixedEnvelope,exported_movie_url:movie.movieUrl,export_signature:movie.productionSignature,updated_at:"2026-10-29T20:43:36.412234+00:00"};
const mediaBefore = extractProjectMediaReferences(beforeFinal);
const mediaAfter = extractProjectMediaReferences(stored);
for (const reference of mediaBefore) assert.ok(mediaAfter.some(candidate=>JSON.stringify(candidate)===JSON.stringify(reference)));
assert.equal(mediaAfter.filter(r=>r.referenceType === "scene_image").length,36);
assert.equal(mediaAfter.filter(r=>r.referenceType === "narration_audio").length,36);
assert.equal(mediaAfter.filter(r=>r.referenceType === "asset_history").length,36);
assert.equal(mediaAfter.filter(r=>r.referenceType === "final_video").length,1);

const binding = createCreatorFinalExportRevisionBinding({projectId,jobId:"job-final",previousProjectUpdatedAt:beforeFinal.updated_at,project:stored,exportedMovieResult:fixedEnvelope});
assert.equal(binding.projectUpdatedAt,stored.updated_at,"actual stored trigger timestamp is authoritative, not the RPC's later clock timestamp");
const origin = {projectId,generation:10};
const current = {projectId,generation:10,expectedUpdatedAt:beforeFinal.updated_at};
const resolve = (overrides={})=>resolveCreatorFinalExportRevisionAdvance({binding,jobId:"job-final",origin,active:current,...overrides});
assert.equal(resolve(),stored.updated_at);
assert.equal(resolve({active:{...current,expectedUpdatedAt:stored.updated_at}}),stored.updated_at,"duplicate terminal notification is idempotent");
assert.equal(resolve({active:{...current,expectedUpdatedAt:"2026-10-29T20:44:00Z"}}),null,"older result cannot rebase a newer save");
assert.equal(resolve({active:{...current,generation:11}}),null);
assert.equal(resolve({active:{...current,projectId:"other-project"}}),null);
assert.equal(resolve({jobId:"other-job"}),null);
assert.equal(resolve({binding:null}),null);
assert.equal(createCreatorFinalExportRevisionBinding({projectId,jobId:"job-final",previousProjectUpdatedAt:beforeFinal.updated_at,project:{...stored,exported_movie_result:{...fixedEnvelope,unrelatedSave:true}},exportedMovieResult:fixedEnvelope}),null,"a newer canonical write cannot issue a handoff for an older envelope");

services.mediaAssetRepository.findByPublicUrl = async()=>({mediaKind:"final_video",lifecycleState:"active",metadata:{projectId}});
const afterFinalSave = await sendHttp(finalState,binding.projectUpdatedAt);
assert.equal(afterFinalSave.status,200,"normal autosave after fixed final installation succeeds");
assert.deepEqual(stored.scenes,scenes);
assert.deepEqual(stored.exported_movie_result.creatorProjectState.strategy,originalState.strategy);
assert.deepEqual(stored.exported_movie_result.creatorProjectState.production,originalState.production);
const consecutive = await sendHttp(stored.exported_movie_result.creatorProjectState,stored.updated_at);
assert.equal(consecutive.status,200,"consecutive autosaves use the returned CAS revision");

for (const [status,code,category] of [
  [401,undefined,"authentication"],[403,undefined,"authentication"],[404,undefined,"project_identity"],
  [413,undefined,"payload_size"],[500,undefined,"server"],[503,undefined,"server"],
  [409,"PROJECT_SAVE_CONFLICT","cas_conflict"],[409,"CREATOR_PROJECT_STATE_REPAIR_REQUIRED","repair_required"],
  [400,"CREATOR_PROJECT_STATE_INVALID","validation"],
]) {
  const response = new Response(JSON.stringify({code,error:"secret=do-not-log https://private.invalid?token=signed"}),{status});
  await assert.rejects(readCreatorProjectSaveResponse(response),error=>{
    const diagnostic=creatorProjectSaveFailureDiagnostic(error);
    assert.equal(diagnostic.status,status);assert.equal(diagnostic.category,category);
    assert.doesNotMatch(JSON.stringify(diagnostic),/secret|private|signed|token/);
    return true;
  });
}
for (const error of [new TypeError("Failed to fetch https://private.invalid?token=secret"), new Error("Geçersiz oturum."), new Error("secret"), {code:"secret"}])
  assert.doesNotMatch(JSON.stringify(creatorProjectSaveFailureDiagnostic(error)),/secret|private|token/);
assert.equal(creatorProjectSaveFailureDiagnostic(new TypeError("Failed to fetch")).category,"network");
await assert.rejects(readCreatorProjectSaveResponse(new Response("<html>secret</html>",{status:502})),e=>e.code === "PROJECT_SAVE_RESPONSE_INVALID" && e.status === 502);
await assert.rejects(readCreatorProjectSaveResponse(new Response(JSON.stringify({project:{}}),{status:200})),e=>e.code === "PROJECT_SAVE_RESPONSE_INVALID");
assert.equal(creatorProjectSaveFailureDiagnostic(new CreatorProjectSaveError({code:"secret",status:500})).code,"PROJECT_SAVE_FAILED");
assert.match(creatorProjectSaveRecoveryMessage(new CreatorProjectSaveError({code:"CREATOR_PROJECT_STATE_REPAIR_REQUIRED",status:409}),"en"),/Keep this tab open/);
assert.match(creatorProjectSaveRecoveryMessage(new CreatorProjectSaveError({code:"CREATOR_PROJECT_STATE_REPAIR_REQUIRED",status:409}),"tr"),/sekmeyi açık tut/);
console.log("CREATOR_FINAL_EXPORT_AUTOSAVE_INTEGRITY=PASS");


// Run the actual uploaded-output worker handler with an in-memory atomic installer.
// No fetch, render, provider call or live database write is available to this VM.
const workerSource=fs.readFileSync("app/api/internal/jobs/[jobId]/creator-final-export/route.ts","utf8");
const nativeRequire=createRequire(import.meta.url);
let workerProject=structuredClone(beforeFinal);
const provenance="a".repeat(64);
const workerJob={id:"job-final",jobType:"creator_final_export",userId:"owner-1",projectId,
  payload:{storageAdmissionId:"synthetic-admission",renderPayloadSha256:provenance,
    renderPayload:{scenes,finalProductionManifestSha256:provenance,finalProductionSignatureSha256:provenance}}};
const uploadedRun={state:"uploaded",project_updated_at:beforeFinal.updated_at,production_signature:"final-signature",
  production_signature_sha256:provenance,manifest_sha256:provenance,render_payload_sha256:provenance,output:movie};
let atomicInstalls=0;
const fakeClient={from:()=>({select:()=>({eq:()=>({single:async()=>({data:uploadedRun,error:null})})})}),rpc:async(name,args)=>{
  assert.equal(name,"velto_install_creator_final_export");atomicInstalls++;
  assert.equal(args.p_job_id,workerJob.id);
  assert.deepEqual(args.p_exported_movie_result.creatorProjectState.strategy,beforeFinal.exported_movie_result.creatorProjectState.strategy);
  assert.equal(args.p_references.filter(r=>r.reference_type === "scene_image").length,36);
  assert.equal(args.p_references.filter(r=>r.reference_type === "narration_audio").length,36);
  workerProject={...workerProject,exported_movie_result:structuredClone(args.p_exported_movie_result),
    updated_at:"2026-10-29T20:43:36.412234+00:00",exported_movie_url:movie.movieUrl,export_signature:movie.productionSignature};
  return {data:{status:"installed",projectUpdatedAt:"2026-10-29T20:43:36.445134+00:00"},error:null};
}};
const workerExports={};
vm.runInNewContext(ts.transpileModule(workerSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:workerExports,process:{env:{VELTO_INTERNAL_WORKER_TOKEN:"synthetic-test-token"}},
  fetch:()=>{throw new Error("No rendering/network allowed in regression");},
  require:name=>{
    if(name === "node:crypto")return nativeRequire(name);
    if(name === "next/server")return {NextResponse:{json:(body,init)=>Response.json(body,init)}};
    if(name === "@/lib/persistence")return {getPersistenceServices:()=>({jobQueue:{getInternal:async()=>workerJob},projectRepository:{getForOwner:async()=>structuredClone(workerProject)}})};
    if(name === "@/lib/supabase/server")return {createServerSupabaseClient:()=>fakeClient};
    if(name === "@/lib/creator/creatorFinalExportPersistence")return finalExportPersistence;
    if(name === "@/lib/persistence/media/projectReferences")return {extractProjectMediaReferences};
    if(name === "@/lib/creator/mediaFingerprint.server")return {validateCreatorRenderSceneMediaIdentities:()=>true};
    return {};
  },
});
const workerResponse=await workerExports.POST(new Request("http://local.invalid/internal",{method:"POST",headers:{authorization:"Bearer synthetic-test-token","x-velto-worker-id":"synthetic-worker"}}),{params:Promise.resolve({jobId:workerJob.id})});
assert.equal(workerResponse.status,200);
const workerBody=await workerResponse.json();
assert.equal(atomicInstalls,1);
assert.equal(workerBody.installation.revisionBinding.projectUpdatedAt,workerProject.updated_at);
assert.equal(workerBody.installation.revisionBinding.previousProjectUpdatedAt,beforeFinal.updated_at);
assert.equal(workerBody.movie.creatorProjectState,undefined,"public movie response does not expose or duplicate project payload");
assert.deepEqual(workerProject.exported_movie_result.creatorProjectState.production,originalState.production);
console.log("CREATOR_FINAL_EXPORT_WORKER_ENVELOPE=PASS");
