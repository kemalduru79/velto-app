import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION as policyVersion } from "../lib/creator/creatorScriptBuildRepairProviderPolicy.ts";
import { canonicalCreatorScriptBuildJson, createCreatorScriptBuildOperationId } from "../lib/creator/creatorScriptBuild.ts";
import {
  createCreatorScriptBuildReplacementCandidateInput,
  createCreatorScriptBuildScriptRepairSemanticFingerprint,
  createCreatorScriptBuildScriptRepairOperationId,
  runCreatorScriptBuildScriptRepairCoordinator,
  CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
  CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
} from "../lib/creator/creatorScriptBuildScriptRepairCoordinator.ts";
import { parseCreatorScriptBuildModelJson } from "../lib/creator/creatorScriptBuildProviderContract.ts";
import { runCreatorScriptBuildScriptGenerationCoordinator } from "../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts";
import { countCreatorScriptWords } from "../lib/creator/creatorScript.ts";
import { prepareHistorical, repairOperations } from "./test-support/creator-script-repair-historical.mjs";
import {
  ownerId, buildId, revision, generationNow, repairNow, clone, loadSetup,
  MemoryRepository, generationProposal, textWithWords, expectBlocked,
} from "./test-support/creator-script-repair-replay.mjs";

const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/stage-0-19-live-repair-provider.json", import.meta.url), "utf8"));
const require = createRequire(import.meta.url);
const providerCode = ts.transpileModule(fs.readFileSync("lib/creator/creatorScriptBuildProviders.server.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function interceptedProvider(proposals) {
  const requests = [];
  class FakeOpenAI {
    responses = { create: async (request) => {
      requests.push(clone(request));
      const user = JSON.parse(request.input[1].content);
      return { output_text: JSON.stringify(proposals(user, requests.length)) };
    } };
  }
  const exports = {};
  vm.runInNewContext(providerCode, {
    exports, process: { env: { OPENAI_API_KEY: "inert-test-only" } },
    require: (name) => {
      if (name === "node:crypto") return require(name);
      if (name === "openai") return { default: FakeOpenAI };
      if (name === "./creatorScriptBuildRepairProviderPolicy.ts") return { CREATOR_SCRIPT_BUILD_REPAIR_PROVIDER_POLICY_VERSION: policyVersion };
      if (name === "./creatorScriptBuildProviderContract.ts") return { parseCreatorScriptBuildModelJson };
      if (name === "../economics/index.ts") return { recordOpenAITextEconomics: async () => {} };
      return {};
    },
  });
  return { requests, execute: (value) => exports.executeCreatorScriptBuildScriptRepairProvider({
    ownerId, projectId: "synthetic-project", value,
  }) };
}

async function setup() {
  const { repository: original } = await prepareHistorical();
  const originalSetup = loadSetup(original);
  const record = clone(original.build);
  record.state = "AUTHORITY_RESOLVED";
  delete record.checkpoints.script_generation;
  const repository = new MemoryRepository(record);
  await runCreatorScriptBuildScriptGenerationCoordinator({ ownerId, buildId, dependencies: {
    repository, getCurrentProjectRevision: async () => revision, now: () => generationNow,
    executeScriptGeneration: async (input) => {
      const proposal = generationProposal(input, "accepted");
      proposal.sections.forEach((section, i) => {
        section.heading = originalSetup.generation.script.sections[i].heading;
        section.text = textWithWords(`livefixture${i}word`, input.sectionPlan[i].id === fixture.sectionId
          ? fixture.beforeWords : countCreatorScriptWords(originalSetup.generation.script.sections[i].text));
        section.claimIds = originalSetup.generation.script.sections[i].claimIds;
      });
      return proposal;
    },
  } });
  const { generation, repairInput } = loadSetup(repository);
  const target = repairInput.replacementTargets.find((target) => target.sectionId === fixture.sectionId);
  assert.deepEqual([target.direction, target.beforeWords, target.requiredFinalMinWords, target.requiredFinalTargetWords,
    target.requiredFinalMaxWords, target.minimumRequiredGain], ["expand", 260, 285, 317, 349, 25]);
  assert.notEqual(repository.build.buildId, fixture.historicalBuildId);
  return { repository, generation, roundInput: repairInput };
}

function response(user, words) {
  const current = user.authorityContext.currentScriptAuthority.sections.find((s) => s.id === user.candidate.sectionId);
  const target = user.replacementTargets[0];
  return { version: "0.19E3B-script-repair-proposal-v2", mode: "replacement", section: {
    sectionId: target.sectionId,
    heading: `Recovered${target.sectionId.replace(/\W/g, "")} Distinction${target.sectionId.replace(/\W/g, "")}`,
    text: textWithWords(`response${target.sectionId.replace(/\W/g, "")}word`, words ?? target.requiredFinalTargetWords),
    claimIds: current.claimIds,
  } };
}

function assertExpandRequest(request, retry = false) {
  assert.deepEqual(request.input.map((m) => m.role), ["system", "user"]);
  const system = request.input[0].content;
  assert.match(system, /EXPAND section section-1/);
  assert.match(system, /current section has 260 words/);
  assert.match(system, /AT LEAST 285 words and NO MORE THAN 349 words/);
  assert.match(system, /Target approximately 317 words/);
  assert.match(system, /longer than the current 260-word section and gain at least 25 words/);
  assert.match(system, /Returning fewer than 285 words.*will be rejected/);
  assert.match(system, /COMPLETE replacement section, not an addition, summary, or partial rewrite/);
  assert.doesNotMatch(system, /COMPRESS section|direction=compress|tighten/);
  const user = JSON.parse(request.input[1].content);
  assert.deepEqual(user.repairSectionIds, ["section-1"]);
  assert.equal(user.replacementTargets.length, 1);
  assert.equal(user.candidate.sectionId, "section-1");
  assert.equal(user.providerPolicyVersion, policyVersion);
  assert.equal(user.repairStrategies, undefined);
  assert.equal(user.repairableViolations, undefined);
  assert.equal(user.expansionTargets, undefined);
  assert.equal(user.authorityContext.usage, "context_only_not_active_repair_instructions");
  assert.match(system, /authorityContext material is CONTEXT ONLY/);
  assert.deepEqual(request.text.format.schema.properties.section.properties.sectionId.enum, ["section-1"]);
  assert.equal(request.max_output_tokens, undefined);
  if (retry) {
    assert.match(system, /previous candidate contained 221 words.*reason wrong_direction_expand/);
    assert.match(system, /at least 285 words and no more than 349 words/);
    assert.match(system, /Aim for approximately 317 words/);
    assert.match(system, /Do not shorten the section again/);
    assert.equal(user.candidate.ordinal, 2);
    assert.equal(user.candidate.rejectionFeedback.candidateWords, 221);
  }
}

for (const recovery of [false, true]) {
  test(`live failure: actual responses.create request, ${recovery ? "221 then 317 recovery" : "221 then 219 exhaustion"}`, async () => {
    const { repository, generation } = await setup();
    const provider = interceptedProvider((user) => response(user, user.candidate.sectionId === fixture.sectionId
      ? user.candidate.ordinal === 1 ? fixture.rejectedCandidates[0] : recovery ? fixture.recoveryCandidate : fixture.rejectedCandidates[1]
      : undefined));
    const execute = async (value) => {
      assert.equal(value.currentScriptAuthority.revision, generation.script.revision);
      assert.deepEqual(value.currentScriptAuthority.sections.map((s) => s.text), generation.script.sections.map((s) => s.text));
      assert.equal(repository.build.resultAuthority, null);
      assert.equal(repository.build.checkpoints.persistence, undefined);
      return provider.execute(value);
    };
    const result = runCreatorScriptBuildScriptRepairCoordinator({ ownerId, buildId, dependencies: {
      repository, getCurrentProjectRevision: async () => revision, now: () => repairNow, executeScriptRepair: execute,
    } });
    if (recovery) {
      const repaired = await result;
      assert.equal(repaired.observedReport.accepted, true);
      assert.equal(repaired.repair.script.revision, generation.script.revision + 1);
      assert.equal(repaired.repair.appliedRevisionCount, 1);
      assert.equal(repaired.repair.candidateCallLimit, 8);
      assert.equal(provider.requests.length, 5);
    } else {
      await expectBlocked(result, "CREATOR_SCRIPT_BUILD_REPAIR_BUDGET_EXHAUSTED");
      assert.equal(provider.requests.length, 2);
      assert.equal(repository.build.failure.diagnostics.candidateCallLimit, 8);
      assert.equal(repository.build.failure.diagnostics.candidateAttemptCount, 2);
      assert.equal(repository.build.failure.diagnostics.lastRejectionReason, "wrong_direction_expand");
    }
    assertExpandRequest(provider.requests[0]);
    assertExpandRequest(provider.requests[1], true);
    const outcomes = repairOperations(repository);
    assert.equal(outcomes[0].resultReference.outcome.replacement.validation.reason, "wrong_direction_expand");
    assert.equal(outcomes[0].resultReference.outcome.replacement.validation.candidateWords, 221);
    assert.ok(outcomes[0].resultReference.request.repairableViolations.some((v) => v.repairStrategy === "compress"));
    assert.equal(outcomes[1].resultReference.outcome.replacement.validation.candidateWords, recovery ? 317 : 219);
    assert.equal(outcomes[1].resultReference.outcome.replacement.validation.accepted, recovery);
    assert.deepEqual(repository.build.checkpoints.script_generation.outputReference.result.script, JSON.parse(JSON.stringify(generation.script)));
    assert.equal(repository.build.resultAuthority, null);
    assert.equal(repository.build.checkpoints.persistence, undefined);
  });
}

test("actual compression request has numeric hard bounds, target and required reduction", async () => {
  const { roundInput } = await setup();
  const value = createCreatorScriptBuildReplacementCandidateInput({ roundInput, buildId, sectionId: "conclusion", ordinal: 1 });
  const provider = interceptedProvider((user) => response(user));
  await provider.execute(value);
  const system = provider.requests[0].input[0].content;
  assert.match(system, /COMPRESS section conclusion/);
  assert.match(system, /current section has 204 words/);
  assert.match(system, /AT LEAST 143 words and NO MORE THAN 175 words/);
  assert.match(system, /Target approximately 159 words/);
  assert.match(system, /shorter than the current 204-word section.*at least 29 words/);
  assert.match(system, /Output above 175 words will be rejected/);
  assert.match(system, /COMPLETE replacement section/);
  assert.doesNotMatch(system, /EXPAND section/);
});

test("retry correction always uses active server target bounds, never feedback bounds", async () => {
  const { roundInput } = await setup();
  const feedback = { accepted: false, reason: "wrong_direction_expand", sectionId: "section-1", beforeWords: 260,
    candidateWords: 221, minimumWords: 1, maximumWords: 9999 };
  const value = createCreatorScriptBuildReplacementCandidateInput({ roundInput, buildId, sectionId: "section-1", ordinal: 2,
    rejectionFeedback: feedback });
  const provider = interceptedProvider((user) => response(user));
  await provider.execute(value);
  assertExpandRequest(provider.requests[0], true);
  assert.doesNotMatch(provider.requests[0].input[0].content, /at least 1 words|9999/);
});

test("provider policy version changes coordinator fingerprint and deterministic operation identity", async () => {
  const { roundInput } = await setup();
  const value = createCreatorScriptBuildReplacementCandidateInput({ roundInput, buildId, sectionId: "section-1", ordinal: 1 });
  const oldFingerprint = `creator-script-build-script-repair-semantic-v3:${createHash("sha256")
    .update(canonicalCreatorScriptBuildJson({ contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION, input: value }), "utf8").digest("hex")}`;
  const expected = `creator-script-build-script-repair-semantic-v3:${createHash("sha256")
    .update(canonicalCreatorScriptBuildJson({ contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION,
      providerPolicyVersion: policyVersion, input: value }), "utf8").digest("hex")}`;
  assert.equal(createCreatorScriptBuildScriptRepairSemanticFingerprint(value), expected);
  assert.notEqual(expected, oldFingerprint);
  const oldId = createCreatorScriptBuildOperationId({ buildId, stage: "repair", operationType: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_TYPE,
    semanticFingerprint: oldFingerprint, contractVersion: CREATOR_SCRIPT_BUILD_SCRIPT_REPAIR_OPERATION_VERSION });
  assert.notEqual(createCreatorScriptBuildScriptRepairOperationId({ buildId, repairInput: value }), oldId);
});
