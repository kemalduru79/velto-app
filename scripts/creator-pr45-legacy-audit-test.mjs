import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createJiti} from "jiti";
const root=new URL("..",import.meta.url).pathname.replace(/\/$/,"");
const jiti=createJiti(import.meta.url,{alias:{"@":root}});
const {readCreatorProjectState}=await jiti.import("../lib/creator/projectState.ts");
const owner="11111111-1111-4111-8111-111111111111";
const route=new URL("./creator-pr45-legacy-audit.mjs",import.meta.url).pathname;
const run=(records,env={VELTO_AUDIT_OWNER_ID:owner})=>spawnSync(process.execPath,["--experimental-transform-types",route],{
  cwd:new URL("..",import.meta.url).pathname,
  input:records.map(x=>JSON.stringify(x)).join("\n")+"\n",
  encoding:"utf8",env:{...process.env,...env},
});
const record=(strategy)=>{
 const snapshot=readCreatorProjectState({});snapshot.strategy={...snapshot.strategy,...strategy};
 return{id:"33333333-3333-4333-8333-333333333333",user_id:owner,flow_type:"creator_lab",exported_movie_result:{creatorProjectState:snapshot}};
};
const current=record({script:null,pendingRefinement:null});
const valid=run([current]);assert.equal(valid.status,0,valid.stderr);
assert.deepEqual(JSON.parse(valid.stdout).counts,{
  reviewed:1,current:0,historical_read_only:0,invalid:0,no_script:1,pending_historical:0,pending_invalid:0,
});
const mismatch=run([{...current,user_id:"22222222-2222-4222-8222-222222222222"}]);
assert.equal(mismatch.status,2);assert.match(mismatch.stderr,/AUDIT_OWNER_OR_FLOW_MISMATCH/);assert.equal(mismatch.stdout,"");
const wrongFlow=run([{...current,flow_type:"storyverse"}]);assert.equal(wrongFlow.status,2);assert.equal(wrongFlow.stdout,"");
const bad=spawnSync(process.execPath,["--experimental-transform-types",route],{
  cwd:new URL("..",import.meta.url).pathname,input:"not-json",encoding:"utf8",env:{...process.env,VELTO_AUDIT_OWNER_ID:owner},
});assert.equal(bad.status,2);assert.equal(bad.stdout,"");
const noAuth=run([current],{VELTO_AUDIT_OWNER_ID:""});assert.equal(noAuth.status,2);assert.equal(noAuth.stdout,"");
const malformed=structuredClone(current);malformed.exported_movie_result.creatorProjectState.version=999;
const classified=run([malformed]);assert.equal(classified.status,0);
assert.equal(JSON.parse(classified.stdout).counts.invalid,1);
assert.equal(JSON.parse(classified.stdout).counts.no_script,0);
assert.deepEqual(JSON.parse(classified.stdout).reasons,{PROJECT_STATE_QUARANTINED:1});
const duplicate=run([current,current]);assert.equal(duplicate.status,2);assert.equal(duplicate.stdout,"");assert.match(duplicate.stderr,/AUDIT_PROJECT_ID_INVALID_OR_DUPLICATE/);
const oversized=spawnSync(process.execPath,["--experimental-transform-types",route],{
 cwd:root,input:" ".repeat(20*1024*1024+1),encoding:"utf8",env:{...process.env,VELTO_AUDIT_OWNER_ID:owner},
});assert.equal(oversized.status,2);assert.equal(oversized.stdout,"");assert.match(oversized.stderr,/AUDIT_INPUT_LIMIT_EXCEEDED/);
const sentinel="private-script-https://secret.invalid/?token=synthetic";
const badScript=record({script:{secret:sentinel},pendingRefinement:{proposedScript:{secret:sentinel}}});
const redacted=run([badScript]);assert.equal(redacted.status,0);assert.equal(JSON.parse(redacted.stdout).counts.invalid,1);assert.equal(JSON.parse(redacted.stdout).counts.pending_invalid,1);
assert(!redacted.stdout.includes(sentinel));assert(!redacted.stderr.includes(sentinel));
console.log("PR45_OFFLINE_AUDIT_OWNER_SCOPE_AND_PRIVACY=PASS");
