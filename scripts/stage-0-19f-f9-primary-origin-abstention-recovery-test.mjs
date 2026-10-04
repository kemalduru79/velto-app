import assert from "node:assert/strict";

import {
  recoverCreatorScriptBuildEditorialAdjudication,
} from "../lib/creator/creatorScriptBuildProviderContract.ts";

const origin = {
  attributedEntity: null,
  referencedWork: "Original post-work study",
};

const initial = {
  claimId: "proposal-item-1",
  claimType: "RESEARCH_FINDING",
  text: "The original study reports a measured change in work participation.",
  propositionKind: "original_research_result",
  origin,
};

const items = [{
  claim: initial,
  evidenceSelections: [{
    sourceId: "source-primary",
    spanId: "span-primary",
    stance: "supports",
    contextNote: null,
  }],
}];

function recovery() {
  const calls = [];
  return {
    calls,
    context: {
      buildId: "f9-test-build",
      runStep: async (step, execute) => {
        calls.push(step);
        return await execute(`f9-${step.kind}-${step.ordinal}`);
      },
    },
  };
}

function adjudication(propositionKind, adjudicatedOrigin = origin) {
  return {
    claims: [{
      claimId: initial.claimId,
      propositionKind,
      origin: adjudicatedOrigin,
    }],
  };
}

{
  const h = recovery();
  let adjudicationCalls = 0;
  const result = await recoverCreatorScriptBuildEditorialAdjudication({
    proposal: { items },
    items,
    initialClaims: [initial],
    authority: { claims: [initial] },
    recovery: h.context,
    adjudicate: async (ordinal, priorRejection) => {
      adjudicationCalls += 1;
      if (ordinal === 1) {
        assert.equal(priorRejection, null);
        return adjudication("ambiguous");
      }
      assert.ok(priorRejection);
      assert.match(
        String(priorRejection.rejectionReason),
        /EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS/u,
      );
      return adjudication("original_research_result");
    },
  });

  assert.equal(adjudicationCalls, 2);
  assert.equal(h.calls.length, 2);
  assert.equal(result.proposal.items[0].claim.propositionKind, "original_research_result");
  assert.deepEqual(result.proposal.items[0].claim.origin, origin);
}

{
  const h = recovery();
  let adjudicationCalls = 0;
  await assert.rejects(
    recoverCreatorScriptBuildEditorialAdjudication({
      proposal: { items },
      items,
      initialClaims: [initial],
      authority: { claims: [initial] },
      recovery: h.context,
      adjudicate: async () => {
        adjudicationCalls += 1;
        return adjudication("ambiguous", {
          attributedEntity: "Invented researcher",
          referencedWork: origin.referencedWork,
        });
      },
    }),
    (error) =>
      error?.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID",
  );
  assert.equal(adjudicationCalls, 1);
  assert.equal(h.calls.length, 1);
}

{
  const h = recovery();
  let adjudicationCalls = 0;
  await assert.rejects(
    recoverCreatorScriptBuildEditorialAdjudication({
      proposal: { items },
      items,
      initialClaims: [initial],
      authority: { claims: [initial] },
      recovery: h.context,
      adjudicate: async () => {
        adjudicationCalls += 1;
        return adjudication("world_state", {
          attributedEntity: null,
          referencedWork: null,
        });
      },
    }),
    (error) =>
      error?.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID",
  );
  assert.equal(adjudicationCalls, 1);
  assert.equal(h.calls.length, 1);
}

{
  const h = recovery();
  let adjudicationCalls = 0;
  await assert.rejects(
    recoverCreatorScriptBuildEditorialAdjudication({
      proposal: { items },
      items,
      initialClaims: [initial],
      authority: { claims: [initial] },
      recovery: h.context,
      adjudicate: async () => {
        adjudicationCalls += 1;
        return adjudication("ambiguous");
      },
    }),
    (error) =>
      error?.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID",
  );
  assert.equal(adjudicationCalls, 2);
  assert.equal(h.calls.length, 2);
}

console.log("stage-0-19f-f9-primary-origin-abstention-recovery-test: PASS");
