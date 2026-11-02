import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createJiti} from 'jiti';
import {createResearchClaimEvidenceGraph} from '../lib/research/claimEvidenceGraph.ts';
import {createEditorialScriptContext} from '../lib/research/editorialScriptContext.ts';
import {parseCreatorProfile} from '../lib/creator/creatorProfile.ts';
import {normalizeScriptPlannerEditorialContext as normalize,createScriptPlannerGroundingDiagnostics as diagnostics,createScriptPlannerGenerationGroundingGate as gate,createCounterEvidenceReview as review,applyCounterEvidenceScopeReview as applyWithSnapshot} from '../lib/research/scriptPlannerEditorialContext.ts';
import {runCreatorEditorialScriptPipeline} from '../lib/research/creatorEditorialPipeline.client.ts';
import {createCreatorScript,createCreatorScriptNarrationEditorialContext,createCreatorScriptSectionBudgetPlan,createCreatorScriptNarrationControlPlan} from '../lib/creator/creatorScript.ts';
import {prepareCreatorLongFormSectionPlanForAvailableEvidence} from '../lib/research/creatorLongFormEvidenceReadiness.ts';
import {issue44EvidenceFixture} from './fixtures/creator-issue-44-evidence.mjs';
import {createOfflineScriptPlanHarness} from './fixtures/creator-script-plan-offline-harness.mjs';
const f=issue44EvidenceFixture();
const sourceSnapshots=new WeakMap();
const make=(fixture=f)=>{
 const graph=createResearchClaimEvidenceGraph(fixture);
 const raw=createEditorialScriptContext({profile:parseCreatorProfile(null),graph,sourceAssessments:fixture.assessments});
 const context=normalize(raw);sourceSnapshots.set(context,graph);return{graph,raw,context};
};
// Positive tests use the exact original fixture graph; never manufacture a
// source summary from the excerpt being validated.
const apply=(context,decision)=>applyWithSnapshot(context,decision,sourceSnapshots.get(context)||graph);
const {graph,raw,context}=make();const original=JSON.stringify(context);
const diag=diagnostics(context);
assert.equal(diag.claimCount,4);assert.equal(diag.evidenceCount,7);assert.equal(diag.nonemptyExcerptCount,7);assert.deepEqual(diag.missingExcerptEvidenceIds,[]);
assert.deepEqual(gate(context).reasonCodes,['MATERIAL_COUNTER_EVIDENCE_REVIEW']);
assert.equal(diag.primaryEvidenceCount,0);assert.equal(diag.primaryCoverageApplicable,true);
assert.deepEqual(diag.primaryCoveredClaimIds,['claim-4']);assert.deepEqual(diag.claimRelativePrimaryEvidenceIds,['evidence-7']);
assert.deepEqual(diag.primaryCoverageByClaim,[{claimId:'claim-4',evidenceIds:['evidence-7'],basis:['CLAIM_RELATIVE_PRIMARY_SUPPORT']}]);
assert.equal(diag.sourceClassificationCounts.primary,0,'claim-relative document evidence never upgrades global source classification');

