import assert from "node:assert/strict";
import fs from "node:fs";

import {
  assertCreatorScriptBuildCheckpointIdentity,
  assertCreatorScriptBuildOperationTransition,
  assertCreatorScriptBuildTransition,
  createCreatorScriptBuildCheckpointId,
  createCreatorScriptBuildIdempotencyKey,
  createCreatorScriptBuildOperationId,
  createCreatorScriptBuildSnapshot,
} from "../lib/creator/creatorScriptBuild.ts";
import {
  createCreatorScriptBuildScriptGenerationInput,
  normalizeCreatorScriptBuildScriptGenerationResultFromCheckpoint,
  runCreatorScriptBuildScriptGenerationCoordinator,
} from "../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts";
import {
  CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS,
  CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_CHECKPOINT_VERSION,
  CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
  CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
  createCreatorScriptBuildScriptRepairInput,
  createCreatorScriptBuildScriptRepairOperationId,
  createCreatorScriptBuildScriptRepairSemanticFingerprint,
  creatorScriptBuildRepairAllowsNextAttempt,
  runCreatorScriptBuildScriptRepairCoordinator,
} from "../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts";
import {
  CreatorScriptBuildCoordinatorBlockedError,
} from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import {
  createCreatorScriptNarrationAuthority,
  normalizeCreatorScript,
} from "../lib/creator/creatorScript.ts";
import {
  evaluateCreatorScriptAcceptance,
} from "../lib/creator/creatorScriptAcceptance.ts";
import {
  normalizeCreatorScriptBuildAuthorityResultFromCheckpoint,
} from "../lib/creator/creatorScriptBuildAuthorityCoordinator.ts";
import { resolveClaimAuthority } from "../lib/research/claimAuthorityResolver.ts";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import {
  assessResearchSource,
  classifyResearchSourceDirectness,
} from "../lib/research/sourceAssessment.ts";

import {
  ownerId, otherOwnerId, buildId, revision, generationNow, repairNow, clone,
  MemoryRepository, prepare, loadSetup, dependencies, expectBlocked, repairOperationFixture,
} from "./test-support/creator-script-repair-replay.mjs";

// 1. Accepted generation is observed but E3B creates no repair authority.
{
  const { repository } = await prepare("accepted");
  const { deps, counts } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.disposition, "NO_REPAIR_REQUIRED");
  assert.equal(result.observedReport.accepted, true);
  assert.equal(result.build.state, "SCRIPT_GENERATED");
  assert.deepEqual(counts(), { providerCalls: 0, authorityCalls: 1 });
  assert.equal(repository.requestedOperations.length, 0);
  assert.equal(repository.build.checkpoints.repair, undefined);
}

// 2. Non-repairable policy failure is left for E3C without failing the build.
{
  const { repository } = await prepare("blocking_short");
  const { deps, counts } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.disposition, "NOT_REPAIRABLE");
  assert.equal(result.observedReport.accepted, false);
  assert.equal(result.observedReport.repairRequired, false);
  assert.equal(result.build.state, "SCRIPT_GENERATED");
  assert.equal(result.build.failure, null);
  assert.deepEqual(counts(), { providerCalls: 0, authorityCalls: 1 });
}

