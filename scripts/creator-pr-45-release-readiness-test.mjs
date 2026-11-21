import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createResearchClaimEvidenceGraph} from '../lib/research/claimEvidenceGraph.ts';
import {createEditorialScriptContext} from '../lib/research/editorialScriptContext.ts';
import {parseCreatorProfile} from '../lib/creator/creatorProfile.ts';
import {normalizeScriptPlannerEditorialContext as normalize,createCounterEvidenceReview as review,applyCounterEvidenceScopeReview as apply,createScriptPlannerGenerationGroundingGate as gate} from '../lib/research/scriptPlannerEditorialContext.ts';
import {createCreatorScriptSectionBudgetPlan,createCreatorScriptNarrationEditorialContext,normalizeCreatorScript} from '../lib/creator/creatorScript.ts';
import {readCreatorProjectState} from '../lib/creator/projectState.ts';
import {prepareCreatorLongFormSectionPlanForAvailableEvidence as prepare} from '../lib/research/creatorLongFormEvidenceReadiness.ts';
import {issue44EvidenceFixture,issue44SupportedScopeFixture} from './fixtures/creator-issue-44-evidence.mjs';
import {createOfflineScriptPlanHarness} from './fixtures/creator-script-plan-offline-harness.mjs';

const reviewedSha='4f48029f7c51c3c32ee365b210647dd02e54ea2c';
const productionSha='d44ab5d8b713d14e57408f026487a6dc13eec015';
// Load the exact historical pure modules, including their historical authority
// dependencies. Other imports resolve to unchanged repository code. No runtime,
// credentials, browser, database or provider is involved.
async function withRevision(revision,names,run) {
  const root=new URL('..',import.meta.url).pathname;
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pr45-readonly-'));
  try {
    for(const name of names) {
      const target=path.join(directory,name);fs.mkdirSync(path.dirname(target),{recursive:true});
      const source=execFileSync('git',['show',`${revision}:${name}`],{encoding:'utf8'});
      fs.writeFileSync(target,source.replace(/from "(\.[^"]+)"/g,(_,specifier)=>{
        const relative=path.relative(root,path.resolve(root,path.dirname(name),specifier));
        return `from "${path.join(names.includes(relative)?directory:root,relative)}"`;
      }));
    }
    await run(name=>import(pathToFileURL(path.join(directory,name)).href));
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
}
const make=(fixture)=>{
  const graph=createResearchClaimEvidenceGraph(fixture);
  const context=normalize(createEditorialScriptContext({profile:parseCreatorProfile(null),graph,sourceAssessments:fixture.assessments}));
  return {context,graph};
};
const scope=fixture=>{
  const {context,graph}=make(fixture);
  return apply(context,{snapshotFingerprint:review(context).snapshotFingerprint,excludedClaimIds:review(context).unresolvedClaimIds,rationale:'Omit unsupported assertions, preserving source-backed factual premises.',confirmed:true},graph);
};
const plan=createCreatorScriptSectionBudgetPlan({targetDurationSec:600,language:'en',hasMaterialCounterview:false});
assert.equal(plan.length,6);
const sparse=scope(issue44EvidenceFixture());const bytes=JSON.stringify(sparse);
const sparseNarration=createCreatorScriptNarrationEditorialContext(sparse);
const input={context:sparseNarration,plan,sectionNative:true};
if(process.argv.includes('--baseline')) {
  await withRevision(reviewedSha,['lib/research/creatorLongFormEvidenceReadiness.ts'],async load=>{
    const baseline=await load('lib/research/creatorLongFormEvidenceReadiness.ts');
    assert.equal(baseline.prepareCreatorLongFormSectionPlanForAvailableEvidence(input).finalReadiness.eligible,true);
    console.log('PR45_BASELINE_INSUFFICIENT_SCOPE_ACCEPTED=REPRODUCED (2 claims / 3 retained passages / 4 factual body sections)');
  });
} else {
  const result=prepare(input);assert.equal(result.finalReadiness.eligible,false);
  assert(result.finalReadiness.reasonCodes.includes('insufficient_factual_foundation'));
  assert.deepEqual(result.finalReadiness.factualFoundation,{requiredPassageCount:4,availablePassageCount:3});
  assert.deepEqual(result.adaptedSectionIds,[],'role adaptation cannot conceal a foundation deficit');
  const harness=await createOfflineScriptPlanHarness();
  const response=await harness.execute({body:{operation:'generate_full_script',durationSec:600,language:'en',strategyFingerprint:'synthetic',topic:'Synthetic'},editorialContext:sparse});
  const payload=await response.json();assert.equal(response.status,422);assert.equal(harness.calls.length,0);
  assert.deepEqual(payload.factualFoundation,{requiredPassageCount:4,availablePassageCount:3});
  assert(payload.error.includes('do not restore unresolved assertions'));
  assert(!JSON.stringify({logs:harness.logs,payload}).includes(sparse.evidence[0].excerpt),'diagnostics expose counts/IDs, not research passages');
  // Unused sources, a second evidence ID or mirrored passage, and imaginary
  // future narration cannot inflate the factual foundation.
  const duplicates=structuredClone(sparseNarration);
  duplicates.evidence.push({...duplicates.evidence[0],evidenceId:'duplicate-passage',sourceId:'a-mirror',excerpt:'  '+duplicates.evidence[0].excerpt.toUpperCase()+'  '});
  duplicates.claims[0].supportingEvidenceIds.push('duplicate-passage');
  assert.equal(prepare({...input,context:duplicates}).finalReadiness.factualFoundation.availablePassageCount,3);
  const imagined=structuredClone(sparseNarration);
  imagined.evidence.push({evidenceId:'imagined-evidence',sourceId:'imagined-source',excerpt:'Suppose a hypothetical institution exists in 2075.',contextNote:null,locator:{}});
  imagined.claims.push({claimId:'imagined',claimType:'THOUGHT_EXPERIMENT',text:'Imagine hypothetical 2055 and 2075 institutions.',supportingEvidenceIds:['imagined-evidence'],counterEvidenceIds:[],contextualEvidenceIds:[]});
  assert.equal(prepare({...input,context:imagined}).finalReadiness.eligible,false);
  const positive=scope(issue44SupportedScopeFixture());
  const positivePlan=prepare({...input,context:createCreatorScriptNarrationEditorialContext(positive)});
  assert.equal(positivePlan.finalReadiness.eligible,true);
  assert.deepEqual(positivePlan.finalReadiness.factualFoundation,{requiredPassageCount:4,availablePassageCount:5});
  // A real sourced forecast with documented opposition keeps its FORECAST
  // type. A date alone never reclassifies a researched prediction as fiction.
  const forecast=issue44SupportedScopeFixture();
  forecast.sources[5].summary='In a synthetic forecast comparison, the projected 2055 outcome failed under alternate institutional assumptions.';
  forecast.evidence[5].excerpt=forecast.sources[5].summary;
  forecast.links.find(link=>link.evidenceId==='evidence-6').stance='contradicts';
  const forecastScope=scope(forecast);
  assert.equal(forecastScope.claims.find(claim=>claim.claimId==='claim-3').claimType,'FORECAST');
  const forecastHarness=await createOfflineScriptPlanHarness();
  await forecastHarness.execute({body:{operation:'generate_full_script',durationSec:600,language:'en',strategyFingerprint:'synthetic',topic:'Synthetic actual forecast'},editorialContext:forecastScope});
  const forecastCalls=forecastHarness.calls.filter(call=>call.body.requestedSectionBudgets);
  assert.equal(forecastCalls.length,6);
  const routedForecasts=forecastCalls.flatMap(call=>call.body.editorialContext.claims.filter(claim=>claim.claimId==='claim-3'));
  assert(routedForecasts.length>0);assert(routedForecasts.every(claim=>claim.claimType==='FORECAST'&&claim.text===forecastScope.claims.find(item=>item.claimId==='claim-3').text));
  assert.equal(JSON.stringify(sparse),bytes,'readiness and diagnostics never mutate the reviewed context');
  console.log('PR45_FOUNDATION_FLOOR_AND_ZERO_PROVIDER_DISPATCH=PASS');
}

