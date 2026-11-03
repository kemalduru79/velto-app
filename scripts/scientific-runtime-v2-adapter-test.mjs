import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runOfflineScientificV2 as filesystemRun,modelOfflineScientificV2,SCIENTIFIC_V2_CHUNK_LIMIT} from '../lib/creator/scientificReview/runtimeV2Adapter.ts';
import {scientificSha256 as hashBytes} from '../lib/creator/scientificReview/authorityContracts.ts';
import {sealScientificV2Receipt,verifyScientificV2Receipt} from '../lib/creator/scientificReview/runtimeV2Contracts.ts';
import {profileFixture,profileHash,requestFixture,workerOutputFixture,exitFixture,transportFixture,storageModelFixture,hash} from './fixtures/scientific-runtime-v2.mjs';

const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'pr45-v2-offline-')));
await fs.chmod(root,0o700);
const profile=profileFixture(),request=requestFixture();let count=0;
const {storage,records}=storageModelFixture();
const runOfflineScientificV2=(request,options,transport)=>modelOfflineScientificV2(request,options,transport,storage);
const spin=ms=>{const start=performance.now();while(performance.now()-start<ms){/* starve timers */}};
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('NETWORK_FORBIDDEN');};
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
const options=(name,extra={})=>({profile,expectedProfileSha256:profileHash(profile),runDirectory:path.join(root,name),...extra});
const read=async(name,file)=>{const value=records.get(path.join(root,name))?.get(file);if(value===undefined)throw Object.assign(Error('missing model record'),{code:'ENOENT'});return structuredClone(value);};
async function absent(name,file){assert(!records.get(path.join(root,name))?.has(file));}
async function failureCase(name,hooks,pattern,extra={}){
 const {transport,calls}=transportFixture(request,profile,hooks);
 await assert.rejects(runOfflineScientificV2(request,options(name,extra),transport),pattern);
 assert.equal(calls.execute,1);assert.equal(calls.reconcile,1);await absent(name,'receipt.json');
 const failure=await read(name,'failure.json');assert.equal(failure.state,'TERMINAL_NO_AUTOMATIC_RETRY');assert.equal(failure.automaticRetry,false);
 assert(!JSON.stringify(failure).includes('sensitive-token'));
 await assert.rejects(runOfflineScientificV2(request,options(name),transport),/REPLAY_OR_RUN_UNAVAILABLE/);
 assert.equal(calls.execute,1,'No retry/replay dispatch');return{failure,calls};
}
try{
 await test('successful volatile synthetic lifecycle: admission ordering, argv/environment, exact bytes, receipt',async()=>{
  const {transport,calls}=transportFixture(request,profile,{execute:async(inv,events)=>{
   const marker=await read('success','attempt-0001-consumed.json');assert.equal(marker.state,'CONSUMED_BEFORE_SYNTHETIC_DISPATCH');assert.equal(marker.ownedName,inv.ownedName);
   assert.equal((await read('success','request.json')).requestIdentitySha256,request.requestIdentitySha256);
   const bytes=Buffer.from(JSON.stringify(workerOutputFixture(request,profile)));events.stdout(bytes.subarray(0,17));events.stdout(bytes.subarray(17));
   return exitFixture(inv,profile);
  }});
  const before=process.env.DOCKER_HOST;process.env.DOCKER_HOST='tcp://sensitive-token.invalid';
  let receipt;try{receipt=await runOfflineScientificV2(request,options('success'),transport);}finally{if(before===undefined)delete process.env.DOCKER_HOST;else process.env.DOCKER_HOST=before;}
  assert.equal(receipt.executionMode,'OFFLINE_SYNTHETIC');assert.equal(receipt.qualification,'NOT_ESTABLISHED');assert.equal(receipt.liveAuthorization,false);
  assert.equal(receipt.lifecycle.state,'RECONCILED');assert.equal(receipt.result.resultJson,workerOutputFixture(request,profile).resultJson);
  assert.equal(calls.execute,1);assert.equal(calls.reconcile,1);
  const cleanup=calls.identities[0];assert.equal(cleanup.requireOwnershipBeforeMutation,true);
  assert.deepEqual(cleanup.commands.map(command=>command.action),['inspect','kill','remove']);
  for(const command of cleanup.commands){assert.equal(command.args.at(-1),receipt.lifecycle.ownedName);assert(!command.args.includes('prune'));assert.equal(command.executable,profile.engine.executable);}
  const inv=calls.invocations[0],argv=inv.args.join(' ');
  for(const flag of ['--interactive','--pull never','--network none','--read-only','--user 65532:65532','--cap-drop ALL','--cpus 1','--memory 536870912','--memory-swap 536870912','--pids-limit 64','--security-opt no-new-privileges=true','--tmpfs /tmp:rw,noexec,nosuid,nodev,size=67108864,mode=1777'])assert(argv.includes(flag),flag);
  assert(argv.includes(profile.image.reference));assert(argv.includes('unix://'+profile.engine.socketPath));
  assert(!/--privileged|--mount|--volume|--publish|--tty|sensitive-token/.test(argv));
  assert.deepEqual(Object.keys(inv.env).sort(),['LANG','LC_ALL','PATH','TZ']);assert(!JSON.stringify(inv.env).includes('sensitive-token'));
  assert.equal(storage.mode,'VOLATILE_SYNTHETIC_STORAGE','No filesystem durability acceptance');
  assert.deepEqual(verifyScientificV2Receipt(await read('success','receipt.json'),receipt),receipt);
  for(const change of [r=>r.result.result.mean=999,r=>r.profileSha256=hash('forged'),r=>r.lifecycle.containerId=hash('foreign'),r=>r.liveAuthorization=true,r=>r.runtime.dependencies.inventorySha256=hash('forged')]){
   const forged=structuredClone(receipt);change(forged);assert.throws(()=>verifyScientificV2Receipt(forged,receipt),/RECEIPT_TAMPERED/);
   const {receiptSha256,...body}=forged;assert.throws(()=>verifyScientificV2Receipt(sealScientificV2Receipt(body),receipt),/RECEIPT_TAMPERED/,'Resealing does not change retained execution authority');
  }
 });
 await test('replay rejected across independent invocations before dispatch',async()=>{
  const {transport,calls}=transportFixture(request,profile);
  await assert.rejects(runOfflineScientificV2(request,options('success'),transport),/REPLAY_OR_RUN_UNAVAILABLE/);assert.equal(calls.execute+calls.reconcile,0);
 });
 for(const channel of ['stdout','stderr'])await test(channel+' overflow is terminal and scoped cleanup runs',async()=>{
  const result=await failureCase('overflow-'+channel,{execute:async(inv,e)=>{e[channel](new Uint8Array(1_000_001));return exitFixture(inv,profile);}},/OUTPUT_LIMIT_EXCEEDED/);
  assert.equal(result.failure.reason,'OUTPUT_LIMIT_EXCEEDED');
 });
 await test('timeout cancels once and reconciles the owned attempt',async()=>{
  const result=await failureCase('timeout',{execute:async()=>new Promise(()=>{})},/TIMEOUT/,{timeoutMs:15});
  assert.equal(result.failure.reason,'TIMEOUT');assert.equal(result.calls.identities[0].containerId,null);
 });
 await test('cleanup exception never creates a successful receipt',async()=>{
  const result=await failureCase('cleanup-fail',{reconcile:async()=>{throw Error('sensitive-token');}},/RECONCILIATION_REQUIRED/);
  assert.equal(result.failure.reason,'RECONCILIATION_REQUIRED');
 });
 await test('hanging cleanup is bounded and requires reconciliation',async()=>{
  await failureCase('cleanup-timeout',{reconcile:async()=>new Promise(()=>{})},/RECONCILIATION_REQUIRED/,{cleanupTimeoutMs:15});
 });
 await test('absence without settled creation is insufficient',async()=>{
  await failureCase('unsettled',{reconcile:async id=>({ownedName:id.ownedName,containerId:id.containerId,creationSettled:false,containerAbsent:true})},/RECONCILIATION_REQUIRED/);
 });
 await test('mismatched cleanup identity cannot reconcile a foreign container',async()=>{
  await failureCase('cleanup-foreign',{reconcile:async id=>({ownedName:'foreign-container',containerId:id.containerId,creationSettled:true,containerAbsent:true})},/RECONCILIATION_REQUIRED/);
 });
 await test('timeout plus cleanup failure retains original reason without retry',async()=>{
  const {failure}=await failureCase('two-failures',{execute:async()=>new Promise(()=>{}),reconcile:async()=>{throw Error('offline cleanup failure');}},/RECONCILIATION_REQUIRED/,{timeoutMs:15});
  assert.equal(failure.executionReason,'TIMEOUT');
 });
 await test('external interrupt is terminal with scoped cleanup',async()=>{
  const abort=new AbortController();
  await failureCase('interrupt',{execute:async()=>{abort.abort();throw Error('sensitive-token');}},/INTERRUPTED/,{signal:abort.signal});
 });
 await test('interrupt before admission creates no run or dispatch',async()=>{
  const abort=new AbortController();abort.abort();const {transport,calls}=transportFixture(request,profile);
  await assert.rejects(runOfflineScientificV2(request,options('pre-interrupt',{signal:abort.signal}),transport),/INTERRUPTED_BEFORE_ADMISSION/);
  assert(!records.has(path.join(root,'pre-interrupt')));assert.equal(calls.execute+calls.reconcile,0);
 });
 await test('interrupt during modeled admission never dispatches and cannot replay',async()=>{
  const abort=new AbortController();const {transport,calls}=transportFixture(request,profile);
  const running=runOfflineScientificV2(request,options('admission-interrupt',{signal:abort.signal}),transport);abort.abort();
  await assert.rejects(running,/INTERRUPTED/);assert.equal(calls.execute,0);assert.equal(calls.reconcile,1);
  assert.equal((await read('admission-interrupt','failure.json')).reason,'INTERRUPTED');
 });
 await test('foreign lifecycle identity is never used for cleanup',async()=>{
  const result=await failureCase('foreign',{execute:async(inv,e)=>{e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));return{...exitFixture(inv,profile),ownedName:'foreign-container'};}},/EXECUTION_IDENTITY_OR_EXIT_INVALID/);
  assert.notEqual(result.calls.identities[0].ownedName,'foreign-container');assert.equal(result.calls.identities[0].containerId,null);
 });
 await test('observed runtime drift blocks receipt before unsafe CID adoption',async()=>{
  await failureCase('runtime-drift',{execute:async(inv,e)=>{e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));const exit=exitFixture(inv,profile);exit.observed.workerSha256=hash('altered-worker');return exit;}},/OBSERVED_IDENTITY_MISMATCH/);
 });
 await test('worker result digest drift is terminal',async()=>{
  await failureCase('result-drift',{execute:async(inv,e)=>{const output=workerOutputFixture(request,profile);output.resultSha256=hash('altered');e.stdout(Buffer.from(JSON.stringify(output)));return exitFixture(inv,profile);}},/RESULT_DIGEST_MISMATCH/);
 });
 await test('transport rejection cannot leak arbitrary exception content',async()=>{
  const result=await failureCase('transport-crash',{execute:async()=>{throw Error('https://fixture.invalid/?sensitive-token');}},/EXECUTION_INTERRUPTED_OR_FAILED/);
  assert.equal(result.failure.reason,'EXECUTION_INTERRUPTED_OR_FAILED');
 });
 await test('untrusted exception code is redacted as well as URLs',async()=>{
  const {failure}=await failureCase('untrusted-code',{execute:async()=>{throw Error('SCIENTIFIC_V2_PRIVATE_CREDENTIAL_SENTINEL');}},/EXECUTION_INTERRUPTED_OR_FAILED/);
  assert(!JSON.stringify(failure).includes('PRIVATE_CREDENTIAL_SENTINEL'));
 });
 await test('unknown transport kind, altered profiles and oversized input never dispatch',async()=>{
  const {transport,calls}=transportFixture(request,profile);const altered=structuredClone(profile);altered.worker.sha256=hash('bad');
  await assert.rejects(runOfflineScientificV2(request,options('bad-profile',{profile:altered}),transport),/PROFILE_IDENTITY_MISMATCH/);
  await assert.rejects(runOfflineScientificV2(request,options('bad-transport'),{...transport,mode:'REAL'}),/REAL_EXECUTION_DISABLED/);
  const huge=requestFixture('descriptive_statistics_v1',{values:[1,3],ddof:0,padding:Array.from({length:2100},()=> 'x'.repeat(500))});
  await assert.rejects(runOfflineScientificV2(huge,options('too-large'),transport),/INPUT_LIMIT_EXCEEDED/);
  assert.equal(calls.execute+calls.reconcile,0);await assert.rejects(fs.stat(path.join(root,'too-large')),{code:'ENOENT'});
 });
 await test('concurrent admission consumes exactly one ordinal',async()=>{
  const {transport,calls}=transportFixture(request,profile);
  const results=await Promise.allSettled([runOfflineScientificV2(request,options('concurrent'),transport),runOfflineScientificV2(request,options('concurrent'),transport)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(calls.execute,1);assert.equal(calls.reconcile,1);
  const rejected=results.find(result=>result.status==='rejected');assert.match(rejected.reason.message,/REPLAY_OR_RUN_UNAVAILABLE/);
 });
 await test('filesystem entry fails closed before admission or any adversarial callback',async()=>{
  const run=path.join(root,'no-fs-admission'),target=path.join(root,'unadmitted');await fs.mkdir(target,{mode:0o755});
  const mutable=options('no-fs-admission');
  const {transport,calls}=transportFixture(request,profile,{execute:async()=>{mutable.runDirectory=target;await fs.symlink(target,run);throw Error('must never execute');}});
  for(const directory of [run,target]){
   mutable.runDirectory=directory;
   await assert.rejects(filesystemRun(request,mutable,transport),/DIRECTORY_RELATIVE_PERSISTENCE_UNAVAILABLE/);
  }
  const linked=path.join(root,'linked');await fs.symlink(target,linked);
  await assert.rejects(filesystemRun(request,options('unused',{runDirectory:path.join(linked,'attempt')}),transport),/DIRECTORY_RELATIVE_PERSISTENCE_UNAVAILABLE/);
  assert.equal(calls.execute+calls.reconcile,0);assert.deepEqual(await fs.readdir(target),[]);
  await assert.rejects(fs.stat(run),{code:'ENOENT'});
 });
 await test('all modeled options and transport callbacks are snapshotted before awaits',async()=>{
  const abort=new AbortController(),mutable=options('snapshot',{signal:abort.signal});
  const originalProfile=structuredClone(mutable.profile);mutable.profile=structuredClone(mutable.profile);
  const {transport,calls}=transportFixture(request,profile,{execute:async(inv,e)=>{
   mutable.runDirectory=path.join(root,'redirected');mutable.expectedProfileSha256=hash('wrong');mutable.profile.worker.sha256=hash('wrong');mutable.timeoutMs=1;mutable.signal=new AbortController().signal;
   transport.reconcile=async()=>{throw Error('mutated callback must not run');};
   e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));return exitFixture(inv,profile);
  }});
  const receipt=await runOfflineScientificV2(request,mutable,transport);
  assert.deepEqual(receipt.runtime,originalProfile);assert.equal(calls.reconcile,1);
  assert(records.get(path.join(root,'snapshot')).has('receipt.json'));assert(!records.has(path.join(root,'redirected')));
 });
 for(const phase of ['execute','cleanup'])await test('60 ms blocking '+phase+' cannot succeed against 5 ms deadline',async()=>{
  const hooks=phase==='execute'?{execute:async(inv,e)=>{spin(60);e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));return exitFixture(inv,profile);}}
   :{reconcile:async id=>{spin(60);return{ownedName:id.ownedName,containerId:id.containerId,creationSettled:true,containerAbsent:true};}};
  await failureCase('starved-'+phase,hooks,phase==='execute'?/TIMEOUT/:/RECONCILIATION_REQUIRED/,phase==='execute'?{timeoutMs:5}:{cleanupTimeoutMs:5});
 });
 await test('synchronous result/identity validation is included in execution deadline',async()=>{
  await failureCase('slow-validation',{execute:async(inv,e)=>{
   e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));const exit=exitFixture(inv,profile);
   const id=exit.containerId;Object.defineProperty(exit,'containerId',{enumerable:true,get(){spin(60);return id;}});return exit;
  }},/TIMEOUT/,{timeoutMs:5});
 });
 await test('synchronous cleanup validation is included in cleanup deadline',async()=>{
  await failureCase('slow-cleanup-validation',{reconcile:async id=>({ownedName:id.ownedName,containerId:id.containerId,creationSettled:true,get containerAbsent(){spin(60);return true;}})},/RECONCILIATION_REQUIRED/,{cleanupTimeoutMs:5});
 });
 await test('synchronous abort listeners cannot hide overdue execution teardown',async()=>{
  await failureCase('slow-abort',{execute:async(inv,e)=>{e.signal.addEventListener('abort',()=>spin(60),{once:true});e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));return exitFixture(inv,profile);}},/TIMEOUT/,{timeoutMs:5});
 });
 await test('synchronous abort listeners cannot hide overdue cleanup teardown',async()=>{
  await failureCase('slow-cleanup-abort',{reconcile:async(id,signal)=>{signal.addEventListener('abort',()=>spin(60),{once:true});return{ownedName:id.ownedName,containerId:id.containerId,creationSettled:true,containerAbsent:true};}},/RECONCILIATION_REQUIRED/,{cleanupTimeoutMs:5});
 });
 await test('100,000 empty chunks ignored without consuming retained metadata budget',async()=>{
  const {transport}=transportFixture(request,profile,{execute:async(inv,e)=>{
   for(let i=0;i<100_000;i++){e.stdout(new Uint8Array());e.stderr(new Uint8Array());}
   e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));return exitFixture(inv,profile);
  }});
  assert.equal((await runOfflineScientificV2(request,options('empty-chunks'),transport)).lifecycle.state,'RECONCILED');
 });
 for(const channel of ['stdout','stderr'])await test(channel+' chunk count independently bounded below byte cap',async()=>{
  await failureCase('chunk-limit-'+channel,{execute:async(inv,e)=>{for(let i=0;i<=SCIENTIFIC_V2_CHUNK_LIMIT;i++)e[channel](Uint8Array.of(32));return exitFixture(inv,profile);}},/OUTPUT_CHUNK_LIMIT_EXCEEDED/);
 });
 for(const channel of ['stdout','stderr'])await test(channel+' shadowed byteLength cannot bypass actual byte cap',async()=>{
  await failureCase('shadowed-'+channel,{execute:async(inv,e)=>{
   const bytes=new Uint8Array(1_000_001);Object.defineProperty(bytes,'byteLength',{value:1});
   e[channel](bytes);e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));return exitFixture(inv,profile);
  }},/OUTPUT_LIMIT_EXCEEDED/);
 });
 for(const channel of ['stdout','stderr'])for(const length of [1_000_000,1_000_001])await test(channel+' actual byte boundary '+length,async()=>{
  const name='boundary-'+channel+'-'+length;
  const hooks={execute:async(inv,e)=>{
   const payload=Buffer.from(JSON.stringify(workerOutputFixture(request,profile)));
   const bytes=channel==='stdout'?Buffer.concat([payload,Buffer.alloc(length-payload.length,32)]):new Uint8Array(length);
   e[channel](bytes);if(channel==='stderr')e.stdout(payload);return exitFixture(inv,profile);
  }};
  if(length>1_000_000)await failureCase(name,hooks,/OUTPUT_LIMIT_EXCEEDED/);
  else {const {transport}=transportFixture(request,profile,hooks);assert.equal((await runOfflineScientificV2(request,options(name),transport)).lifecycle.state,'RECONCILED');}
 });
 for(const channel of ['stdout','stderr'])await test(channel+' chunk cap accepts exactly 4096 nonempty chunks',async()=>{
  const {transport}=transportFixture(request,profile,{execute:async(inv,e)=>{
   const payload=Buffer.from(JSON.stringify(workerOutputFixture(request,profile)));
   if(channel==='stdout'){
    const bytes=Buffer.concat([payload,Buffer.alloc(5000,32)]);
    for(let i=0;i<4095;i++)e.stdout(bytes.subarray(i,i+1));e.stdout(bytes.subarray(4095));
   }else{for(let i=0;i<4096;i++)e.stderr(Uint8Array.of(32));e.stdout(payload);}
   return exitFixture(inv,profile);
  }});
  assert.equal((await runOfflineScientificV2(request,options('exact-chunks-'+channel),transport)).lifecycle.state,'RECONCILED');
 });
 await test('actual remaining stream budget includes earlier chunks',async()=>{
  await failureCase('remaining-budget',{execute:async(inv,e)=>{
   e.stderr(new Uint8Array(600_000));const bytes=new Uint8Array(400_001);Object.defineProperty(bytes,'byteLength',{value:1});e.stderr(bytes);
   e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));return exitFixture(inv,profile);
  }},/OUTPUT_LIMIT_EXCEEDED/);
 });
 await test('instance metadata, iterators and nonzero offsets cannot redirect a bounded copy',async()=>{
  const {transport}=transportFixture(request,profile,{execute:async(inv,e)=>{
   const payload=Buffer.from(JSON.stringify(workerOutputFixture(request,profile)));
   const backing=new Uint8Array(payload.length+20);backing.set(payload,10);
   const view=new Uint8Array(backing.buffer,10,payload.length);
   for(const key of ['byteLength','byteOffset','buffer','length',Symbol.iterator])Object.defineProperty(view,key,{get(){throw Error('untrusted view accessor invoked');}});
   e.stdout(view);backing.fill(0);return exitFixture(inv,profile);
  }});
  const receipt=await runOfflineScientificV2(request,options('intrinsic-copy'),transport);
  assert.equal(receipt.result.stdoutSha256,hashBytes(Buffer.from(JSON.stringify(workerOutputFixture(request,profile)))));
 });
 const unsafeChunks={proxy:new Proxy(new Uint8Array(1),{}),dataView:new DataView(new ArrayBuffer(1)),nonByteView:new Uint16Array(1),fake:Object.create(Uint8Array.prototype),shared:new Uint8Array(new SharedArrayBuffer(1))};
 const detached=new Uint8Array(1);structuredClone(detached.buffer,{transfer:[detached.buffer]});unsafeChunks.detached=detached;
 const resizable=new ArrayBuffer(1,{maxByteLength:2});assert.equal(resizable.resizable,true,'Node 22 resizable-store negative must execute');unsafeChunks.resizable=new Uint8Array(resizable);
 for(const [kind,chunk] of Object.entries(unsafeChunks))await test('unsafe '+kind+' chunk rejected',async()=>{
  await failureCase('unsafe-'+kind,{execute:async(inv,e)=>{e.stderr(chunk);e.stdout(Buffer.from(JSON.stringify(workerOutputFixture(request,profile))));return exitFixture(inv,profile);}},/OUTPUT_INVALID/);
 });
 console.log(`SCIENTIFIC_V2_OFFLINE_LIFECYCLE=PASS (${count} checks)`);
 console.log('REAL_DOCKER_CALLS=0; RUNTIME_QUALIFICATION=NOT_ESTABLISHED; STORAGE=VOLATILE_MODEL_ONLY; DURABLE_FILESYSTEM=BLOCKED');
}finally{globalThis.fetch=originalFetch;await fs.rm(root,{recursive:true,force:true});}
