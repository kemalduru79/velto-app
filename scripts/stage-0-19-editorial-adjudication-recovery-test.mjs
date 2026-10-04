import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import * as contract from "../lib/creator/creatorScriptBuildProviderContract.ts";
import * as graph from "../lib/research/claimEvidenceGraph.ts";
import { reconcileClaimPropositionAuthorities } from "../lib/research/claimPropositionAuthority.ts";
import { createCreatorScriptBuildEditorialRecoveryContext } from "../lib/creator/creatorScriptBuildEditorialAdjudicationRecovery.ts";
import { runCreatorScriptBuildResearchEditorialCoordinator as run, CreatorScriptBuildCoordinatorBlockedError, CreatorScriptBuildStageExecutionError } from "../lib/creator/creatorScriptBuildResearchEditorialCoordinator.ts";
import { createCreatorScriptBuildOperationId, canonicalCreatorScriptBuildJson } from "../lib/creator/creatorScriptBuild.ts";
import { ownerId, buildId, projectId, revision, clone, createSnapshot, buildRecord, MemoryRepository, authorityFixture } from "./test-support/creator-script-repair-replay.mjs";

const require = createRequire(import.meta.url);
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/creator/creatorScriptBuildProviders.server.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, process: {env:{}}, require: name => {
  if (name === "node:crypto") return require(name);
  if (name === "./creatorScriptBuildProviderContract.ts") return contract;
  if (name === "./creatorScriptBuildResearchEditorialCoordinator.ts") return {CreatorScriptBuildStageExecutionError};
  if (name === "../research/claimEvidenceGraph.ts") return graph;
  return {};
}});
const emptyOrigin = {attributedEntity:null,referencedWork:null};
const claim = Object.freeze({ text:"Memory contributes to identity.",claimType:"FACT",propositionKind:"world_state",origin:emptyOrigin });
const adjudication = (kind, origin=emptyOrigin) => ({claims:[{claimId:"proposal-item-1",propositionKind:kind,origin}]});
const children = repository => [...repository.operations.values()].filter(o => o.operationType === "creator_editorial_adjudication_attempt");
function setup(options={}) {
  const repository = options.repository || new MemoryRepository(buildRecord(createSnapshot(),{state:"REQUESTED",checkpoints:{}}));
  const requests=[];
  const deps = {repository,getCurrentProjectRevision:async()=>revision,now:()=>"2026-10-04T10:00:00.000Z",
    executeResearch:async()=>({sources:authorityFixture().graph.sources,lanes:[{laneId:"baseline",purpose:"baseline",required:true,status:"ready",sourceIds:authorityFixture().graph.sources.map(s=>s.sourceId)}]}),
    executeEditorialProposal:async(value,recovery)=>exports.executeCreatorScriptBuildEditorialProposalProvider({ownerId,projectId,value,recovery,
      runJson:async request=>{
        requests.push(clone(request));
        assert.equal(repository.build.resultAuthority,null);
        assert.equal(repository.build.checkpoints.persistence,undefined);
        if(request.operationType === "creator_script_build_editorial_proposal") {
          const span=value.candidateSpans[0];
          return {items:[{claim:clone(options.claim || claim),evidenceSelections:[{sourceId:span.sourceId,spanId:span.spanId,stance:"supports",contextNote:null}]}]};
        }
        const ordinal = requests.filter(r=>r.operationType === "creator_script_build_claim_origin_adjudication").length;
        if(options.provider) return options.provider(request,ordinal);
        return ordinal === 1 ? adjudication("ambiguous") : adjudication("world_state");
      }}),
  };
  return {repository,requests,deps,result:()=>run({ownerId,buildId,dependencies:deps})};
}
function diagnostic(operation) {return operation.resultReference.outcome.rejection;}
function assertComparison(d) {
  assert.equal(d.adjudicationOrdinal,1);
  assert.match(d.rejectionReason,/EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS/u);
  const c=d.comparisons[0];
  assert.equal(c.proposalItemId,"proposal-item-1");assert.equal(c.claimText,claim.text);assert.equal(c.claimType,"FACT");
  assert.equal(c.initialKind,"world_state");assert.equal(c.adjudicatedKind,"ambiguous");
  assert.deepEqual(c.initialOrigin,emptyOrigin);assert.deepEqual(c.adjudicatedOrigin,emptyOrigin);
  assert.equal(c.kindMatches,false);assert.equal(c.originMatches,true);
  assert.equal(c.evidenceSelections.length,1);assert.ok(c.evidenceSelections[0].spanId);assert.ok(c.evidenceSelections[0].sourceId);
}