if(process.argv.includes('--baseline')) {
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'issue44-exact-production-'));
 try {
  const load=async name=>{
   const file=path.join(directory,name);
   const base=execFileSync('git',['show',`d44ab5d8b713d14e57408f026487a6dc13eec015:lib/research/${name}`],{encoding:'utf8'});
   fs.writeFileSync(file,base.replace(/from "(\.[^"]+)"/g,(_,specifier)=>`from "${new URL(specifier,new URL('../lib/research/'+name,import.meta.url)).pathname}"`));
   return import(pathToFileURL(file).href);
  };
  const baselinePipeline=await load('creatorEditorialPipeline.client.ts');
  const baselineSource=await load('sourceAssessment.ts');
  let prompted=0,scriptPosts=0;
  const baselineHarness=await createOfflineScriptPlanHarness();
  await assert.rejects(()=>baselinePipeline.runCreatorEditorialScriptPipeline({accessToken:'synthetic',topic:'Synthetic 2055/2075 documentary',scriptPlanRequest:{operation:'generate_full_script',durationSec:600,language:'en'},onCounterEvidenceReview:async()=>{prompted++;return null;},fetchImpl:async(url,init)=>{
   const body=JSON.parse(init.body);
   if(url.endsWith('creator-research'))return Response.json({success:true,sources:f.sources});
   if(url.endsWith('creator-editorial-analysis'))return Response.json({success:true,graph,readiness:raw.readiness,scriptContext:raw});
   if(body.operation==='validate_generation_authority')return Response.json({success:true});
   scriptPosts++;return baselineHarness.execute({body,editorialContext:normalize(body.scriptContext)});
  }}),error=>error.code==='CREATOR_SCRIPT_GROUNDING_BLOCKED');
  assert.equal(prompted,0);assert.equal(scriptPosts,1);assert.equal(baselineHarness.calls.length,0);
  assert.equal(baselineSource.researchSourceIsPrimaryForClaim(f.sources[8],{...f.claims[3],propositionKind:'original_research_result'}),true);
  console.log('ISSUE_44_BASELINE_REPRODUCED=PASS: 4 claims / 7 excerpts / material review / no review workflow / zero provider calls');
  console.log('ISSUE_44_BASELINE_SECONDARY_REPORT_ORIGINAL_STUDY_QUALIFICATION=REPRODUCED');
 } finally {fs.rmSync(directory,{recursive:true,force:true});}
 process.exit(0);
}

const report=review(context);assert.deepEqual(report.unresolvedClaimIds,['claim-2','claim-3']);
assert(report.claims.every(claim=>claim.outcome==='context_only_not_counterevidence'));
const decision={snapshotFingerprint:report.snapshotFingerprint,excludedClaimIds:report.unresolvedClaimIds,rationale:'Omit unverified generalization and prediction; preserve the observed trial and exact attribution.',confirmed:true};
const scoped=apply(context,decision);
assert.equal(gate(scoped).eligible,true);assert.equal(scoped.claims.length,2);
assert.equal(JSON.stringify(context),original);assert.deepEqual(scoped.counterEvidenceReview.originalContext,context);
assert.deepEqual(scoped.evidence,context.evidence);assert.deepEqual(scoped.sources,context.sources);
assert.deepEqual(normalize(JSON.parse(JSON.stringify(scoped))),scoped,'server normalization must rederive the exact reviewed scope');
assert.deepEqual(normalize(scoped).counterEvidenceReview.originalContext.claims,context.claims);
assert.throws(()=>apply(context,{...decision,confirmed:false}),/UNCONFIRMED/);
assert.throws(()=>apply(context,{...decision,snapshotFingerprint:'old-snapshot'}),/STALE/);
assert.throws(()=>applyWithSnapshot(context,decision,null),/SNAPSHOT_REQUIRED/);
const unowned=structuredClone(graph);unowned.sources[0].summary='A different source passage.';
assert.throws(()=>applyWithSnapshot(context,decision,unowned),/EXCERPT_OWNERSHIP_UNVERIFIED/);
const mismatched=structuredClone(graph);mismatched.claims[0].text+=' Changed.';
assert.throws(()=>applyWithSnapshot(context,decision,mismatched),/SNAPSHOT_MISMATCH/);
assert(context.evidence.every(e=>e.locator.timecodeStartSec===null));
assert.deepEqual(normalize(context),context,'normalization must never fabricate zero-second locators');
assert.throws(()=>apply({...context,evidence:context.evidence.map((e,i)=>i?e:{...e,excerpt:e.excerpt+' Changed.'})},decision),/STALE|SNAPSHOT_MISMATCH/);
assert.throws(()=>apply(context,{...decision,excludedClaimIds:['claim-2']}),/UNRESOLVED:claim-3/);
assert.throws(()=>apply(context,{...decision,excludedClaimIds:['claim-4']}),/NOT_UNRESOLVED/);
assert.throws(()=>apply(context,{...decision,excludedClaimIds:['claim-2','claim-2']}),/DECISION_INVALID/);
assert.throws(()=>apply(scoped,decision),/ALREADY_APPLIED/);
for(const mutate of [value=>{value.claims[0].text+=' A fabricated fact.';},value=>{value.claims.push({...context.claims[2],claimType:'THOUGHT_EXPERIMENT'});},value=>{value.sources[0].directness='primary';},value=>{value.evidence[0].excerpt='Fabricated quotation.';}]){
 const forged=structuredClone(scoped);mutate(forged);assert.throws(()=>normalize(forged),/PROJECTION_MISMATCH/);
}
const nested=structuredClone(scoped);nested.counterEvidenceReview.originalContext.counterEvidenceReview=scoped.counterEvidenceReview;
assert.throws(()=>normalize(nested),/NESTED_SNAPSHOT/);
// Matching a secondary report's URL is NOT original-study provenance.
const secondaryStudy=structuredClone(f);secondaryStudy.claims[3].propositionKind='original_research_result';secondaryStudy.claims[3].claimType='RESEARCH_FINDING';
const unverifiedStudy=make(secondaryStudy).context;assert(gate(unverifiedStudy).reasonCodes.includes('PRIMARY_SOURCE_COVERAGE_REQUIRED'));
assert.deepEqual(diagnostics(unverifiedStudy).primaryMissingClaimIds,['claim-4']);
const verifiedStudy=structuredClone(secondaryStudy);verifiedStudy.sources[8].adapterId='academic';verifiedStudy.sources[8].mediaKind='paper';verifiedStudy.assessments[8].directness='primary';
const verified=make(verifiedStudy);assert.deepEqual(diagnostics(verified.context).primaryCoveredClaimIds,['claim-4']);
const withInitial=applyWithSnapshot(verified.context,{...decision,snapshotFingerprint:review(verified.context).snapshotFingerprint},verified.graph,make(secondaryStudy).graph);
assert.deepEqual(withInitial.counterEvidenceReview.initialResearchSnapshot,make(secondaryStudy).graph,'the original snapshot must survive legitimate primary augmentation');
assert.deepEqual(normalize(withInitial),withInitial);