// 3, 6-21, 39, 42, 47-51. One canonical additive repair is server assembled.
let successful;
{
  const { repository } = await prepare("repairable_short");
  const before = loadSetup(repository);
  assert.equal(before.report.repairRequired, true);
  const { deps, counts, inputs } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  successful = { repository, result };
  assert.equal(result.disposition, "REPAIR_PHASE_COMPLETED");
  assert.equal(result.build.state, "REPAIRING");
  assert.equal(result.observedReport.accepted, true);
  assert.equal(result.repair.attemptCount, 1);
  assert.deepEqual(counts(), { providerCalls: 1, authorityCalls: 5 });
  assert.deepEqual(repository.transitions, ["SCRIPT_GENERATED->REPAIRING"]);
  assert.equal(repository.requestedOperations.length, 1);
  assert.equal(repository.requestedOperations[0].stage, "repair");
  assert.equal(
    repository.requestedOperations[0].operationType,
    CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
  );
  assert.deepEqual(inputs()[0].repairSectionIds, before.report.repairSectionIds);
  assert.equal(inputs()[0].mode, "additive");
  assert.ok(inputs()[0].expansionTargets.every((target) =>
    target.availablePlacementAnchors.length === 1 &&
    target.availablePlacementAnchors[0].placementMode === "server_exact_offset"
  ));
  assert.equal(result.repair.script.revision, 2);
  assert.equal(result.repair.script.title, before.generation.script.title);
  assert.equal(
    result.repair.script.targetDurationSec,
    before.generation.script.targetDurationSec,
  );
  assert.equal(
    result.repair.script.strategyFingerprint,
    before.generation.script.strategyFingerprint,
  );
  assert.deepEqual(
    result.repair.script.grounding.context,
    before.generation.script.grounding.context,
  );
  assert.equal(result.repair.script.generatedAt, before.generation.script.generatedAt);
  assert.equal(result.repair.script.updatedAt, repairNow);
  assert.equal(result.repair.script.approval, null);
  assert.deepEqual(
    result.repair.script.sections.map((section) => [section.id, section.kind]),
    before.generation.script.sections.map((section) => [section.id, section.kind]),
  );
  assert.ok(result.repair.script.sections.every((section) =>
    !section.humanVerification && !section.evidenceReviewRequired
  ));
  const targets = new Set(inputs()[0].repairSectionIds);
  before.generation.script.sections.forEach((section, index) => {
    if (!targets.has(section.id)) {
      assert.deepEqual(result.repair.script.sections[index], section);
    }
  });
  assert.equal(repository.build.resultAuthority, null);
  assert.equal(repository.build.checkpoints.acceptance, undefined);
  assert.equal(repository.build.checkpoints.persistence, undefined);
  assert.ok(!repository.transitions.some((value) =>
    value.includes("ACCEPTED") || value.includes("PERSISTED")
  ));
  assert.equal(CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS, 2);
}

// 22-23, 29, 45. Operation and completed-checkpoint reuse are timestamp stable.
{
  const completedBuild = clone(successful.repository.build);
  const storedScript = clone(successful.result.repair.script);
  const completedRepair = completedBuild.checkpoints.repair;
  completedBuild.checkpoints.repair = {
    ...completedRepair,
    status: "RUNNING",
    outputReference: null,
    completedAt: null,
  };
  const repository = new MemoryRepository(
    completedBuild,
    [...successful.repository.operations.values()],
  );
  const { deps, counts } = dependencies(repository, {
    now: () => "2026-10-03T11:00:00.000Z",
  });
  const reused = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(reused.repair.script.revision, 2);
  assert.equal(reused.repair.script.updatedAt, storedScript.updatedAt);
  assert.deepEqual(reused.repair.script, storedScript);
  assert.equal(counts().providerCalls, 0);

  const resumeDependencies = dependencies(successful.repository);
  const resumed = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: resumeDependencies.deps,
  });
  assert.equal(resumed.disposition, "RESUMED");
  assert.deepEqual(resumed.repair.script, storedScript);
  assert.equal(resumeDependencies.counts().providerCalls, 0);
}

