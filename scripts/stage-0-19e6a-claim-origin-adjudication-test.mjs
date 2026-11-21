import assert from "node:assert/strict";
import {
  researchClaimRequiresPrimarySource,
} from "../lib/research/claimEvidenceGraph.ts";
import {
  ClaimPropositionAuthorityDisagreementError,
  reconcileClaimPropositionAuthorities,
} from "../lib/research/claimPropositionAuthority.ts";

const emptyOrigin = {
  attributedEntity: null,
  referencedWork: null,
};

const runtimeFailureClaim = {
  claimId: "claim-runtime-editorial-inference",
  claimType: "EDITORIAL_INFERENCE",
  text: "Elon Musk's vision of a post-work future raises profound questions that extend beyond technology, including social and economic implications.",
  propositionKind: "editorial_inference",
  origin: {
    attributedEntity: "Elon Musk",
    referencedWork: null,
  },
  untouchedProviderField: "preserve-me",
};

const deattributed = reconcileClaimPropositionAuthorities({
  initialClaims: [runtimeFailureClaim],
  adjudication: {
    claims: [{
      claimId: runtimeFailureClaim.claimId,
      propositionKind: "editorial_inference",
      origin: emptyOrigin,
    }],
  },
});

assert.equal(
  deattributed[0].propositionKind,
  "editorial_inference",
  "safe de-attribution must preserve the adjudicated proposition kind",
);
assert.deepEqual(
  deattributed[0].origin,
  emptyOrigin,
  "a same-kind editorial inference may remove a spurious named attribution",
);
assert.equal(
  deattributed[0].untouchedProviderField,
  "preserve-me",
  "reconciliation must not rewrite unrelated provider fields",
);
assert.equal(
  researchClaimRequiresPrimarySource(deattributed[0]),
  false,
  "safe de-attribution must not create a primary-source obligation",
);

assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [runtimeFailureClaim],
    adjudication: {
      claims: [{
        claimId: runtimeFailureClaim.claimId,
        propositionKind: "editorial_inference",
        origin: {
          attributedEntity: "Sam Altman",
          referencedWork: null,
        },
      }],
    },
  }),
  (error) =>
    error instanceof ClaimPropositionAuthorityDisagreementError &&
    error.disagreement.originMatches === false,
  "changing one named attribution to another must remain fail-closed",
);

assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [{
      ...runtimeFailureClaim,
      origin: emptyOrigin,
    }],
    adjudication: {
      claims: [{
        claimId: runtimeFailureClaim.claimId,
        propositionKind: "editorial_inference",
        origin: {
          attributedEntity: "Elon Musk",
          referencedWork: null,
        },
      }],
    },
  }),
  /EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT/,
  "adding a new named attribution must remain fail-closed",
);

assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [{
      ...runtimeFailureClaim,
      origin: {
        attributedEntity: "Elon Musk",
        referencedWork: "Vision interview",
      },
    }],
    adjudication: {
      claims: [{
        claimId: runtimeFailureClaim.claimId,
        propositionKind: "editorial_inference",
        origin: {
          attributedEntity: "Elon Musk",
          referencedWork: "Different interview",
        },
      }],
    },
  }),
  /EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT/,
  "substituting a referenced work must remain fail-closed",
);

assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [{
      claimId: "claim-primary-bearing",
      claimType: "FACT",
      text: "Ada Example said the system changed.",
      propositionKind: "attributed_statement",
      origin: {
        attributedEntity: "Ada Example",
        referencedWork: "Official interview",
      },
    }],
    adjudication: {
      claims: [{
        claimId: "claim-primary-bearing",
        propositionKind: "world_state",
        origin: emptyOrigin,
      }],
    },
  }),
  /EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT/,
  "primary-bearing authority downgrades must remain fail-closed",
);

console.log("stage-0-19e6a-claim-origin-adjudication-test: PASS");
