import assert from "node:assert/strict";
import test from "node:test";
import { prepareHistorical, reloadRepository, repairOperations } from "./test-support/creator-script-repair-historical.mjs";
import { ownerId, buildId, loadSetup, dependencies, repairProposal, clone } from "./test-support/creator-script-repair-replay.mjs";
import { runCreatorScriptBuildScriptRepairCoordinator as runRepair, creatorScriptBuildRepairAllowsCrossConstraintContinuation as allows } from "../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts";
import { creatorScriptAcceptanceMateriallyImproved, evaluateCreatorScriptAcceptance } from "../lib/creator/creatorScriptAcceptance.ts";

const fixture = Object.freeze({ historicalBuildId: "beae59c5-44c4-45e6-81c2-df233be53a61", words: Object.freeze([123,268,268,237,310,214]) });
test("frozen local overflow resolves into bounded second-round additive compensation", async () => {
  const { repository } = await prepareHistorical({ sectionWords: fixture.words });
  assert.notEqual(buildId, fixture.historicalBuildId);
  const { generation, repairInput } = loadSetup(repository);
  assert.equal(generation.script.sections.reduce((n,s) => n + s.text.split(/\s+/u).length,0),1420);
  assert.deepEqual(generation.sectionPlan.map(s => [s.minimumWords,s.targetWords,s.maximumWords]), [[111,124,137],...[1,2,3,4].map(() => [285,317,349]),[143,159,175]]);
  assert.deepEqual(repairInput.replacementTargets.map(t => [t.sectionId,t.direction]), [["conclusion","compress"]]);
  let continuation;
  const harness = dependencies(repository, { executeScriptRepair: async input => {
    assert.equal(repository.build.resultAuthority,null);
    assert.equal(repository.build.checkpoints.persistence,undefined);
    if (input.attempt === 1) return repairProposal(input,{replacementWords: () => 156});
    assert.equal(input.attempt,2);
    assert.equal(input.mode,"additive");
    assert.ok(input.expansionTargets.every(t => t.sectionId !== "conclusion" && t.requestedGainWords <= t.maxAdditionalWords));
    assert.ok(input.expansionTargets.reduce((n,t) => n+t.requestedGainWords,0) >= 34);
    const script = { ...generation.script, sections: input.currentScriptAuthority.sections };
    const current = evaluateCreatorScriptAcceptance({script,sectionPlan:generation.sectionPlan, narrationAuthority: input.narrationAuthority});
    const previous = evaluateCreatorScriptAcceptance({script:generation.script,sectionPlan:generation.sectionPlan});
    assert.equal(current.duration.actualWordCount,1362);
    assert.equal(current.duration.minimumAcceptableWordCount,1396);
    assert.equal(current.duration.targetWordCount,1551);
    assert.equal(current.duration.maximumAcceptableWordCount,1706);
    assert.equal(current.repairableViolations[0].diagnostics.distanceWords,34);
    assert.equal(current.repairableViolations[0].repairable,true);
    assert.equal(creatorScriptAcceptanceMateriallyImproved({previous,current}),false);
    continuation = { completedAttempt:1, previous,current,script,sectionPlan:generation.sectionPlan,compressedSectionIds:["conclusion"],remainingProviderCalls:1 };
    assert.equal(allows(continuation),true);
    return repairProposal(input);
  }});
  const result = await runRepair({ownerId,buildId,dependencies:harness.deps});
  assert.equal(result.observedReport.accepted,true);
  assert.equal(harness.counts().providerCalls,2);
  assert.equal(result.repair.attemptCount,2);
  assert.equal(result.repair.appliedRevisionCount,2);
  assert.equal(result.repair.candidateAttemptCount,2);
  assert.equal(repairOperations(repository)[0].resultReference.outcome.replacement.validation.accepted,true);
  assert.equal(repository.build.resultAuthority,null);
  assert.equal(repository.build.checkpoints.persistence,undefined);
  const restored = reloadRepository(repository);
  const resumed = dependencies(restored);
  assert.deepEqual((await runRepair({ownerId,buildId,dependencies:resumed.deps})).repair,result.repair);
  assert.equal(resumed.counts().providerCalls,0);
  for (const mutate of [
    v => {v.current.blockingViolations.push({code:"GROUNDING_BLOCKED"});},
    v => {v.current.violations.push({code:"EDITORIAL_DISTINCTIVENESS",severity:"hard",repairable:true});},
    v => {v.script.sections.forEach(s => {s.text="No insertion anchor";});},
    v => {v.remainingProviderCalls=0;},
    v => {v.completedAttempt=2;},
    v => {v.current.repairRequired=false;},
    v => {v.compressedSectionIds=[];},
    v => {v.previous.violations.push({code:"GLOBAL_DURATION_TOO_LONG",severity:"hard",repairable:true});},
  ]) {const changed=clone(continuation);mutate(changed);assert.equal(allows(changed),false);}
});

test("older coordinator contracts fail closed before dispatch", async () => {
  const { repository } = await prepareHistorical({ sectionWords: fixture.words });
  repository.build.snapshot.contractVersions.creatorScriptBuildScriptRepairCoordinator = "0.19E3B-S2";
  const harness = dependencies(repository);
  const frozen = JSON.stringify(repository.build);
  await assert.rejects(runRepair({ownerId,buildId,dependencies:harness.deps}),/CONTRACT_MISMATCH/u);
  assert.equal(harness.counts().providerCalls,0);
  assert.equal(JSON.stringify(repository.build),frozen);
});
