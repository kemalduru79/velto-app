import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  runCreatorScriptBuildScriptRepairCoordinator as runRepair,
  createCreatorScriptBuildReplacementCandidateInput,
  createCreatorScriptBuildScriptRepairOperationId,
  createCreatorScriptBuildScriptRepairSemanticFingerprint,
  replayCreatorScriptBuildCompletedRepair,
} from "../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts";
import { runCreatorScriptBuildAcceptanceCoordinator } from "../lib/creator/creatorScriptBuildAcceptanceCoordinator.ts";
import { CreatorScriptBuildCoordinatorBlockedError, CreatorScriptBuildStageExecutionError } from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import { CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO, getCreatorScriptRepairReplacementDiagnostics } from "../lib/creator/creatorScript.ts";
import {
  ownerId, buildId, revision, clone, loadSetup, prepare, dependencies,
  repairProposal, textWithWords, expectBlocked,
} from "./test-support/creator-script-repair-replay.mjs";
import { historical, prepareHistorical, reloadRepository, repairOperations } from "./test-support/creator-script-repair-historical.mjs";

const run = (repository, options = {}) => {
  const harness = dependencies(repository, options);
  return { ...harness, result: runRepair({ ownerId, buildId, dependencies: harness.deps }) };
};
const interruption = () => new CreatorScriptBuildCoordinatorBlockedError({ code: "REPLAY_CRASH", buildId });
function noProjectWrite(repository) {
  assert.equal(repository.build.resultAuthority, null);
  assert.equal(repository.build.checkpoints.persistence, undefined);
  assert.ok(!repository.transitions.some((transition) => /ACCEPTED|PERSISTED/.test(transition)));
}
function crashAfterCandidate(repository, accepted) {
  const transition = repository.transitionOperation.bind(repository);
  let crashed = false;
  repository.transitionOperation = async (input) => {
    const result = await transition(input);
    if (!crashed && input.nextState === "COMPLETED" && input.resultReference.outcome?.replacement?.validation.accepted === accepted) {
      crashed = true;
      throw interruption();
    }
    return result;
  };
}
const rejectFirst = (sectionId) => ({ replacementWords: (target, input) =>
  target.sectionId === sectionId && input.candidate.ordinal === 1
    ? target.beforeWords : target.requiredFinalTargetWords });

// Frozen historical geometry is replayed through actual generation, acceptance and repair coordinators.
test("S1/S6: frozen E6N geometry derives exactly three expansions and one compression", async () => {
  const { repository } = await prepareHistorical();
  const { generation, repairInput } = loadSetup(repository);
  assert.equal(historical.historicalBuildId, "e270980e-8f85-4ab2-89c2-639c457037db");
  assert.notEqual(repository.build.buildId, historical.historicalBuildId);
  assert.deepEqual(repairInput.replacementTargets.map((t) => [t.sectionId, t.direction, t.minimumRequiredGain, t.minimumRequiredReduction]), [
    ["section-1", "expand", 72, 0], ["section-2", "expand", 48, 0],
    ["section-3", "expand", 86, 0], ["conclusion", "compress", 0, 29],
  ]);
  const harness = run(repository);
  const result = await harness.result;
  assert.equal(result.observedReport.accepted, true);
  assert.equal(harness.counts().providerCalls, 4);
  assert.equal(result.repair.candidateCallLimit, 8);
  assert.equal(result.repair.candidateAttemptCount, 4);
  assert.equal(result.repair.appliedRevisionCount, 1);
  assert.equal(result.repair.script.revision, generation.script.revision + 1);
  for (const id of ["opening", "section-4"]) assert.deepEqual(
    result.repair.script.sections.find((s) => s.id === id), generation.script.sections.find((s) => s.id === id));
  assert.deepEqual(result.repair.script.grounding.context, generation.script.grounding.context);
  assert.equal(result.repair.script.approval, null);
  noProjectWrite(repository);
});

