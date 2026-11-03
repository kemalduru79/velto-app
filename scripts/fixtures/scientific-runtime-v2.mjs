// All identities here are synthetic. No image, credential or qualification exists.
import {scientificSha256,stableScientificJson} from '../../lib/creator/scientificReview/authorityContracts.ts';
import {computeScientificCalculationRequestIdentity,computeScientificCalculationInputDataSha256,SCIENTIFIC_CALCULATION_METHODS} from '../../lib/creator/scientificReview/calculationContracts.ts';
export const hash=label=>scientificSha256('synthetic-only:'+label);
export function profileFixture(){
 return{version:'scientific-runtime-profile-v2',profileId:'linux-amd64-scientific-container-v2',platform:'linux/amd64',
  engine:{executable:'/opt/fixture/docker',executableSha256:hash('engine'),version:'29.6.2',socketPath:'/opt/fixture/docker.sock',configDirectory:'/opt/fixture/empty-config',daemonIdentitySha256:hash('daemon'),supervisorSha256:hash('supervisor')},
  image:{reference:'registry.invalid/scientific@sha256:'+hash('manifest'),indexSha256:hash('index'),manifestSha256:hash('manifest'),configSha256:hash('config')},
  worker:{path:'/opt/velto/scientific_compute_v2.py',sha256:hash('worker'),protocol:'scientific-result-v2'},
  dependencies:{pythonVersion:'3.11.18',pythonExecutable:'/usr/local/bin/python3',pythonSha256:hash('python'),numpyVersion:'2.1.3',scipyVersion:'1.13.1',inventorySha256:hash('inventory'),blasSha256:hash('blas')},
  evidence:{artifactAuthoritySha256:hash('artifact-authority'),issuerPolicySha256:hash('issuer'),securityAssessmentSha256:hash('security'),isolationAcceptanceSha256:hash('isolation'),supervisorAcceptanceSha256:hash('supervisor-acceptance')}};
}
export const profileHash=p=>scientificSha256(stableScientificJson(p));
export function requestFixture(operation='descriptive_statistics_v1',parameters={values:[1,3],ddof:0}){
 const dataKeys=Object.keys(parameters).sort();
 const base={version:'stage-5e1g-b-calculation-request-v1',operationId:'synthetic-v2-operation',operation,method:SCIENTIFIC_CALCULATION_METHODS[operation],
  sourceBindings:[{sourceId:'synthetic-source',sourceVersion:'v1',documentSha256:hash('doc'),evidenceIds:['synthetic-evidence'],dataKeys,
   dataFingerprintSha256:scientificSha256(stableScientificJson(Object.fromEntries(dataKeys.map(k=>[k,parameters[k]]))))}],parameters,
  inputDataSha256:computeScientificCalculationInputDataSha256(parameters),precision:{decimalPlaces:12,absoluteTolerance:1e-10,relativeTolerance:1e-10},limitations:['SYNTHETIC_FIXTURE_ONLY']};
 return{...base,requestIdentitySha256:computeScientificCalculationRequestIdentity(base)};
}
export const resultJsonFixture='{"maximum":3.0,"mean":2.0,"median":2.0,"minimum":1.0,"n":2,"standardDeviation":1.0,"variance":1.0}';
export function workerOutputFixture(request,profile,resultJson=resultJsonFixture){
 return{protocol:'scientific-result-v2',requestIdentitySha256:request.requestIdentitySha256,profileSha256:profileHash(profile),operation:request.operation,
  pythonVersion:profile.dependencies.pythonVersion,numpyVersion:profile.dependencies.numpyVersion,scipyVersion:profile.dependencies.scipyVersion,workerSha256:profile.worker.sha256,
  result:JSON.parse(resultJson),resultJson,resultSha256:scientificSha256(resultJson)};
}
export function exitFixture(invocation,profile){
 return{ownedName:invocation.ownedName,containerId:hash('container'),exitCode:0,observed:{profileSha256:profileHash(profile),engineSha256:profile.engine.executableSha256,
  daemonIdentitySha256:profile.engine.daemonIdentitySha256,imageManifestSha256:profile.image.manifestSha256,indexSha256:profile.image.indexSha256,imageConfigSha256:profile.image.configSha256,
  workerSha256:profile.worker.sha256,pythonSha256:profile.dependencies.pythonSha256,inventorySha256:profile.dependencies.inventorySha256,blasSha256:profile.dependencies.blasSha256,
  isolationAcceptanceSha256:profile.evidence.isolationAcceptanceSha256,supervisorSha256:profile.engine.supervisorSha256}};
}
export function transportFixture(request,profile,hooks={}){
 const calls={execute:0,reconcile:0,invocations:[],identities:[]};
 const transport={mode:'OFFLINE_SYNTHETIC',execute:async(invocation,events)=>{
  calls.execute++;calls.invocations.push(structuredClone(invocation));
  if(hooks.execute)return hooks.execute(invocation,events);
  events.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));return exitFixture(invocation,profile);
 },reconcile:async(identity,signal)=>{
  calls.reconcile++;calls.identities.push(structuredClone(identity));
  return hooks.reconcile?hooks.reconcile(identity,signal):{ownedName:identity.ownedName,containerId:identity.containerId,creationSettled:true,containerAbsent:true};
 }};
 return{transport,calls};
}

// Volatile test double: NOT filesystem safety, fsync or durable replay evidence.
export function storageModelFixture(){
 const records=new Map();
 const storage={mode:'VOLATILE_SYNTHETIC_STORAGE',admit:async identity=>{
  if(records.has(identity))throw Error('SCIENTIFIC_V2_REPLAY_OR_RUN_UNAVAILABLE');
  const files=new Map();records.set(identity,files);
  return{create:async(name,value)=>{
   if(files.has(name))throw Error('SCIENTIFIC_V2_REPLAY_OR_RUN_UNAVAILABLE');
   files.set(name,structuredClone(value));
  }};
 }};
 return{storage,records};
}
