import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createIntegratedFixture,syntheticResearch,boundedRetainedResearch,ownerId} from './fixtures/creator-integrated-workflow.mjs';
import {geopoliticalTestProposal} from './fixtures/creator-geopolitical-fiction-draft.mjs';
import {runCreatorScriptBuildV2} from '../lib/creator/creatorScriptBuildClient.ts';
import {createCreatorScriptSectionBudgetPlan,normalizeCreatorScript,normalizeHistoricalCreatorScript,getCreatorScriptDurationContractForScript} from '../lib/creator/creatorScript.ts';
import {createScriptEvidenceBindingMap} from '../lib/research/scriptEvidenceBinding.ts';
import {createScriptQaReport} from '../lib/research/scriptEvidenceQa.ts';
import {generationInputFromCheckpoint} from '../lib/creator/creatorScriptBuildScriptGenerationCoordinator.ts';
import {createScriptPlannerGenerationGroundingGate} from '../lib/research/scriptPlannerEditorialContext.ts';
import {issue44EvidenceFixture} from './fixtures/creator-issue-44-evidence.mjs';
import {createResearchClaimEvidenceGraph} from '../lib/research/claimEvidenceGraph.ts';
import {createEditorialScriptContext} from '../lib/research/editorialScriptContext.ts';
import {parseCreatorProfile} from '../lib/creator/creatorProfile.ts';
const decision=view=>({reviewId:view.reviewId,confirmed:true,excludedClaimIds:[],rationale:'Synthetic explicit review interaction; fixture authority only.',storyStructure:'geopolitical_fiction_2055_2075_v1'});
const pause=async f=>{const input={ownerId,buildId:f.repository.build.buildId};await f.runtime.advance(input);const view=await f.runtime.advance(input);assert.equal(view.state,'AUTHORITY_RESOLVED');assert(view.editorialReview);return view.editorialReview;};
const request=(f,body,token='synthetic')=>f.api.post(new Request('http://fixture.local/api/creator-script-build',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));

// Fresh draft research never needs to renew an obsolete historical approval.
// Corrupted historical records remain blocked by the same project reader.
const legacy=issue44EvidenceFixture();
legacy.claims=[{...legacy.claims[3],claimType:'RESEARCH_FINDING',propositionKind:'original_research_result'}];
legacy.links=legacy.links.filter(l=>l.claimId===legacy.claims[0].claimId);
const oldContext=createEditorialScriptContext({profile:parseCreatorProfile(null),graph:createResearchClaimEvidenceGraph(legacy),sourceAssessments:legacy.assessments});
oldContext.readiness={...oldContext.readiness,status:'ready',reviewReasons:[],primarySourceCoveredClaimIds:[legacy.claims[0].claimId]};
const historical={version:1,title:'Synthetic historical Revision-2',sections:['opening','body','conclusion'].map((kind,i)=>({id:'old-'+i,kind,text:'Synthetic historical narration preserved verbatim.',claimIds:[legacy.claims[0].claimId],evidenceReviewRequired:false})),targetDurationSec:540,strategyFingerprint:'legacy-strategy',revision:2,grounding:{context:oldContext},generatedAt:'2026-11-04T18:00:00.000Z',updatedAt:'2026-11-04T18:00:00.000Z',approval:{approvedRevision:2,approvedStrategyFingerprint:'legacy-strategy',approvedAt:'2026-11-04T18:01:00.000Z'}};
assert.throws(()=>normalizeCreatorScript(historical),/CREATOR_SCRIPT_INVALID/);
// Historical representation remains broader than new-generation eligibility.
const longerHistorical={...structuredClone(historical),targetDurationSec:4000};
assert.equal(normalizeHistoricalCreatorScript(longerHistorical).targetDurationSec,4000);
assert.throws(()=>createCreatorScriptSectionBudgetPlan({targetDurationSec:4000,language:'en'}),/valid target duration/);
const tooManyHistorical=structuredClone(longerHistorical);
tooManyHistorical.sections=Array.from({length:25},(_,i)=>({...historical.sections[1],id:'old-'+i,kind:i===0?'opening':i===24?'conclusion':'body'}));
assert.throws(()=>normalizeHistoricalCreatorScript(tooManyHistorical),/CREATOR_SCRIPT_SECTIONS_INVALID/);
const preserved=await createIntegratedFixture({mutateProject:p=>{p.exported_movie_result.creatorProjectState.strategy.script=structuredClone(historical);}});
const freshView=await pause(preserved);
assert(!freshView.claims.some(c=>c.text===legacy.claims[0].text));
assert.deepEqual(preserved.project.exported_movie_result.creatorProjectState.strategy.script,historical);preserved.preservation();
await assert.rejects(()=>createIntegratedFixture({mutateProject:p=>{p.exported_movie_result.creatorProjectState.strategy.script=structuredClone(historical);p.exported_movie_result.creatorProjectState.strategy.script.sections[0].claimIds=['forged'];}}),/PROJECT_STATE_INVALID|SCRIPT_INVALID/);