// 24-28. Semantic repair operation identity is deterministic and excludes timestamps.
{
  const { repository } = await prepare("repairable_short");
  const { generation, report, repairInput } = loadSetup(repository);
  assert.ok(repairInput);
  const same = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: clone(generation.script),
    sectionPlan: clone(generation.sectionPlan),
    report: clone(report),
    attempt: 1,
  });
  const baseId = createCreatorScriptBuildScriptRepairOperationId({
    buildId,
    repairInput,
  });
  assert.equal(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: same }),
  );
  const timestampOnly = normalizeCreatorScript({
    ...generation.script,
    generatedAt: "2026-10-03T12:00:00.000Z",
    updatedAt: "2026-10-03T12:00:01.000Z",
  });
  const timestampInput = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: timestampOnly,
    sectionPlan: generation.sectionPlan,
    report,
    attempt: 1,
  });
  assert.equal(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({
      buildId,
      repairInput: timestampInput,
    }),
  );
  const changedScript = normalizeCreatorScript({
    ...generation.script,
    sections: generation.script.sections.map((section, index) =>
      index === 0 ? { ...section, text: `${section.text} changedword.` } : section
    ),
  });
  const changedInput = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: changedScript,
    sectionPlan: generation.sectionPlan,
    report,
    attempt: 1,
  });
  assert.notEqual(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: changedInput }),
  );
  const changedReport = clone(report);
  changedReport.repairableViolations[0].diagnostics.distanceWords += 1;
  const reportInput = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: generation.script,
    sectionPlan: generation.sectionPlan,
    report: changedReport,
    attempt: 1,
  });
  assert.notEqual(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: reportInput }),
  );
  const attempt2 = createCreatorScriptBuildScriptRepairInput({
    snapshot: repository.build.snapshot,
    script: generation.script,
    sectionPlan: generation.sectionPlan,
    report,
    attempt: 2,
  });
  assert.notEqual(
    baseId,
    createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: attempt2 }),
  );
  assert.equal("generatedAt" in repairInput.currentScriptAuthority, false);
  assert.equal("updatedAt" in repairInput.currentScriptAuthority, false);
}

// 30-32. Durable pending/uncertain/failed identities never re-execute.
for (const state of ["PENDING", "OUTCOME_UNCERTAIN", "FAILED"]) {
  const { repository } = await prepare("repairable_short");
  const operation = repairOperationFixture(repository, state);
  repository.operations.set(operation.operationId, clone(operation));
  const { deps, counts } = dependencies(repository);
  const expectedCode = state === "FAILED"
    ? "CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_FAILED"
    : "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED";
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    expectedCode,
  );
  assert.equal(counts().providerCalls, 0);
  assert.equal(repository.requestedOperations.length, 1);
  assert.equal(repository.requestedOperations[0].semanticFingerprint, operation.semanticFingerprint);
  assert.equal(repository.operations.size, 2); // E3A generation + the one repair identity.
}

