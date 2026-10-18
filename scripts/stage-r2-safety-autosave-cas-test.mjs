import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createCreatorProjectAutosaveTicket,
  shouldDispatchCreatorProjectAutosave,
} from "../lib/creator/projectSaveCoordinator.ts";
import {
  createCreatorAutosaveSemanticKey,
  shouldPersistCreatorAutosaveIntent,
} from "../lib/creator/creatorHydrationPersistence.ts";

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

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(page, /const autosaveTicket = createCreatorProjectAutosaveTicket\(\{/);
assert.match(page, /shouldDispatchCreatorProjectAutosave\(autosaveTicket/);
assert.match(page, /projectSaveConflictGenerationRef\.current = binding\.generation/);
assert.match(page, /projectSaveConflictGenerationRef\.current === binding\.generation/);
assert.match(page, /projectSaveConflictGenerationRef\.current = null/);
assert.doesNotMatch(page, /PROJECT_SAVE_CONFLICT[\s\S]{0,200}(retry|forceNewProject)/i);

console.log("STAGE_R2_SAFETY_AUTOSAVE_CAS=PASS");