// The actual owner read/snapshot/controller/runtime/coordinators are used with
// synthetic Auth, in-memory persistence and deterministic providers. Never live.
const f=await createIntegratedFixture({scriptProvider:geopoliticalTestProposal});
const unknown=await request(f,{action:'start'},'invalid');assert.equal(unknown.status,401);
const badStart=await request(f,{action:'start',projectId:f.project.id,expectedProjectUpdatedAt:f.project.updated_at,strategyFingerprint:'incorrect',draftOnly:true});assert.equal(badStart.status,409);assert.equal(f.repository.build.state,'REQUESTED');
let reviews=0, authorityBefore;
const result=await runCreatorScriptBuildV2({accessToken:'synthetic',projectId:f.project.id,expectedProjectUpdatedAt:f.project.updated_at,strategyFingerprint:f.snapshot.strategyFingerprint,fetchImpl:f.fetchImpl,draftOnly:true,onEditorialReview:async view=>{
 reviews++;authorityBefore=JSON.stringify(f.repository.build.checkpoints.authority);assert.equal(f.calls.generation,0);assert.equal(view.claims.length,14);assert.equal(view.context.claims.filter(c=>c.claimType==='THOUGHT_EXPERIMENT').length,7);assert.equal(view.fictionPlan.length,5);assert.equal(view.fictionReadiness.eligible,true);return decision(view);
}});
assert.equal(reviews,1);assert.equal(JSON.stringify(f.repository.build.checkpoints.authority),authorityBefore);assert.equal(result.state,'ACCEPTED');assert.equal(result.disposition,'DRAFT_READY');
const script=normalizeCreatorScript(result.creatorScript);assert.equal(script.sections.length,5);assert.equal(script.targetDurationSec,540);assert.equal(script.strategyFingerprint,f.snapshot.strategyFingerprint);assert.equal(script.approval,null);
assert(script.sections.every(s=>s.evidenceReviewRequired===false));
assert(script.sections[0].text.includes('not a prediction'));
assert(script.sections[3].text.includes('not an achievement'));
assert(script.sections[4].text.endsWith('who truly wins?'));
const replay=generationInputFromCheckpoint(f.repository.build);
assert.deepEqual(replay.sectionPlan,createCreatorScriptSectionBudgetPlan({targetDurationSec:540,language:'en',storyStructure:decision({reviewId:'unused'}).storyStructure}));
assert.deepEqual(replay.editorialContext,script.grounding.context);
assert.equal(createScriptPlannerGenerationGroundingGate(script.grounding.context).eligible,true);
assert.equal(f.calls.generation,1);assert.equal(f.calls.repair,0);f.preservation();
assert.equal(f.repository.build.state,'ACCEPTED','draft must not claim project installation');
const withoutFlag=await request(f,{action:'advance',buildId:f.repository.build.buildId,editorialReviewDecision:replay.editorialReviewDecision});
assert.equal(withoutFlag.status,200);assert.equal(withoutFlag.body.disposition,'DRAFT_READY');f.preservation();
const untampered=structuredClone(f.repository.build.checkpoints.script_generation.outputReference);
f.repository.build.checkpoints.script_generation.outputReference.result.editorialReviewDecision.rationale='Altered review rationale must not reuse an existing operation.';
assert.throws(()=>generationInputFromCheckpoint(f.repository.build),/OPERATION_INVALID/);
f.repository.build.checkpoints.script_generation.outputReference=untampered;


