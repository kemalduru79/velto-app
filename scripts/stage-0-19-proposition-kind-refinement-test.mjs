import assert from "node:assert/strict";
import test from "node:test";
import {
  reconcileClaimPropositionAuthorities as reconcile,
  ClaimPropositionAuthorityDisagreementError,
  CLAIM_PROPOSITION_AUTHORITY_VERSION,
} from "../lib/research/claimPropositionAuthority.ts";
import { createResearchClaimEvidenceGraph, researchClaimRequiresPrimarySource } from "../lib/research/claimEvidenceGraph.ts";
import { researchSourceIsPrimaryForClaim, assessResearchSource, classifyResearchSourceDirectness } from "../lib/research/sourceAssessment.ts";
import { resolveClaimAuthority } from "../lib/research/claimAuthorityResolver.ts";
import { recoverCreatorScriptBuildEditorialAdjudication as recover } from "../lib/creator/creatorScriptBuildProviderContract.ts";
import { createCreatorScriptBuildEditorialRecoveryContext, CREATOR_SCRIPT_BUILD_EDITORIAL_ADJUDICATION_POLICY_VERSION } from "../lib/creator/creatorScriptBuildEditorialAdjudicationRecovery.ts";
import { runCreatorScriptBuildResearchEditorialCoordinator } from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import { ownerId, buildId, clone, MemoryRepository, buildRecord, createSnapshot, authorityFixture } from "./test-support/creator-script-repair-replay.mjs";

