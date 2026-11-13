import {buildCreatorProjectState} from '../../lib/creator/projectState.ts';
import assert from 'node:assert/strict';
import {assertCreatorScriptBuildTransition,assertCreatorScriptBuildCheckpointIdentity,assertCreatorScriptBuildOperationTransition,createCreatorScriptBuildOperationId,createCreatorScriptBuildIdempotencyKey} from '../../lib/creator/creatorScriptBuild.ts';
import {createCreatorScriptBuildRuntime} from '../../lib/creator/creatorScriptBuildRuntime.server.ts';
import {createCreatorScriptBuildApiController} from '../../lib/creator/creatorScriptBuildApi.server.ts';
import {createCreatorStrategyBindingFingerprint} from '../../lib/creator/creatorStrategyBinding.ts';
export const ownerId='00000000-0000-4000-8000-000000000001', projectId='10000000-0000-4000-8000-000000000001';
export const revision='2026-11-06T20:00:00.000Z';
const now='2026-11-06T20:00:01.000Z';
const clone=x=>structuredClone(x);
export class MemoryRepository {
  constructor(initialBuild, operations = []) {
    this.build = clone(initialBuild);
    this.operations = new Map(
      operations.map((operation) => [operation.operationId, clone(operation)]),
    );
    this.projectWrites=0;
    this.transitions = [];
    this.requestedOperations = [];
  }

  async request(input) {
    const key=createCreatorScriptBuildIdempotencyKey(input);
    assert.equal(key,this.build.idempotencyKey);assert.equal(input.ownerId,this.build.ownerId);
    return {build:clone(this.build),created:false,resolution:"REUSE_IN_PROGRESS"};
  }
  async persistAccepted(){this.projectWrites++;throw Error("TEST_PROJECT_WRITES_FORBIDDEN");}
  async getForOwner(requestedBuildId, requestedOwnerId) {
    return requestedBuildId === this.build.buildId && requestedOwnerId === this.build.ownerId
      ? clone(this.build)
      : null;
  }
  async getByIdempotencyForOwner() { return null; }
  async transition(input) {
    assert.equal(input.ownerId, this.build.ownerId);
    assert.equal(input.buildId, this.build.buildId);
    assert.equal(input.expectedState, this.build.state);
    assertCreatorScriptBuildTransition(input.expectedState, input.nextState);
    if (
      input.resultAuthority != null &&
      input.nextState !== "ACCEPTED" &&
      input.nextState !== "PERSISTED"
    ) {
      throw new Error("RESULT_AUTHORITY_STATE_INVALID");
    }
    this.transitions.push(`${input.expectedState}->${input.nextState}`);
    this.build = {
      ...this.build,
      state: input.nextState,
      failure: input.failure || null,
      resultAuthority: input.resultAuthority ?? this.build.resultAuthority,
      updatedAt: now,
    };
    return clone(this.build);
  }
  async saveCheckpoint(input) {
    assert.equal(input.ownerId, this.build.ownerId);
    assert.equal(input.buildId, this.build.buildId);
    assert.equal(input.expectedBuildState, this.build.state);
    assertCreatorScriptBuildCheckpointIdentity({
      buildId: input.buildId,
      checkpoint: input.checkpoint,
    });
    const previous = this.build.checkpoints[input.checkpoint.stage] || null;
    const allowed = !previous
      ? ["PENDING", "RUNNING"].includes(input.checkpoint.status)
      : previous.status === "PENDING"
        ? ["RUNNING", "COMPLETED", "FAILED"].includes(input.checkpoint.status)
        : previous.status === "RUNNING"
          ? ["COMPLETED", "FAILED"].includes(input.checkpoint.status)
          : false;
    if (!allowed && JSON.stringify(previous) !== JSON.stringify(input.checkpoint)) {
      throw new Error("CHECKPOINT_TRANSITION_INVALID");
    }
    this.build = {
      ...this.build,
      checkpoints: {
        ...this.build.checkpoints,
        [input.checkpoint.stage]: clone(input.checkpoint),
      },
    };
    return clone(this.build);
  }
  async requestOperation(input) {
    this.requestedOperations.push(clone(input));
    const operationId = createCreatorScriptBuildOperationId(input);
    const existing = this.operations.get(operationId);
    if (existing) return { operation: clone(existing), created: false };
    const operation = {
      operationId,
      buildId: input.buildId,
      ownerId: input.ownerId,
      stage: input.stage,
      operationType: input.operationType,
      semanticFingerprint: input.semanticFingerprint,
      contractVersion: input.contractVersion,
      state: "PENDING",
      resultReference: null,
      failure: null,
      createdAt: revision,
      updatedAt: revision,
    };
    this.operations.set(operationId, operation);
    return { operation: clone(operation), created: true };
  }
  async getOperationForOwner(operationId, requestedBuildId, requestedOwnerId) {
    const operation = this.operations.get(operationId);
    if (
      !operation ||
      operation.buildId !== requestedBuildId ||
      operation.ownerId !== requestedOwnerId
    ) return null;
    return clone(operation);
  }
  async transitionOperation(input) {
    const operation = this.operations.get(input.operationId);
    assert.ok(operation);
    assert.equal(operation.state, input.expectedState);
    assertCreatorScriptBuildOperationTransition(input.expectedState, input.nextState);
    const next = {
      ...operation,
      state: input.nextState,
      resultReference: input.resultReference ?? null,
      failure: input.failure || null,
      updatedAt: now,
    };
    this.operations.set(input.operationId, next);
    return clone(next);
  }
}