// No callback, cancellation, stale project, unconfirmed/tampered decision and
// concurrent state movement cannot authorize provider dispatch.
for(const mode of ['missing_callback','cancel','stale']){
 const x=await createIntegratedFixture();
 await assert.rejects(()=>runCreatorScriptBuildV2({accessToken:'synthetic',projectId:x.project.id,expectedProjectUpdatedAt:x.project.updated_at,strategyFingerprint:x.snapshot.strategyFingerprint,fetchImpl:x.fetchImpl,draftOnly:true,...(mode!=='missing_callback'?{onEditorialReview:async view=>{if(mode==='cancel')return null;x.project.updated_at='2026-11-06T20:00:02.000Z';return decision(view);}}:{})}),error=>/REVIEW_REQUIRED|REVIEW_STOPPED|PROJECT_STALE/.test(error.code));
 assert.equal(x.calls.generation,0);assert.equal(x.repository.projectWrites,0);
}
for(const mode of ['unconfirmed','altered_id','altered_strategy','altered_passage']){
 const x=await createIntegratedFixture(),view=await pause(x),d=decision(view);
 if(mode==='unconfirmed')d.confirmed=false;
 if(mode==='altered_id')d.reviewId='0'.repeat(64);
 if(mode==='altered_strategy')x.repository.build.snapshot.strategyFingerprint='changed';
 if(mode==='altered_passage')x.repository.build.checkpoints.authority.outputReference.result.graph.evidence[0].excerpt+=' unsupported alteration';
 const response=await request(x,{action:'advance',buildId:x.repository.build.buildId,editorialReviewDecision:d,draftOnly:true});
 assert(response.status>=400);assert.equal(x.calls.generation,0);x.preservation();
}

// A genuinely sourced forecast stays a forecast; context is not opposition.
for(const kind of ['FORECAST','EDITORIAL_INFERENCE']){
 const research=syntheticResearch();research.claims[0].claimType=kind;
 const x=await createIntegratedFixture({research}),view=await pause(x);
 assert(view.reasonCodes.includes('MATERIAL_COUNTER_EVIDENCE_REVIEW'));
 assert(view.claims.some(c=>c.claimType===kind));
 const response=await request(x,{action:'advance',buildId:x.repository.build.buildId,editorialReviewDecision:decision(view),draftOnly:true});
 assert.equal(response.status,422);assert.equal(x.calls.generation,0);x.preservation();
}
const sparse=syntheticResearch();sparse.claims=sparse.claims.filter(c=>c.claimType==='THOUGHT_EXPERIMENT'||c.claimId==='synthetic-fact-0');sparse.links=sparse.links.filter(l=>l.claimId==='synthetic-fact-0');
const thin=await createIntegratedFixture({research:sparse}),thinReview=await pause(thin);assert.equal(thinReview.fictionReadiness.eligible,false);assert(thinReview.fictionReadiness.reasonCodes.includes('insufficient_factual_foundation'));
const thinResult=await request(thin,{action:'advance',buildId:thin.repository.build.buildId,editorialReviewDecision:decision(thinReview),draftOnly:true});assert.equal(thinResult.status,422);assert.equal(thin.calls.generation,0);thin.preservation();