const forecastPrimary=structuredClone(secondaryStudy);forecastPrimary.claims[3].claimType='FORECAST';
const pinned=make(forecastPrimary).context;assert.equal(review(pinned).claims.find(c=>c.claimId==='claim-4').canExclude,false);
assert.throws(()=>apply(pinned,{...decision,snapshotFingerprint:review(pinned).snapshotFingerprint,excludedClaimIds:review(pinned).unresolvedClaimIds}),/PRIMARY_OBLIGATION_RETAINED/);
// A real counter-finding remains a contradicts link, never a relabelled limit.
const conflicting=structuredClone(f);conflicting.evidence[4].excerpt='In a synthetic follow-up trial, researchers observed three failures, contradicting the prediction of success on every tested task.';
conflicting.sources[4].summary=conflicting.evidence[4].excerpt;
conflicting.links.find(link=>link.evidenceId==='evidence-5').stance='contradicts';
const withCounter=make(conflicting).context;assert.deepEqual(review(withCounter).unresolvedClaimIds,['claim-3']);
const keepCounter=apply(withCounter,{...decision,snapshotFingerprint:review(withCounter).snapshotFingerprint,excludedClaimIds:['claim-3']});
assert.deepEqual(keepCounter.claims.find(c=>c.claimId==='claim-2').counterEvidenceIds,['evidence-5']);assert(gate(keepCounter).eligible);
const noCounter=structuredClone(f);noCounter.links=noCounter.links.filter(link=>link.stance!=='contextualizes');
assert(review(make(noCounter).context).claims.every(c=>c.outcome==='no_counterevidence_in_snapshot'));
const imagined=structuredClone(f);imagined.claims[2]={...imagined.claims[2],claimType:'THOUGHT_EXPERIMENT',text:'Imagine, hypothetically, different AI institutions in 2055 and 2075; this is not a prediction.'};
assert.deepEqual(review(make(imagined).context).unresolvedClaimIds,['claim-2']);
const basisFixture=structuredClone(f);basisFixture.claims=basisFixture.claims.filter(c=>c.claimId==='claim-3');basisFixture.links=basisFixture.links.filter(l=>l.claimId==='claim-3');const noBasis=make(basisFixture).context;
assert.throws(()=>apply(noBasis,{...decision,snapshotFingerprint:review(noBasis).snapshotFingerprint,excludedClaimIds:['claim-3']}),/NO_FACTUAL_SCRIPT_BASIS/);
// Pause the actual client once. Its original request/snapshot stays unchanged.
const request={operation:'generate_full_script',projectId:'offline-owned-project',expectedProjectUpdatedAt:'synthetic-cas',strategyFingerprint:'offline-strategy',durationSec:600,language:'en',topic:'Synthetic documentary with imagined 2055/2075 scenarios'};
const harness=await createOfflineScriptPlanHarness();let reviewCount=0;let handoff;
const fakeFetch=async(url,init)=>{
 const body=JSON.parse(init.body);
 if(url==='/api/creator-research')return Response.json({success:true,sources:f.sources});
 if(url==='/api/creator-editorial-analysis')return Response.json({success:true,graph,readiness:raw.readiness,scriptContext:raw});
 assert.equal(url,'/api/creator-script-plan');
 if(body.operation==='validate_generation_authority')return Response.json({success:true});
 handoff=body.scriptContext;
 return harness.execute({body,editorialContext:normalize(body.scriptContext)});
};
// The existing deterministic provider stub is repetitive and deliberately fails
// final prose acceptance. We inspect actual all-six section dispatches, not claim
// authenticated production or accepted documentary prose.
await runCreatorEditorialScriptPipeline({accessToken:'synthetic-never-sent',topic:request.topic,scriptPlanRequest:request,fetchImpl:fakeFetch,onCounterEvidenceReview:async r=>{reviewCount++;return{...decision,snapshotFingerprint:r.snapshotFingerprint};}}).catch(error=>assert.equal(error.stage,'script_plan'));
assert.equal(reviewCount,1);assert(handoff.counterEvidenceReview);assert.deepEqual(handoff.counterEvidenceReview.originalContext,context);assert.deepEqual(handoff.counterEvidenceReview.originalResearchSnapshot,graph);assert.deepEqual(handoff.counterEvidenceReview.initialResearchSnapshot,graph);
const calls=harness.calls.filter(call=>call.body.requestedSectionBudgets);assert.equal(calls.length,6);
const narration=createCreatorScriptNarrationEditorialContext(scoped);assert.equal(narration.counterEvidenceReview,undefined);
assert(narration.evidence.every(e=>!['evidence-3','evidence-4','evidence-5','evidence-6'].includes(e.evidenceId)));
const plan=prepareCreatorLongFormSectionPlanForAvailableEvidence({context:narration,plan:createCreatorScriptSectionBudgetPlan({targetDurationSec:600,language:'en',hasMaterialCounterview:false}),sectionNative:true});
for(const call of calls){assert.deepEqual(call.body.editorialSectionPlan,JSON.parse(JSON.stringify(createCreatorScriptNarrationControlPlan(plan.plan))));assert(call.body.allowedClaimIds.every(id=>!decision.excludedClaimIds.includes(id)));assert(!JSON.stringify(call.body.editorialContext).includes('inevitably'));assert.equal(call.body.editorialContext.counterEvidenceReview,undefined);}
const imaginedContext=make(imagined).context;
const imaginedScope=apply(imaginedContext,{...decision,snapshotFingerprint:review(imaginedContext).snapshotFingerprint,excludedClaimIds:['claim-2']});
const imaginedHarness=await createOfflineScriptPlanHarness();await imaginedHarness.execute({body:request,editorialContext:imaginedScope});
const imaginedCalls=imaginedHarness.calls.filter(call=>call.body.requestedSectionBudgets);assert.equal(imaginedCalls.length,6);
assert(imaginedCalls.some(call=>call.body.editorialContext.claims.some(claim=>claim.claimId==='claim-3'&&claim.claimType==='THOUGHT_EXPERIMENT')));
assert(imaginedCalls.every(call=>call.request.input[0].content.includes('explicitly hypothetical')));
const originalRequest=JSON.stringify(request);
for(const mode of ['stop','stale','partial']){
 let dispatched=0;let active=true;let reviewCalls=0;
 await assert.rejects(()=>runCreatorEditorialScriptPipeline({accessToken:'synthetic',topic:request.topic,scriptPlanRequest:request,operationIsCurrent:()=>active,fetchImpl:async(url,init)=>{
  const body=JSON.parse(init.body);if(url.endsWith('creator-research'))return Response.json({success:true,sources:f.sources});if(url.endsWith('creator-editorial-analysis'))return Response.json({success:true,graph,readiness:raw.readiness,scriptContext:raw});if(body.operation==='validate_generation_authority')return Response.json({success:true});dispatched++;throw Error('UNEXPECTED_SCRIPT_DISPATCH');
 },onCounterEvidenceReview:async r=>{reviewCalls++;if(mode==='stop')return null;if(mode==='stale')active=false;return{...decision,snapshotFingerprint:r.snapshotFingerprint,excludedClaimIds:mode==='partial'?['claim-2']:decision.excludedClaimIds};}}),error=>['EDITORIAL_REVIEW_STOPPED','EDITORIAL_REVIEW_STALE','EDITORIAL_REVIEW_UNRESOLVED'].includes(error.code));
 assert.equal(dispatched,0);assert.equal(reviewCalls,1);assert.equal(JSON.stringify(request),originalRequest);
}
const blockedHarness=await createOfflineScriptPlanHarness();const blocked=await blockedHarness.execute({body:request,editorialContext:context});const blockedPayload=await blocked.json();assert.deepEqual(blockedPayload.unresolvedClaimIds,['claim-2','claim-3']);assert.equal(blockedHarness.calls.length,0);
// Exercise the actual authenticated API branch with synthetic auth only.
// Legacy scene planning must never bypass unresolved grounding either.
const legacyHarness=await createOfflineScriptPlanHarness({includePost:true,authenticatedUserId:'synthetic-owner'});
const legacyRequest=(scriptContext)=>new Request('http://offline.invalid/api/creator-script-plan',{method:'POST',headers:{authorization:'Bearer synthetic-never-sent','content-type':'application/json'},body:JSON.stringify({productionPackage:{title:'Synthetic package',scenes:[]},durationSec:600,scriptContext})});
const legacyBlocked=await legacyHarness.post(legacyRequest(context));assert.equal(legacyBlocked.status,422);
assert.deepEqual((await legacyBlocked.json()).unresolvedClaimIds,['claim-2','claim-3']);assert.equal(legacyHarness.calls.length,0);
const primaryBlocked=await legacyHarness.post(legacyRequest(unverifiedStudy));assert.equal(primaryBlocked.status,422);assert((await primaryBlocked.json()).reasonCodes.includes('PRIMARY_SOURCE_COVERAGE_REQUIRED'));assert.equal(legacyHarness.calls.length,0);
const altered=structuredClone(scoped);altered.claims[0].text+=' Fabricated.';
assert.equal((await legacyHarness.post(legacyRequest(altered))).status,400);assert.equal(legacyHarness.calls.length,0);
const regenHarness=await createOfflineScriptPlanHarness();
const existingScript=createCreatorScript({title:'Synthetic existing draft',targetDurationSec:600,strategyFingerprint:request.strategyFingerprint,generatedAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',grounding:{context},sections:['opening','body','conclusion'].map((kind,index)=>({id:`section-${index+1}`,kind,heading:'Synthetic',text:'A bounded synthetic statement.',claimIds:['claim-1'],evidenceReviewRequired:true}))});
const regeneration=await regenHarness.execute({body:{...request,operation:'regenerate_section',targetSectionId:'section-2',creatorScript:existingScript},editorialContext:scoped});
assert.equal(regeneration.status,409);assert.equal((await regeneration.json()).code,'CREATOR_SCRIPT_REGENERATION_GROUNDING_MISMATCH');assert.equal(regenHarness.calls.length,0,'a ready request cannot launder a different unreviewed script context');
const rhetoric=structuredClone(f);rhetoric.sources[5].summary='Some commentators disagree rhetorically without supplying observations or an alternative tested explanation.';rhetoric.evidence[5].excerpt=rhetoric.sources[5].summary;
assert(gate(make(rhetoric).context).reasonCodes.includes('MATERIAL_COUNTER_EVIDENCE_REVIEW'),'mere rhetorical context is never promoted to contradictory evidence');
// Render the actual dialog without mounting effects or opening any browser.
const jiti=createJiti(import.meta.url,{fsCache:false,jsx:{runtime:'automatic'},alias:{'@':new URL('..',import.meta.url).pathname}});
const React=await jiti.import('react');const {renderToStaticMarkup}=await jiti.import('react-dom/server');
const {CreatorCounterEvidenceReview}=await jiti.import('../components/create/CreatorCounterEvidenceReview.tsx');
const html=renderToStaticMarkup(React.createElement(CreatorCounterEvidenceReview,{review:report,onDecision:()=>{throw Error('RENDER_CANNOT_APPROVE');}}));
assert(html.includes('disabled=""'));assert(!html.includes('checked=""'));assert(html.includes('Context and limitations'));assert(html.includes('Stop — research unresolved claims'));
assert(!JSON.stringify(harness.logs).includes(f.evidence[0].excerpt),'diagnostic logs never dump evidence passages');
assert(!fs.readFileSync('components/create/CreatorCounterEvidenceReview.tsx','utf8').includes('fetch('));
// Real route authority helper, with only a synthetic read-only owner repository.
const {readCreatorProjectState}=await jiti.import('../lib/creator/projectState.ts');
const saved=readCreatorProjectState({});saved.brief.topic=request.topic;saved.brief.language='en';saved.brief.durationSec=600;saved.strategy.strategyFingerprint=request.strategyFingerprint;
const syntheticProject={id:request.projectId,flow_type:'creator_lab',updated_at:request.expectedProjectUpdatedAt,exported_movie_result:{creatorProjectState:saved}};
let reads=0;
const owned=await createOfflineScriptPlanHarness({readProjectForOwner:async(id,owner)=>{reads++;return id===syntheticProject.id&&owner==='synthetic-owner'?syntheticProject:null;}});
const authorityRequest={...request,topicAuthority:request.topic,selectedDirectionId:saved.strategy.selectedDirectionId,selectedHook:saved.strategy.selectedHook};
assert.equal((await owned.authority(authorityRequest,'synthetic-owner')).ok,true);
assert.equal((await owned.authority(authorityRequest,'foreign-owner')).reason,'project_missing');
const stale=await owned.authority({...authorityRequest,expectedProjectUpdatedAt:'stale-revision'},'synthetic-owner');assert.equal(stale.ok,false);assert.equal(stale.matches.revision,false);assert.equal(reads,3);assert.equal(owned.calls.length,0);

console.log('ISSUE_44_ALL_EXCERPTS_PRESENT_REVIEW_BLOCK_REPRODUCED=PASS');
console.log('ISSUE_44_OWNER_SCOPE_REVIEW_PRIMARY_PROVENANCE_AND_SIX_SECTION_HANDOFF=PASS');
console.log('No auth/provider/DB/media operations. Deterministic requests exercise section dispatch; final model prose acceptance is not claimed.');