function canonicalState() {
  return buildCreatorProjectState({
    navigation: { workspaceStep: 2, productionSubstep: "setup" },
    brief: {
      topic: "When AI Governs — The Future Beyond Human Control",
      language: "en",
      country: "global",
      ageGroup: "professional_18",
      contentType: "educational_explainer",
      format: "youtube_video",
      durationPreset: "custom",
      durationSec: 540,
      customDurationSec: 540,
      qualityMode: "standard",
      targetPlatforms: ["youtube"],
    },
    strategy: {
      mentorResult: {
        audienceInsight: ["Viewers want evidence."],
        hookPatterns: ["What if memory changes?"],
        videoIdeas: [
          { title: "The Memory That Made You", concept: "Recommended duplicate" },
          { title: "Identity After Recall", concept: "Alternative framing" },
        ],
        recommendedIdea: {
          title: "The Memory That Made You",
          reason: "Follow reconstructive memory into identity.",
        },
        productionPlan: ["Ground claims."],
        strategySelection: {
          directionId: "alternative-1",
          hook: "What if your defining memory changed each time?",
        },
      },
      selectedDirectionId: "alternative-1",
      selectedHook: "What if your defining memory changed each time?",
      strategyFingerprint: "creator-strategy-v1-authoritative",
      profileSnapshot: {
        brandName: "",
        brandVoice: "premium documentary",
        defaultAudience: "educated general audience",
        defaultVisualStyle: "cinematic",
        defaultCountry: "global",
        defaultFormat: "youtube_video",
        defaultQualityMode: "standard",
        defaultCreditPreference: "balanced",
        editorialConstitution: {
          mission: "Explain carefully.",
          audiencePromise: "Grounded narration.",
          editorialPointOfView: "Evidence first.",
        },
      },
      script: null,
      pendingRefinement: null,
      revisionHistory: [],
    },
    production: {
      package: null,
      refinedScenes: [],
      backgroundMusic: null,
      projectContinuityMode: "independent",
      sceneContinuityModes: {},
      voicePreferences: null,
    },
    createReview: { scenes: [] },
    publish: {
      metadata: null,
      thumbnail: null,
      thumbnailDesign: null,
      confirmations: {},
      packageDownloaded: false,
      packageSignature: "",
      finalVideoUrl: "",
      finalVideoSignature: "",
    },
  });
}