test("one durable abstention, one corrective retry, unchanged authority and normal editorial completion",async()=>{
  assert.throws(()=>reconcileClaimPropositionAuthorities({initialClaims:[{...claim,claimId:"proposal-item-1"}],adjudication:adjudication("ambiguous")}),/EDITORIAL_CLAIM_ORIGIN_AMBIGUOUS/u);
  const h=setup();const result=await h.result();assert.equal(result.build.state,"EDITORIAL_COMPILED");
  assert.equal(h.requests.length,3);const [a,b]=h.requests.filter(r=>r.operationType.includes("adjudication"));
  assert.notEqual(a.logicalOperationId,b.logicalOperationId);
  assert.equal(canonicalCreatorScriptBuildJson(a.user.claims),canonicalCreatorScriptBuildJson(b.user.claims));
  assert.equal(canonicalCreatorScriptBuildJson(a.user.sources),canonicalCreatorScriptBuildJson(b.user.sources));
  assert.equal(canonicalCreatorScriptBuildJson(a.user.candidateSpans),canonicalCreatorScriptBuildJson(b.user.candidateSpans));
  for(const phrase of ["previous answer was ambiguous","Ambiguity cannot be accepted","unchanged claim and evidence","Do not invent attribution","Do not force world_state","ambiguity may remain","fail closed"]) assert.ok(b.system.includes(phrase));
  const attempts=children(h.repository);assert.equal(attempts.length,2);
  assert.equal(attempts[0].resultReference.outcome.accepted,false);assertComparison(diagnostic(attempts[0]));
  assert.equal(attempts[1].resultReference.outcome.accepted,true);
  for(const operation of attempts) assert.equal(createCreatorScriptBuildOperationId(operation),operation.operationId);
  const second=setup();await second.result();assert.deepEqual(children(second.repository).map(o=>o.operationId),attempts.map(o=>o.operationId));
  const resumed=setup({repository:new MemoryRepository(clone(h.repository.build),clone([...h.repository.operations.values()]))});
  assert.equal((await resumed.result()).disposition,"ALREADY_ADVANCED");assert.equal(resumed.requests.length,0);
});

test("corrective attributed classification accepts only the existing monotonic primary upgrade",async()=>{
  const h=setup({provider:async(_request,ordinal)=>ordinal===1?adjudication("ambiguous"):adjudication("attributed_statement",{attributedEntity:"A. Reporter",referencedWork:null})});
  const result=await h.result();assert.equal(result.build.state,"EDITORIAL_COMPILED");
  assert.equal(result.editorial.graph.claims[0].propositionKind,"attributed_statement");
  assert.equal(graph.researchClaimRequiresPrimarySource(result.editorial.graph.claims[0]),true);
  assert.equal(children(h.repository).length,2);
});