// Shared semantic rule: fiction is evidence-optional; mixed/factual and forecast
// requirements remain enforced, and primary obligations cannot be hidden in it.
const graph=syntheticResearch();
const bind=ids=>createScriptEvidenceBindingMap({graph,statements:[{statementId:'statement',sceneId:'scene',text:'Explicit fiction with bounded factual starting conditions.',evidenceMode:'required',claimIds:ids}]});
assert.equal(bind(['synthetic-fiction-0']).statements[0].traceabilityStatus,'not_required');
assert.equal(bind(['synthetic-fact-0','synthetic-fiction-0']).statements[0].traceabilityStatus,'traceable');
graph.links=graph.links.filter(l=>l.claimId!=='synthetic-fact-0');assert.equal(createScriptQaReport(bind(['synthetic-fact-0','synthetic-fiction-0'])).status,'blocked');
graph.claims.find(c=>c.claimId==='synthetic-fiction-0').claimType='FORECAST';assert.equal(createScriptQaReport(bind(['synthetic-fiction-0'])).status,'blocked');
for(const invalid of [4,3601,NaN])assert.throws(()=>createCreatorScriptSectionBudgetPlan({targetDurationSec:invalid,language:'en',storyStructure:'geopolitical_fiction_2055_2075_v1'}),/valid target duration/);
for(const duration of [479,601,900,1800]){
 const explicit=createCreatorScriptSectionBudgetPlan({targetDurationSec:duration,language:'en',storyStructure:'geopolitical_fiction_2055_2075_v1'});
 const automatic=createCreatorScriptSectionBudgetPlan({targetDurationSec:duration,language:'en'});
 assert.equal(explicit.length,5);assert.equal(explicit.reduce((n,s)=>n+s.targetWords,0),Math.round(duration*2.35));
 if(duration===900)assert.notEqual(automatic.length,5,'five is optional; existing generic count remains available');
}

// Optional authorized package integration stops at review. It never applies
// a synthetic approval to the owner's real source corpus or produces a draft.
if(process.env.VELTO_RETAINED_RESEARCH_PACKAGE){
 const file=process.env.VELTO_RETAINED_RESEARCH_PACKAGE,bytes=fs.readFileSync(file),p=JSON.parse(bytes);
 const integrity=JSON.parse(fs.readFileSync(new URL('./INTEGRITY.json','file://'+file)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),integrity.files['PROPOSED-EVIDENCE-PACKAGE.json']);
 const actual=await createIntegratedFixture({research:boundedRetainedResearch(p.graph)});const view=await pause(actual);
 assert.equal(view.claims.length,14);assert.equal(view.context.evidence.length,8);assert.equal(view.context.sources.length,7);assert.deepEqual(view.reasonCodes,[]);assert.equal(view.fictionPlan.length,5);assert.equal(view.fictionReadiness.eligible,true);assert.equal(actual.calls.generation,0);actual.preservation();
 console.log('RETAINED_PUBLIC_PACKAGE_TO_REAL_V2_REVIEW=PASS; NO OWNER APPROVAL APPLIED; REAL STRATEGY BINDING UNVERIFIED');
}
console.log('INTEGRATED_V2_CONTROLLER_TO_FIVE_SECTION_DRAFT=PASS; 540 seconds; explicit synthetic review; actual acceptance; zero project writes');
console.log('INVALID_EVIDENCE_STALE_REVIEW_FORECAST_FICTION_AND_PRESERVATION=PASS; Auth/DB/providers are test doubles; no real-provider acceptance claimed');