export function syntheticResearch(){
 const sentences=[
  'The synthetic energy register records 415 units of data-centre demand in 2024, with measurement uncertainty.',
  'The synthetic mineral register records concentration across three refining locations in 2024.',
  'The synthetic factory register counts five thousand industrial machines in 2025, not eliminated jobs.',
  'The synthetic policy record describes targeted computing export controls announced in 2022.',
  'The synthetic security assessment describes modernization of nuclear arsenals during 2025, not inevitable conflict.',
  'The synthetic diplomatic record documents an expressed commitment to human decisions and continued cooperation.',
  'The synthetic governance document describes a voluntary risk-management framework, not a guarantee of control.'
 ];
 const sources=sentences.map((summary,i)=>({sourceId:`synthetic-source-${i}`,adapterId:'web',mediaKind:'document',externalId:null,title:`Synthetic register ${i}`,url:`https://fixture.example/register-${i}`,publisher:'Synthetic Fixture Office',author:null,publishedAt:'2026-01-01',language:'en',summary,thumbnailUrl:null,durationSec:null,metrics:{},sourceMetadata:{}}));
 const claims=sources.map((source,i)=>({claimId:`synthetic-fact-${i}`,claimType:'PRIMARY_SOURCE_CLAIM',text:sentences[i],propositionKind:'document_assertion',origin:{attributedEntity:null,referencedWork:source.url}}));
 for(const [i,text] of [
  'Explicitly fictional 2055: automation replaces much economically necessary labor.',
  'Explicitly fictional 2055: energy and compute ownership concentrate power.',
  'Explicitly fictional 2055: the United States and China lead competing technological blocs.',
  'Explicitly fictional 2055: resource dependency reshapes alliances and practical independence.',
  'Explicitly fictional 2075: political decisions escalate competition into devastating nuclear conflict.',
  'Explicitly fictional 2075: people suffer and institutions struggle to rebuild a new order.',
  'Explicitly fictional 2075: AI systems gain strategic autonomy over infrastructure and resource allocation.'
 ].entries())claims.push({claimId:`synthetic-fiction-${i}`,claimType:'THOUGHT_EXPERIMENT',text,propositionKind:'editorial_inference',origin:{attributedEntity:null,referencedWork:null}});
 const evidence=sources.map((s,i)=>({evidenceId:`synthetic-evidence-${i}`,sourceId:s.sourceId,excerpt:sentences[i],contextNote:'Synthetic fixture only. These test records make no factual claim about the real world.',locator:{section:'Fixture record',page:null,timecodeStartSec:null,timecodeEndSec:null}}));
 const links=evidence.map((e,i)=>({claimId:claims[i].claimId,evidenceId:e.evidenceId,stance:'supports'}));
 links.push({claimId:claims[3].claimId,evidenceId:evidence[5].evidenceId,stance:'contextualizes'});
 return {sources,claims,evidence,links};
}
export async function createIntegratedFixture({research=syntheticResearch(),scriptProvider,mutateProject,targetDurationSec=540}={}){
 const state=canonicalState();
 state.brief.durationSec=targetDurationSec;state.brief.customDurationSec=targetDurationSec;
 state.strategy.selectedDirectionId="recommended";
 state.strategy.selectedHook="Who controls the infrastructure of this explicitly fictional future?";
 state.strategy.mentorResult.recommendedIdea={title:"2055 to 2075: The Rise of AI Empires",reason:"Follow political choices, resource dependence and human consequences in explicit fiction, using documented starting conditions."};
 state.strategy.mentorResult.videoIdeas=[{title:"2055 to 2075: The Rise of AI Empires",concept:"Recommended duplicate"}];
 state.strategy.strategyFingerprint=createCreatorStrategyBindingFingerprint({topic:state.brief.topic,selectedDirectionId:state.strategy.selectedDirectionId,selectedHook:state.strategy.selectedHook,language:state.brief.language,country:state.brief.country,audience:state.brief.ageGroup,contentType:state.brief.contentType,format:state.brief.format,targetDurationSec,creatorProfile:state.strategy.profileSnapshot,mentorResult:state.strategy.mentorResult});
 state.publish.finalVideoUrl='https://fixture.example/original.mp4';state.publish.finalVideoSignature='synthetic-original-signature';
 const project={id:projectId,owner_user_id:ownerId,flow_type:'creator_lab',updated_at:revision,exported_movie_result:{creatorProjectState:state,originalMetadata:{preserved:true}},scenes:Array.from({length:36},(_,i)=>({id:`synthetic-scene-${i}`,text:`Synthetic preserved narration ${i}`,image:`https://fixture.example/image-${i}`,audio:`https://fixture.example/audio-${i}`})),audioTimeline:{synthetic:true},historicalRevision2:{preserved:true,script:'Synthetic historical script; never replace.'}};
 mutateProject?.(project);
 const projectBefore=JSON.stringify(project);
 const projectRepository={getForOwner:async(id,owner)=>id===projectId&&owner===ownerId?clone(project):null};
 const {createCreatorScriptBuildSnapshotFromProject}=await import('../../lib/creator/creatorScriptBuildSnapshot.server.ts');
 const snapshot=(await createCreatorScriptBuildSnapshotFromProject({ownerId,projectId,expectedProjectUpdatedAt:revision,projectRepository})).snapshot;
 const build={buildId:'20000000-0000-4000-8000-000000000001',ownerId,projectId,idempotencyKey:createCreatorScriptBuildIdempotencyKey({ownerId,snapshot}),state:'REQUESTED',snapshot,checkpoints:{},failure:null,resultAuthority:null,createdAt:revision,updatedAt:revision};
 const repository=new MemoryRepository(build);const calls={research:0,editorial:0,generation:0,repair:0};
 const noProvider=async()=>{throw Error('UNEXPECTED_PROVIDER_CALL');};
 const providers={
  executeResearch:async()=>{calls.research++;return {version:'0.19E2A-research-result-v1',sources:research.sources,lanes:[{laneId:'baseline',purpose:'baseline',required:true,status:'ready',sourceIds:research.sources.map(s=>s.sourceId)}]};},
  executeEditorialProposal:async input=>{calls.editorial++;return {proposal:{items:research.claims.map(c=>({claim:{text:c.text,claimType:c.claimType,propositionKind:c.propositionKind,origin:c.origin},evidenceSelections:research.links.filter(l=>l.claimId===c.claimId).map(l=>{const e=research.evidence.find(e=>e.evidenceId===l.evidenceId);const span=input.candidateSpans.find(s=>s.sourceId===e.sourceId && s.text.includes(e.excerpt));assert(span,'retained source passage must survive real span catalogue');return {sourceId:span.sourceId,spanId:span.spanId,stance:l.stance,contextNote:e.contextNote};})}))}};},
  executePrimaryAcquisition:noProvider,executePrimaryCoverageSelection:noProvider,
  executeScriptGeneration:async input=>{calls.generation++;return scriptProvider?scriptProvider(input):{version:'0.19E3A-script-generation-proposal-v1',sections:input.sectionPlan.map((s,i)=>({heading:`Synthetic geopolitical chapter ${i+1}`,text:'Explicitly fictional test draft.',claimIds:[input.permittedClaimIds[0]]}))};},
  executeScriptRepair:async()=>{calls.repair++;throw Error('UNEXPECTED_REPAIR_PROVIDER_CALL');}
 };
 const runtime=createCreatorScriptBuildRuntime({buildRepository:repository,projectRepository,providers,now:()=>now});
 const api=createCreatorScriptBuildApiController({authenticate:async request=>{if(request.headers.get('authorization')!=='Bearer synthetic')throw Error('AUTH_REQUIRED');return {ownerId};},featureEnabled:()=>true,createSnapshot:async input=>(await createCreatorScriptBuildSnapshotFromProject({...input,projectRepository})).snapshot,createRuntime:async()=>runtime});
 const fetchImpl=async(url,init={})=>{assert(String(url).startsWith('/api/creator-script-build'));const request=new Request('http://fixture.local'+url,{...init});const response=init.method==='POST'?await api.post(request):await api.get(request);return Response.json(response.body,{status:response.status});};
 return {api,runtime,repository,project,projectBefore,snapshot,calls,fetchImpl,preservation:()=>{assert.equal(JSON.stringify(project),projectBefore);assert.equal(repository.projectWrites,0);}};
}

// Test transport adapter for retained public captures: copy source-owned text,
// never manufacture a summary from a model assertion. Full originals stay in
// the independently hashed package. The application input limits are unchanged.
export function boundedRetainedResearch(graph){
 const value=clone(graph);
 for(const s of value.sources){
  const original=s.summary;assert.equal(typeof original,'string');
  const ranges=value.evidence.filter(e=>e.sourceId===s.sourceId).map(e=>{
   const i=original.indexOf(e.excerpt);assert(i>=0,'excerpt must match retained original');
   return [Math.max(0,i-200),Math.min(original.length,i+e.excerpt.length+350)];
  }).sort((a,b)=>a[0]-b[0]);
  const merged=[];for(const r of ranges){const last=merged.at(-1);if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push(r);}
  s.summary=merged.map(([a,b])=>original.slice(a,b)).join('\n');
  assert(s.summary.length<=2500,'preserve normal transport limits');
  for(const e of value.evidence.filter(e=>e.sourceId===s.sourceId))assert(s.summary.includes(e.excerpt));
 }
 return value;
}