for (const sectionId of ["section-1", "conclusion"]) {
  test(`S2/S3: ${sectionId} rejection retries only that target without revision or persistence`, async () => {
    const { repository } = await prepareHistorical();
    const original = clone(loadSetup(repository).generation.script);
    const calls = [];
    const harness = run(repository, { executeScriptRepair: async (input) => {
      assert.equal(input.replacementTargets.length, 1);
      assert.equal(input.candidate.buildId, buildId);
      assert.ok(Object.isFrozen(input));
      assert.deepEqual(input.currentScriptAuthority.sections.map((s) => s.text), original.sections.map((s) => s.text));
      assert.equal(input.currentScriptAuthority.revision, original.revision);
      assert.equal(repository.build.state, "REPAIRING");
      noProjectWrite(repository);
      calls.push([input.candidate.sectionId, input.candidate.ordinal]);
      return repairProposal(input, rejectFirst(sectionId));
    } });
    const result = await harness.result;
    assert.equal(result.observedReport.accepted, true);
    assert.equal(result.repair.script.revision, original.revision + 1);
    assert.equal(result.repair.candidateAttemptCount, 5);
    assert.equal(calls.filter(([id]) => id === sectionId).length, 2);
    for (const id of ["section-1", "section-2", "section-3", "conclusion"].filter((id) => id !== sectionId)) {
      assert.equal(calls.filter(([calledId]) => calledId === id).length, 1);
    }
    const rejected = repairOperations(repository).find((o) => !o.resultReference.outcome.replacement.validation.accepted);
    assert.equal(rejected.state, "COMPLETED");
    assert.equal(rejected.resultReference.outcome.replacement.section, null);
    assert.equal(rejected.resultReference.outcome.script, null);
    assert.equal(rejected.resultReference.outcome.replacement.validation.reason,
      sectionId === "conclusion" ? "wrong_direction_compress" : "wrong_direction_expand");
    const restored = reloadRepository(repository);
    assert.deepEqual(repairOperations(restored), repairOperations(repository));
    const resume = run(restored);
    assert.deepEqual((await resume.result).repair, result.repair);
    assert.equal(resume.counts().providerCalls, 0);
    noProjectWrite(restored);
  });
}

test("S3: rejection exhaustion is precise and bounded, without installing partial repair", async () => {
  const { repository } = await prepareHistorical();
  const original = clone(repository.build.checkpoints.script_generation);
  const harness = run(repository, { proposalOptions: { replacementWords: (target) => target.beforeWords } });
  await expectBlocked(harness.result, "CREATOR_SCRIPT_BUILD_REPAIR_BUDGET_EXHAUSTED");
  assert.equal(harness.counts().providerCalls, 2);
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.failure.diagnostics.lastRejectionReason, "wrong_direction_expand");
  assert.equal(repository.build.failure.diagnostics.candidateCallLimit, 8);
  assert.equal(repository.build.failure.diagnostics.candidateAttemptCount, 2);
  assert.deepEqual(repository.build.checkpoints.script_generation, original);
  assert.ok(repairOperations(repository).every((o) => o.state === "COMPLETED"));
  noProjectWrite(repository);
  const frozen = JSON.stringify(repository.build);
  const resume = run(repository);
  await expectBlocked(resume.result, "CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_STATE_INVALID");
  assert.equal(JSON.stringify(repository.build), frozen);
  assert.equal(resume.counts().providerCalls, 0);
});

