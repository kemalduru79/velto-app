import assert from "node:assert/strict";
import {createJiti} from "jiti";
import {createResearchClaimEvidenceGraph} from "../lib/research/claimEvidenceGraph.ts";
import {createEditorialScriptContext} from "../lib/research/editorialScriptContext.ts";
import {parseCreatorProfile} from "../lib/creator/creatorProfile.ts";
import {normalizeScriptPlannerEditorialContext} from "../lib/research/scriptPlannerEditorialContext.ts";
import {
  isCreatorScriptHistoricalResearchOnly,isValidHistoricalCreatorScript,
  normalizeCreatorScript,normalizeHistoricalCreatorScript
} from "../lib/creator/creatorScript.ts";
import {getCreatorScriptApprovalBlockers} from "../lib/creator/creatorScriptApproval.ts";
import {readCreatorProjectState,isValidCreatorProjectState,inspectCreatorProjectStatePersistenceAuthority} from "../lib/creator/projectState.ts";
import {currentCreatorFinalProductionAuthority} from "../lib/creator/publishReadiness.server.ts";
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
assert(getCreatorScriptApprovalBlockers({script:normalizeHistoricalCreatorScript(script),strategyFingerprint:"historical-strategy",language:"en",hasPendingRefinement:false}).includes("grounding"));
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
normal.publish.finalVideoUrl="https://assets.invalid/final.mp4";
normal.publish.finalVideoSignature="immutable-final-signature";
const project={id:"historical-project",flow_type:"creator_lab",updated_at:"r1",
 scenes:structuredClone(normal.createReview.scenes),refined_creator_scenes:[{id:1}],
 creator_production_package:normal.production.package,creator_mentor_result:normal.strategy.mentorResult,
 youtube_metadata:normal.publish.metadata,youtube_thumbnail:normal.publish.thumbnail,
 exported_movie_url:normal.publish.finalVideoUrl,export_signature:normal.publish.finalVideoSignature,
 exported_movie_result:{sibling:{untouched:true},creatorProjectState:normal}};
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
assert.throws(()=>currentCreatorFinalProductionAuthority(project),/CREATOR_SCRIPT_INVALID/);
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
const handler=POST.handleForTest;
const owner={id:"owned-user",email:"owner@fixture.invalid",providerUser:{id:"owned-user"}};
const request=body=>new Request("http://localhost/api/save-project",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
const execute=async(body,{foreign=false}={})=>{
 let saved=structuredClone(project),writes=[];
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
     saved.updated_at="r2";
     return {project:structuredClone(saved),created:false};
   },
 },mediaAssetRepository:{
   findByPublicUrl:async(_,url)=>url===project.exported_movie_url?{mediaKind:"final_video",lifecycleState:"active",metadata:{projectId:project.id}}:null,
   replaceProjectReferences:async()=>undefined,
   listFinalVideosForProject:async()=>[],
 }};
 const response=await handler(request(body),{authenticate:async()=>owner,persistence:()=>services});
 return {status:response.status,payload:await response.json(),writes,saved};
};
const body={projectId:project.id,flowType:"creator_lab",expectedUpdatedAt:"r1",creatorProjectState:hydrated,exportedMovieResult:{clientMetadata:"do-not-install"}};
const saved=await execute(body);
assert.equal(saved.status,200,JSON.stringify(saved.payload).slice(0,450));
assert.equal(saved.writes.length,1);
assert.deepEqual(saved.saved.exported_movie_result,project.exported_movie_result,"Preserve exact original snapshot and envelope.");
assert.equal(saved.saved.exported_movie_url,project.exported_movie_url);
assert.equal(saved.saved.export_signature,project.export_signature);
assert.deepEqual(saved.saved.scenes,project.scenes);
assert.deepEqual(saved.saved.refined_creator_scenes,project.refined_creator_scenes);
const repeated=await execute({...body,title:"Safe historical title"});
assert.equal(repeated.status,200);
assert.equal(repeated.saved.title,"Safe historical title");
assert.deepEqual(repeated.saved.exported_movie_result,project.exported_movie_result);
for(const mutation of [
  {...body,creatorProjectState:{...hydrated,publish:{...hydrated.publish,finalVideoUrl:""}}},
  {...body,scenes:[{id:1,editorChange:true}]},
  {...body,creatorScriptMutation:{type:"manual_document_edit",expectedRevision:1,documentText:"Altered"}},
  {...body,exportSignature:"forged"},
]){const x=await execute(mutation);assert.equal(x.status,409,JSON.stringify(x.payload));assert.equal(x.payload.code,"CREATOR_LEGACY_RESEARCH_REVALIDATION_REQUIRED");assert.equal(x.writes.length,0);}
const cas=await execute({...body,expectedUpdatedAt:"old"});assert.equal(cas.status,409);assert.equal(cas.writes.length,0);
const foreign=await execute(body,{foreign:true});assert.equal(foreign.status,404);assert.equal(foreign.writes.length,0);
assert.equal(JSON.stringify(project),rawBefore);
console.log("PR45_HISTORICAL_LOADING_SAVE_PRESERVATION_AND_STRICT_GATES=PASS");
