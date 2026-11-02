import assert from "node:assert/strict";
import { reconcileClaimPropositionAuthorities, ClaimPropositionAuthorityDisagreementError } from "../lib/research/claimPropositionAuthority.ts";
import { researchClaimRequiresPrimarySource } from "../lib/research/claimEvidenceGraph.ts";
import fs from "node:fs";

const article = "https://cacm.acm.org/opinion/three-ai-futures/";
const claim = Object.freeze({
  claimId: "claim-1",
  claimType: "THEORY",
  text: "Three distinct possibilities have been discussed for the future of AI.",
  propositionKind: "attributed_statement",
  origin: { attributedEntity: "cacm.acm.org", referencedWork: null },
  preservedProperty: "do-not-change",
});
const graph = {
  sources: [{ sourceId: "web-1", url: article }],
  evidence: [{ evidenceId: "evidence-1", sourceId: "web-1", excerpt: "The original article asserts three futures." }],
  links: [{ claimId: "claim-1", evidenceId: "evidence-1", stance: "supports" }],
};
const decision = { claims: [{ claimId: "claim-1", propositionKind: "document_assertion", origin: { attributedEntity: null, referencedWork: article } }] };
const run = (initialClaims=[claim], adjudication=decision, sourceGraph=graph) =>
  reconcileClaimPropositionAuthorities({initialClaims,adjudication,sourceGraph});

const [accepted] = run();
assert.equal(accepted.propositionKind, "document_assertion");
assert.deepEqual(accepted.origin, { attributedEntity: null, referencedWork: article });
assert.equal(accepted.claimType, claim.claimType);
assert.equal(accepted.text, claim.text);
assert.equal(accepted.preservedProperty, claim.preservedProperty);
assert.equal(researchClaimRequiresPrimarySource(claim),true);
assert.equal(researchClaimRequiresPrimarySource(accepted),true);
assert.equal(claim.propositionKind,"attributed_statement","Canonical input immutable");

const disallowed = [
  ["no evidence graph", [claim],decision,undefined],
  ["unlinked source", [claim],decision,{...graph,links:[]}],
  ["unregistered work", [claim],{ claims:[{...decision.claims[0],origin:{attributedEntity:null,referencedWork:"https://cacm.acm.org/opinion/not-the-article/"}}]},graph],
  ["source spoofed", [claim],decision,{...graph,sources:[{sourceId:"web-1",url:"https://other.example/test"}]}],
  ["person substitution", [{...claim,origin:{attributedEntity:"Jane Smith",referencedWork:null}}],decision,graph],
  ["different publisher", [{...claim,origin:{attributedEntity:"other.example",referencedWork:null}}],decision,graph],
  ["different claim evidence", [{...claim,claimId:"claim-2"}],{claims:[{...decision.claims[0],claimId:"claim-2"}]},graph],
  ["primary downgrade", [claim],{claims:[{claimId:"claim-1",propositionKind:"world_state",origin:{attributedEntity:null,referencedWork:null}}]},graph],
];
for (const [label,claims,adjudication,sourceGraph] of disallowed) {
  assert.throws(() => run(claims,adjudication,sourceGraph),
    error => error instanceof ClaimPropositionAuthorityDisagreementError,
    label+" must fail closed");
}
const api = fs.readFileSync("app/api/creator-editorial-analysis/route.ts","utf8");
assert.match(api,/reconcileClaimPropositionAuthorities\\(\\{[\\s\\S]*?sourceGraph: graph,/u);
console.log("CreatorLab publisher-document claim origin regression PASS");
