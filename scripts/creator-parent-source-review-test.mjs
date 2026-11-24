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
    assert.equal(statuses,2);
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
console.log('PARENT_SOURCE_REVIEW_PIPELINE=PASS');