for (const [reason, change] of [
  ["empty", (p) => { p.section.text = ""; }],
  ["wrong_section_identity", (p) => { p.section.sectionId = "conclusion"; }],
  ["wrong_direction_expand", (p, t) => { p.section.text = textWithWords("shrinking", t.beforeWords - 1); }],
  ["above_maximum", (p, t) => { p.section.text = textWithWords("overshoot", t.requiredFinalMaxWords + 1); }],
  ["insufficient_minimum_gain", (p, t) => { p.section.text = textWithWords("shortgain", t.beforeWords + 1); }],
  ["distinctiveness_rejection", (p) => { p.section.heading = "Interpretive Boundaries"; }],
]) {
  test(`S3/S6: durable ${reason} diagnostics survive reload and replay`, async () => {
    const { repository } = await prepareHistorical();
    crashAfterCandidate(repository, false);
    const execute = async (input) => {
      const proposal = repairProposal(input);
      if (input.candidate.sectionId === "section-1" && input.candidate.ordinal === 1) change(proposal, input.replacementTargets[0]);
      return proposal;
    };
    const first = run(repository, { executeScriptRepair: execute });
    await expectBlocked(first.result, "REPLAY_CRASH");
    const artifact = repairOperations(repository)[0];
    assert.equal(artifact.resultReference.outcome.replacement.validation.reason, reason);
    const restored = reloadRepository(repository);
    const resumed = run(restored, { executeScriptRepair: execute });
    assert.equal((await resumed.result).observedReport.accepted, true);
    assert.equal(first.counts().providerCalls + resumed.counts().providerCalls, 5);
    assert.deepEqual(repairOperations(restored)[0], artifact);
    const second = repairOperations(restored)[1];
    assert.notEqual(second.operationId, artifact.operationId);
    assert.equal(second.resultReference.request.candidate.ordinal, 2);
    assert.equal(second.resultReference.request.candidate.rejectionFeedback.reason, reason);
    noProjectWrite(restored);
  });
}

test("S3: insufficient compression and overcompression have exact diagnostics", async () => {
  const { repository } = await prepareHistorical();
  const { generation, repairInput } = loadSetup(repository);
  const target = repairInput.replacementTargets.find((t) => t.sectionId === "conclusion");
  for (const [words, reason] of [[203, "insufficient_minimum_reduction"], [204, "wrong_direction_compress"], [142, "below_minimum"]]) {
    const [diagnostic] = getCreatorScriptRepairReplacementDiagnostics({ script: generation.script,
      plan: [...generation.sectionPlan], targets: [target], replacements: [{ id: target.sectionId, text: textWithWords("compression", words) }] });
    assert.equal(diagnostic.accepted, false);
    assert.equal(diagnostic.reason, reason);
  }
});

test("S3: malformed proposal remains a classified durable contract failure", async () => {
  const { repository } = await prepareHistorical();
  const harness = run(repository, { executeScriptRepair: async () => ({ version: "bad" }) });
  await expectBlocked(harness.result, "CREATOR_SCRIPT_BUILD_REPAIR_PROPOSAL_INVALID");
  assert.equal(harness.counts().providerCalls, 1);
  const operation = repairOperations(repository)[0];
  assert.equal(operation.state, "FAILED");
  assert.equal(operation.failure.category, "MODEL_CONTRACT");
  assert.equal(operation.failure.diagnostics.rejectionReason, "malformed_proposal");
  assert.deepEqual(operation.resultReference.proposal, { version: "bad" });
  noProjectWrite(repository);
});

test("S5: accepted candidate crash resumes without recalling its provider", async () => {
  const { repository } = await prepareHistorical();
  crashAfterCandidate(repository, true);
  const first = run(repository);
  await expectBlocked(first.result, "REPLAY_CRASH");
  const artifact = repairOperations(repository)[0];
  assert.equal(artifact.resultReference.outcome.replacement.validation.accepted, true);
  assert.equal(artifact.resultReference.outcome.script, null);
  const restored = reloadRepository(repository);
  const resumed = run(restored);
  assert.equal((await resumed.result).observedReport.accepted, true);
  assert.equal(first.counts().providerCalls + resumed.counts().providerCalls, 4);
  assert.deepEqual(repairOperations(restored)[0], artifact);
});

