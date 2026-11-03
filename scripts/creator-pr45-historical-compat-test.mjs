import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {EMPTY_CREATOR_AUDIO_TIMELINE,normalizeCreatorAudioTimeline} from "../lib/creator/audioTimeline.ts";
import {createJiti} from "jiti";
import {createResearchClaimEvidenceGraph} from "../lib/research/claimEvidenceGraph.ts";
import {createEditorialScriptContext} from "../lib/research/editorialScriptContext.ts";
import {parseCreatorProfile} from "../lib/creator/creatorProfile.ts";
import {normalizeScriptPlannerEditorialContext,createCounterEvidenceReview,applyCounterEvidenceScopeReview} from "../lib/research/scriptPlannerEditorialContext.ts";
import {
  isCreatorScriptHistoricalResearchOnly,isValidHistoricalCreatorScript,
  normalizeCreatorScript,normalizeHistoricalCreatorScript,
  getCreatorScriptStatus,canBuildScenesFromCreatorScript,creatorScriptHasGroundingBlocker
} from "../lib/creator/creatorScript.ts";
import {getCreatorScriptApprovalBlockers} from "../lib/creator/creatorScriptApproval.ts";
import {readCreatorProjectState,isValidCreatorProjectState,inspectCreatorProjectStatePersistenceAuthority} from "../lib/creator/projectState.ts";
import {issue44EvidenceFixture} from "./fixtures/creator-issue-44-evidence.mjs";

const f=issue44EvidenceFixture();
f.claims=[{...f.claims[3],claimType:"RESEARCH_FINDING",propositionKind:"original_research_result"}];
f.links=f.links.filter(x=>x.claimId==="claim-4");
const graph=createResearchClaimEvidenceGraph(f);
const historicalContext=createEditorialScriptContext({profile:parseCreatorProfile(null),graph,sourceAssessments:f.assessments});
// An approved context from the original production rule. Preserve stored fields
// literally; only a historical reader may recognize its former qualification.
historicalContext.readiness.primarySourceCoveredClaimIds=["claim-4"];
historicalContext.readiness.status="ready";
historicalContext.readiness.reviewReasons=[];
const script={
  version:1,title:"Historical research documentary",
  sections:["opening","body","conclusion"].map((kind,i)=>({
    id:"part-"+i,kind,text:"Historical original script text for "+kind+".",
    claimIds:["claim-4"],evidenceReviewRequired:false
  })),
  targetDurationSec:600,strategyFingerprint:"historical-strategy",revision:1,
  grounding:{context:historicalContext},generatedAt:"2026-01-01T00:00:00Z",updatedAt:"2026-01-01T00:00:00Z",
  approval:{approvedRevision:1,approvedStrategyFingerprint:"historical-strategy",approvedAt:"2026-01-02T00:00:00Z"}
};
assert.throws(()=>normalizeScriptPlannerEditorialContext(historicalContext),/PRIMARY_AUTHORITY_MISMATCH/);
assert.throws(()=>normalizeCreatorScript(script),/CREATOR_SCRIPT_INVALID/);
assert.equal(isValidHistoricalCreatorScript(script),true);
assert.equal(isCreatorScriptHistoricalResearchOnly(script),true);
assert.deepEqual(normalizeHistoricalCreatorScript(script).approval,script.approval);
assert.equal(getCreatorScriptStatus(normalizeHistoricalCreatorScript(script),"historical-strategy"),"stale");
assert.equal(canBuildScenesFromCreatorScript(normalizeHistoricalCreatorScript(script),"historical-strategy"),false);
assert.equal(creatorScriptHasGroundingBlocker(normalizeHistoricalCreatorScript(script)),true);
assert(getCreatorScriptApprovalBlockers({script:normalizeHistoricalCreatorScript(script),strategyFingerprint:"historical-strategy",language:"en",hasPendingRefinement:false}).includes("grounding"));
// Current, valid review provenance must be tried under current rules first.
const currentFixture=issue44EvidenceFixture();
const currentGraph=createResearchClaimEvidenceGraph(currentFixture);
const currentContext=normalizeScriptPlannerEditorialContext(createEditorialScriptContext({profile:parseCreatorProfile(null),graph:currentGraph,sourceAssessments:currentFixture.assessments}));
const review=createCounterEvidenceReview(currentContext);
const scoped=applyCounterEvidenceScopeReview(currentContext,{
 snapshotFingerprint:review.snapshotFingerprint,excludedClaimIds:review.unresolvedClaimIds,
 rationale:"Exclude unresolved synthetic assertions; retain the tested finding and document attribution.",confirmed:true,
},currentGraph);
const currentScript={...script,grounding:{context:scoped}};
assert.doesNotThrow(()=>normalizeCreatorScript(currentScript));
assert.equal(isValidHistoricalCreatorScript(currentScript),true,"Historical loading must accept current review provenance.");
assert.equal(isCreatorScriptHistoricalResearchOnly(currentScript),false);
const normal=readCreatorProjectState({});
const pending={proposalId:"pending-1",baseRevision:1,scope:"whole_script",instruction:"Historical revision, unchanged",createdAt:"2026-01-01",
  changes:[{sectionId:"part-1",sectionHeading:"body",beforeText:script.sections[1].text,afterText:"Historically proposed text."}],
  proposedScript:{...script,revision:2,approval:null,sections:script.sections.map((s,i)=>i===1?{...s,text:"Historically proposed text."}:s)}};
