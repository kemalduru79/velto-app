import assert from 'node:assert/strict';
import { runCreatorEditorialScriptPipeline } from '../lib/research/creatorEditorialPipeline.client.ts';

const digest = 'a'.repeat(64);
const graph = { sources:[], claims:[{claimId:'c1',propositionKind:'original_research_result',text:'Measured result'}], evidence:[], links:[] };
const context = { claims:[], evidence:[], sources:[] };
const review = { snapshotFingerprint:'synthetic', claims:[], unresolvedClaimIds:[] };

async function exercise(mode) {
  const calls = []; let statuses = 0; let notify; let resume;
  const paused = new Promise(resolve => { notify = resolve; });
  const release = new Promise(resolve => { resume = resolve; });
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({url,body});
    if (url === '/api/creator-research') return Response.json({success:true,sources:[{sourceId:'s1',url:'https://example.org'}]});
    if (url === '/api/creator-editorial-analysis') return Response.json({success:true,graph,sourceAuthoritySnapshotDigest:digest,scriptContext:context,readiness:{primarySourceRequiredClaimIds:['c1'],primarySourceCoveredClaimIds:[],reviewReasons:['PRIMARY_SOURCE_COVERAGE_REQUIRED']}});
    if (url === '/api/creator-editorial-primary-coverage') return Response.json({success:true,graph,sourceAuthoritySnapshotDigest:digest,scriptContext:context,excludedPrimaryClaimIds:['c1'],readiness:{primarySourceRequiredClaimIds:[],primarySourceCoveredClaimIds:[],reviewReasons:[]}});
    if (url === '/api/creator-evidence-evaluation' && body.operation === 'review_status') {
      statuses++;
      if (mode === 'stale') return Response.json({success:false,status:'STALE_RESEARCH'},{status:422});
      if (mode === 'invalid') return Response.json({success:true,projectId:'project',snapshotDigest:digest,researchRevision:1,status:'AUTHORITY_INVALID',requirements:[]});
      return Response.json({success:true,projectId:mode==='project'?'other':'project',snapshotDigest:mode==='snapshot'?'b'.repeat(64):digest,researchRevision:mode==='revision'&&statuses>1?2:1,status:statuses===1||mode==='unverified'?'REVIEW_REQUIRED':'REVIEW_COMPLETE',requirements:[{claimId:'c1',evidenceId:'e1',sourceId:'s1'}]});
    }
    if (url === '/api/creator-evidence-evaluation') return Response.json({success:true,projectId:'project',snapshotDigest:digest,researchRevision:1,review,blockingReasons:[]});
    if (url === '/api/creator-script-plan') return Response.json({success:true});
    throw Error(`unexpected ${url}`);
  };
  const callback = mode === 'missing' ? undefined : async pending => { assert.equal(pending.projectId,'project'); assert.equal(pending.snapshotDigest,digest); assert.equal(pending.researchRevision,1); notify(); await release; };
  const run = runCreatorEditorialScriptPipeline({accessToken:'synthetic',topic:'Synthetic',scriptPlanRequest:{projectId:'project'},operationIsCurrent:()=>true,fetchImpl,onParentSourceReview:callback});
  if (['ok','revision','unverified'].includes(mode)) {
    await paused;
    assert.equal(calls.filter(c=>c.url==='/api/creator-research').length,1);
    assert.equal(calls.filter(c=>c.url==='/api/creator-editorial-analysis').length,1);
    assert.equal(calls.filter(c=>c.url==='/api/creator-editorial-primary-coverage').length,0);
    assert.equal(calls.filter(c=>c.url==='/api/creator-script-plan').length,1); // preflight only
    resume();
  }
  if (mode === 'ok') {
    await run;
    assert.equal(statuses,3); // unchanged parent is revalidated after coverage
    assert.equal(calls.filter(c=>c.url==='/api/creator-editorial-analysis').length,1);
    assert.equal(calls.filter(c=>c.url==='/api/creator-editorial-primary-coverage').length,1);
    assert.equal(calls.filter(c=>c.url==='/api/creator-script-plan').length,2);
  } else {
    await assert.rejects(run, error => ['SOURCE_AUTHORITY_REVIEW_REQUIRED','STALE_RESEARCH','AUTHORITY_INVALID'].includes(error.code));
    assert.equal(calls.filter(c=>c.url==='/api/creator-editorial-primary-coverage').length,0);
    assert.equal(calls.filter(c=>c.url==='/api/creator-script-plan').length,1);
  }
}
for (const mode of ['ok','missing','stale','invalid','project','snapshot','revision','unverified']) await exercise(mode);
async function childCase(mode) {
  const child = 'c'.repeat(64), calls = []; let childChecks=0, notify, release;
  const paused = new Promise(resolve=>{notify=resolve;});
  const resume = new Promise(resolve=>{release=resolve;});
  const same = mode === 'unchanged';
  const fetchImpl = async (url, init) => {
    const body=JSON.parse(init.body); calls.push({url,body});
    if(url==='/api/creator-research')return Response.json({success:true,sources:[{sourceId:'s1',url:'https://example.org'}]});
    if(url==='/api/creator-editorial-analysis')return Response.json({success:true,graph,sourceAuthoritySnapshotDigest:digest,scriptContext:context,readiness:{primarySourceRequiredClaimIds:['c1'],primarySourceCoveredClaimIds:[],reviewReasons:['PRIMARY_SOURCE_COVERAGE_REQUIRED']}});
    if(url==='/api/creator-editorial-primary-coverage')return Response.json({success:true,graph,sourceAuthoritySnapshotDigest:mode==='bad_digest'?'invalid':mode==='long_digest'?child+'suffix':same?digest:child,scriptContext:context,excludedPrimaryClaimIds:['c1'],readiness:{primarySourceRequiredClaimIds:[],primarySourceCoveredClaimIds:[],reviewReasons:[]}});
    if(url==='/api/creator-evidence-evaluation'&&body.operation==='review_status') {
      if(body.snapshotDigest===digest)return Response.json({success:true,projectId:'project',snapshotDigest:digest,researchRevision:1,status:'REVIEW_COMPLETE',requirements:[]});
      childChecks++;
      if(mode==='child_stale')return Response.json({success:false,status:'STALE_RESEARCH'},{status:422});
      const invalid=['expired','tampered','duplicate'].includes(mode);
      return Response.json({success:true,projectId:mode==='child_project'?'other':'project',snapshotDigest:mode==='replay'?digest:child,researchRevision:mode==='child_revision'?2:1,status:invalid?'AUTHORITY_INVALID':childChecks===1||mode==='child_unverified'||mode==='missing_child'?'REVIEW_REQUIRED':'REVIEW_COMPLETE',requirements:[{claimId:'c1',evidenceId:'e1',sourceId:'s1'}]});
    }
    if(url==='/api/creator-evidence-evaluation')return Response.json({success:true,projectId:'project',snapshotDigest:same?digest:child,researchRevision:1,review,blockingReasons:[]});
    if(url==='/api/creator-script-plan')return Response.json({success:true});
    throw Error(`unexpected ${url}`);
  };
  const run=runCreatorEditorialScriptPipeline({accessToken:'synthetic',topic:'Synthetic',scriptPlanRequest:{projectId:'project'},operationIsCurrent:()=>true,fetchImpl,...(mode==='missing_child'?{}:{onParentSourceReview:async pending=>{assert.equal(pending.snapshotDigest,child);notify();await resume;}})});
  if(['child_ok','child_unverified'].includes(mode)) {
    await paused;
    assert.equal(calls.filter(c=>c.url==='/api/creator-editorial-primary-coverage').length,1);
    assert.equal(calls.filter(c=>c.url==='/api/creator-evidence-evaluation'&&!c.body.operation).length,0);
    assert.equal(calls.filter(c=>c.url==='/api/creator-script-plan').length,1);
    release();
  }
  if(['child_ok','unchanged'].includes(mode)) {
    await run;
    assert.equal(calls.filter(c=>c.url==='/api/creator-editorial-analysis').length,1);
    assert.equal(calls.filter(c=>c.url==='/api/creator-editorial-primary-coverage').length,1);
    assert.equal(calls.filter(c=>c.url==='/api/creator-evidence-evaluation'&&!c.body.operation).length,1);
    assert.equal(calls.filter(c=>c.url==='/api/creator-script-plan').length,2);
    if(same)assert.equal(calls.filter(c=>c.body.operation==='review_status').length,2);
  } else {
    await assert.rejects(run,error=>['SOURCE_AUTHORITY_REVIEW_REQUIRED','STALE_RESEARCH','AUTHORITY_INVALID'].includes(error.code));
    assert.equal(calls.filter(c=>c.url==='/api/creator-evidence-evaluation'&&!c.body.operation).length,0);
    assert.equal(calls.filter(c=>c.url==='/api/creator-script-plan').length,1);
  }
}
for(const mode of ['child_ok','unchanged','missing_child','child_stale','expired','tampered','duplicate','child_project','replay','child_revision','bad_digest','long_digest','child_unverified'])await childCase(mode);
console.log('CHILD_SOURCE_REVIEW_PIPELINE=PASS');
console.log('PARENT_SOURCE_REVIEW_PIPELINE=PASS');