for (const settledCheckpoint of [false, true]) {
  test(`S4/S5: crash after round assembly (${settledCheckpoint ? "after" : "before"} checkpoint write) replays without paid calls`, async () => {
    const { repository } = await prepareHistorical();
    const save = repository.saveCheckpoint.bind(repository);
    repository.saveCheckpoint = async (input) => {
      if (input.checkpoint.stage === "repair" && input.checkpoint.status === "COMPLETED") {
        if (settledCheckpoint) await save(input);
        throw interruption();
      }
      return save(input);
    };
    const first = run(repository);
    await expectBlocked(first.result, "REPLAY_CRASH");
    assert.equal(first.counts().providerCalls, 4);
    const resumed = run(reloadRepository(repository));
    const result = await resumed.result;
    assert.equal(result.repair.appliedRevisionCount, 1);
    assert.equal(result.repair.script.revision, 2);
    assert.equal(resumed.counts().providerCalls, 0);
  });
}

for (const retryability of ["UNKNOWN_OUTCOME", "NON_RETRYABLE", "RETRYABLE"]) {
  test(`S5: provider ${retryability} is distinct from candidate rejection`, async () => {
    const { repository } = await prepareHistorical();
    const harness = run(repository, { executeScriptRepair: async () => { throw new CreatorScriptBuildStageExecutionError({
      category: "PROVIDER", code: "FROZEN_PROVIDER_FAILURE", retryability,
    }); } });
    await expectBlocked(harness.result, retryability === "UNKNOWN_OUTCOME" ? "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED" : "FROZEN_PROVIDER_FAILURE");
    const operation = repairOperations(repository)[0];
    assert.equal(operation.state, retryability === "UNKNOWN_OUTCOME" ? "OUTCOME_UNCERTAIN" : "FAILED");
    assert.equal(harness.counts().providerCalls, 1);
    if (retryability === "UNKNOWN_OUTCOME") {
      const resumed = run(reloadRepository(repository));
      await expectBlocked(resumed.result, "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED");
      assert.equal(resumed.counts().providerCalls, 0);
    } else assert.equal(repository.build.failure.retryability, retryability);
    noProjectWrite(repository);
  });
}

test("S5: concurrent advances cannot dispatch the same pending candidate twice", async () => {
  const { repository } = await prepareHistorical();
  repository.build.state = "REPAIRING";
  let signalStarted;
  const started = new Promise((resolve) => { signalStarted = resolve; });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const first = run(repository, { executeScriptRepair: async (input, call) => {
    if (call === 1) { signalStarted(); await gate; }
    return repairProposal(input);
  } });
  await started;
  const second = run(repository);
  await expectBlocked(second.result, "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED");
  assert.equal(second.counts().providerCalls, 0);
  release();
  assert.equal((await first.result).observedReport.accepted, true);
  assert.equal(first.counts().providerCalls, 4);
});

for (const staleAt of [1, 3, 4, 10, 11]) {
  test(`S5: stale check ${staleAt} prevents further candidate/assembly installation`, async () => {
    const { repository } = await prepareHistorical();
    const original = clone(repository.build.checkpoints.script_generation);
    const harness = run(repository, { currentRevision: (call) => call < staleAt ? revision : "2026-10-04T00:00:00.000Z" });
    await expectBlocked(harness.result, "CREATOR_SCRIPT_BUILD_PROJECT_STALE");
    assert.equal(repository.build.state, "STALE");
    if (staleAt <= 3) assert.equal(harness.counts().providerCalls, 0);
    if (staleAt === 4) assert.equal(harness.counts().providerCalls, 1);
    assert.notEqual(repository.build.checkpoints.repair?.status, "COMPLETED");
    assert.deepEqual(repository.build.checkpoints.script_generation, original);
    noProjectWrite(repository);
  });
}

for (const [name, mutate] of [
  ["sectionId", (r) => { r.proposal.section.sectionId = "conclusion"; }],
  ["direction", (r) => { r.request.replacementTargets[0].direction = "compress"; }],
  ["candidate ordinal", (r) => { r.request.candidate.ordinal = 2; }],
  ["result", (r) => { r.outcome.replacement.section.text = "tampered"; }],
  ["fingerprint", (r) => { r.semanticFingerprint = "tampered"; }],
]) {
  test(`S5: settled ${name} tampering fails before provider recall`, async () => {
    const { repository } = await prepareHistorical();
    crashAfterCandidate(repository, true);
    const first = run(repository);
    await expectBlocked(first.result, "REPLAY_CRASH");
    const restored = reloadRepository(repository);
    const [operation] = repairOperations(restored);
    mutate(restored.operations.get(operation.operationId).resultReference);
    const resumed = run(restored);
    await expectBlocked(resumed.result, "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_RESULT_INVALID");
    assert.equal(resumed.counts().providerCalls, 0);
    noProjectWrite(restored);
  });
}