// User-reported current configuration: 600 seconds / English / long form /
// five connected fictional chapters. Auth, row and provider remain synthetic.
const ten=await createIntegratedFixture({targetDurationSec:600,scriptProvider:geopoliticalTestProposal});
assert.equal(ten.snapshot.requestedDurationSeconds,600);assert.equal(ten.snapshot.language,'en');assert.equal(ten.snapshot.strategy.format,'youtube_video');assert.equal(ten.snapshot.strategy.title,'2055 to 2075: The Rise of AI Empires');
let tenView;
const tenDraft=await runCreatorScriptBuildV2({accessToken:'synthetic',projectId:ten.project.id,expectedProjectUpdatedAt:ten.project.updated_at,strategyFingerprint:ten.snapshot.strategyFingerprint,fetchImpl:ten.fetchImpl,draftOnly:true,onEditorialReview:async v=>{tenView=v;assert.equal(v.durationSec,600);assert.equal(v.fictionPlan.length,5);assert.equal(v.fictionPlan.reduce((n,s)=>n+s.targetWords,0),1410);assert.equal(v.fictionReadiness.eligible,true);return decision(v);}});
assert.equal(tenDraft.disposition,'DRAFT_READY');const tenScript=normalizeCreatorScript(tenDraft.creatorScript);assert.equal(tenScript.sections.length,5);assert.equal(tenScript.targetDurationSec,600);assert.equal(getCreatorScriptDurationContractForScript(tenScript,'en').status,'compliant');assert.equal(tenScript.approval,null);
assert.deepEqual(generationInputFromCheckpoint(ten.repository.build).sectionPlan,tenView.fictionPlan);
assert.equal(createCreatorScriptSectionBudgetPlan({targetDurationSec:600,language:'en'}).length,6,'generic planning is unchanged; fiction requires explicit review choice');ten.preservation();
const staleTen=await createIntegratedFixture({targetDurationSec:600}),newView=await pause(staleTen);assert.notEqual(newView.reviewId,freshView.reviewId);
const cross=await request(staleTen,{action:'advance',buildId:staleTen.repository.build.buildId,editorialReviewDecision:decision(freshView),draftOnly:true});assert.equal(cross.status,422);assert.equal(staleTen.calls.generation,0);staleTen.preservation();
const shortTen=await createIntegratedFixture({targetDurationSec:600,scriptProvider:input=>geopoliticalTestProposal({...input,requestedDurationSeconds:540})});
await assert.rejects(()=>runCreatorScriptBuildV2({accessToken:'synthetic',projectId:shortTen.project.id,expectedProjectUpdatedAt:shortTen.project.updated_at,strategyFingerprint:shortTen.snapshot.strategyFingerprint,fetchImpl:shortTen.fetchImpl,draftOnly:true,onEditorialReview:async v=>decision(v)}));shortTen.preservation();
console.log('TEN_MINUTE_FIVE_CHAPTER_CONTROLLER_TO_DRAFT=PASS; 600-second budgets unchanged; undersized draft/stale review rejected; synthetic Auth/DB/providers; zero project writes');

const twelve=await createIntegratedFixture({targetDurationSec:720,scriptProvider:geopoliticalTestProposal});
let approvedPlan;
const twelveResult=await runCreatorScriptBuildV2({accessToken:'synthetic',projectId:twelve.project.id,expectedProjectUpdatedAt:twelve.project.updated_at,strategyFingerprint:twelve.snapshot.strategyFingerprint,fetchImpl:twelve.fetchImpl,draftOnly:true,onEditorialReview:async v=>{assert.equal(v.durationSec,720);approvedPlan=structuredClone(v.fictionPlan);return decision(v);}});
const twelveScript=normalizeCreatorScript(twelveResult.creatorScript);assert.equal(twelveScript.targetDurationSec,720);assert.equal(twelveScript.sections.length,5);assert.equal(getCreatorScriptDurationContractForScript(twelveScript,'en').status,'compliant');assert.deepEqual(generationInputFromCheckpoint(twelve.repository.build).sectionPlan,approvedPlan);twelve.preservation();
console.log('TWELVE_MINUTE_REVIEW_TO_ACCEPTED_DRAFT=PASS; exact approved roles and word budgets; synthetic Auth/DB/providers; zero project writes');