normal.strategy={...normal.strategy,script,pendingRefinement:pending,revisionHistory:[{id:"history-1",fromRevision:0,toRevision:1,origin:"manual",createdAt:"2026-01-01",changes:[]}]};
normal.production.package={sourceScriptRevision:1,scenes:[]};
normal.createReview.scenes=Array.from({length:36},(_,index)=>({
 id:index+1,creatorSceneId:"scene-"+(index+1),text:"Historical scene "+(index+1),
 image:"https://assets.invalid/"+(index+1)+".png",audioUrl:"https://assets.invalid/"+(index+1)+".mp3"
}));
normal.production.audioTimeline=normalizeCreatorAudioTimeline({...structuredClone(EMPTY_CREATOR_AUDIO_TIMELINE),placements:[{
 id:"preserved-music",kind:"music",asset:{assetId:"synthetic-music",origin:"uploaded",mediaKind:"music",durationMs:600000,rights:{status:"unknown"}},
 range:{start:{sceneId:"scene-1",edge:"start",offsetMs:0},end:{sceneId:"scene-36",edge:"end",offsetMs:0}},
 sourceInMs:1300,gain:0.25,fades:{inMs:1000,outMs:2000},ducking:{mode:"under_speech"},status:"active",
}]});
normal.createReview.scenes[0].text="Owner-adjusted synthetic narration — preserved exactly.";
normal.createReview.scenes[0].videoUrl="https://assets.invalid/original-scene.mp4";
normal.legacyReadOnlyMetadata={opaque:"preserve-unknown-json"};
normal.publish.finalVideoUrl="https://assets.invalid/final.mp4";
normal.publish.finalVideoSignature="immutable-final-signature";
const project={id:"historical-project",flow_type:"creator_lab",updated_at:"r1",
 scenes:structuredClone(normal.createReview.scenes),refined_creator_scenes:[{id:1}],
 creator_production_package:normal.production.package,creator_mentor_result:normal.strategy.mentorResult,
 youtube_metadata:normal.publish.metadata,youtube_thumbnail:normal.publish.thumbnail,
 exported_movie_url:normal.publish.finalVideoUrl,export_signature:normal.publish.finalVideoSignature,
 exported_movie_result:{sibling:{untouched:true},creatorProjectState:normal}};