// Compatibility matrix: facts, exact document attribution, attributed speakers,
// globally primary original research, and already-primary-missing contexts.
for(const kind of ['document_assertion','attributed_statement','verified_study','primary_missing']) {
  const fixture=issue44EvidenceFixture();
  fixture.claims=[fixture.claims[3]];fixture.links=fixture.links.filter(link=>link.claimId==='claim-4');
  if(kind==='attributed_statement') {
    fixture.claims[0].propositionKind=kind;fixture.claims[0].origin={attributedEntity:fixture.sources[8].publisher,referencedWork:null};
  }
  if(kind==='verified_study'||kind==='primary_missing') {
    fixture.claims[0].claimType='RESEARCH_FINDING';fixture.claims[0].propositionKind='original_research_result';
    if(kind==='verified_study'){fixture.sources[8].adapterId='academic';fixture.sources[8].mediaKind='paper';fixture.assessments[8].directness='primary';}
    else fixture.claims[0].origin.referencedWork='An unavailable original study';
  }
  const {context}=make(fixture);assert.equal(gate(context).eligible,kind!=='primary_missing');assert.deepEqual(normalize(context),context);
}
const names=['lib/research/sourceAssessment.ts','lib/research/claimAuthorityResolver.ts','lib/research/topicEvidenceReadiness.ts','lib/research/editorialScriptContext.ts','lib/research/scriptPlannerEditorialContext.ts','lib/creator/creatorScript.ts','lib/creator/projectState.ts'];
await withRevision(productionSha,names,async load=>{
  const oldContext=await load('lib/research/editorialScriptContext.ts');
  const oldPlanner=await load('lib/research/scriptPlannerEditorialContext.ts');
  const oldScript=await load('lib/creator/creatorScript.ts');
  const oldProject=await load('lib/creator/projectState.ts');
  const fixture=issue44EvidenceFixture();fixture.claims=[{...fixture.claims[3],claimType:'RESEARCH_FINDING',propositionKind:'original_research_result'}];fixture.links=fixture.links.filter(link=>link.claimId==='claim-4');
  const graph=createResearchClaimEvidenceGraph(fixture);
  const context=oldPlanner.normalizeScriptPlannerEditorialContext(oldContext.createEditorialScriptContext({profile:parseCreatorProfile(null),graph,sourceAssessments:fixture.assessments}));
  assert.equal(context.readiness.status,'ready');
  const script=oldScript.approveCreatorScript(oldScript.createCreatorScript({title:'Synthetic legacy approved script',targetDurationSec:600,strategyFingerprint:'synthetic',grounding:{context},generatedAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',sections:['opening','body','conclusion'].map((kind,i)=>({id:`section-${i}`,kind,text:'Synthetic preserved text.',claimIds:['claim-4'],evidenceReviewRequired:false}))}),'synthetic','2026-01-01T00:00:00Z');
  const state=oldProject.readCreatorProjectState({});state.strategy.script=script;
  const project={id:'synthetic',exported_movie_result:{creatorProjectState:state}};
  assert(oldProject.readCreatorProjectState(project).strategy.script);
  const original=JSON.stringify(project);
  assert.throws(()=>normalize(context),/PRIMARY_AUTHORITY_MISMATCH/);
  assert.throws(()=>normalizeCreatorScript(script),/CREATOR_SCRIPT_INVALID/);
  const compatible=readCreatorProjectState(project);
  assert.deepEqual(compatible.strategy.script?.approval,script.approval,'Historical approval is retained, not renewed.');
  assert.deepEqual(compatible.strategy.script?.sections.map(section=>section.text),script.sections.map(section=>section.text));
  assert.throws(()=>normalizeCreatorScript(compatible.strategy.script),/CREATOR_SCRIPT_INVALID/,'New generation still requires current primary authority.');
  assert.equal(JSON.stringify(project),original);
  console.log('PR45_LEGACY_APPROVED_PROJECT_READ_COMPATIBILITY=PASS (current strict authority unchanged)');
});
console.log('PR45_READONLY_COMPATIBILITY_MATRIX=PASS; live population impact and source truth remain unverified.');
