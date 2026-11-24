import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createSourceAuthorityWorkflow } from '../lib/research/sourceAuthorityWorkflow.ts';
import { normalizeScriptPlannerEditorialContext } from '../lib/research/scriptPlannerEditorialContext.ts';
import { validateOwnedSourceSnapshot, validateSourceAuthorityRecords } from '../lib/research/sourceAuthorityBoundary.ts';

// Deliberately unusable outside the dedicated GitHub Actions service container.
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.equal(process.env.PGPORT, '5432');
assert.equal(process.env.PGDATABASE, 'source_authority_ci');
assert.equal(process.env.PGUSER, 'postgres');
const query = sql => execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8' }).trim();
assert.equal(query('select current_database()'), 'source_authority_ci');
const literal = value => `convert_from(decode('${Buffer.from(String(value), 'utf8').toString('hex')}','hex'),'UTF8')`;
const owner = '00000000-0000-0000-0000-000000000001';
const reviewer = '00000000-0000-0000-0000-000000000002';
const project = '10000000-0000-0000-0000-000000000003';
query(`insert into public.velto_projects (id,owner_user_id,flow_type) values ('${project}','${owner}','creator_lab')`);
const context = normalizeScriptPlannerEditorialContext({ version:'0.10H-2E', editorialConstitution:'Use evidence carefully.', readiness:{status:'ready', editorialReadinessScore:100, reviewReasons:[], primarySourceRequiredClaimIds:['c1'], primarySourceCoveredClaimIds:['c1']}, claims:[{claimId:'c1', claimType:'PRIMARY_SOURCE_CLAIM',text:'Synthetic measured finding.',supportingEvidenceIds:['e1'],counterEvidenceIds:[],contextualEvidenceIds:[]}], evidence:[{evidenceId:'e1',sourceId:'s1',excerpt:'A synthetic passage demonstrating a measured finding.',contextNote:'',locator:{section:null,page:null,timecodeStartSec:null,timecodeEndSec:null}}], sources:[{sourceId:'s1',title:'Synthetic study',url:'https://example.org/study',publisher:'Synthetic publisher',author:null,publishedAt:null,directness:'primary',reviewStatus:'usable',searchLane:'academic',sourceKind:'paper'}] });
assert.ok(context);
const sqlJSON = obj => `${literal(JSON.stringify(obj))}::jsonb`;
const snapshots = 'public.creator_source_authority_snapshots';
const records = 'public.creator_source_authority_verifications';
const scope = (ownerId, projectId, digest) => `owner_user_id=${literal(ownerId)}::uuid and project_id=${literal(projectId)} and snapshot_digest=${literal(digest)}`;
const service = sql => query(`set role service_role; ${sql}`);
const workflow = createSourceAuthorityWorkflow({
 enabled:true, authenticateReviewer:async token => token === 'synthetic-reviewer' ? reviewer : null,
 ownsProject:async (o,p) => o === owner && p === project,
 insertSnapshot:async row => service(`insert into ${snapshots} (owner_user_id,project_id,snapshot_digest,editorial_context) values (${literal(row.owner_user_id)}::uuid,${literal(row.project_id)},${literal(row.snapshot_digest)},${sqlJSON(row.editorial_context)})`),
 loadSnapshot:async (o,p,d) => { const result=service(`select row_to_json(s) from ${snapshots} s where ${scope(o,p,d)}`); return result ? JSON.parse(result) : null; },
 loadActiveSnapshot:async (o,p,d) => { const result=service(`select row_to_json(s) from ${snapshots} s join public.velto_projects p on p.owner_user_id=s.owner_user_id and p.id::text=s.project_id and p.active_research_snapshot_digest=s.snapshot_digest and p.research_revision=s.research_revision where s.owner_user_id=${literal(o)}::uuid and s.project_id=${literal(p)} and s.snapshot_digest=${literal(d)}`); if (!result) throw Error('RESEARCH_AUTHORITY_NOT_ACTIVE'); const row=JSON.parse(result); return {editorialContext:row.editorial_context,researchRevision:row.research_revision}; },
 acquire:async source => ({sourceId:source.sourceId,url:source.url,content:`Header ${context.evidence[0].excerpt} Footer`,acquisition:'trusted_fetch',authority:'unknown'}),
 insertRecord:async (row,revision) => {
   const call = `select public.creator_issue_source_authority_record(${literal(row.owner_user_id)}::uuid,${literal(row.project_id)},${revision},${literal(row.snapshot_digest)},${sqlJSON(row)})`;
   service(`begin; ${call}; rollback`);
   assert.equal(service(`select count(*) from ${records} where ${scope(row.owner_user_id,row.project_id,row.snapshot_digest)}`), '0');
   service(call);
 },
 now:()=>'2026-01-01T00:00:00Z',
});
const common = {token:'synthetic-reviewer',ownerId:owner,projectId:project};
const snapshotDigest = (await import('../lib/research/sourceAuthorityBoundary.ts')).sourceAuthoritySnapshotDigest(context);
const revision = Number(service(`select public.creator_begin_research_revision('${owner}','${project}')`));
const snapshotRow = {owner_user_id:owner,project_id:project,snapshot_digest:snapshotDigest,editorial_context:context,parent_snapshot_digest:null};
service(`select public.creator_activate_research_snapshot('${owner}','${project}',${revision},null,${sqlJSON(snapshotRow)})`);
const selection = {...common,snapshotDigest,claimId:'c1',evidenceId:'e1'};
const inspected = await workflow.inspect(selection);
await workflow.issue({...selection,expiresAt:'2026-01-02T00:00:00Z',decision:{publisherAuthoredDocument:true,classification:'original_research',basis:'Synthetic human editorial decision',documentDigest:inspected.documentDigest}});
const storedSnapshot = JSON.parse(service(`select row_to_json(s) from ${snapshots} s where ${scope(owner,project,snapshotDigest)}`));
const storedRecords = JSON.parse(service(`select coalesce(json_agg(r),'[]'::json) from ${records} r where ${scope(owner,project,snapshotDigest)}`));
assert.equal(validateOwnedSourceSnapshot({ownerUserId:owner,projectId:project,context,snapshot:storedSnapshot}),true);
const check = (c=context, rs=storedRecords, o=owner,p=project, now=Date.parse('2026-01-01T12:00:00Z')) => validateSourceAuthorityRecords({ownerUserId:o,projectId:p,context:c,records:rs,now}).ok;
assert.equal(check(),true);
assert.equal(check(context,storedRecords,reviewer),false);
assert.equal(check(context,storedRecords,owner,'other-project'),false);
assert.equal(check(context,storedRecords,owner,project,Date.parse('2026-01-03T00:00:00Z')),false);
const altered=structuredClone(context); altered.evidence[0].excerpt += ' changed'; assert.equal(check(altered),false);
const badSnapshot=structuredClone(storedSnapshot); badSnapshot.editorial_context.claims[0].text += ' changed'; assert.equal(validateOwnedSourceSnapshot({ownerUserId:owner,projectId:project,context,snapshot:badSnapshot}),false);
await assert.rejects(()=>workflow.issue({...selection,token:'forged',expiresAt:'2026-01-02T00:00:00Z',decision:{publisherAuthoredDocument:true,classification:'original_research',basis:'fake',documentDigest:inspected.documentDigest}}));
console.log('POSTGRES_BACKED_AUTHORITY_CHAIN=PASS (synthetic auth, project ownership, human review and source acquisition)');