test("S5: operation metadata identity is verified before paid dispatch", async () => {
  const { repository } = await prepareHistorical();
  const request = repository.requestOperation.bind(repository);
  repository.requestOperation = async (input) => {
    const result = await request(input);
    result.operation.semanticFingerprint = "tampered";
    return result;
  };
  const harness = run(repository);
  await expectBlocked(harness.result, "CREATOR_SCRIPT_BUILD_REPAIR_OPERATION_IDENTITY_INVALID");
  assert.equal(harness.counts().providerCalls, 0);
});

for (const field of ["candidateAttemptCount", "appliedRevisionCount", "attemptCount", "candidateCallLimit", "operationIds"]) {
  test(`S4/S5: completed checkpoint ${field} tampering is rejected by acceptance`, async () => {
    const { repository } = await prepareHistorical();
    await run(repository).result;
    const result = repository.build.checkpoints.repair.outputReference.result;
    if (field === "operationIds") result.operationIds.reverse();
    else result[field] += 1;
    const harness = run(repository);
    await expectBlocked(harness.result, "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID");
    assert.equal(harness.counts().providerCalls, 0);
    noProjectWrite(repository);
  });
}

test("S5: acceptance independently replays candidate operations before accepting a repaired script", async () => {
  const { repository } = await prepareHistorical();
  await run(repository).result;
  repository.build.checkpoints.repair.outputReference.result.candidateAttemptCount += 1;
  await expectBlocked(runCreatorScriptBuildAcceptanceCoordinator({ ownerId, buildId, dependencies: {
    repository, getCurrentProjectRevision: async () => revision, now: () => "2026-10-03T10:00:03.000Z",
  } }), "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_INVALID");
  noProjectWrite(repository);
});

test("S5: semantic identity binds build, target, round, ordinal, direction, bounds and feedback", async () => {
  const { repository } = await prepareHistorical();
  const roundInput = loadSetup(repository).repairInput;
  const input = createCreatorScriptBuildReplacementCandidateInput({ roundInput, buildId, sectionId: "section-1", ordinal: 1 });
  const identity = createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: input });
  assert.equal(identity, createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: clone(input) }));
  for (const mutate of [
    (v) => { v.attempt = 2; }, (v) => { v.candidate.ordinal = 2; },
    (v) => { v.candidate.sectionId = "section-2"; }, (v) => { v.replacementTargets[0].direction = "compress"; },
    (v) => { v.replacementTargets[0].requiredFinalMinWords += 1; },
    (v) => { v.replacementTargets[0].minimumRequiredGain += 1; },
    (v) => { v.currentScriptAuthority.sections[0].text += " changed"; },
    (v) => { v.candidate.rejectionFeedback = { reason: "above_maximum" }; },
  ]) {
    const changed = clone(input); mutate(changed);
    assert.notEqual(createCreatorScriptBuildScriptRepairSemanticFingerprint(changed), createCreatorScriptBuildScriptRepairSemanticFingerprint(input));
  }
  assert.notEqual(identity, createCreatorScriptBuildScriptRepairOperationId({ buildId: "other-build", repairInput: input }));
});

test("S4: whole-script duration remains authoritative after locally valid work", async () => {
  const { repository } = await prepare("repairable_short");
  const harness = run(repository, { proposalOptions: { additionWords: () => 6 } });
  const result = await harness.result;
  assert.equal(result.observedReport.accepted, false);
  assert.equal(result.repair.appliedRevisionCount, 2);
  assert.equal(result.repair.candidateAttemptCount, 2);
  assert.equal(harness.counts().providerCalls, 2);
  noProjectWrite(repository);
});