const origin = Object.freeze({ attributedEntity: "Daniel Susskind", referencedWork: "c4ejournal source" });
const emptyOrigin = Object.freeze({ attributedEntity: null, referencedWork: null });
const liveText = "Daniel Susskind's concept of 'task encroachment' describes how machines are increasingly capable of performing tasks once done only by humans, leading to a gradual but relentless advance of automation into human work domains.";
const freeze = value => { if(value && typeof value === "object"){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
// Exact supplied item-1 text; remaining entries freeze the supplied classification set.
const fixture = freeze({ historicalBuildId:"01a5a3b8-289e-48c8-963f-0683b95846e0",
  initialClaims:["original_research_result",...Array(6).fill("expert_synthesis"),"editorial_inference"].map((kind,index)=>({
    claimId:`proposal-item-${index+1}`,claimType:index===7?"EDITORIAL_INFERENCE":"FACT",
    text:index===0?liveText:`Frozen classification claim ${index+1}.`,propositionKind:kind,origin:index===7?emptyOrigin:origin,
  })),
  adjudication:{claims:[...Array(4).fill("attributed_statement"),...Array(3).fill("document_assertion"),"editorial_inference"].map((kind,index)=>({
    claimId:`proposal-item-${index+1}`,propositionKind:kind,origin:index===7?emptyOrigin:origin,
  }))},
});
const one = (initial={},adjudicated={}) => reconcile({
  initialClaims:[{...fixture.initialClaims[0],...initial}],
  adjudication:{claims:[{...fixture.adjudication.claims[0],...adjudicated}]},
})[0];
const concreteDisagreement = error => error instanceof ClaimPropositionAuthorityDisagreementError &&
  error.message.startsWith("EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT:");
function harness(initialClaims=fixture.initialClaims,adjudication=fixture.adjudication) {
  const repository = new MemoryRepository(buildRecord(createSnapshot()));
  const recovery = createCreatorScriptBuildEditorialRecoveryContext({repository,build:repository.build,parentOperationId:"frozen-refinement-parent",assertAuthority:async()=>{}}).context;
  const items=initialClaims.map((c,index)=>({claim:{text:c.text,claimType:c.claimType,propositionKind:c.propositionKind,origin:c.origin},
    evidenceSelections:[{sourceId:"source-c4e",spanId:`span-${index+1}`,stance:"supports",contextNote:"Frozen selected evidence."}]}));
  const authority=freeze({claims:clone(initialClaims),sources:[{sourceId:"source-c4e",title:"c4ejournal source"}],
    candidateSpans:items.map((item,index)=>({sourceId:"source-c4e",spanId:item.evidenceSelections[0].spanId,text:`Frozen selected evidence ${index+1}.`}))});
  let calls=0;
  const execute = () => recover({proposal:{items},items,initialClaims,authority,recovery,
    adjudicate:async(ordinal,previous)=>{calls++;if(typeof adjudication === "function")return adjudication(ordinal,previous);
      assert.equal(ordinal,1);assert.equal(previous,null);return clone(adjudication);}});
  return {repository,items,authority,execute,calls:()=>calls};
}

test("frozen live eight-kind set reconciles with one concrete adjudication and unchanged prose/evidence",async()=>{
  const h=harness();assert.notEqual(buildId,fixture.historicalBuildId);
  const before=JSON.stringify({items:h.items,authority:h.authority});
  const result=await h.execute();assert.equal(h.calls(),1);
  assert.deepEqual(result.proposal.items.map(i=>i.claim.propositionKind),fixture.adjudication.claims.map(c=>c.propositionKind));
  result.proposal.items.forEach((item,index)=>{
    assert.equal(item.claim.text,h.items[index].claim.text);assert.equal(item.claim.claimType,h.items[index].claim.claimType);
    assert.deepEqual(item.claim.origin,h.items[index].claim.origin);assert.deepEqual(item.evidenceSelections,h.items[index].evidenceSelections);
  });
  assert.equal(result.proposal.items[0].claim.propositionKind,"attributed_statement");
  assert.equal(researchClaimRequiresPrimarySource(result.proposal.items[0].claim),true);
  assert.equal(JSON.stringify({items:h.items,authority:h.authority}),before);
  const attempts=[...h.repository.operations.values()];assert.equal(attempts.length,1);assert.equal(attempts[0].resultReference.outcome.accepted,true);
  assert.deepEqual(await h.execute(),result);assert.equal(h.calls(),1);
  assert.equal(h.repository.build.resultAuthority,null);assert.equal(h.repository.build.checkpoints.persistence,undefined);
});

test("existing same-work and nonprimary refinements remain unchanged",()=>{
  for(const [initialKind,adjudicatedKind] of [["document_assertion","original_research_result"],["original_research_result","document_assertion"],
    ["expert_synthesis","attributed_statement"],["expert_synthesis","document_assertion"],
    ["expert_synthesis","editorial_inference"],["editorial_inference","expert_synthesis"]]) {
    assert.equal(one({propositionKind:initialKind},{propositionKind:adjudicatedKind}).propositionKind,adjudicatedKind);
  }
  assert.equal(one({propositionKind:"editorial_inference"},{propositionKind:"editorial_inference"}).propositionKind,"editorial_inference");
});

for(const [name,initial,adjudicated] of [
  ["entity substitution",{},{origin:{...origin,attributedEntity:"Another person"}}],
  ["work substitution",{},{origin:{...origin,referencedWork:"Another work"}}],
  ["entity de-attribution",{},{origin:{...origin,attributedEntity:null}}],
  ["work de-attribution",{},{origin:{...origin,referencedWork:null}}],
  ["normalization-hidden entity substitution",{},{origin:{...origin,attributedEntity:" Daniel Susskind "}}],
  ["normalization-hidden work substitution",{},{origin:{...origin,referencedWork:" c4ejournal source "}}],
  ["primary-to-nonprimary downgrade",{},{propositionKind:"expert_synthesis"}],
  ["world-state downgrade",{},{propositionKind:"world_state",origin:emptyOrigin}],
  ["reverse edge",{propositionKind:"attributed_statement"},{propositionKind:"original_research_result"}],
  ["other primary edge",{propositionKind:"document_assertion"},{}],
  ["changed claim text in adjudication",{},{text:"Rewritten claim."}],
  ["changed evidence in adjudication",{},{evidenceSelections:[{sourceId:"invented-source",spanId:"invented-span"}]}],
  ["invalid initial originating-work authority",{origin:{...origin,referencedWork:null}},{origin:{...origin,referencedWork:null}}],
  ["invalid initial claim text",{text:""},{}],
]) test(`${name} is rejected`,()=>assert.throws(()=>one(initial,adjudicated)));

test("concrete disagreement diagnostic is distinct from actual abstention",()=>{
  assert.throws(()=>one({},{origin:{...origin,referencedWork:"Changed work"}}),concreteDisagreement);
  assert.throws(()=>one({},{propositionKind:"ambiguous"}),error=>error instanceof ClaimPropositionAuthorityDisagreementError &&
    error.message.startsWith("EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS:") && error.disagreement.adjudicatedKind === "ambiguous");
  for(const origin of [{attributedEntity:42,referencedWork:"work"},{attributedEntity:"Daniel Susskind"},null])
    assert.throws(()=>one({},{origin}),/EDITORIAL_CLAIM_ORIGIN_ADJUDICATION_INVALID/u);
});

test("secondary discussion cannot inherit primary qualification after refinement",()=>{
  const canonical=one();
  const source={...authorityFixture().graph.sources[0],sourceId:"web:https://c4e.example/susskind",url:"https://c4e.example/susskind",
    title:"c4ejournal source",author:"Secondary Reviewer",publisher:"C4E Journal",summary:liveText};
  assert.equal(classifyResearchSourceDirectness(source).directness,"secondary");
  assert.equal(researchSourceIsPrimaryForClaim(source,fixture.initialClaims[0]),true,"initial work-title match illustrates the old authority route");
  assert.equal(researchSourceIsPrimaryForClaim(source,canonical),false,"canonical attribution must qualify against the named entity");
  const graph=createResearchClaimEvidenceGraph({sources:[source],claims:[canonical],evidence:[{
    evidenceId:"evidence-1",sourceId:source.sourceId,excerpt:liveText,contextNote:null,
    locator:{section:"review",page:null,timecodeStartSec:null,timecodeEndSec:null},
  }],links:[{claimId:canonical.claimId,evidenceId:"evidence-1",stance:"supports"}]});
  const report=resolveClaimAuthority({graph,sourceAssessments:[assessResearchSource(source,"secondary")]});
  assert.equal(report.claims[0].requiresPrimary,true);assert.equal(report.claims[0].status,"PRIMARY_REQUIRED_MISSING");
  assert.deepEqual(report.claims[0].qualifyingPrimaryEvidenceIds,[]);
  assert.equal(researchSourceIsPrimaryForClaim({...source,author:"Daniel Susskind"},canonical),true);
});

test("concrete rejection persists exact comparison and never uses abstention recovery",async()=>{
  const changed={claims:[{...fixture.adjudication.claims[0],origin:{...origin,referencedWork:"Different work"}}]};
  const h=harness([fixture.initialClaims[0]],changed);
  await assert.rejects(h.execute(),e=>e.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID");assert.equal(h.calls(),1);
  const outcome=[...h.repository.operations.values()][0].resultReference.outcome;
  assert.equal(outcome.recoverable,false);assert.match(outcome.rejection.rejectionReason,/^EDITORIAL_CLAIM_ORIGIN_DISAGREEMENT:/u);
  assert.deepEqual(outcome.rejection.comparisons[0],{
    proposalItemId:"proposal-item-1",claimText:liveText,claimType:"FACT",initialKind:"original_research_result",initialOrigin:origin,
    adjudicatedKind:"attributed_statement",adjudicatedOrigin:changed.claims[0].origin,kindMatches:false,originMatches:false,
    evidenceSelections:[{sourceId:"source-c4e",spanId:"span-1"}],
  });
  assert.equal(outcome.rejection.adjudicationOrdinal,1);assert.equal(outcome.rejection.policyVersion,CREATOR_SCRIPT_BUILD_EDITORIAL_ADJUDICATION_POLICY_VERSION);
});

test("prior settled reconciliation contracts cannot be reinterpreted",async()=>{
  assert.equal(CLAIM_PROPOSITION_AUTHORITY_VERSION,"claim-proposition-authority-v2");
  assert.equal(CREATOR_SCRIPT_BUILD_EDITORIAL_ADJUDICATION_POLICY_VERSION,"creator-script-build-editorial-adjudication-recovery-v2");
  for(const state of ["FAILED","RESEARCH_READY"]){
    const repository=new MemoryRepository(buildRecord(createSnapshot(),{state}));
    repository.build.snapshot.contractVersions.creatorScriptResearchEditorialCoordinator="0.19E2A-A1";
    const before=JSON.stringify(repository.build);let calls=0;
    await assert.rejects(runCreatorScriptBuildResearchEditorialCoordinator({ownerId,buildId,dependencies:{repository,
      getCurrentProjectRevision:async()=>null,executeResearch:async()=>{calls++;},executeEditorialProposal:async()=>{calls++;}}}),/CONTRACT_MISMATCH/u);
    assert.equal(calls,0);assert.equal(JSON.stringify(repository.build),before);
  }
});


test("actual world-state abstention still uses the existing two-attempt recovery",async()=>{
  const initial={...fixture.initialClaims[0],propositionKind:"world_state",origin:emptyOrigin};
  const h=harness([initial],(ordinal,previous)=>{
    if(ordinal===1)assert.equal(previous,null);
    else {assert.equal(ordinal,2);assert.match(previous.rejectionReason,/^EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS:/u);}
    return {claims:[{claimId:initial.claimId,propositionKind:ordinal===1?"ambiguous":"world_state",origin:emptyOrigin}]};
  });
  assert.equal((await h.execute()).proposal.items[0].claim.propositionKind,"world_state");assert.equal(h.calls(),2);
  const outcomes=[...h.repository.operations.values()].map(o=>o.resultReference.outcome);
  assert.equal(outcomes[0].accepted,false);assert.equal(outcomes[0].recoverable,true);assert.equal(outcomes[1].accepted,true);
});
