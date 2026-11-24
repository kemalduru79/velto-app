import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import { issue44EvidenceFixture } from './fixtures/creator-issue-44-evidence.mjs';
import { createResearchClaimEvidenceGraph } from '../lib/research/claimEvidenceGraph.ts';
import { createEditorialScriptContext } from '../lib/research/editorialScriptContext.ts';
import { parseCreatorProfile } from '../lib/creator/creatorProfile.ts';
import { normalizeScriptPlannerEditorialContext, createCounterEvidenceReview } from '../lib/research/scriptPlannerEditorialContext.ts';
import { runCreatorEditorialScriptPipeline } from '../lib/research/creatorEditorialPipeline.client.ts';
const fixture=issue44EvidenceFixture();
fixture.sources=fixture.sources.filter(s=>['source-3','source-4'].includes(s.sourceId));
fixture.sources[0].summary='The study was limited to experienced open-source developers.';fixture.sources[1].summary='Verification was only a possible explanation.';
fixture.claims=fixture.claims.filter(c=>['claim-2','claim-3'].includes(c.claimId)).map(c=>({...c,claimType:'EDITORIAL_INFERENCE',text:c.claimId==='claim-2'?fixture.sources[0].summary:'Verification caused the entire slowdown.'}));
fixture.evidence=fixture.evidence.filter(e=>['evidence-3','evidence-4'].includes(e.evidenceId)).map(e=>({...e,excerpt:fixture.sources.find(s=>s.sourceId===e.sourceId).summary}));fixture.links=fixture.links.filter(l=>['evidence-3','evidence-4'].includes(l.evidenceId));fixture.assessments=fixture.assessments.filter(a=>['source-3','source-4'].includes(a.sourceId));
const graph=createResearchClaimEvidenceGraph(fixture);const raw=createEditorialScriptContext({profile:parseCreatorProfile(null),graph,sourceAssessments:fixture.assessments});const context=normalizeScriptPlannerEditorialContext(raw);const review=createCounterEvidenceReview(context,new Set(['claim-2']));
assert.deepEqual(review.unresolvedClaimIds,['claim-3']);
const digest='a'.repeat(64);const request={operation:'generate_full_script',projectId:'project',durationSec:180};
const jiti=createJiti(import.meta.url,{fsCache:false,jsx:{runtime:'automatic'},alias:{'@':new URL('..',import.meta.url).pathname}});const component=(await jiti.import('../components/create/CreatorCounterEvidenceReview.tsx')).CreatorCounterEvidenceReview;
let calls, active, options, shown, projected;
async function run(config={}) {
 calls={eval:0,generation:0,research:0};active=true;shown=null;projected=null;options={...request};
 const fetchImpl=async(url,init)=>{const body=JSON.parse(init.body);
  if(url==='/api/creator-research'){calls.research++;return Response.json({success:true,sources:fixture.sources});}
  if(url==='/api/creator-editorial-analysis')return Response.json({success:true,graph,readiness:raw.readiness,scriptContext:raw,sourceAuthoritySnapshotDigest:config.noSnapshot?null:digest});
  if(url==='/api/creator-evidence-evaluation'){
   calls.eval++;if(config.stale){active=false;}if(config.projectChange)options.projectId='other';
   if(config.failure)return Response.json({success:false,code:'EVIDENCE_AUTHORITY_UNAVAILABLE'},{status:422});
   const scoped=Boolean(body.scopeDecision);const revised=scoped?{...context,claims:context.claims.filter(c=>c.claimId!=='claim-3')}:context;
   const r=scoped?createCounterEvidenceReview(revised,new Set(['claim-2'])):config.noUnresolved?{...review,claims:[],unresolvedClaimIds:[]}:review;
   return Response.json({success:true,projectId:'project',snapshotDigest:digest,researchRevision:scoped&&config.revisionChange?2:1,readiness:{status:'review'},review:r,verifiedLimitationClaimIds:['claim-2'],blockingReasons:config.primaryBlock?['PRIMARY_SOURCE_COVERAGE_REQUIRED']:scoped||config.noUnresolved?[]:['MATERIAL_COUNTER_EVIDENCE_REVIEW'],...(scoped?{proposedScope:revised}:{})});
  }
  if(url==='/api/creator-script-plan'&&body.operation==='validate_generation_authority')return Response.json({success:true});
  if(url==='/api/creator-script-plan'){calls.generation++;projected=body.scriptContext;return Response.json({success:true});}
  throw Error('Unexpected network request');
 };
 return runCreatorEditorialScriptPipeline({accessToken:'synthetic-token',topic:'Synthetic study',scriptPlanRequest:options,operationIsCurrent:()=>active,fetchImpl,onCounterEvidenceReview:async r=>{shown=r;return {snapshotFingerprint:r.snapshotFingerprint,excludedClaimIds:['claim-3'],rationale:'Exclude unsupported causal assertion.',confirmed:true};}});
}
await run();assert.equal(calls.eval,2);assert.equal(calls.generation,1);assert.deepEqual(shown.unresolvedClaimIds,['claim-3']);assert(projected.claims.some(c=>c.claimId==='claim-2'));assert(!projected.claims.some(c=>c.claimId==='claim-3'));assert(projected.evidence.some(e=>e.evidenceId==='evidence-3'));
const html=renderToStaticMarkup(React.createElement(component,{review:shown,onDecision:()=>{}}));assert(html.includes('claim-3'));assert(!html.includes('claim-2'));assert(html.includes('Verification'));
await run({noUnresolved:true});assert.equal(calls.eval,1);assert.equal(calls.generation,1);assert.equal(shown,null);
for(const config of [{stale:true},{projectChange:true},{failure:true},{noSnapshot:true},{primaryBlock:true},{revisionChange:true}]) {await assert.rejects(()=>run(config));assert.equal(calls.generation,0);}
console.log('EVIDENCE_REVIEW_ACTUAL_PIPELINE=PASS');
