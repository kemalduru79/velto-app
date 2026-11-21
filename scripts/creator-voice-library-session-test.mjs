import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

// Execute the actual parent gateways and identity module. Only React setters,
// authentication, transport and timing playback helpers are synthetic ports.
const root=process.cwd(), nativeRequire=createRequire(import.meta.url), cache=new Map();
function load(file){
 const filename=path.resolve(root,file);if(cache.has(filename))return cache.get(filename).exports;
 const mod={exports:{}};cache.set(filename,mod);
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const localRequire=specifier=>specifier.startsWith('@/')?load(specifier.slice(2)+'.ts'):specifier.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(filename),specifier))+'.ts'):nativeRequire(specifier);
 new Function('require','module','exports',compiled)(localRequire,mod,mod.exports);return mod.exports;
}
const identity=load('components/create/voiceLibraryOperation.ts'), library=load('lib/creator/voiceLibrary.ts');
const pageText=fs.readFileSync('app/create/page.tsx','utf8');
const page=ts.createSourceFile('page.tsx',pageText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['isCreatorVoiceOperationCurrent','commitCreatorVoiceSelection','applyCreatorVoiceLibrarySelection','clearCreatorVoiceLibrarySelection'];
const declarations=new Map();
function visit(node){if(ts.isVariableDeclaration(node)&&names.includes(node.name.getText(page)))declarations.set(node.name.getText(page),node.getText(page));ts.forEachChild(node,visit);}visit(page);
assert.equal(declarations.size,names.length);
const code=ts.transpileModule(names.map(name=>'const '+declarations.get(name)+';').join('\n')+'\nreturn { apply: applyCreatorVoiceLibrarySelection, clear: clearCreatorVoiceLibrarySelection };',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const voice={source:'available',voiceId:'synthetic-voice',name:'Synthetic voice',previewUrl:'fixture-preview',publicOwnerId:'synthetic-owner'};
function scene(id,stable='scene-'+id){return {id,creatorSceneId:stable,narration:'Synthetic narration',imageUrl:'fixture-image-'+id,videoUrl:'fixture-video-'+id,audioUrl:'fixture-audio-'+id,audioPath:'fixture-audio-path',audioSourceText:'Synthetic narration',audioSettingsKey:'fixture-settings',dialogueAudioUrl:'fixture-dialogue-'+id,dialogueAudioPath:'fixture-dialogue-path',dialogueAudioSourceText:'Synthetic dialogue',dialogueAudioSettingsKey:'fixture-dialogue-settings',timing:{narrationDuration:3,dialogueDuration:2}};}
function fixture(target={scope:'scene_narrator',sceneId:1},options={}){
 const state={scenes:[scene(1),scene(2)],characters:[{id:'character-1',name:'Synthetic character',voiceId:'old'}],narrator:{unrelated:'preserved'},queue:[],mutations:0,stops:0,fetches:0,session:true};
 const origin={projectId:'project-a',generation:1};
 const binding=identity.captureCreatorVoiceOperation(target,origin,state.scenes,state.characters);assert(binding);
 const operation={current:binding},snapshot={current:{scenes:state.scenes,characters:state.characters}},id={current:origin.projectId},generation={current:origin.generation};
 const update=(key,fn)=>{const work=()=>{const previous=state[key];state[key]=fn(previous);if(state[key]!==previous)state.mutations++;snapshot.current={scenes:state.scenes,characters:state.characters};};if(options.defer)state.queue.push(work);else work();};
 const ports={...identity,voiceLibraryOperationRef:operation,voiceLibraryOwnerSnapshotRef:snapshot,currentProjectIdRef:id,projectGenerationRef:generation,toVoiceLibrarySelection:library.toVoiceLibrarySelection,uiLanguage:'en',getAccessTokenOrThrow:options.auth|| (async()=> 'synthetic-no-authority'),fetch:async()=>{state.fetches++;return options.fetch?options.fetch():{ok:true,json:async()=>({ok:true,voiceId:'resolved-shared'})};},stopDialoguePlayback:()=>{state.stops++;},stopStoryPlayback:()=>{state.stops++;},setNarratorSettings:fn=>update('narrator',fn),setCharacters:fn=>update('characters',fn),setScenes:fn=>update('scenes',fn),buildSceneTimingForCurrentFlow:(n,d)=>({narrationDuration:n,dialogueDuration:d})};
 const handlers=new Function(...Object.keys(ports),code)(...Object.values(ports));
 return {state,binding,operation,snapshot,id,generation,apply:(v=voice)=>handlers.apply(binding.target,v,()=>state.session),clear:()=>handlers.clear(binding.target),flush:()=>{for(const work of state.queue.splice(0))work();},sync:()=>{snapshot.current={scenes:state.scenes,characters:state.characters};}};
}
let passed=0;const check=async(name,run)=>{await run();passed++;console.log('PASS '+name);};
for(const target of [{scope:'project_narrator'},{scope:'project_dialogue'},{scope:'scene_narrator',sceneId:1},{scope:'scene_dialogue',sceneId:1},{scope:'character',characterId:'character-1'}]){
 await check('apply '+target.scope,async()=>{
  const f=fixture(target),before=structuredClone(f.state.scenes);assert.equal((await f.apply()).status,'applied');assert.equal(f.state.stops,2);
  for(let n=0;n<2;n++){const s=f.state.scenes[n];assert.equal(s.imageUrl,before[n].imageUrl);assert.equal(s.videoUrl,before[n].videoUrl);assert.equal(s.narration,before[n].narration);assert.deepEqual(s.timing,{narrationDuration:0,dialogueDuration:0});const narration=target.scope==='project_narrator'||target.scope==='scene_narrator'&&n===0;const dialogue=['project_dialogue','character'].includes(target.scope)||target.scope==='scene_dialogue'&&n===0;for(const key of ['audioUrl','audioPath','audioSourceText','audioSettingsKey'])assert.equal(s[key],narration?'':before[n][key]);for(const key of ['dialogueAudioUrl','dialogueAudioPath','dialogueAudioSourceText','dialogueAudioSettingsKey'])assert.equal(s[key],dialogue?'':before[n][key]);}
  if(target.scope==='character'){assert.equal(f.state.characters[0].voiceId,voice.voiceId);assert.equal(f.state.characters[0].voiceSelection.previewUrl,undefined);}
  if(target.scope==='project_narrator')assert.equal(f.state.narrator.voiceId,voice.voiceId);
  if(target.scope==='project_dialogue')assert.equal(f.state.narrator.dialogueVoiceId,voice.voiceId);
  if(target.scope==='scene_narrator')assert.equal(f.state.scenes[0].narratorVoiceSelection.voiceId,voice.voiceId);
  if(target.scope==='scene_dialogue')assert.equal(f.state.scenes[0].dialogueVoiceSelection.voiceId,voice.voiceId);
 });
 await check('clear '+target.scope,async()=>{const f=fixture(target);assert.equal(f.clear(),true);assert.equal(f.state.stops,0);assert(f.state.mutations>0);assert.equal(f.state.scenes[0].imageUrl,'fixture-image-1');assert.equal(f.state.scenes[1].videoUrl,'fixture-video-2');});
}
const shared={...voice,source:'shared'};
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
for(const change of ['different-project','same-id-new-generation','scene-replaced','scene-deleted','duplicate-stable-id','session-closed','picker-reopened','unmounted'])await check('reject pending shared / '+change,async()=>{
 const pending=deferred(),started=deferred(),f=fixture(undefined,{fetch:()=>{started.resolve();return pending.promise;}});const result=f.apply(shared);await started.promise;
 if(change==='different-project'){f.id.current='project-b';f.generation.current++;f.state.scenes=[scene(1,'replacement')];f.sync();}
 if(change==='same-id-new-generation')f.generation.current++;
 if(change==='scene-replaced'){f.state.scenes[0]=scene(1,'replacement');f.sync();}
 if(change==='scene-deleted'){f.state.scenes.shift();f.sync();}
 if(change==='duplicate-stable-id'){f.state.scenes.push(scene(3,'scene-1'));f.sync();}
 if(change==='session-closed')f.state.session=false;
 if(change==='picker-reopened')f.operation.current=identity.captureCreatorVoiceOperation({scope:'scene_narrator',sceneId:2},{projectId:f.id.current,generation:f.generation.current},f.state.scenes,f.state.characters);
 if(change==='unmounted')f.snapshot.current=null;
 const before=structuredClone(f.state.scenes);pending.resolve({ok:true,json:async()=>({ok:true,voiceId:'resolved-shared'})});assert.equal((await result).status,'stale');assert.equal(f.state.mutations,0);assert.equal(f.state.stops,0);assert.deepEqual(f.state.scenes,before);
});
await check('stale during auth prevents shared POST',async()=>{const pending=deferred(),f=fixture(undefined,{auth:()=>pending.promise});const result=f.apply(shared);f.generation.current++;pending.resolve('synthetic-no-authority');assert.equal((await result).status,'stale');assert.equal(f.state.fetches,0);assert.equal(f.state.mutations,0);});
await check('stale during response parsing rejects',async()=>{const pending=deferred(),started=deferred(),f=fixture(undefined,{fetch:async()=>({ok:true,json:()=>{started.resolve();return pending.promise;}})});const result=f.apply(shared);await started.promise;f.generation.current++;pending.resolve({ok:true});assert.equal((await result).status,'stale');assert.equal(f.state.stops,0);});
await check('reordered stable scene receives intended voice',async()=>{const pending=deferred(),started=deferred(),f=fixture(undefined,{fetch:()=>{started.resolve();return pending.promise;}});const result=f.apply(shared);await started.promise;f.state.scenes=[{...f.state.scenes[1],id:1},{...f.state.scenes[0],id:2}];f.sync();pending.resolve({ok:true,json:async()=>({ok:true})});assert.equal((await result).status,'applied');assert.equal(f.state.scenes[1].narratorVoiceSelection.voiceId,voice.voiceId);assert.equal(f.state.scenes[0].audioUrl,'fixture-audio-2');});
for(const target of [{scope:'project_narrator'},{scope:'project_dialogue'},{scope:'scene_narrator',sceneId:1},{scope:'scene_dialogue',sceneId:1},{scope:'character',characterId:'character-1'}])await check('deferred updater rejects project replacement / '+target.scope,async()=>{const f=fixture(target,{defer:true});assert.equal((await f.apply()).status,'applied');f.id.current='project-b';f.generation.current++;f.state.scenes=[scene(1,'replacement')];f.sync();const before=structuredClone({scenes:f.state.scenes,characters:f.state.characters,narrator:f.state.narrator});f.flush();assert.equal(f.state.mutations,0);assert.deepEqual(f.state.scenes,before.scenes);assert.deepEqual(f.state.characters,before.characters);assert.deepEqual(f.state.narrator,before.narrator);});
for(const failure of ['auth','network','server','missing-owner'])await check('failure leaves canonical state unchanged / '+failure,async()=>{const f=fixture(undefined,{auth:failure==='auth'?async()=>{throw Error('synthetic auth failure');}:undefined,fetch:async()=>{if(failure==='network')throw Error('synthetic network failure');return {ok:false,json:async()=>({ok:false,error:'synthetic server failure'})};}});const result=await f.apply(failure==='missing-owner'?{...shared,publicOwnerId:undefined}:shared);assert.equal(result.status,'error');assert.equal(f.state.mutations,0);assert.equal(f.state.stops,0);});
for(const target of [{scope:'project_narrator'},{scope:'project_dialogue'},{scope:'scene_narrator',sceneId:1},{scope:'scene_dialogue',sceneId:1},{scope:'character',characterId:'character-1'}])await check('valid deferred updater / '+target.scope,async()=>{const f=fixture(target,{defer:true});assert.equal((await f.apply()).status,'applied');f.flush();assert(f.state.mutations>0);assert.equal(f.state.scenes[0].imageUrl,'fixture-image-1');});
await check('stale clear rejects without any setter',async()=>{const f=fixture();f.generation.current++;assert.equal(f.clear(),false);assert.equal(f.state.mutations,0);assert.equal(f.state.stops,0);});
await check('shared success',async()=>{const f=fixture();assert.equal((await f.apply(shared)).selection.voiceId,'resolved-shared');assert.equal(f.state.fetches,1);});
await check('ordinary revision advance does not revoke project generation',async()=>{const f=fixture();assert.equal((await f.apply()).status,'applied');});
await check('unsaved identity promotion uses existing operation semantics',async()=>{const f=fixture();const b=identity.captureCreatorVoiceOperation({scope:'project_narrator'},{projectId:'',generation:1},f.state.scenes,f.state.characters);assert(identity.isCreatorVoiceOperationActive(b,{projectId:'newly-saved',generation:1},f.state.scenes,f.state.characters));assert(!identity.isCreatorVoiceOperationActive(b,{projectId:'other',generation:2},f.state.scenes,f.state.characters));});
await check('legacy identity is exact object, never ordinal fallback',async()=>{const original={id:1};const b=identity.captureCreatorVoiceOperation({scope:'scene_narrator',sceneId:1},{projectId:'a',generation:1},[original],[]);assert(identity.isCreatorVoiceOperationActive(b,{projectId:'a',generation:1},[original],[]));assert(!identity.isCreatorVoiceOperationActive(b,{projectId:'a',generation:1},[{id:1}],[]));});
await check('missing and duplicate targets cannot be admitted',async()=>{for(const scenes of [[],[scene(1),scene(1)],[scene(1),scene(2,'scene-1')]])assert.equal(identity.captureCreatorVoiceOperation({scope:'scene_narrator',sceneId:1},{projectId:'a',generation:1},scenes,[]),null);assert.equal(identity.captureCreatorVoiceOperation({scope:'character',characterId:''},{projectId:'a',generation:1},[],[{id:''}]),null);});
await check('immutable target and origin snapshot',async()=>{const target={scope:'scene_narrator',sceneId:1},origin={projectId:'a',generation:1},scenes=[scene(1)],b=identity.captureCreatorVoiceOperation(target,origin,scenes,[]);target.sceneId=2;origin.generation=2;assert.equal(b.target.sceneId,1);assert.equal(b.origin.generation,1);assert(Object.isFrozen(b));});
const child=ts.createSourceFile('session.tsx',fs.readFileSync('components/create/CreatorVoiceLibrarySession.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),hooks={};
function count(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&/^use[A-Z]/.test(n.expression.text))hooks[n.expression.text]=(hooks[n.expression.text]||0)+1;ts.forEachChild(n,count);}count(child);
assert.equal(hooks.useState,18);assert.equal(hooks.useEffect,4);assert.equal(hooks.useImperativeHandle,1);
assert.equal((pageText.match(/<CreatorVoiceLibrarySession\b/g)||[]).length,1);
assert(!pageText.includes('const [voiceLibraryTarget,'));
assert(!/setScenes|setNarratorSettings|setCharacters|supabase|getAccessTokenOrThrow/.test(child.text));
console.log(`VOICE_SESSION_PARENT_SAFETY=PASS; ${passed} cases; actual parent gateway; synthetic state/auth/transport; no production access`);
