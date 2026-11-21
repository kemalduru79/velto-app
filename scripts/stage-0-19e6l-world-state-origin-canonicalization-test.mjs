import assert from "node:assert/strict";

const {
  reconcileClaimPropositionAuthorities,
} = await import("../lib/research/claimPropositionAuthority.ts");

function origin(attributedEntity = null, referencedWork = null) {
  return { attributedEntity, referencedWork };
}

const canonicalized = reconcileClaimPropositionAuthorities({
  initialClaims: [{
    claimId: "claim-world",
    claimType: "FACT",
    text: "A general world-state proposition.",
    propositionKind: "world_state",
    origin: origin(),
  }],
  adjudication: {
    claims: [{
      claimId: "claim-world",
      propositionKind: "world_state",
      origin: origin("Provider residue", "Provider work residue"),
    }],
  },
});

assert.equal(canonicalized.length, 1);
assert.equal(canonicalized[0].propositionKind, "world_state");
assert.deepEqual(
  canonicalized[0].origin,
  origin(),
  "world_state adjudication must canonicalize attribution-only origin metadata to null/null",
);

assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [{
      claimId: "claim-primary",
      claimType: "PRIMARY_SOURCE_CLAIM",
      text: "A primary-source claim.",
      propositionKind: "document_assertion",
      origin: origin(null, "source-work"),
    }],
    adjudication: {
      claims: [{
        claimId: "claim-primary",
        propositionKind: "world_state",
        origin: origin("Provider residue", "Provider work residue"),
      }],
    },
  }),
  /CLAIM_PRIMARY_SOURCE_WORLD_STATE_INVALID:claim-primary/u,
  "canonicalization must not permit PRIMARY_SOURCE_CLAIM to downgrade into world_state",
);

assert.throws(
  () => reconcileClaimPropositionAuthorities({
    initialClaims: [{
      claimId: "claim-primary-downgrade",
      claimType: "RESEARCH_FINDING",
      text: "A research result tied to its originating work.",
      propositionKind: "original_research_result",
      origin: origin(null, "research-work"),
    }],
    adjudication: {
      claims: [{
        claimId: "claim-primary-downgrade",
        propositionKind: "world_state",
        origin: origin("Provider residue", "Provider work residue"),
      }],
    },
  }),
  /EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT:claim-primary-downgrade/u,
  "canonicalization must preserve disagreement protection against primary-authority downgrade",
);

const repairedInvalidInitial = reconcileClaimPropositionAuthorities({
  initialClaims: [{
    claimId: "claim-invalid-world-origin",
    claimType: "FACT",
    text: "A world-state proposition with invalid provider origin metadata.",
    propositionKind: "world_state",
    origin: origin("Initial provider residue", null),
  }],
  adjudication: {
    claims: [{
      claimId: "claim-invalid-world-origin",
      propositionKind: "world_state",
      origin: origin("Adjudicator residue", "Adjudicator work residue"),
    }],
  },
});

assert.deepEqual(
  repairedInvalidInitial[0].origin,
  origin(),
  "a semantically invalid initial world_state may be repaired only to canonical null/null origin",
);

console.log("stage-0-19e6l-world-state-origin-canonicalization-test: PASS");
