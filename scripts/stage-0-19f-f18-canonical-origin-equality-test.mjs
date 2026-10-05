import assert from "node:assert/strict";

import {
  ClaimPropositionAuthorityDisagreementError,
  claimPropositionOriginsEqual,
  reconcileClaimPropositionAuthorities,
} from "../lib/research/claimPropositionAuthority.ts";
import {
  createCreatorScriptBuildAdjudicationRejectionDiagnostic,
} from "../lib/creator/creatorScriptBuildProviderContract.ts";
import {
  canonicalResearchReference,
  canonicalResearchUrl,
} from "../lib/research/orchestratedResearch.ts";

const proposalUrl = "https://lancengym.medium.com/the-post-work-paradox-why-elon-musks-utopia-contradicts-itself-b00c31e8433b";
const adjudicatedUrl = "https://lancengym.medium.com/the-post-work-paradox-why-elon-musk-s-utopia-contradicts-itself-b00c31e8433b";
const proposalOrigin = {
  attributedEntity: null,
  referencedWork: `web:${proposalUrl}`,
};
const adjudicatedOrigin = {
  attributedEntity: null,
  referencedWork: `web:${adjudicatedUrl}`,
};
const initialClaim = {
  claimId: "proposal-item-3",
  claimType: "EXPERT_OPINION",
  text: "UBI may preserve income without replacing the meaning people derive from work.",
  propositionKind: "expert_synthesis",
  origin: proposalOrigin,
};

assert.equal(
  canonicalResearchUrl(proposalUrl),
  "https://lancengym.medium.com/p/b00c31e8433b",
);
assert.equal(canonicalResearchUrl(proposalUrl), canonicalResearchUrl(adjudicatedUrl));
assert.equal(
  canonicalResearchReference(`web:${proposalUrl}`),
  canonicalResearchReference(`web:${adjudicatedUrl}`),
);
assert.equal(claimPropositionOriginsEqual(proposalOrigin, adjudicatedOrigin), true);

const reconciled = reconcileClaimPropositionAuthorities({
  initialClaims: [initialClaim],
  adjudication: {
    claims: [{
      claimId: initialClaim.claimId,
      propositionKind: initialClaim.propositionKind,
      origin: adjudicatedOrigin,
    }],
  },
});
assert.deepEqual(
  reconciled[0].origin,
  proposalOrigin,
  "canonical equality must retain the proposal's exact supplied source authority",
);
const diagnostic = createCreatorScriptBuildAdjudicationRejectionDiagnostic({
  initialClaims: [initialClaim],
  items: [{ claim: initialClaim, evidenceSelections: [] }],
  adjudication: {
    claims: [{
      claimId: initialClaim.claimId,
      propositionKind: initialClaim.propositionKind,
      origin: adjudicatedOrigin,
    }],
  },
  ordinal: 1,
  reason: "regression",
});
assert.equal(
  diagnostic.comparisons[0].originMatches,
  true,
  "durable diagnostics must use the same canonical origin equality",
);

assert.equal(
  claimPropositionOriginsEqual(
    { attributedEntity: null, referencedWork: "web:https://example.com/report/?utm_source=test&b=2&a=1#part" },
    { attributedEntity: null, referencedWork: "web:https://example.com/report?a=1&b=2" },
  ),
  true,
  "tracking, hash, query order, and trailing slash variations should use canonical URL identity",
);
assert.equal(
  claimPropositionOriginsEqual(
    { attributedEntity: null, referencedWork: "web:https://example.com/report?edition=1" },
    { attributedEntity: null, referencedWork: "web:https://example.com/report?edition=2" },
  ),
  false,
  "meaningful query differences must remain distinct",
);
assert.equal(
  claimPropositionOriginsEqual(
    proposalOrigin,
    { attributedEntity: null, referencedWork: "web:https://lancengym.medium.com/another-post-aaaaaaaaaaaa" },
  ),
  false,
  "different Medium post ids must remain distinct",
);
assert.equal(
  claimPropositionOriginsEqual(
    proposalOrigin,
    { attributedEntity: "Lance Ng", referencedWork: proposalOrigin.referencedWork },
  ),
  false,
  "attributedEntity mismatch must remain distinct",
);

for (const changedOrigin of [
  { attributedEntity: null, referencedWork: "web:https://lancengym.medium.com/another-post-aaaaaaaaaaaa" },
  { attributedEntity: "Lance Ng", referencedWork: proposalOrigin.referencedWork },
]) {
  assert.throws(
    () => reconcileClaimPropositionAuthorities({
      initialClaims: [initialClaim],
      adjudication: {
        claims: [{
          claimId: initialClaim.claimId,
          propositionKind: initialClaim.propositionKind,
          origin: changedOrigin,
        }],
      },
    }),
    (error) =>
      error instanceof ClaimPropositionAuthorityDisagreementError &&
      error.disagreement.originMatches === false,
    "genuinely different origins must remain fail-closed",
  );
}

assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [initialClaim],
    adjudication: {
      claims: [{
        claimId: initialClaim.claimId,
        propositionKind: "world_state",
        origin: { attributedEntity: null, referencedWork: null },
      }],
    },
  }),
  (error) =>
    error instanceof ClaimPropositionAuthorityDisagreementError &&
    error.disagreement.kindMatches === false,
  "unauthorized propositionKind changes must remain fail-closed",
);

console.log("stage-0-19f-f18-canonical-origin-equality-test: PASS");