const currentProject=structuredClone(project);
currentProject.exported_movie_result.creatorProjectState.strategy.script=currentScript;
currentProject.exported_movie_result.creatorProjectState.strategy.pendingRefinement.proposedScript={...currentScript,revision:2,approval:null};
assert.equal(inspectCreatorProjectStatePersistenceAuthority(currentProject).status,"valid");
assert.deepEqual(readCreatorProjectState(currentProject).strategy.script.grounding.context.counterEvidenceReview,scoped.counterEvidenceReview);
const forgedReview=structuredClone(currentProject);
forgedReview.exported_movie_result.creatorProjectState.strategy.script.grounding.context.counterEvidenceReview.decision.confirmed=false;
assert.equal(inspectCreatorProjectStatePersistenceAuthority(forgedReview).status,"malformed_invalid_script");
const rawBefore=JSON.stringify(project);
assert.equal(isValidCreatorProjectState(normal),true);
assert.equal(inspectCreatorProjectStatePersistenceAuthority(project).status,"valid");
const hydrated=readCreatorProjectState(project);
assert(hydrated.strategy.script?.approval);
assert(hydrated.strategy.pendingRefinement?.proposedScript);
assert.equal(hydrated.createReview.scenes.length,36);
assert.equal(hydrated.publish.finalVideoSignature,"immutable-final-signature");
assert.deepEqual(hydrated.strategy.revisionHistory,normal.strategy.revisionHistory);
assert.equal(JSON.stringify(project),rawBefore);
const invalid=structuredClone(project);
invalid.exported_movie_result.creatorProjectState.strategy.script.sections[0].claimIds=["forged-claim"];
assert.equal(inspectCreatorProjectStatePersistenceAuthority(invalid).status,"malformed_invalid_script");
assert.throws(()=>readCreatorProjectState(invalid),/CREATOR_PROJECT_STATE_SCRIPT_INVALID/);
const mismatched=structuredClone(project);
mismatched.exported_movie_result.creatorProjectState.strategy.script.grounding.context.readiness.primarySourceCoveredClaimIds=["forged"];
assert.equal(inspectCreatorProjectStatePersistenceAuthority(mismatched).status,"malformed_invalid_script");

