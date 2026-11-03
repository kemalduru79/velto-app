import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {issue42EvidenceFixture} from './fixtures/creator-issue-42-evidence.mjs';
import {createValidatedEditorialAnalysisWithOneRepair,createEditorialGroundingCandidateSpans} from '../lib/research/editorialGroundingRepair.ts';
import {createEditorialScriptContext} from '../lib/research/editorialScriptContext.ts';
import {normalizeScriptPlannerEditorialContext,createScriptPlannerGroundingDiagnostics} from '../lib/research/scriptPlannerEditorialContext.ts';
import {parseCreatorProfile} from '../lib/creator/creatorProfile.ts';
import {createCreatorScriptSectionBudgetPlan} from '../lib/creator/creatorScript.ts';
import {createCreatorLongFormEvidenceReadiness,prepareCreatorLongFormSectionPlanForAvailableEvidence} from '../lib/research/creatorLongFormEvidenceReadiness.ts';
const baseline=process.argv.includes('--baseline');
const f=issue42EvidenceFixture(), before=JSON.stringify(f);let repairs=0;
let validate=createValidatedEditorialAnalysisWithOneRepair;
let baselineDir;
if(baseline){
  baselineDir=await fs.mkdtemp(path.join(os.tmpdir(),'issue42-production-baseline-'));
  const original=execFileSync('git',['show','be0dda7eaf6debc2d996eaa5d90c7095b32cde2d:lib/research/editorialGroundingRepair.ts'],{encoding:'utf8'});
  const research=new URL('../lib/research/',import.meta.url).pathname;
  const modulePath=path.join(baselineDir,'editorialGroundingRepair.ts');
  await fs.writeFile(modulePath,original.replace(/from "\.\//g,`from "${research}`));
  validate=(await import(pathToFileURL(modulePath).href)).createValidatedEditorialAnalysisWithOneRepair;
}
const graph=await validate({sources:f.sources,proposal:f.proposal,repair:async input=>{repairs++;assert.equal(input.invalidEvidence.length,1);assert.equal(input.invalidEvidence[0].evidenceId,'evidence-8');assert(input.candidateSpans.every(s=>s.sourceId==='source-8'));return{repairs:[{evidenceId:'evidence-8',spanId:input.candidateSpans[0].spanId}]};}});
assert.equal(repairs,1);assert.equal(JSON.stringify(f),before);
const raw=createEditorialScriptContext({profile:parseCreatorProfile(null),graph,sourceAssessments:f.assessments});
const context=normalizeScriptPlannerEditorialContext(JSON.parse(JSON.stringify(raw)));
const diagnostics=createScriptPlannerGroundingDiagnostics(context);
const plan=createCreatorScriptSectionBudgetPlan({targetDurationSec:600,language:'en',hasMaterialCounterview:context.claims.some(c=>c.counterEvidenceIds.length>0)});
const readiness=createCreatorLongFormEvidenceReadiness({context,plan,sectionNative:true});
assert.equal(diagnostics.evidenceCount,8);assert.equal(diagnostics.claimCount,6);assert.equal(diagnostics.groundingStatus,'review');assert.deepEqual(diagnostics.blockingReasons,['MATERIAL_COUNTER_EVIDENCE_REVIEW']);assert.equal(diagnostics.primaryEvidenceCount,0);assert.equal(diagnostics.primaryCoverageRatio,1);assert.equal(plan.length,6);
if(baseline){assert.equal(diagnostics.canonicalSpanCount,1);assert.deepEqual(readiness.reasonCodes,['missing_grounded_demonstration_capability']);console.log('ISSUE_42_BASELINE_REPRODUCED: 8 evidence / 1 excerpt / material review / missing demonstration');}
else {assert.equal(diagnostics.canonicalSpanCount,8,'all selected excerpts must survive one-item repair');assert(!readiness.reasonCodes.includes('missing_grounded_demonstration_capability'));console.log('ISSUE_42_REPAIRED_EXCERPTS=PASS');}
// Earlier attempt: ready graph with six excerpt-backed, non-empirical facts but no uncertainty.
const spans=createEditorialGroundingCandidateSpans(f.sources);
const earlier={...context,readiness:{...context.readiness,status:'ready',reviewReasons:[]},claims:context.claims.slice(0,4).map(c=>({...c,claimType:'FACT',counterEvidenceIds:[],contextualEvidenceIds:[]})),evidence:graph.evidence.slice(0,6).map((e)=>({...e,excerpt:spans.find(s=>s.sourceId===e.sourceId).text.replace(/In this synthetic trial.*/, 'Synthetic source discusses the policy relationship without an empirical observation.')}))};
const earlierPlan=createCreatorScriptSectionBudgetPlan({targetDurationSec:600,language:'en',hasMaterialCounterview:false}).map(s=>s.id==='section-3'?{...s,ownershipBoundary:{...s.ownershipBoundary,owns:['grounded_synthesis','evidence_interpretation']}}:s);
assert.deepEqual(createCreatorLongFormEvidenceReadiness({context:earlier,plan:earlierPlan,sectionNative:true}).reasonCodes,['missing_uncertainty_capability']);assert.equal(prepareCreatorLongFormSectionPlanForAvailableEvidence({context:earlier,plan:earlierPlan,sectionNative:true}).finalReadiness.eligible,true);
console.log('ISSUE_42_EARLIER_READY_UNCERTAINTY_REPRODUCED=PASS');
if(baselineDir)await fs.rm(baselineDir,{recursive:true,force:true});

if(!baseline){
 const {createScriptPlannerGenerationGroundingGate:gate}=await import('../lib/research/scriptPlannerEditorialContext.ts');
 const {installCanonicalEditorialEvidenceSpans:install}=await import('../lib/research/editorialGroundingRepair.ts');
 const {createCreatorEvidenceUnits,buildCreatorSectionEvidencePromptPack}=await import('../lib/research/creatorEvidencePack.ts');
 const {createCreatorScriptNarrationEditorialContext}=await import('../lib/creator/creatorScript.ts');
 const {createOfflineScriptPlanHarness}=await import('./fixtures/creator-script-plan-offline-harness.mjs');
 const harness=await createOfflineScriptPlanHarness();
 const request={operation:'generate_full_script',durationSec:600,language:'en',strategyFingerprint:'offline-strategy',topic:'AI policy with explicitly imagined 2055 and 2075 scenarios',title:'Synthetic documentary'};
 const snapshot=JSON.stringify({context,request});
 const blocked=await harness.execute({body:request,editorialContext:context});
 assert.equal(blocked.status,422);const blockedBody=await blocked.json();
 assert(blockedBody.reasonCodes.includes('MATERIAL_COUNTER_EVIDENCE_REVIEW'));
 assert(blockedBody.nextActions.includes('review_material_counter_evidence'));assert.equal(harness.calls.length,0);
 const forged={...context,readiness:{...context.readiness,status:'ready',reviewReasons:[]}};
 assert(gate(forged).reasonCodes.includes('MATERIAL_COUNTER_EVIDENCE_REVIEW'),'removing client review metadata cannot auto-approve a forecast');
 assert.equal(JSON.stringify({context,request}),snapshot,'blocked route preserves all drafts and canonical inputs');
 assert.equal(diagnostics.primaryEvidenceCount,0);assert.equal(diagnostics.primaryCoverageApplicable,false,'ratio=1 is vacuous when no primary obligations exist');
 // Legacy/partial contexts never gain capability from empty IDs-only authority.
 const partial={...earlier,evidence:earlier.evidence.map(e=>({...e,excerpt:e.evidenceId==='evidence-1'?e.excerpt:null}))};
 const missing=gate(partial);assert(missing.reasonCodes.includes('EVIDENCE_EXCERPTS_REQUIRED'));assert(missing.missingExcerptEvidenceIds.length>0);
 assert(createCreatorEvidenceUnits(partial).every(u=>[...u.supportingEvidence,...u.counterEvidence,...u.contextualEvidence].every(e=>e.excerpt)));
 const allEmpty={...partial,evidence:partial.evidence.map(e=>({...e,excerpt:'  '}))};
 assert.equal(createCreatorEvidenceUnits(allEmpty).length,0);
 assert.equal(prepareCreatorLongFormSectionPlanForAvailableEvidence({context:allEmpty,plan:earlierPlan,sectionNative:true}).finalReadiness.eligible,false);
 assert.equal((await harness.execute({body:request,editorialContext:partial})).status,422);assert.equal(harness.calls.length,0);
 // Duplicate/cross-source identities stay fail-closed and cannot be reattributed.
 const candidates=createEditorialGroundingCandidateSpans(f.sources);
 assert.throws(()=>install({proposal:f.proposal,candidateSpans:[...candidates,candidates[0]]}),/CANDIDATE_SPAN_ID_DUPLICATE/);
 const validProposal=structuredClone(f.proposal);validProposal.evidence[7].spanId='span-8-1';
 assert.throws(()=>install({proposal:{...validProposal,evidence:[validProposal.evidence[0],{...validProposal.evidence[0],evidenceId:'duplicate-span'}]},candidateSpans:candidates}),/EVIDENCE_SPAN_DUPLICATE/);
 assert.throws(()=>install({proposal:f.proposal,candidateSpans:candidates}),/SPAN_SOURCE_MISMATCH/);
 await assert.rejects(()=>validate({sources:f.sources,proposal:f.proposal,repair:async()=>({repairs:[{evidenceId:'evidence-1',spanId:'span-1-1'}]})}),/REPAIR_UNEXPECTED_EVIDENCE/);
 let capped=0;
 await assert.rejects(()=>validate({sources:f.sources,proposal:f.proposal,repair:async()=>{capped++;return{repairs:[{evidenceId:'evidence-8',spanId:'span-1-1'}]};}}),/REPAIR_SPAN_MISSING/);assert.equal(capped,1);
 const missingSelection=structuredClone(validProposal);delete missingSelection.evidence[0].spanId;
 const recovered=await validate({sources:f.sources,proposal:missingSelection,requireSpanSelections:true,repair:async()=>({repairs:[{evidenceId:'evidence-1',spanId:'span-1-1'}]})});
 assert.equal(recovered.evidence.filter(e=>e.excerpt).length,8);
 const once=await validate({sources:f.sources,proposal:validProposal,requireSpanSelections:true,repair:async()=>{throw Error('UNNEEDED_REPAIR')}});
 assert.deepEqual(once.evidence,recovered.evidence,'canonical materialization is idempotent and preserves IDs');
 let noMaterialDispatch=0;
 await assert.rejects(()=>validate({sources:[{...f.sources[0],summary:null}],proposal:{claims:[],evidence:[{evidenceId:'empty',sourceId:'source-1'}],links:[]},requireSpanSelections:true,repair:async()=>{noMaterialDispatch++;}}),/NO_SOURCE_SPANS/);assert.equal(noMaterialDispatch,0);
 // Primary obligations and downgrade prevention remain unchanged.
 const primary=structuredClone(earlier);primary.claims[0]={...primary.claims[0],claimType:'PRIMARY_SOURCE_CLAIM',propositionKind:'document_assertion',origin:{attributedEntity:null,referencedWork:primary.sources[1].url}};
 primary.readiness.primarySourceRequiredClaimIds=[primary.claims[0].claimId];primary.readiness.primarySourceCoveredClaimIds=[];
 const primaryContext=normalizeScriptPlannerEditorialContext(primary);assert(gate(primaryContext).reasonCodes.includes('PRIMARY_SOURCE_COVERAGE_REQUIRED'));
 primary.claims[0].propositionKind='world_state';primary.claims[0].origin={attributedEntity:null,referencedWork:null};
 assert.throws(()=>normalizeScriptPlannerEditorialContext(primary),/PRIMARY_SOURCE_WORLD_STATE_INVALID/);
 // Concrete evidence after an abstract first binding must survive prompt budgets.
 const demonstrated={...earlier,claims:earlier.claims.map((c,i)=>i===0?{...c,supportingEvidenceIds:['evidence-1','evidence-2']}:c),evidence:earlier.evidence.map(e=>e.evidenceId==='evidence-2'?{...e,excerpt:f.sources[1].summary}:e)};
 const demoSection=plan.find(s=>s.id==='section-3');
 const pack=buildCreatorSectionEvidencePromptPack({context:demonstrated,section:demoSection,eligibleClaimIds:[demonstrated.claims[0].claimId]});
 assert.equal(pack.units[0].supportingEvidence[0].evidenceId,'evidence-2');
 // Hypothetical 2055/2075 material is never converted to FACT or primary evidence.
 const scenario={claimId:'scenario-2055-2075',claimType:'THOUGHT_EXPERIMENT',text:'Imagine hypothetical AI institutions in 2055 and 2075, not established predictions.',supportingEvidenceIds:[],counterEvidenceIds:[],contextualEvidenceIds:[]};
 const good={...earlier,claims:[...earlier.claims,scenario]};
 assert(createCreatorScriptNarrationEditorialContext(good).claims.some(c=>c.claimId===scenario.claimId&&c.claimType==='THOUGHT_EXPERIMENT'));
 assert.equal(gate(good).eligible,true);
 const goodBefore=JSON.stringify(good);
 await harness.execute({body:request,editorialContext:good});
 assert(harness.calls.length>0,'eligible adaptive evidence reaches the actual generation request');
 const initial=harness.calls.filter(c=>c.body.requestedSectionBudgets);
 assert.equal(initial.length,6,'actual section-native generation dispatches all six section requests');
 const expected=prepareCreatorLongFormSectionPlanForAvailableEvidence({context:createCreatorScriptNarrationEditorialContext(good),plan:createCreatorScriptSectionBudgetPlan({targetDurationSec:600,language:'en',hasMaterialCounterview:false}),sectionNative:true});
 const {createCreatorScriptNarrationControlPlan}=await import('../lib/creator/creatorScript.ts');
 const controls=JSON.parse(JSON.stringify(createCreatorScriptNarrationControlPlan(expected.plan)));
 for(const call of initial){assert.deepEqual(call.body.editorialSectionPlan,controls);assert(call.request.input[0].content.includes('explicitly hypothetical'));for(const e of call.body.editorialContext.evidence)assert(e.excerpt);}
 assert.equal(JSON.stringify(good),goodBefore);
 // A control-only source cannot qualify a narrated empirical demonstration.
 const controlOnly={...demonstrated,claims:[...demonstrated.claims,context.claims[4]],sources:demonstrated.sources.map(s=>s.sourceId==='source-2'?{...s,url:'https://thnkfirst.com/applied-inquiry/control'}:s)};
 const controlHarness=await createOfflineScriptPlanHarness();await controlHarness.execute({body:request,editorialContext:controlOnly});
 const controlInitial=controlHarness.calls.filter(c=>c.body.requestedSectionBudgets);assert(controlInitial.length>0);
 assert(controlInitial[0].body.editorialSectionPlan.find(s=>s.sectionId==='section-3').owns.includes('grounded_synthesis'));
 assert(controlInitial.every(c=>c.body.editorialContext.evidence.every(e=>e.sourceId!=='source-2')));
 const {runCreatorEditorialScriptPipeline}=await import('../lib/research/creatorEditorialPipeline.client.ts');
 const pipelineHarness=await createOfflineScriptPlanHarness();
 const draft={...request,projectId:'offline-project'};const originalDraft=JSON.stringify(draft);const handoffs=[];
 await assert.rejects(()=>runCreatorEditorialScriptPipeline({accessToken:'synthetic-token-never-sent',topic:request.topic,scriptPlanRequest:draft,fetchImpl:async(url,init)=>{
   const body=JSON.parse(init.body);
   if(url==='/api/creator-research')return Response.json({success:true,sources:f.sources});
   if(url==='/api/creator-editorial-analysis')return Response.json({success:true,graph,readiness:raw.readiness,scriptContext:raw});
   assert.equal(url,'/api/creator-script-plan');
   if(body.operation==='validate_generation_authority')return Response.json({success:true});
   handoffs.push(body.scriptContext);
   return pipelineHarness.execute({body,editorialContext:normalizeScriptPlannerEditorialContext(body.scriptContext)});
 }}),error=>error.code==='CREATOR_SCRIPT_GROUNDING_BLOCKED'&&error.message.includes('counter-evidence'));
 assert.equal(handoffs.length,1);assert.deepEqual(handoffs[0],raw,'real client handoff retains excerpts and review verbatim');
 assert.equal(pipelineHarness.calls.length,0);assert.equal(JSON.stringify(draft),originalDraft,'client failure never replaces the draft');
 console.log('ISSUE_42_GATE_CAPABILITIES_PRIMARY_SCENARIOS_AND_ACTUAL_GENERATION_HANDOFF=PASS');
 console.log('Offline provider responses exercise all section dispatches; synthetic repetitive prose is not claimed as an accepted production script. No auth, DB writes, external provider or media operations.');
}
