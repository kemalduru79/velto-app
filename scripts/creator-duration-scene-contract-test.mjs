import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolveCreatorSourceSceneConfiguration as resolve,reconcileCreatorSceneDurations} from '../lib/creator/creatorScriptSceneConfiguration.ts';
import {createOfflineScriptPlanHarness} from './fixtures/creator-script-plan-offline-harness.mjs';
import {createIntegratedFixture,ownerId} from './fixtures/creator-integrated-workflow.mjs';
import {createCreatorScript,normalizeCreatorScript} from '../lib/creator/creatorScript.ts';
const scenes=n=>Array.from({length:n},(_,i)=>({id:i+1,text:'Synthetic source '+i,narration:'Synthetic source narration only.',dialogue:''}));
const request=b=>new Request('http://synthetic.local/api/creator-script-plan',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:JSON.stringify(b)});
const responder=body=>({status:'completed',output_text:JSON.stringify({scenes:body.sourceScenes.map((s,i)=>({...s,narration:Array.from({length:body.sceneBudgets[i].targetWords},(_,n)=>n===0?'Synthetic':'fixture').join(' '),dialogue:''}))})});
const options={includePost:true,authenticatedUserId:'synthetic-owner',sceneResponder:responder};
// Optional before-image reproduction requires local Git history. The normal
// regression does not depend on history being included in a CI checkout.
if(process.env.VELTO_VERIFY_SCENE_BASELINE==='1'){
 const baseline=await createOfflineScriptPlanHarness({...options,sourceText:execFileSync('git',['show','ba55a5bdc65d9016f88f65b6411de35c9acbff97:app/api/creator-script-plan/route.ts'],{encoding:'utf8',maxBuffer:1024*1024})});
 await baseline.post(request({durationSec:4000,sceneCount:37,format:'youtube_video',productionPackage:{scenes:scenes(37)}}));
 assert(baseline.calls.length>0);assert.equal(baseline.calls[0].body.sourceScenes.length,36);assert.equal(baseline.calls[0].body.sceneBudgets.reduce((n,s)=>n+s.targetDurationSec,0),1080);
 console.log('BEFORE_SILENT_CLAMP_REPRODUCED=37 scenes/4000 seconds became 36 scenes/1080 budget seconds before provider dispatch');
}
for(const body of [
 {durationSec:4000,sceneCount:36,productionPackage:{scenes:scenes(36)}},
 {durationSec:600,sceneCount:37,productionPackage:{scenes:scenes(37)}},
 {durationSec:600,sceneCount:36,productionPackage:{scenes:scenes(37)}},
 {durationSec:600,sceneCount:35,productionPackage:{scenes:scenes(36)}},
 {durationSec:600,sceneCount:35.5,productionPackage:{scenes:scenes(36)}},
 {durationSec:'600',sceneCount:36,productionPackage:{scenes:scenes(36)}},
 {durationSec:2400,sceneCount:36,productionPackage:{scenes:scenes(36)}},
 {durationSec:100,sceneCount:36,productionPackage:{scenes:scenes(36)}},
]){
 const h=await createOfflineScriptPlanHarness(options),before=JSON.stringify(body),r=await h.post(request({...body,format:'youtube_video'}));assert.equal(r.status,422);assert.equal((await r.json()).providerDispatched,false);assert.equal(h.calls.length,0);assert.equal(JSON.stringify(body),before);
}
for(const [durationSec,count] of [[600,36],[720,36],[900,36],[600,30]]){
 const h=await createOfflineScriptPlanHarness(options),body={durationSec,sceneCount:count,format:'youtube_video',productionPackage:{scenes:scenes(count),preservedMetadata:'synthetic'}};
 const r=await h.post(request(body));assert.equal(r.status,200);const out=await r.json();assert.equal(out.productionPackage.durationSec,durationSec);assert.equal(out.productionPackage.scenes.length,count);assert.equal(out.productionPackage.preservedMetadata,'synthetic');assert(Math.abs(h.calls[0].body.sceneBudgets.reduce((n,s)=>n+s.targetDurationSec,0)-durationSec)<1e-7);
}
const denied=await createOfflineScriptPlanHarness(options);assert.equal((await denied.post(new Request('http://synthetic.local',{method:'POST',body:'{}'}))).status,401);assert.equal(denied.calls.length,0);
assert.equal(resolve({requestedDurationSec:undefined,packageDurationSec:600,requestedSceneCount:undefined,sourceSceneCount:36,format:'youtube_video'}).durationSec,600);
assert(Math.abs(reconcileCreatorSceneDurations(Array(36).fill(16.7),600,7,30).reduce((a,b)=>a+b,0)-600)<1e-7);
assert.throws(()=>reconcileCreatorSceneDurations([30,30],100,7,30),/allocator cannot preserve/);
// Historical duration remains readable, but cannot bypass present execution
// eligibility through section regeneration instead of full generation.
const historicalFixture=await createIntegratedFixture();
const advance={ownerId,buildId:historicalFixture.repository.build.buildId};
await historicalFixture.runtime.advance(advance);
const view=await historicalFixture.runtime.advance(advance),context=view.editorialReview.context;
const historical=createCreatorScript({title:'Synthetic historical duration',targetDurationSec:4000,strategyFingerprint:historicalFixture.snapshot.strategyFingerprint,generatedAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',grounding:{context},sections:['opening','body','conclusion'].map((kind,index)=>({id:'section-'+index,kind,text:'Synthetic retained narration.',claimIds:[context.claims.find(c=>c.supportingEvidenceIds.length>0).claimId],evidenceReviewRequired:false}))});
const beforeHistorical=JSON.stringify(historical);assert.equal(normalizeCreatorScript(historical).targetDurationSec,4000);
const regeneration=await createOfflineScriptPlanHarness();
const blocked=await regeneration.execute({body:{operation:'regenerate_section',creatorScript:historical,targetSectionId:'section-1',strategyFingerprint:historical.strategyFingerprint},editorialContext:context});
assert.equal(blocked.status,400);assert.equal((await blocked.json()).code,'CREATOR_SCRIPT_DURATION_INVALID');assert.equal(regeneration.calls.length,0);assert.equal(JSON.stringify(historical),beforeHistorical);historicalFixture.preservation();
console.log('SOURCE_SCENE_API_CONTRACT=PASS; explicit resource errors, complete source sequence, unchanged requested duration, exact allocation total, unauthorized dispatch blocked; synthetic Auth/providers only');