const root=new URL("..",import.meta.url).pathname.replace(/\/$/,"");
const jiti=createJiti(import.meta.url,{interopDefault:true,alias:{"@":root,"server-only":new URL("../lib/creator/projectState.ts",import.meta.url).pathname}});
const {POST}=await jiti.import("../app/api/save-project/route.ts");
const {currentCreatorFinalProductionAuthority}=await jiti.import("../lib/creator/publishReadiness.server.ts");
assert.throws(()=>currentCreatorFinalProductionAuthority(project),/CREATOR_SCRIPT_INVALID/);
const handler=POST.handleForTest;
const owner={id:"owned-user",email:"owner@fixture.invalid",providerUser:{id:"owned-user"}};
const request=body=>new Request("http://localhost/api/save-project",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
const execute=async(body,{foreign=false,initial=project}={})=>{
 let saved=structuredClone(initial),writes=[],referenceWrites=0,cleanupReads=0;
 const services={projectRepository:{
   getForOwner:async(_,userId)=>foreign||userId!==owner.id?null:structuredClone(saved),
   saveForOwner:async patch=>{
     if(patch.expectedUpdatedAt!==saved.updated_at)throw Error("PROJECT_SAVE_CONFLICT");
     writes.push(structuredClone(patch));
     if(Object.hasOwn(patch,"title"))saved.title=patch.title;
     if(Object.hasOwn(patch,"exportedMovieResult"))saved.exported_movie_result=patch.exportedMovieResult;
     if(Object.hasOwn(patch,"exportedMovieUrl"))saved.exported_movie_url=patch.exportedMovieUrl;
     if(Object.hasOwn(patch,"exportSignature"))saved.export_signature=patch.exportSignature;
     if(Object.hasOwn(patch,"scenes"))saved.scenes=patch.scenes;
     saved.updated_at="r"+(Number(saved.updated_at.slice(1))+1);
     return {project:structuredClone(saved),created:false};
   },
 },mediaAssetRepository:{
   findByPublicUrl:async(_,url)=>url===project.exported_movie_url?{mediaKind:"final_video",lifecycleState:"active",metadata:{projectId:project.id}}:null,
   replaceProjectReferences:async()=>{referenceWrites++;},
   listFinalVideosForProject:async()=>{cleanupReads++;return[];},
 }};
 const response=await handler(request(body),{authenticate:async()=>owner,persistence:()=>services});
 return {status:response.status,payload:await response.json(),writes,saved,referenceWrites,cleanupReads};
};
const body={projectId:project.id,flowType:"creator_lab",expectedUpdatedAt:"r1",creatorProjectState:hydrated,exportedMovieResult:{clientMetadata:"do-not-install"}};
const saved=await execute(body);
assert.equal(saved.status,200,JSON.stringify(saved.payload).slice(0,450));
assert.equal(saved.writes.length,1);
assert.equal(saved.referenceWrites,0,"An unchanged historical save must not replace preserved media references.");
assert.equal(saved.cleanupReads,0,"An unchanged historical save must not start media cleanup.");
assert.deepEqual(saved.saved.exported_movie_result,project.exported_movie_result,"Preserve exact original snapshot and envelope.");
assert.equal(saved.saved.exported_movie_url,project.exported_movie_url);
assert.equal(saved.saved.export_signature,project.export_signature);
assert.deepEqual(saved.saved.scenes,project.scenes);
assert.deepEqual(saved.saved.refined_creator_scenes,project.refined_creator_scenes);
const reloaded=readCreatorProjectState(saved.saved);
const repeated=await execute({...body,creatorProjectState:reloaded,expectedUpdatedAt:saved.saved.updated_at,title:"Safe historical title"},{initial:saved.saved});
assert.equal(repeated.status,200);
assert.equal(repeated.saved.title,"Safe historical title");
assert.equal(repeated.saved.updated_at,"r3");
assert.deepEqual(readCreatorProjectState(repeated.saved).production.audioTimeline,normal.production.audioTimeline);
assert.deepEqual(repeated.saved.scenes,project.scenes);
assert.equal(repeated.referenceWrites+repeated.cleanupReads,0);
assert.deepEqual(repeated.saved.exported_movie_result,project.exported_movie_result);
for(const mutation of [
  {...body,creatorProjectState:{...hydrated,publish:{...hydrated.publish,finalVideoUrl:""}}},
  {...body,scenes:[{id:1,editorChange:true}]},
  {...body,creatorScriptMutation:{type:"manual_document_edit",expectedRevision:1,documentText:"Altered"}},
  {...body,exportSignature:"forged"},
]){const x=await execute(mutation);assert.equal(x.status,409,JSON.stringify(x.payload));assert.equal(x.payload.code,"CREATOR_LEGACY_RESEARCH_REVALIDATION_REQUIRED");assert.equal(x.writes.length,0);}
const cloned=await execute({...body,projectId:undefined,title:"Synthetic legacy clone",scenes:[]});
assert.equal(cloned.status,409,"Historical-read compatibility cannot authorize a new script installation.");
assert.equal(cloned.writes.length,0);
const cas=await execute({...body,expectedUpdatedAt:"old"});assert.equal(cas.status,409);assert.equal(cas.writes.length,0);
const foreign=await execute(body,{foreign:true});assert.equal(foreign.status,404);assert.equal(foreign.writes.length,0);
assert.equal(JSON.stringify(project),rawBefore);
const auditOwner="11111111-1111-4111-8111-111111111111";
const auditRows=[structuredClone(project),structuredClone(currentProject),structuredClone(currentProject)];
auditRows[1].exported_movie_result.creatorProjectState.strategy.pendingRefinement=pending;
for(const [i,row] of auditRows.entries()){row.user_id=auditOwner;row.id=`33333333-3333-4333-8333-${String(i+1).padStart(12,"0")}`;}
const audit=spawnSync(process.execPath,["--experimental-transform-types","scripts/creator-pr45-legacy-audit.mjs"],{
 cwd:root,input:auditRows.map(row=>JSON.stringify(row)).join("\n"),encoding:"utf8",env:{...process.env,VELTO_AUDIT_OWNER_ID:auditOwner},
});
assert.equal(audit.status,0,audit.stderr);const auditCounts=JSON.parse(audit.stdout).counts;
assert.equal(auditCounts.historical_read_only,1);assert.equal(auditCounts.current,2);assert.equal(auditCounts.pending_historical,2);assert.equal(auditCounts.invalid,0);
console.log("PR45_HISTORICAL_LOADING_SAVE_PRESERVATION_AND_STRICT_GATES=PASS");