test("S5: narration safety blocks locally valid repaired prose before installation", async () => {
  const { repository } = await prepareHistorical();
  const harness = run(repository, { proposalOptions: { unsafeNarration: true, replacementWords: (target) => target.requiredFinalTargetWords } });
  await expectBlocked(harness.result, "CREATOR_SCRIPT_BUILD_REPAIR_ASSEMBLED_SCRIPT_REJECTED");
  assert.equal(repository.build.checkpoints.repair.status, "FAILED");
  noProjectWrite(repository);
});

test("S5: excluded/unknown grounding authority is never retried as a geometry rejection", async () => {
  const { repository } = await prepareHistorical();
  const harness = run(repository, { proposalOptions: { claimIds: ["claim-excluded"] } });
  await expectBlocked(harness.result, "CREATOR_SCRIPT_BUILD_REPAIR_CLAIM_NOT_PERMITTED");
  assert.equal(harness.counts().providerCalls, 1);
  assert.equal(repository.build.failure.category, "GROUNDING");
  noProjectWrite(repository);
});

test("S5: combined replacements cannot bypass cross-section distinctiveness", async () => {
  const { repository } = await prepareHistorical();
  const harness = run(repository, { executeScriptRepair: async (input) => {
    const p = repairProposal(input);
    if (input.candidate.sectionId.startsWith("section-")) p.section.heading = "Shared Repaired Pattern";
    return p;
  } });
  await expectBlocked(harness.result, "CREATOR_SCRIPT_BUILD_REPAIR_DISTINCTIVENESS_REGRESSION");
  noProjectWrite(repository);
});

