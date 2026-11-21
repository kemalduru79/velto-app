import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

// Real React/ReactDOM and actual parent code. Only media observation and
// persistence transport are synthetic. Never synthesize a successful receipt.
export async function runCreatorExportDurationMountedTests({ sourceText, characterize = false } = {}) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  sourceText ??= fs.readFileSync(path.join(root, 'app/create/page.tsx'), 'utf8');
  const sf = ts.createSourceFile('page.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const workspace = sf.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'CreateWorkspace');
  assert(workspace, 'Use the actual parent, never a duplicate reconciliation algorithm');
  const statements = [...workspace.body.statements];
  const named = (statement, name) => ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(declaration => declaration.name.getText(sf) === name);
  const handler = statements.find(statement => named(statement, 'handleExportMovie')).declarationList.declarations[0].initializer;
  const stop = [...handler.body.statements].findIndex(statement => named(statement, 'currentSignature'));
  assert(stop > 0);
  const prefix = [...handler.body.statements].slice(0, stop).map(statement => statement.getText(sf)).join('\n');
  const start = statements.findIndex(statement => named(statement, 'creatorExportDurationChecksRef'));
  const end = statements.findIndex(statement => named(statement, 'voiceLibrarySessionRef'));
  assert(characterize || start >= 0, 'Current acceptance requires the actual committed-state boundary');
  const boundary = start >= 0 ? statements.slice(start, end).map(statement => statement.getText(sf)).join('\n') : '';
  if (start >= 0) assert(end > start && boundary.includes('useLayoutEffect') && boundary.includes('checkCreatorExportDurationCommit'));

  const require = createRequire(path.join(root, 'package.json'));
  const { webpack } = require('next/dist/compiled/webpack/webpack');
  const modulePath = process.env.VELTO_TEST_PLAYWRIGHT_MODULE;
  assert(modulePath && path.isAbsolute(modulePath) && fs.existsSync(modulePath),
    'Set VELTO_TEST_PLAYWRIGHT_MODULE to an already installed module; never download or substitute simulated acceptance');
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'velto-export-duration-mounted-'));
  fs.chmodSync(out, 0o700);
  const entry = `
    import React, {useState,useRef,useLayoutEffect} from ${JSON.stringify(path.join(root, 'node_modules/react/index.js'))};
    import {createRoot} from ${JSON.stringify(path.join(root, 'node_modules/react-dom/client.js'))};
    import {isCreatorProjectOperationActive} from ${JSON.stringify(path.join(root, 'lib/creator/projectSaveCoordinator.ts'))};
    import {reconcileCreatorFullVideoSourceDurations} from ${JSON.stringify(path.join(root, 'lib/creator/editorState.ts'))};
    const originalUrl='https://synthetic.invalid/original.mp4';
    const scene=(marker='a')=>({id:1,creatorSceneId:marker+'-stable-scene',text:marker+' synthetic visual',dialogue:'',videoUrl:marker==='a'?originalUrl:'https://synthetic.invalid/'+marker+'.mp4',videoStatus:'done',videoDurationSeconds:10,targetDurationSec:8.32,narration:marker+' synthetic narration',audioSourceText:marker+' synthetic narration',image:'https://synthetic.invalid/'+marker+'.jpg',audioUrl:'https://synthetic.invalid/'+marker+'.wav'});
    const api=window.durationTest={events:[],observations:[],saves:[],pendingSaves:[],tasks:[],holdSave:false,arm:null};
    function Fixture(){
      const [scenes,commitScenes]=useState([scene()]);
      const [creatorSceneVideoSourceDurations,commitDurations]=useState({});
      const currentProjectIdRef=useRef('synthetic-a'),projectGenerationRef=useRef(7);
      const isHydratingRef=useRef(false),creatorSceneHydrationAuthorityRef=useRef('hydrated_populated');
      const creatorVisualScenesRef=useRef(scenes);
      React.useEffect(()=>{creatorVisualScenesRef.current=scenes;},[scenes]);
      ${boundary}
      const sidecar=useRef({script:{revision:2,text:'synthetic canonical script',history:['original']},timeline:{sceneIds:['a-stable-scene'],durationSec:8.32},music:{mode:'none'},finalVideo:{url:'https://synthetic.invalid/original-final.mp4',signature:'synthetic-original-signature'},cas:'2030-01-01T00:00:00.000Z'});
      useLayoutEffect(()=>{api.canonicalScenes=scenes;api.canonicalDurations=creatorSceneVideoSourceDurations;api.rendered={scenes,durations:creatorSceneVideoSourceDurations,sidecar:sidecar.current};});
      const replace=()=>{currentProjectIdRef.current='synthetic-b';projectGenerationRef.current=8;commitScenes([scene('b')]);};
      const setScenes=update=>{
        api.events.push({type:'scene-enqueue'});
        if(api.arm==='source-before-updater'){api.arm=null;commitScenes(current=>current.map(s=>({...s,videoUrl:'https://synthetic.invalid/edited.mp4',videoDurationSeconds:19})));}
        commitScenes(update);
        if(api.arm==='project-before-ack'){api.arm=null;replace();}
        if(api.arm==='unmount-before-ack'){api.arm=null;root.unmount();}
      };
      const setCreatorSceneVideoSourceDurations=update=>{api.events.push({type:'duration-enqueue'});commitDurations(update);};
      const observeCreatorVideoSourceDuration=url=>new Promise(resolve=>api.observations.push({url,resolve}));
      const persistProject=async(manual,options)=>{
        if(manual!==false||options.persistScenes!==true)throw Error('wrong persistence intent');
        api.saves.push({projectId:currentProjectIdRef.current,generation:projectGenerationRef.current,scenes:options.sourceScenes,canonical:api.canonicalScenes,durations:api.canonicalDurations,consistent:options.sourceScenes===api.canonicalScenes&&api.canonicalDurations[options.sourceScenes[0].creatorSceneId]?.durationSec===options.sourceScenes[0].videoDurationSeconds});
        api.events.push({type:'save-intent'});
        if(api.holdSave)await new Promise((resolve,reject)=>api.pendingSaves.push({resolve,reject}));
      };
      const setSaveMessage=value=>api.events.push({type:'save-feedback',value});
      const setError=value=>api.events.push({type:'error-feedback',value});
      const isCreatorLabFlow=true,uiLanguage='en';
      const handleExportMovie=async()=>{${prefix}\napi.events.push({type:'continuation',scenes:exportAuthorityScenes});};
      useLayoutEffect(()=>{
        api.start=()=>{const task={done:false};api.tasks.push(task);task.promise=handleExportMovie().then(()=>{task.done=true;},error=>{task.done=true;task.error=String(error);});return api.tasks.length-1;};
        api.resolve=(index,duration=10.08)=>{const o=api.observations[index];o.resolve({videoUrl:o.url,durationSec:duration});};
        api.change=mode=>{
          if(mode==='hydrating-session'){isHydratingRef.current=true;return;}
          if(mode==='recovery-required'){creatorSceneHydrationAuthorityRef.current='recovery_required';return;}
          if(mode==='cross-project'||mode==='deferred-project-switch'){replace();return;}
          if(mode==='cross-project-same-generation'){currentProjectIdRef.current='synthetic-b';commitScenes([scene('b')]);return;}
          if(mode==='same-id-new-generation'||mode==='round-trip-new-generation'){
            if(mode==='round-trip-new-generation'){currentProjectIdRef.current='synthetic-b';projectGenerationRef.current++;}
            currentProjectIdRef.current='synthetic-a';projectGenerationRef.current++;commitScenes([scene('replacement')]);return;
          }
          if(mode==='in-place-source-change'){scenes[0].videoUrl='https://synthetic.invalid/edited.mp4';return;}
          commitScenes(current=>current.map(s=>({...s,...(mode==='scene-replaced'?{creatorSceneId:'new-stable-scene'}:mode==='trim-changed'?{clipInSec:1,clipOutSec:7}:mode==='narration-edited'?{narration:'edited synthetic narration'}:{videoUrl:'https://synthetic.invalid/edited.mp4',videoDurationSeconds:19})})));
        };
        api.ready=true;
      });
      return React.createElement('div',null,scenes[0].videoUrl);
    }
    const root=createRoot(document.getElementById('root'));
    api.unmount=()=>root.unmount();
    root.render(React.createElement(React.StrictMode,null,React.createElement(Fixture)));
  `;
  const entryPath = path.join(out, 'fixture.tsx');
  fs.writeFileSync(entryPath, entry, { mode: 0o600 });
  const compiler = webpack({ mode: 'none', target: 'web', context: root, entry: entryPath,
    output: { path: out, filename: 'fixture.js' }, devtool: false,
    resolve: { extensions: ['.ts', '.tsx', '.js'], modules: [path.join(root, 'node_modules')] },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: [path.join(root, 'scripts/fixtures/typescript-browser-loader.mjs')] }] },
    plugins: [new webpack.DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('development') })],
    optimization: { minimize: false }, performance: false });
  const stats = await new Promise((resolve, reject) => compiler.run((error, value) => error ? reject(error) : resolve(value)));
  await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
  assert(!stats.hasErrors(), stats.toString({ errors: true, warnings: false }));
  const bundle = path.join(out, 'fixture.js'); fs.chmodSync(bundle, 0o600);
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    args: ['--disable-background-networking', '--disable-component-update', '--no-first-run'] });
  const results = [], errors = []; let network = 0;
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => { network++; return route.abort(); });
    async function fixture() {
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.setContent('<!doctype html><meta charset="utf-8"><div id="root"></div>');
      await page.addScriptTag({ content: fs.readFileSync(bundle, 'utf8') });
      await page.waitForFunction(() => window.durationTest?.ready);
      return page;
    }
    const finish = page => page.waitForFunction(() => window.durationTest.tasks.length > 0 && window.durationTest.tasks.every(t => t.done));
    const snapshot = page => page.evaluate(() => JSON.parse(JSON.stringify({ state: durationTest.rendered, saves: durationTest.saves, events: durationTest.events, taskErrors: durationTest.tasks.filter(t => t.error).map(t => t.error) })));
    const noFeedback = data => !data.events.some(event => ['error-feedback', 'save-feedback', 'continuation'].includes(event.type));
    async function rejection(mode) {
      const page = await fixture();
      await page.evaluate(mode => { const a=durationTest; a.start(); a.change(mode); }, mode);
      // This is an observed commit boundary, not a timer or a passive-ref shortcut.
      if (!['in-place-source-change','hydrating-session','recovery-required'].includes(mode)) await page.waitForFunction(() => durationTest.rendered.scenes[0].videoUrl !== 'https://synthetic.invalid/original.mp4' || durationTest.rendered.scenes[0].creatorSceneId !== 'a-stable-scene' || durationTest.rendered.scenes[0].clipInSec === 1 || durationTest.rendered.scenes[0].narration === 'edited synthetic narration');
      const before = await snapshot(page);
      await page.evaluate(() => durationTest.resolve(0)); await finish(page);
      const after = await snapshot(page);
      assert.deepEqual(after.state, before.state, mode); assert.equal(after.saves.length, 0, mode); assert(noFeedback(after));
      assert.equal(after.events.filter(e => e.type === 'scene-enqueue').length, 0, 'Known stale origins must be rejected before scene enqueue');
      assert.equal(after.events.filter(e => e.type === 'duration-enqueue').length, 0); assert.deepEqual(after.taskErrors, []);
      results.push({ scenario: mode, safety: 'PASS', saveIntents: 0, durationInstallations: 0 }); await page.close();
    }
    if (!characterize) {
      for (const mode of ['cross-project', 'same-id-new-generation', 'cross-project-same-generation', 'round-trip-new-generation',
        'source-replaced', 'scene-replaced', 'trim-changed', 'narration-edited', 'in-place-source-change',
        'hydrating-session', 'recovery-required']) await rejection(mode);
    }
    for (const mode of characterize ? ['queued-source-before-observation', 'source-before-updater'] :
      ['queued-source-before-observation', 'source-before-updater', 'deferred-project-switch', 'unmount-before-ack']) {
      const page = await fixture();
      const original = await snapshot(page);
      await page.evaluate(mode => {
        const a=durationTest;
        if(mode==='source-before-updater')a.arm=mode;
        if(mode==='deferred-project-switch')a.arm='project-before-ack';
        if(mode==='unmount-before-ack')a.arm=mode;
        a.start();if(mode==='queued-source-before-observation')a.change('source-replaced');a.resolve(0);
      }, mode);
      await finish(page); const data = await snapshot(page);
      if (characterize) {
        assert(data.saves.length > 0); results.push({ scenario: mode, safety: 'FAIL', expectedBaselineRegression: true });
      } else {
        assert.equal(data.saves.length, 0, mode); assert(noFeedback(data), mode); assert.deepEqual(data.taskErrors, []);
        assert.equal(data.events.filter(e => e.type === 'duration-enqueue').length, 0, 'Rejected scene proposals cannot install duration maps');
        if (mode === 'queued-source-before-observation' || mode === 'source-before-updater') {
          assert.deepEqual(data.state.scenes, [{ ...original.state.scenes[0], videoUrl: 'https://synthetic.invalid/edited.mp4', videoDurationSeconds: 19 }]);
          assert.deepEqual(data.state.sidecar, original.state.sidecar);
        }
        if (mode === 'deferred-project-switch') assert.equal(data.state.scenes[0].creatorSceneId, 'b-stable-scene');
        results.push({ scenario: mode, safety: 'PASS', saveIntents: 0, durationInstallations: 0 });
      }
      await page.close();
    }
    for (const mode of characterize ? ['save-source-success', 'save-source-error'] :
      ['current-project', 'save-current-error', 'save-source-success', 'save-source-error', 'save-success-switch', 'save-error-switch']) {
      const page = await fixture();
      const original = await snapshot(page);
      await page.evaluate(() => { durationTest.holdSave=true;durationTest.start();durationTest.resolve(0); });
      await page.waitForFunction(() => durationTest.pendingSaves.length === 1);
      const admitted = await snapshot(page);
      if (!characterize) {
        assert.equal(admitted.saves.length, 1); assert(admitted.saves[0].consistent, 'Save must use the exact committed scene and duration projection');
        assert.deepEqual(admitted.state.scenes, [{ ...original.state.scenes[0], videoDurationSeconds: 10.08 }], 'Only observed source duration may change');
        assert.deepEqual(admitted.state.sidecar, original.state.sidecar);
      }
      const stale = mode.includes('source') || mode.includes('switch'), failed = mode.includes('error');
      if (stale) {
        await page.evaluate(mode => durationTest.change(mode.includes('switch')?'cross-project':'source-replaced'), mode);
        await page.waitForFunction(() => durationTest.rendered.scenes[0].videoUrl !== 'https://synthetic.invalid/original.mp4');
      }
      const beforeSettlement = await snapshot(page);
      await page.evaluate(failed => { const p=durationTest.pendingSaves[0];if(failed)p.reject(Error('synthetic save failure'));else p.resolve(); }, failed);
      await finish(page); const data = await snapshot(page);
      assert.deepEqual(data.state, beforeSettlement.state); assert.deepEqual(data.taskErrors, []);
      if (characterize) {
        assert(data.events.some(e => e.type === (failed?'error-feedback':'continuation')));
        results.push({ scenario: mode, safety: 'FAIL', expectedBaselineRegression: true });
      } else {
        if (stale) assert(noFeedback(data), mode);
        else if (failed) assert(data.events.some(e => e.type === 'error-feedback'), 'A current-source failure must remain actionable');
        else {
          assert(data.events.some(e => e.type === 'continuation')); assert.equal(data.state.scenes[0].videoDurationSeconds, 10.08);
          assert.equal(data.state.scenes[0].targetDurationSec, 8.32);
        }
        assert.equal(data.saves.length, 1); assert.deepEqual(data.state.sidecar, admitted.state.sidecar);
        results.push({ scenario: mode, safety: 'PASS', acceptedSaveIntents: 1, obsoleteContinuation: false });
      }
      await page.close();
    }
    {
      const page = await fixture();
      await page.evaluate(() => { durationTest.start();durationTest.start();durationTest.resolve(1,10.08);queueMicrotask(()=>durationTest.resolve(0,12)); });
      await finish(page); const data=await snapshot(page);
      assert.equal(data.state.scenes[0].videoDurationSeconds,10.08); assert.deepEqual(data.taskErrors,[]);
      if (characterize) {
        assert.equal(data.saves.length,2); assert.equal(data.saves[1].scenes[0].videoDurationSeconds,12);
        assert.equal(data.state.durations['a-stable-scene'].durationSec,12);
        results.push({scenario:'out-of-order-completions',safety:'FAIL',expectedBaselineRegression:true,canonicalDuration:10.08,savedDuration:12});
      } else {
        assert.equal(data.saves.length,1); assert(data.saves[0].consistent);
        assert.equal(data.state.durations['a-stable-scene'].durationSec,10.08); assert.equal(data.saves[0].scenes[0].videoDurationSeconds,10.08);
        results.push({scenario:'out-of-order-completions',safety:'PASS',canonicalDuration:10.08,savedDuration:10.08});
      }
      await page.close();
    }
    assert.deepEqual(errors, []); assert.equal(network, 0);
    const summary = { mode: characterize?'UNSAFE_R1_CHARACTERIZATION':'STRICT_MOUNTED_REACT', results, react: require('react/package.json').version,
      strictMode: true, actualParentBoundary: start >= 0, sourceSha256: createHash('sha256').update(sourceText).digest('hex'),
      boundarySha256: createHash('sha256').update(boundary).digest('hex'), networkRequests: network,
      qualification: 'actual parent acknowledgement and export prefix; synthetic media/persistence only; no complete app/backend/provider acceptance' };
    fs.writeFileSync(path.join(out, 'RESULTS.json'), JSON.stringify(summary,null,2)+'\n', { mode:0o600 });
    console.log('MOUNTED_EXPORT_DURATION='+JSON.stringify(summary)); console.log('PRIVATE_MOUNTED_EVIDENCE='+out);
    return results;
  } finally { await browser.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  assert(args.length===0 || args.length===3 && args[0]==='--before' && args[2]==='--characterize');
  await runCreatorExportDurationMountedTests(args.length?{sourceText:fs.readFileSync(args[1],'utf8'),characterize:true}:{});
}
