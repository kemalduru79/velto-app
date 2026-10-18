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
const scenes = Array.from({ length: 36 }, (_, index) => ({ id: index + 1, creatorSceneId: `scene-${index + 1}`, narration: `Scene ${index + 1}`, dialogue: "" }));
const makeSnapshot = (topic) => buildCreatorProjectState({
  brief: { topic, language: "en", country: "global", ageGroup: "professional_18", contentType: "educational_explainer", format: "youtube_video", durationPreset: "custom", durationSec: 300, customDurationSec: 300, qualityMode: "premium", targetPlatforms: ["youtube"] },
  strategy: { mentorResult: null, selectedDirectionId: "recommended", selectedHook: "", strategyFingerprint: script.strategyFingerprint, profileSnapshot: null, script },
  production: { package: null, refinedScenes: [], backgroundMusic: null, projectContinuityMode: "continuous", sceneContinuityModes: {}, voicePreferences: null },
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