// 33. Stale authority before attempt one prevents any repair operation/provider call.
{
  const { repository } = await prepare("repairable_short");
  const { deps, counts } = dependencies(repository, {
    currentRevision: () => "2026-10-03T12:00:00.000Z",
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(repository.build.state, "STALE");
  assert.equal(counts().providerCalls, 0);
  assert.equal(repository.requestedOperations.length, 0);
}

// 34-35. Stale authority between attempts prevents the second paid call.
{
  const { repository } = await prepare("repairable_short");
  const { deps, counts } = dependencies(repository, {
    currentRevision: (call) => call < 4 ? revision : "2026-10-03T12:00:00.000Z",
    proposalOptions: { additionWords: () => 10 },
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_PROJECT_STALE",
  );
  assert.equal(counts().providerCalls, 1);
  assert.equal(repository.build.state, "STALE");
  assert.equal(repository.requestedOperations.length, 1);
}

// 27, 36-37, 40. A materially improving attempt permits exactly one second attempt.
{
  const { repository } = await prepare("repairable_short");
  const { deps, counts, inputs } = dependencies(repository, {
    proposalOptions: {
      additionWords: (target, input) => input.attempt === 1
        ? 10
        : target.requestedGainWords,
    },
  });
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(counts().providerCalls, 2);
  assert.equal(result.repair.attemptCount, 2);
  assert.equal(result.repair.script.revision, 3);
  assert.equal(result.observedReport.accepted, true);
  assert.equal(result.build.state, "REPAIRING");
  assert.notEqual(
    createCreatorScriptBuildScriptRepairOperationId({
      buildId,
      repairInput: inputs()[0],
    }),
    createCreatorScriptBuildScriptRepairOperationId({
      buildId,
      repairInput: inputs()[1],
    }),
  );
}

// 36, 41. Bounded repair exhaustion completes without a third call or false failure.
{
  const { repository } = await prepare("repairable_short");
  const { deps, counts } = dependencies(repository, {
    proposalOptions: { additionWords: () => 1 },
  });
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(counts().providerCalls, 2);
  assert.equal(result.repair.attemptCount, 2);
  assert.equal(result.observedReport.accepted, false);
  assert.equal(result.build.state, "REPAIRING");
  assert.equal(result.build.failure, null);
  assert.equal(repository.requestedOperations.length, 2);
}

// Unsafe assembled prose remains a settled operation artifact, never a repair revision.
for (const shape of ["distinctiveness", "repairable_short"]) {
  const { repository } = await prepare(shape);
  const { deps, counts } = dependencies(repository, { proposalOptions: { unsafeNarration: true } });
  await expectBlocked(runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_REPAIR_ASSEMBLED_SCRIPT_REJECTED");
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.resultAuthority, null);
  assert.equal(repository.build.checkpoints.persistence, undefined);
  assert.ok(counts().providerCalls >= 1);
}

// 37-38. The explicit second-attempt gate rejects unchanged policy reports.
{
  const { repository } = await prepare("repairable_short");
  const { report } = loadSetup(repository);
  assert.equal(creatorScriptBuildRepairAllowsNextAttempt({
    completedAttempt: 1,
    previous: report,
    current: clone(report),
  }), false);
  const blocking = clone(report);
  blocking.repairRequired = false;
  blocking.blockingViolations = [clone(blocking.repairableViolations[0])];
  assert.equal(creatorScriptBuildRepairAllowsNextAttempt({
    completedAttempt: 1,
    previous: report,
    current: blocking,
  }), false);
  assert.equal(creatorScriptBuildRepairAllowsNextAttempt({
    completedAttempt: 2,
    previous: report,
    current: report,
  }), false);
}

// 7-16. Content-only proposal metadata cannot override server target/control authority.
{
  const { repository } = await prepare("repairable_short");
  const { deps } = dependencies(repository);
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.repair.script.title, repository.build.snapshot.strategy.title);
  assert.equal(result.repair.script.revision, 2);
  assert.equal(result.repair.script.approval, null);
  assert.equal(result.repair.script.generatedAt, generationNow);
  assert.equal(result.repair.script.updatedAt, repairNow);
  assert.ok(result.repair.script.sections.every((section) =>
    !section.id.startsWith("provider") && section.kind !== "provider"
  ));
  assert.ok(result.repair.script.sections.every((section) =>
    section.evidenceReviewRequired === false && section.humanVerification == null
  ));
}

// 9-10. Unknown and E2B-excluded claims are both rejected as grounding violations.
for (const forbiddenClaimId of ["claim-unknown", "claim-excluded"]) {
  const { repository } = await prepare("repairable_short");
  const { deps, counts } = dependencies(repository, {
    proposalOptions: { claimIds: [forbiddenClaimId] },
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_REPAIR_CLAIM_NOT_PERMITTED",
  );
  assert.equal(counts().providerCalls, 1);
  assert.equal(repository.build.state, "FAILED");
  assert.equal(repository.build.failure.category, "GROUNDING");
}

// 43. Compression must move toward the existing canonical envelope.
{
  const { repository } = await prepare("repairable_long");
  const { deps, counts } = dependencies(repository, {
    proposalOptions: {
      replacementWords: (target) => target.beforeWords,
    },
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_REPAIR_BUDGET_EXHAUSTED",
  );
  assert.equal(counts().providerCalls, 2);
  assert.equal(repository.build.state, "FAILED");
}

// 44. A distinctiveness proposal cannot retain/reintroduce the same failure.
{
  const { repository } = await prepare("distinctiveness");
  const { deps, counts } = dependencies(repository, {
    proposalOptions: { sameHeading: true },
  });
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_REPAIR_BUDGET_EXHAUSTED",
  );
  assert.equal(counts().providerCalls, 2);
  assert.equal(repository.build.state, "FAILED");
}

// 44A. A duration repair may preserve pre-existing heading debt while a later
// dedicated distinctiveness target resolves it. Only new candidate regressions
// are rejected before the combined-replacement gate.
{
  const { repository } = await prepare("distinctiveness_short");
  const before = loadSetup(repository);
  assert.ok(before.report.repairableViolations.some((violation) =>
    violation.code === "GLOBAL_DURATION_TOO_SHORT"
  ));
  assert.ok(before.report.repairableViolations.some((violation) =>
    violation.code === "EDITORIAL_DISTINCTIVENESS"
  ));
  const { deps, counts, inputs } = dependencies(repository, {
    proposalOptions: {
      heading: (target, input, current) =>
        target.direction === "differentiate_sections"
          ? `Recovered${target.sectionId.replace(/\W/g, "")} Unique Heading`
          : current.heading,
    },
  });
  const result = await runCreatorScriptBuildScriptRepairCoordinator({
    ownerId,
    buildId,
    dependencies: deps,
  });
  assert.equal(result.build.state, "REPAIRING");
  assert.notEqual(result.repair, null);
  assert.ok(counts().providerCalls >= 2);
  const repairInputs = inputs();
  assert.ok(repairInputs.some((input) =>
    input.replacementTargets[0]?.direction === "expand"
  ));
  assert.ok(repairInputs.some((input) =>
    input.replacementTargets[0]?.direction === "differentiate_sections"
  ));
}

// 4-5. REPAIRING is the only resume state and unrelated states fail closed.
for (const state of [
  "REQUESTED",
  "SNAPSHOTTED",
  "RESEARCH_READY",
  "EDITORIAL_COMPILED",
  "AUTHORITY_RESOLVED",
  "ACCEPTED",
  "PERSISTED",
  "FAILED",
  "STALE",
]) {
  const { repository } = await prepare("repairable_short");
  repository.build = { ...repository.build, state };
  const { deps, counts } = dependencies(repository);
  await expectBlocked(
    runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: deps }),
    "CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_STATE_INVALID",
  );
  assert.equal(counts().providerCalls, 0);
}

// 46. Owner authority applies to both build and operation reads.
{
  const { repository } = await prepare("repairable_short");
  const operation = repairOperationFixture(repository, "PENDING");
  repository.operations.set(operation.operationId, operation);
  await assert.rejects(
    runCreatorScriptBuildScriptRepairCoordinator({
      ownerId: otherOwnerId,
      buildId,
      dependencies: dependencies(repository).deps,
    }),
    /CREATOR_SCRIPT_BUILD_NOT_FOUND/u,
  );
  assert.equal(
    await repository.getOperationForOwner(operation.operationId, buildId, otherOwnerId),
    null,
  );
}

// Static architecture guard: no queue, project persistence, acceptance transition, or API route.
{
  const moduleText = fs.readFileSync(
    new URL("../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(moduleText, /genericQueue|queue\.add|save-project|creator-script-plan\/route/u);
  assert.doesNotMatch(moduleText, /nextState:\s*"ACCEPTED"|nextState:\s*"PERSISTED"/u);
  assert.doesNotMatch(moduleText, /resultAuthority\s*:/u);
  assert.match(moduleText, /evaluateCreatorScriptAcceptance/u);
  assert.match(moduleText, /creatorScriptAcceptanceMateriallyImproved/u);
  assert.match(moduleText, /round <= CREATOR_SCRIPT_BUILD_MAX_REPAIR_ATTEMPTS/u);
}

console.log("stage-0-19e3b-script-repair-coordinator-test: PASS");
