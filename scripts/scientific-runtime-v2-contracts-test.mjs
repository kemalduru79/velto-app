import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {inspectScientificRuntimeProfile,selectScientificRuntimeProfile,executeScientificContainerV2,runScientificCalculationForProfile,SCIENTIFIC_DARWIN_V1_PROFILE,SCIENTIFIC_V2_REAL_EXECUTION_ENABLED} from '../lib/creator/scientificReview/runtimeProfiles.ts';
import {validateScientificV2Profile,validateScientificV2Result,parseScientificV2Json} from '../lib/creator/scientificReview/runtimeV2Contracts.ts';
import {scientificSha256,stableScientificJson} from '../lib/creator/scientificReview/authorityContracts.ts';
import {profileFixture,profileHash,requestFixture,workerOutputFixture,resultJsonFixture,hash} from './fixtures/scientific-runtime-v2.mjs';

const profile=profileFixture(),request=requestFixture();
assert.equal(SCIENTIFIC_V2_REAL_EXECUTION_ENABLED,false);
for(const id of ['linux-amd64-scientific-container-v2','linux-arm64-scientific-container-v2']){
 assert.equal(inspectScientificRuntimeProfile(id).availability,'UNQUALIFIED_EXECUTION_DISABLED');
 assert.throws(()=>selectScientificRuntimeProfile(id),/PROFILE_UNQUALIFIED/);
 await assert.rejects(runScientificCalculationForProfile(request,{profileId:id,runDirectory:'/no-write-allowed'}),/PROFILE_UNQUALIFIED/);
}
for(const id of [undefined,null,'','ubuntu-python',{},'darwin-system-python-3.9.6-scipy-gated-v1\n'])assert.throws(()=>selectScientificRuntimeProfile(id),/PROFILE_UNKNOWN/);
if(process.platform==='darwin')assert.equal(selectScientificRuntimeProfile(SCIENTIFIC_DARWIN_V1_PROFILE).kind,'darwin_v1');
else assert.throws(()=>selectScientificRuntimeProfile(SCIENTIFIC_DARWIN_V1_PROFILE),/PROFILE_HOST_UNAVAILABLE/);
// Environment changes cannot switch the disabled production boundary on.
const originalEnable=process.env.SCIENTIFIC_V2_REAL_EXECUTION_ENABLED;
process.env.SCIENTIFIC_V2_REAL_EXECUTION_ENABLED='true';
await assert.rejects(executeScientificContainerV2(),/REAL_EXECUTION_DISABLED/);
if(originalEnable===undefined)delete process.env.SCIENTIFIC_V2_REAL_EXECUTION_ENABLED;else process.env.SCIENTIFIC_V2_REAL_EXECUTION_ENABLED=originalEnable;
assert.deepEqual(validateScientificV2Profile(profile,profileHash(profile)),profile);
const arm=structuredClone(profile);arm.profileId='linux-arm64-scientific-container-v2';arm.platform='linux/arm64';
assert.equal(validateScientificV2Profile(arm,profileHash(arm)).platform,'linux/arm64');
for(const mutate of [p=>p.worker.sha256=hash('changed'),p=>p.dependencies.inventorySha256=hash('changed'),p=>p.evidence.isolationAcceptanceSha256=hash('changed')]){
 const changed=structuredClone(profile);mutate(changed);assert.throws(()=>validateScientificV2Profile(changed,profileHash(profile)),/PROFILE_IDENTITY_MISMATCH/);
}
for(const mutate of [p=>delete p.evidence.securityAssessmentSha256,p=>p.engine.socketPath='tcp://remote.invalid',p=>p.engine.executable='/opt/../docker',p=>p.dependencies.numpyVersion='latest',p=>p.image.reference='registry.invalid/scientific:latest',p=>p.platform='linux/arm64',p=>p.evidence.approved=true]){
 const changed=structuredClone(profile);mutate(changed);assert.throws(()=>validateScientificV2Profile(changed,profileHash(changed)),/SCIENTIFIC_V2_/);
}
const output=workerOutputFixture(request,profile);
const validated=validateScientificV2Result(Buffer.from(JSON.stringify(output)),request,profile,profileHash(profile));
assert.equal(validated.resultJson,resultJsonFixture);
assert.notEqual(scientificSha256(stableScientificJson(validated.result)),validated.resultSha256,'Do not replace the preserved Python bytes with JS JSON.');
for(const mutate of [o=>o.resultJson+=' ',o=>o.result.mean=99,o=>o.pythonVersion='0.0.0',o=>o.numpyVersion='0.0.0',o=>o.workerSha256=hash('bad'),o=>o.requestIdentitySha256=hash('other')]){
 const changed=structuredClone(output);mutate(changed);assert.throws(()=>validateScientificV2Result(Buffer.from(JSON.stringify(changed)),request,profile,profileHash(profile)),/SCIENTIFIC_V2_/);
}
for(const text of ['{"n":2,"n":3}','{"n":2,"\\u006e":3}','{"x":1e999}','{"x":NaN}','{"x":[1,]}','{"x":"bad\n"}','{"x":01}','[] trailing']){
 assert.throws(()=>parseScientificV2Json(Buffer.from(text)),/SCIENTIFIC_V2_/);
}
assert.throws(()=>parseScientificV2Json(Uint8Array.from([0xff])),/JSON_INVALID/);
for(const result of [{...output.result,mean:Infinity},{...output.result,n:3},{...output.result,extra:1}]){
 const changed=workerOutputFixture(request,profile,JSON.stringify(result));assert.throws(()=>validateScientificV2Result(Buffer.from(JSON.stringify(changed)),request,profile,profileHash(profile)),/SCIENTIFIC_V2_/);
}
for(const [operation,parameters,result] of [
 ['cohens_d_independent_v1',{groupA:[1,3],groupB:[2,4]},{nA:2,nB:2,cohensD:-1,pooledStandardDeviation:1}],
 ['normal_mean_ci_known_sigma_v1',{values:[1,3],populationSigma:1,confidenceLevel:0.95},{n:2,mean:2,confidenceLevel:0.95,lower:1,upper:3,marginOfError:1}],
 ['mean_t_ci_scipy_v1',{values:[1,3],confidenceLevel:0.95},{n:2,degreesOfFreedom:1,mean:2,confidenceLevel:0.95,lower:1,upper:3,marginOfError:1}],
 ['exponential_growth_doubling_v1',{startValue:4,endValue:2,elapsedTime:1},{multiplier:0.5,logGrowthRatePerUnit:-0.5,doublingTime:null}],
 ['log_linear_model_fit_v1',{x:[1,2,3],y:[2,4,8]},{n:3,logIntercept:0,logSlope:0.5,rSquaredLogSpace:1,rmseLogSpace:0,doublingTime:2}],
]){
 // Schema-only synthetic numbers; these are NOT reference calculation results.
 const r=requestFixture(operation,parameters),o=workerOutputFixture(r,profile,JSON.stringify(Object.fromEntries(Object.keys(result).sort().map(key=>[key,result[key]]))));
 validateScientificV2Result(Buffer.from(JSON.stringify(o)),r,profile,profileHash(profile));
}
for(const text of [JSON.stringify(output.result,null,2),JSON.stringify(Object.fromEntries(Object.entries(output.result).reverse()))]){
 const changed={...output,resultJson:text,resultSha256:scientificSha256(text)};
 assert.throws(()=>validateScientificV2Result(Buffer.from(JSON.stringify(changed)),request,profile,profileHash(profile)),/RESULT_NOT_CANONICAL/);
}
const duplicate=structuredClone(output);duplicate.resultJson=resultJsonFixture.replace('"mean":2.0','"mean":2.0,"mean":3.0');duplicate.resultSha256=scientificSha256(duplicate.resultJson);
assert.throws(()=>validateScientificV2Result(Buffer.from(JSON.stringify(duplicate)),request,profile,profileHash(profile)),/JSON_DUPLICATE_KEY/);
// Exact decimal consistency, independently of binary64 rounding/JSON.stringify.
for(const token of ['9007199254740992','9007199254740993','-9007199254740993','9007199254740993.0','9.007199254740993e15','1e-999']){
 assert.throws(()=>parseScientificV2Json(Buffer.from('{"value":'+token+'}')),/NUMERIC_DOMAIN_INVALID/);
}
for(const token of ['9007199254740991','-9007199254740991','9007199254740991.0','9.007199254740991e15']){
 assert.equal(Math.abs(parseScientificV2Json(Buffer.from('{"value":'+token+'}')).value),Number.MAX_SAFE_INTEGER);
}
const lossy=structuredClone(output);
lossy.resultJson=lossy.resultJson.replace('"mean":2.0','"mean":9007199254740993');
lossy.resultSha256=scientificSha256(lossy.resultJson);lossy.result.mean=9007199254740992;
assert.throws(()=>validateScientificV2Result(Buffer.from(JSON.stringify(lossy)),request,profile,profileHash(profile)),/NUMERIC_DOMAIN_INVALID/);
const rounded=structuredClone(output);
rounded.resultJson=rounded.resultJson.replace('"mean":2.0','"mean":0.10000000000000001');rounded.resultSha256=scientificSha256(rounded.resultJson);rounded.result.mean=0.1;
assert.throws(()=>validateScientificV2Result(Buffer.from(JSON.stringify(rounded)),request,profile,profileHash(profile)),/RESULT_CONSISTENCY_MISMATCH/);
for(const [inner,outer] of [['1e0',1],['1.00',1],['-0.0',0],['0.1',0.1],['9007199254740991.0',Number.MAX_SAFE_INTEGER]]){
 const o=structuredClone(output);o.resultJson=o.resultJson.replace('"mean":2.0','"mean":'+inner);o.resultSha256=scientificSha256(o.resultJson);o.result.mean=outer;
 const result=validateScientificV2Result(Buffer.from(JSON.stringify(o)),request,profile,profileHash(profile));assert.equal(result.resultJson,o.resultJson);assert.equal(result.resultSha256,o.resultSha256);
}
console.log('V2_NUMERIC_DOMAIN_AND_LOSSLESS_DECIMAL_CONSISTENCY=PASS');
// This optional local probe checks serialization only, never Linux/runtime qualification.
if(process.platform==='darwin'){
 const pinned=JSON.parse(fs.readFileSync('lib/creator/scientificReview/scientificComputeRuntime.v1.json'));
 assert.equal(scientificSha256(fs.readFileSync(pinned.pythonExecutable)),pinned.pythonExecutableSha256);
 const labels={request_sha256:request.requestIdentitySha256,profile_sha256:profileHash(profile),operation:request.operation,python_version:profile.dependencies.pythonVersion,
  numpy_version:profile.dependencies.numpyVersion,scipy_version:profile.dependencies.scipyVersion,worker_sha256:profile.worker.sha256,result:output.result};
 const result=spawnSync(pinned.pythonExecutable,['-I','-B','scripts/fixtures/scientific-runtime-v2-protocol-probe.py'],{input:JSON.stringify(labels),encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);const produced=validateScientificV2Result(Buffer.from(result.stdout),request,profile,profileHash(profile));assert(produced.resultJson.includes('"mean":2.0'));assert.notEqual(produced.resultSha256,scientificSha256(stableScientificJson(produced.result)));
 for(const invalid of [{...labels,result:{n:true}},{...labels,result:{n:null}},{...labels,worker_sha256:'bad'},{...labels,result:{n:9007199254740992}},{...labels,result:{mean:9007199254740992}}]){
  const rejected=spawnSync(pinned.pythonExecutable,['-I','-B','scripts/fixtures/scientific-runtime-v2-protocol-probe.py'],{input:JSON.stringify(invalid),encoding:'utf8'});assert.notEqual(rejected.status,0);
 }
 console.log('V2_PYTHON_SERIALIZER=PASS (local formatting only; supplied fixture labels are not attestation)');
}
console.log('SCIENTIFIC_V2_PROFILE_AND_PROTOCOL_CONTRACTS=PASS');
console.log('REAL_CONTAINER_EXECUTION=DISABLED; LINUX_SCIPY_ISOLATION_ACCEPTANCE=NOT_ESTABLISHED');