test("S5: residual threshold and V2 persistence boundaries remain unchanged", async () => {
  assert.equal(CREATOR_SCRIPT_MAX_RESIDUAL_REPAIR_RATIO, 0.12);
  const source = fs.readFileSync("lib/creator/creatorScriptBuildScriptRepairCoordinator.ts", "utf8");
  assert.doesNotMatch(source, /nextState:\s*"ACCEPTED"|nextState:\s*"PERSISTED"|persistAccepted\(/);
  assert.doesNotMatch(source, /creator-script-plan\/route|save-project|genericQueue/);
  const { repository } = await prepareHistorical();
  const result = await run(repository).result;
  const replayed = await replayCreatorScriptBuildCompletedRepair({ repository, build: repository.build, generation: loadSetup(repository).generation });
  assert.deepEqual(replayed, result.repair);
  noProjectWrite(repository);
});

test("S4/S5: replacement round followed by duration round replays with two revisions", async () => {
  const { repository } = await prepareHistorical({ openingWords: 111 });
  const harness = run(repository, { proposalOptions: {
    replacementWords: (target) => target.requiredFinalMinWords,
  } });
  const result = await harness.result;
  assert.equal(result.observedReport.accepted, true);
  assert.equal(result.repair.attemptCount, 2);
  assert.equal(result.repair.appliedRevisionCount, 2);
  assert.equal(result.repair.candidateAttemptCount, 5);
  assert.equal(result.repair.script.revision, 3);
  assert.equal(harness.inputs().at(-1).mode, "additive");
  const restored = reloadRepository(repository);
  const replay = run(restored);
  assert.deepEqual((await replay.result).repair, result.repair);
  assert.equal(replay.counts().providerCalls, 0);
  noProjectWrite(restored);
});

for (const damaged of ["null-result", "missing-request", "missing-operation"]) {
  test(`S5: settled ${damaged} never permits duplicate provider dispatch`, async () => {
    const { repository } = await prepareHistorical();
    await run(repository).result;
    const restored = reloadRepository(repository);
    const [operation] = repairOperations(restored);
    if (damaged === "missing-operation") restored.operations.delete(operation.operationId);
    else if (damaged === "null-result") restored.operations.get(operation.operationId).resultReference = null;
    else delete restored.operations.get(operation.operationId).resultReference.request;
    const harness = run(restored);
    await assert.rejects(harness.result);
    assert.equal(harness.counts().providerCalls, 0);
    noProjectWrite(restored);
  });
}

test("S5: valid repaired acceptance and acceptance resume independently validate settled candidates", async () => {
  const { repository } = await prepareHistorical();
  const repaired = await run(repository).result;
  const deps = { repository, getCurrentProjectRevision: async () => revision, now: () => "2026-10-03T10:00:03.000Z" };
  const accepted = await runCreatorScriptBuildAcceptanceCoordinator({ ownerId, buildId, dependencies: deps });
  assert.equal(accepted.build.state, "ACCEPTED");
  assert.equal(accepted.acceptance.script.revision, repaired.repair.script.revision);
  assert.equal(repository.build.checkpoints.persistence, undefined);
  const resumed = await runCreatorScriptBuildAcceptanceCoordinator({ ownerId, buildId, dependencies: deps });
  assert.equal(resumed.disposition, "RESUMED");
  assert.deepEqual(resumed.acceptance, accepted.acceptance);
});

test("S2: actual provider helper binds single section schema and economic candidate identities", async () => {
  // Evaluate the real provider module with inert dependencies: no provider, research,
  // database or network implementation can execute in this test.
  const { default: ts } = await import("typescript");
  const { default: vm } = await import("node:vm");
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const compiled = ts.transpileModule(fs.readFileSync("lib/creator/creatorScriptBuildProviders.server.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (name) => name === "node:crypto" ? require(name) : {}, process: { env: {} } });
  const { repository } = await prepareHistorical();
  const roundInput = loadSetup(repository).repairInput;
  const input = createCreatorScriptBuildReplacementCandidateInput({ roundInput, buildId, sectionId: "section-1", ordinal: 1 });
  const calls = [];
  const invoke = (value) => exports.executeCreatorScriptBuildScriptRepairProvider({ ownerId, projectId: repository.build.projectId,
    value, runJson: async (args) => { calls.push(JSON.parse(JSON.stringify(args))); return repairProposal(value); } });
  const proposal = await invoke(input);
  assert.equal(proposal.section.sectionId, "section-1");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].schema.properties.section.properties.sectionId.enum, ["section-1"]);
  assert.deepEqual(calls[0].schema.required, ["version", "mode", "section"]);
  assert.equal(calls[0].schema.properties.sections, undefined);
  assert.equal(calls[0].user.replacementTargets.length, 1);
  assert.equal(calls[0].user.candidate.buildId, buildId);
  assert.match(calls[0].system, /Never refer to the production itself/);
  assert.match(calls[0].system, /sole replacementTargets item and candidate.sectionId/);
  await invoke(createCreatorScriptBuildReplacementCandidateInput({ roundInput, buildId, sectionId: "section-1", ordinal: 2 }));
  await invoke(createCreatorScriptBuildReplacementCandidateInput({ roundInput, buildId: "different-build", sectionId: "section-1", ordinal: 1 }));
  assert.equal(new Set(calls.map((c) => c.logicalOperationId)).size, 3);
  await assert.rejects(invoke(roundInput), /SINGLE_TARGET_REQUIRED/);
  assert.equal(calls.length, 3);
});

for (const field of ["checkpointId", "operationId", "diagnostics", "script-revision"]) {
  test(`S4/S5: checkpoint ${field} tampering cannot bypass read-only replay`, async () => {
    const { repository } = await prepareHistorical();
    await run(repository).result;
    const checkpoint = repository.build.checkpoints.repair;
    if (field === "diagnostics") checkpoint.diagnostics.candidateAttemptCount += 1;
    else if (field === "script-revision") checkpoint.outputReference.result.script.revision += 1;
    else checkpoint[field] = "tampered";
    const harness = run(repository);
    await expectBlocked(harness.result, "CREATOR_SCRIPT_BUILD_REPAIR_CHECKPOINT_OUTPUT_INVALID");
    assert.equal(harness.counts().providerCalls, 0);
    noProjectWrite(repository);
  });
}
