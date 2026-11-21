import assert from "node:assert/strict";
import {
  reconcileEditorialClaimOriginsWithAdditiveRepairRollback as reconcile,
} from "../lib/research/editorialClaimOriginRepairRollback.ts";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import { ClaimPropositionAuthorityDisagreementError } from "../lib/research/claimPropositionAuthority.ts";

const source = {
  sourceId: "web:https://secondthoughts.ai/p/measuring-ai-progress",
  url: "https://secondthoughts.ai/p/measuring-ai-progress",
  title: "Measuring AI Progress", mediaKind: "webpage",
};
const baseClaim = {
  claimId: "claim-1", claimType: "FACT",
  text: "AI benchmark results and observed productivity are different measurements.",
  propositionKind: "world_state",
  origin: { attributedEntity: null, referencedWork: null },
};
const additiveClaim = {
  claimId: "claim-6", claimType: "FACT",
  text: "AI abilities vary dramatically across tasks and durations.",
  propositionKind: "original_research_result",
  origin: { attributedEntity: null, referencedWork: source.sourceId },
};
const baseEvidence = {
  evidenceId: "evidence-1", sourceId: source.sourceId,
  excerpt: "The source compares benchmarks with real-world tasks.",
  contextNote: null, locator: { section: null, page: null,
    timecodeStartSec: null, timecodeEndSec: null },
};
const additiveEvidence = {
  ...baseEvidence, evidenceId: "evidence-6",
  excerpt: "The source describes the jagged frontier of AI capabilities.",
};
const baseGraph = createResearchClaimEvidenceGraph({
  sources: [source], claims: [baseClaim], evidence: [baseEvidence],
  links: [{ claimId: "claim-1", evidenceId: "evidence-1", stance: "supports" }],
});
const selectedGraph = createResearchClaimEvidenceGraph({
  sources: [source], claims: [baseClaim, additiveClaim],
  evidence: [baseEvidence, additiveEvidence],
  links: [...baseGraph.links, {
    claimId: "claim-6", evidenceId: "evidence-6", stance: "supports",
  }],
});
const baseDecision = {
  claimId: baseClaim.claimId, propositionKind: "world_state",
  origin: baseClaim.origin,
};
const downgrade = {
  claimId: additiveClaim.claimId, propositionKind: "expert_synthesis",
  origin: additiveClaim.origin,
};
const inputs = { baseGraph, selectedGraph, repairAccepted: true,
  adjudication: { claims: [baseDecision, downgrade] } };

const fallback = reconcile(inputs);
assert.equal(fallback.rolledBackAdditiveClaimId, "claim-6");
assert.deepEqual(fallback.graph, baseGraph,
  "canonical rollback must preserve every original claim, evidence, link and source");
assert.equal(fallback.graph.claims.some((claim) => claim.claimId === "claim-6"), false,
  "a downgraded primary claim is never sent to Script Planner");
const accepted = reconcile({ ...inputs,
  adjudication: { claims: [baseDecision, {
    ...downgrade, propositionKind: "original_research_result",
  }] },
});
assert.equal(accepted.rolledBackAdditiveClaimId, null);
assert.deepEqual(accepted.graph, selectedGraph);

assert.throws(() => reconcile({ ...inputs, repairAccepted: false }),
  ClaimPropositionAuthorityDisagreementError);
const tamperedGraph = createResearchClaimEvidenceGraph({
  ...selectedGraph,
  claims: [{ ...baseClaim, text: "Altered original claim" }, additiveClaim],
});
assert.throws(() => reconcile({ ...inputs, selectedGraph: tamperedGraph }),
  ClaimPropositionAuthorityDisagreementError,
  "rollback is forbidden if accepted expansion changed existing authority");
const basePrimaryGraph = createResearchClaimEvidenceGraph({
  ...baseGraph,
  claims: [{ ...additiveClaim, claimId: "claim-1" }],
});
assert.throws(() => reconcile({
  ...inputs, baseGraph: basePrimaryGraph,
  adjudication: { claims: [{ ...downgrade, claimId: "claim-1" }, {
    ...downgrade,
    propositionKind: "original_research_result",
  }] },
}), ClaimPropositionAuthorityDisagreementError,
"any disagreement affecting an original claim must remain fail-closed");

const route = await import("node:fs").then((fs) => fs.readFileSync(
  "app/api/creator-editorial-analysis/route.ts", "utf8",
));
assert.match(route, /reconcileEditorialClaimOriginsWithAdditiveRepairRollback/);
assert.match(route, /CREATOR_EDITORIAL_CLAIM_ORIGIN_ADDITIVE_REPAIR_ROLLED_BACK/);
console.log("creator-editorial-claim-origin-repair-rollback-test: PASS");