for(const [name,response] of [
  ["repeated ambiguity",()=>adjudication("ambiguous")],
  ["malformed response",()=>({claims:[]})],
  ["invalid attributed authority",()=>adjudication("attributed_statement")],
  ["unapproved nonprimary disagreement",()=>adjudication("expert_synthesis")],
  ["malformed JSON",()=>{throw new CreatorScriptBuildStageExecutionError({category:"MODEL_CONTRACT",code:"CREATOR_SCRIPT_BUILD_PROVIDER_STRUCTURED_RESPONSE_INVALID",retryability:"NON_RETRYABLE"});}],
]) test(`${name} fails closed after exactly one corrective attempt with inspectable rejection`,async()=>{
  const h=setup({provider:async(_request,ordinal)=>ordinal===1?adjudication("ambiguous"):response()});
  await assert.rejects(h.result(),e=>e.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID");
  assert.equal(h.repository.build.state,"FAILED");assert.equal(h.requests.length,3);assert.equal(children(h.repository).length,2);
  assertComparison(diagnostic(children(h.repository)[0]));
  const failed=children(h.repository)[1];assert.equal(failed.resultReference.outcome.accepted,false);
  assert.equal(h.repository.build.failure.diagnostics.adjudicationOrdinal,2);
  assert.equal(h.repository.build.failure.diagnostics.adjudicationOperationId,failed.operationId);
  assert.equal(h.repository.build.resultAuthority,null);assert.equal(h.repository.build.checkpoints.persistence,undefined);
  const restored=setup({repository:new MemoryRepository(clone(h.repository.build),clone([...h.repository.operations.values()]))});
  const frozen=JSON.stringify(restored.repository.build);assert.equal((await restored.result()).disposition,"TERMINAL");
  assert.equal(restored.requests.length,0);assert.equal(JSON.stringify(restored.repository.build),frozen);
});

test("resume after first rejection reuses proposal and settled first adjudication",async()=>{
  const h=setup();const transition=h.repository.transitionOperation.bind(h.repository);let interrupted=false;
  h.repository.transitionOperation=async input=>{const result=await transition(input);
    if(!interrupted && input.resultReference?.outcome?.rejection?.adjudicationOrdinal===1){interrupted=true;throw new CreatorScriptBuildCoordinatorBlockedError({code:"SIMULATED_CRASH",buildId});}
    return result;
  };
  await assert.rejects(h.result(),e=>e.code === "SIMULATED_CRASH");assert.equal(h.requests.length,2);
  assert.equal(h.repository.build.state,"RESEARCH_READY");assertComparison(diagnostic(children(h.repository)[0]));
  const restored=setup({repository:new MemoryRepository(clone(h.repository.build),clone([...h.repository.operations.values()])),provider:async(request,ordinal)=>{
    assert.equal(ordinal,1);assert.equal(request.user.adjudicationOrdinal,2);return adjudication("world_state");
  }});
  assert.equal((await restored.result()).build.state,"EDITORIAL_COMPILED");assert.equal(restored.requests.length,1);
  assert.equal(children(restored.repository).length,2);
});

for(const failOrdinal of [1,2]) test(`unknown outcome at ordinal ${failOrdinal} blocks reconciliation without recalling settled calls`,async()=>{
  const h=setup({provider:async(_request,ordinal)=>{if(ordinal===failOrdinal)throw new Error("unknown provider outcome");return adjudication("ambiguous");}});
  await assert.rejects(h.result(),e=>e.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED");
  assert.equal(h.repository.build.state,"RESEARCH_READY");assert.equal(children(h.repository).at(-1).state,"OUTCOME_UNCERTAIN");
  const restored=setup({repository:new MemoryRepository(clone(h.repository.build),clone([...h.repository.operations.values()]))});
  await assert.rejects(restored.result(),e=>e.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED");assert.equal(restored.requests.length,0);
});

test("historical failed contracts cannot be reinterpreted or revived",async()=>{
  const h=setup();h.repository.build.state="FAILED";
  h.repository.build.snapshot.contractVersions.creatorScriptResearchEditorialCoordinator="0.19E2A";
  const frozen=JSON.stringify(h.repository.build);
  await assert.rejects(h.result(),/CONTRACT_MISMATCH/u);assert.equal(h.requests.length,0);assert.equal(JSON.stringify(h.repository.build),frozen);
});

test("unsafe primary downgrade never receives abstention recovery",async()=>{
  const h=setup();const initial={...claim,claimType:"RESEARCH_FINDING",propositionKind:"original_research_result",origin:{attributedEntity:null,referencedWork:"Research work"},claimId:"proposal-item-1"};
  const items=[{claim:initial,evidenceSelections:[]}];let calls=0;
  const recovery=createCreatorScriptBuildEditorialRecoveryContext({repository:h.repository,build:h.repository.build,parentOperationId:"test-parent",assertAuthority:async()=>{}}).context;
  await assert.rejects(contract.recoverCreatorScriptBuildEditorialAdjudication({proposal:{items},items,initialClaims:[initial],authority:{claims:[initial]},recovery,
    adjudicate:async()=>{calls++;return adjudication("world_state");}}),e=>e.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID");
  assert.equal(calls,1);assert.equal(children(h.repository).length,1);
  assert.equal(children(h.repository)[0].resultReference.outcome.recoverable,false);
});

for(const [name,response] of [
  ["abstention with unrelated origin change",adjudication("ambiguous",{attributedEntity:"Invented entity",referencedWork:null})],
  ["malformed first adjudication",{claims:[]}],
]) test(`${name} does not qualify for corrective retry`,async()=>{
  const h=setup({provider:async()=>clone(response)});
  await assert.rejects(h.result(),e=>e.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID");
  assert.equal(h.requests.length,2);assert.equal(children(h.repository).length,1);
  assert.equal(h.repository.build.state,"FAILED");
});

test("diagnostic artifacts exclude unrelated provider internals",async()=>{
  const h=setup({provider:async()=>({claims:[{...adjudication("ambiguous").claims[0],internalToken:"secret-synthetic-sentinel"}],internalPayload:"secret-synthetic-sentinel"})});
  await assert.rejects(h.result(),e=>e.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID");
  const artifacts=JSON.stringify([...h.repository.operations.values()]);
  assert.ok(!artifacts.includes("secret-synthetic-sentinel"));
  assert.equal(children(h.repository).length,1);
  const d=diagnostic(children(h.repository)[0]);assert.equal(d.comparisons[0].claimText,claim.text);
});

test("retry identities bind build, item, ordinal, authority, and rejection reason",async()=>{
  const step={kind:"adjudication",ordinal:2,authority:{claims:[{...claim,claimId:"proposal-item-1"}],sources:[{sourceId:"source-1"}],candidateSpans:[{spanId:"span-1",text:"Evidence"}]},priorRejection:{rejectionReason:"ambiguous"}};
  const id=async(options={})=>{
    const h=setup();if(options.buildId)h.repository.build.buildId=options.buildId;
    const context=createCreatorScriptBuildEditorialRecoveryContext({repository:h.repository,build:h.repository.build,parentOperationId:"parent",assertAuthority:async()=>{}}).context;
    await context.runStep(options.step || clone(step),async operationId=>({operationId}));
    return children(h.repository)[0].operationId;
  };
  const original=await id();assert.equal(await id(),original);
  assert.notEqual(await id({buildId:"40000000-0000-4000-8000-000000000003"}),original);
  for(const mutate of [
    s=>{s.ordinal=1;},s=>{s.authority.claims[0].claimId="proposal-item-2";},
    s=>{s.authority.claims[0].text="Changed claim";},s=>{s.authority.candidateSpans[0].text="Changed evidence";},
    s=>{s.authority.sources[0].sourceId="changed-source";},s=>{s.priorRejection.rejectionReason="other-rejection";},
  ]) {const changed=clone(step);mutate(changed);assert.notEqual(await id({step:changed}),original);}
});

test("replayed recoverable flag cannot authorize unrelated authority disagreement",async()=>{
  const h=setup();const transition=h.repository.transitionOperation.bind(h.repository);
  h.repository.transitionOperation=async input=>{const result=await transition(input);
    if(input.resultReference?.outcome?.rejection?.adjudicationOrdinal===1)throw new CreatorScriptBuildCoordinatorBlockedError({code:"SIMULATED_CRASH",buildId});
    return result;
  };
  await assert.rejects(h.result(),e=>e.code === "SIMULATED_CRASH");
  const operations=clone([...h.repository.operations.values()]);
  operations.find(o=>o.operationType === "creator_editorial_adjudication_attempt").resultReference.outcome.adjudication=adjudication("expert_synthesis");
  const restored=setup({repository:new MemoryRepository(clone(h.repository.build),operations)});
  await assert.rejects(restored.result(),e=>e.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID");
  assert.equal(restored.requests.length,0);
});

for(const unknown of [false,true]) test(`actual responses.create editorial requests disable SDK retries; unknown=${unknown}`,async()=>{
  const requests=[];
  class FakeOpenAI {responses={create:async(request,options)=>{
    requests.push({request:clone(request),options:clone(options)});
    assert.equal(options.maxRetries,0);
    const user=JSON.parse(request.input[1].content);
    if(request.text.format.name === "creator_script_build_editorial_proposal")return {output_text:JSON.stringify({items:[{claim,evidenceSelections:[{sourceId:"source",spanId:"span",stance:"supports",contextNote:null}]}]})};
    if(unknown)throw new Error("synthetic unknown outcome");
    return {output_text:JSON.stringify(adjudication(user.adjudicationOrdinal===2?"world_state":"ambiguous"))};
  }};}
  const provider={};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/creator/creatorScriptBuildProviders.server.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:provider,process:{env:{OPENAI_API_KEY:"inert-test-only"}},require:name=>{
      if(name === "node:crypto")return require(name);
      if(name === "openai")return {default:FakeOpenAI};
      if(name === "./creatorScriptBuildProviderContract.ts")return contract;
      if(name === "./creatorScriptBuildResearchEditorialCoordinator.ts")return {CreatorScriptBuildStageExecutionError};
      if(name === "../research/claimEvidenceGraph.ts")return graph;
      if(name === "../economics/index.ts")return {recordOpenAITextEconomics:async()=>{}};
      return {};
    },
  });
  const h=setup();const recovery=createCreatorScriptBuildEditorialRecoveryContext({repository:h.repository,build:h.repository.build,parentOperationId:"parent",assertAuthority:async()=>{}}).context;
  const value={version:"0.19E2A-editorial-request-v1",topic:"memory",creatorProfile:{},sources:[{sourceId:"source"}],sourceResearchPurposes:{},candidateSpans:[{sourceId:"source",spanId:"span",text:"Memory contributes to identity.",evidenceSpecificity:"concrete_observation"}]};
  const execute=()=>provider.executeCreatorScriptBuildEditorialProposalProvider({ownerId,projectId,value,recovery});
  if(unknown){await assert.rejects(execute(),e=>e.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED");assert.equal(requests.length,2);
    await assert.rejects(execute(),e=>e.code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED");assert.equal(requests.length,2);
  }else{assert.equal((await execute()).proposal.items[0].claim.propositionKind,"world_state");assert.equal(requests.length,3);
    await execute();assert.equal(requests.length,3);}
});

test("full claim comparison survives bounded failure diagnostics without truncation",async()=>{
  const text="Memory contributes to identity. ".repeat(30).trim();assert.ok(text.length>600);
  const h=setup({claim:{...claim,text},provider:async()=>adjudication("ambiguous")});
  await assert.rejects(h.result(),e=>e.code === "CREATOR_SCRIPT_BUILD_CLAIM_ORIGIN_ADJUDICATION_INVALID");
  for(const attempt of children(h.repository))assert.equal(diagnostic(attempt).comparisons[0].claimText,text);
  const referenced=h.repository.operations.get(h.repository.build.failure.diagnostics.adjudicationOperationId);
  assert.equal(diagnostic(referenced).comparisons[0].claimText,text);
});
