import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import { reconcileCreatorFullVideoSourceDurations } from '../lib/creator/editorState.ts';
import { createCreatorProjectSaveBinding, isCreatorProjectOperationActive, advanceCreatorProjectSaveBinding } from '../lib/creator/projectSaveCoordinator.ts';

// Strict mode is intentionally RED on the unsafe baseline. --characterize
// verifies the exact known failure shape, NOT safety or release acceptance.
// Execute the real parent prefix through reconciliation/persistence, stopping
// before signature/reuse/readiness/provider logic. The real pure reconciler is
// imported unchanged. Only duration observation, React state and persistence
// ports are synthetic; no browser, backend, credentials or media are accessed.
// R2 defaults require real mounted React and the actual parent commit boundary;
// the VM-only path is retained for immutable pre-R2 before-image reproduction.
const args = process.argv.slice(2);
assert(args.length === 0 || args.length === 1 && args[0] === '--characterize' ||
  args.length === 2 && args[0] === '--before' ||
  args.length === 3 && args[0] === '--before' && args[2] === '--characterize');
const characterize = args.includes('--characterize');
const sourceText = fs.readFileSync(args[0] === '--before' ? args[1] : new URL('../app/create/page.tsx', import.meta.url), 'utf8');
const source = ts.createSourceFile('page.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = [];
const saveHandlers = [];
const executeSaveHandlers = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'handleExportMovie') handlers.push(node.initializer);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'persistProject') saveHandlers.push(node.initializer);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'executePersistProject') executeSaveHandlers.push(node.initializer);
  ts.forEachChild(node, visit);
}
visit(source);
assert.equal(handlers.length, 1, 'Actual parent export handler must be unambiguous');
const handler = handlers[0];
assert(ts.isArrowFunction(handler) && ts.isBlock(handler.body));
const statements = [...handler.body.statements];
const stop = statements.findIndex(statement => ts.isVariableStatement(statement) &&
  statement.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'currentSignature'));
assert(stop > 0, 'Fail harness if the reviewed execution boundary moves');
const prefix = statements.slice(0, stop).map(statement => statement.getText(source)).join('\n');
assert(prefix.includes('await observeCreatorVideoSourceDuration(videoUrl)'));
assert(prefix.includes('reconcileCreatorFullVideoSourceDurations({'));
assert(prefix.includes('await persistProject(false, {'));
const compiled = ts.transpileModule(`(async (forceRebuild = false) => { ${prefix}\n return 'RECONCILIATION_PREFIX_COMPLETE'; })`, {
  reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
});
assert(!compiled.diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error));
const prefixHash = createHash('sha256').update(prefix).digest('hex');
assert.equal(saveHandlers.length, 1);
const bindingStatements = [...saveHandlers[0].body.statements].filter(statement => ts.isVariableStatement(statement) &&
  statement.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'binding'));
assert.equal(bindingStatements.length, 1, 'Use actual save-binding admission expression');
const bindingSource = bindingStatements[0].getText(source);
const bindingScript = new vm.Script(`(() => { ${bindingSource}\n return binding; })()`, { filename: 'actual-parent-save-binding.js' });

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`HARNESS_TIMEOUT: ${label}`)), 2000);
    })]);
  } finally { clearTimeout(timer); }
}
const clone = value => JSON.parse(JSON.stringify(value));
function project(id, generation, marker) {
  return {
    id, generation,
    scenes: [{
      id: 1, creatorSceneId: `${marker}-stable-scene`,
      text: `${marker} synthetic visual`, narration: `${marker} synthetic narration`, dialogue: '',
      image: `https://synthetic.invalid/${marker}.jpg`,
      audioUrl: `https://synthetic.invalid/${marker}.wav`,
      audioSourceText: `${marker} synthetic narration`,
      videoUrl: `https://synthetic.invalid/${marker}.mp4`, videoStatus: 'done',
      videoDurationSeconds: 10, targetDurationSec: 8.32,
    }],
    durations: {},
    timeline: { sceneIds: [`${marker}-stable-scene`], durationSec: 8.32 },
    script: { revision: generation, text: `${marker} synthetic canonical script`, history: [marker] },
    music: { mode: 'none' },
    finalVideo: { url: `https://synthetic.invalid/${marker}-final.mp4`, signature: `${marker}-signature` },
    persistence: { expectedUpdatedAt: `synthetic-revision-${marker}`, pending: [] },
  };
}
async function scenario(mode) {
  const observation = deferred(), started = deferred();
  const saving = deferred(), saved = deferred(), updates = [];
  const holdSave = ['deferred-project-switch', 'save-success-switch', 'save-error-switch'].includes(mode);
  const origin = project('synthetic-a', 7, 'a');
  const originBefore = clone(origin);
  let active = origin;
  const currentProjectIdRef = { current: origin.id };
  const projectGenerationRef = { current: origin.generation };
  const projectUpdatedAtRef = { current: origin.persistence.expectedUpdatedAt };
  const creatorVisualScenesRef = { current: origin.scenes };
  const events = [], observations = [];
  const fail = () => { throw new Error('HARNESS_UNEXPECTED_EXTERNAL_OR_UI_ACTIVITY'); };
  const run = new vm.Script(compiled.outputText, { filename: 'actual-export-reconciliation-prefix.js' }).runInNewContext({
    scenes: origin.scenes, isCreatorLabFlow: true,
    creatorSceneVideoSourceDurations: origin.durations,
    currentProjectIdRef, projectGenerationRef, creatorVisualScenesRef, isCreatorProjectOperationActive,
    reconcileCreatorFullVideoSourceDurations,
    observeCreatorVideoSourceDuration: url => {
      assert.equal(url, originBefore.scenes[0].videoUrl);
      observations.push(url); started.resolve(); return observation.promise;
    },
    setScenes: update => {
      events.push({ type: 'scenes', projectId: active.id, generation: active.generation });
      const apply = () => {
        active.scenes = typeof update === 'function' ? update(active.scenes) : update;
        creatorVisualScenesRef.current = active.scenes;
      };
      if (mode === 'deferred-project-switch') updates.push(apply);
      else apply();
    },
    setCreatorSceneVideoSourceDurations: update => {
      events.push({ type: 'durations', projectId: active.id, generation: active.generation });
      const apply = () => { active.durations = typeof update === 'function' ? update(active.durations) : update; };
      if (mode === 'deferred-project-switch') updates.push(apply);
      else apply();
    },
    persistProject: async (manual, options) => {
      assert.equal(manual, false); assert.equal(options.persistScenes, true);
      // Exercise the actual parent binding statement and imported helper too.
      // Canonical state construction, queue, HTTP and CAS response are NOT run.
      const binding = bindingScript.runInNewContext({
        createCreatorProjectSaveBinding, currentProjectIdRef, projectGenerationRef, projectUpdatedAtRef,
        currentProjectId: origin.id, lifecycleOverrides: options, capturedCreatorProjectState: null,
      }, { timeout: 1000 });
      assert(Object.isFrozen(binding));
      const intent = { projectId: binding.projectId, generation: binding.generation,
        expectedUpdatedAt: binding.expectedUpdatedAt, sourceScenes: clone(options.sourceScenes) };
      events.push({ type: 'save-intent', ...intent });
      active.persistence.pending.push(intent);
      saving.resolve();
      if (holdSave) await saved.promise;
      // No actual parent persistence, HTTP, CAS response or database execution.
    },
    setSaveMessage: fail, setError: fail, console: { error: fail },
    fetch: fail, window: undefined, document: undefined, uiLanguage: 'en',
  }, { timeout: 1000 });
  const completion = run();
  await bounded(started.promise, 'deferred duration observation admission');
  assert.equal(events.length, 0, 'No mutation may precede the observation');
  if (mode === 'cross-project') active = project('synthetic-b', 8, 'b');
  if (mode === 'cross-project-same-generation') active = project('synthetic-b', 7, 'b');
  if (mode === 'same-id-new-generation') active = project('synthetic-a', 8, 'replacement');
  if (mode === 'round-trip-new-generation') {
    currentProjectIdRef.current = 'synthetic-b'; projectGenerationRef.current = 8;
    active = project('synthetic-a', 9, 'replacement');
  }
  if (mode === 'source-replaced') active.scenes = [{ ...active.scenes[0], videoUrl: 'https://synthetic.invalid/replacement.mp4' }];
  if (mode === 'scene-replaced') active.scenes = [{ ...active.scenes[0], creatorSceneId: 'replacement-stable-scene' }];
  if (mode === 'trim-changed') active.scenes = [{ ...active.scenes[0], clipInSec: 1, clipOutSec: 7 }];
  if (mode === 'narration-edited') active.scenes = [{ ...active.scenes[0], narration: 'new synthetic narration' }];
  if (mode === 'in-place-source-change') active.scenes[0].videoUrl = 'https://synthetic.invalid/replacement.mp4';
  currentProjectIdRef.current = active.id;
  projectGenerationRef.current = active.generation;
  projectUpdatedAtRef.current = active.persistence.expectedUpdatedAt;
  creatorVisualScenesRef.current = active.scenes;
  const beforeCompletion = clone(active);
  observation.resolve({ videoUrl: originBefore.scenes[0].videoUrl, durationSec: 10.08 });
  if (holdSave) {
    await bounded(saving.promise, 'valid A save admission');
    assert.equal(events[2].projectId, origin.id);
    assert.equal(events[2].generation, origin.generation);
    active = project('synthetic-b', 8, 'b');
    currentProjectIdRef.current = active.id;
    projectGenerationRef.current = active.generation;
    projectUpdatedAtRef.current = active.persistence.expectedUpdatedAt;
    creatorVisualScenesRef.current = active.scenes;
    const replacementBefore = clone(active);
    for (const apply of updates) apply();
    if (mode === 'save-error-switch') saved.resolve(Promise.reject(new Error('synthetic old A save failure')));
    else saved.resolve();
    const returned = await bounded(completion, 'stale save settlement');
    assert.equal(returned, undefined, 'Stale completion must not continue into signature/export or feedback');
    assert.deepEqual(active, replacementBefore, 'Deferred updates and save settlement must leave B untouched');
    assert(events.every(event => event.projectId === origin.id && event.generation === origin.generation));
    return { scenario: mode, safety: 'PASS', replacementMutations: 0, replacementSaveIntents: 0, validOriginSaveIntents: 1 };
  }
  const returned = await bounded(completion, 'actual reconciliation prefix completion');
  assert.equal(observations.length, 1);
  if (mode !== 'current-project' && events.length === 0) {
    assert.deepEqual(active, beforeCompletion);
    assert(!characterize, 'Unsafe baseline no longer reproduced; rerun strict regression mode');
    return { scenario: mode, safety: 'PASS', changedFields: [] };
  }
  assert.equal(returned, 'RECONCILIATION_PREFIX_COMPLETE');

  // Independently assert what actually changed, not just an event counter.
  for (const key of ['timeline', 'script', 'music', 'finalVideo']) assert.deepEqual(active[key], beforeCompletion[key]);
  assert.equal(active.persistence.expectedUpdatedAt, beforeCompletion.persistence.expectedUpdatedAt);
  assert.deepEqual(active.scenes, [{ ...originBefore.scenes[0], videoDurationSeconds: 10.08 }]);
  assert.deepEqual(clone(active.durations), {
    [originBefore.scenes[0].creatorSceneId]: { videoUrl: originBefore.scenes[0].videoUrl, durationSec: 10.08 },
  });
  assert.deepEqual(events.map(event => event.type), ['scenes', 'durations', 'save-intent']);
  const intent = events[2];
  assert.equal(intent.projectId, active.id); assert.equal(intent.generation, active.generation);
  assert.equal(intent.expectedUpdatedAt, beforeCompletion.persistence.expectedUpdatedAt);
  assert.deepEqual(intent.sourceScenes, active.scenes);
  const changedFields = Object.keys(active).filter(key => JSON.stringify(active[key]) !== JSON.stringify(beforeCompletion[key]));
  assert.deepEqual(changedFields, ['scenes', 'durations', 'persistence']);
  if (mode === 'current-project') {
    assert.equal(intent.projectId, origin.id); assert.equal(intent.generation, origin.generation);
    assert.deepEqual(active.scenes[0], { ...beforeCompletion.scenes[0], videoDurationSeconds: 10.08 });
    return { scenario: mode, safety: 'PASS', changedFields, narrationAndMediaReferencesPreserved: true };
  }
  let rejection;
  try { assert.deepEqual(active, beforeCompletion, 'Stale completion must leave the replacement session unchanged'); }
  catch (error) { rejection = error; }
  assert(rejection instanceof assert.AssertionError, 'Known unsafe baseline must be demonstrated, not assumed');
  assert.notEqual(active.scenes[0].creatorSceneId, beforeCompletion.scenes[0].creatorSceneId);
  return { scenario: mode, safety: 'FAIL', expectedBaselineRegression: true, changedFields,
    oldSceneInstalled: true, oldMediaReferencesInstalled: true, saveIntentUsesReplacementMetadata: true,
    timelineScriptFinalVideoAndCasUnchanged: true };
}

function queuedSaveScenario(mode) {
  assert.equal(executeSaveHandlers.length, 1);
  const body = [...executeSaveHandlers[0].body.statements];
  const stop = body.findIndex(statement => ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'sourceScenes'));
  assert(stop > 0);
  const code = ts.transpileModule(`(async () => { ${body.slice(0, stop).map(s => s.getText(source)).join('\n')} return requestBinding; })`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const binding = createCreatorProjectSaveBinding({ originProjectId: 'synthetic-a', projectId: 'synthetic-a',
    generation: 7, expectedUpdatedAt: 'synthetic-a-revision', creatorProjectState: null });
  const run = new vm.Script(code).runInNewContext({ binding, autosaveTicket: undefined, advanceCreatorProjectSaveBinding,
    currentProjectIdRef: { current: mode === 'cross-project' ? 'synthetic-b' : 'synthetic-a' },
    projectGenerationRef: { current: mode === 'current-project' ? 7 : 8 },
    projectUpdatedAtRef: { current: 'synthetic-current-revision' },
  }, { timeout: 1000 });
  return run().then(result => {
    if (mode === 'current-project') { assert.equal(result.projectId, binding.projectId); assert.equal(result.generation, 7); }
    else assert.equal(result, undefined, 'Real queued execution admission must reject an obsolete generation');
    return { scenario: `queued-save/${mode}`, safety: 'PASS', admitted: Boolean(result) };
  });
}

try {
  const results = [];
  const mountedBoundary = sourceText.includes('const checkCreatorExportDurationCommit =');
  assert(args[0] === '--before' || mountedBoundary, 'Current source must retain the real commit boundary; legacy simulation is allowed only for explicit before-images');
  if (mountedBoundary) {
    assert(!characterize, 'Never characterize the new committed-state boundary as accepted by simulation');
    const { runCreatorExportDurationMountedTests } = await import('./creator-export-duration-mounted-test.mjs');
    results.push(...await runCreatorExportDurationMountedTests({ sourceText }));
  } else {
    // Retain the exact original VM scenarios for immutable pre-R2 reproduction.
    for (const mode of ['cross-project', 'same-id-new-generation', 'current-project']) results.push(await scenario(mode));
    if (!characterize && args[0] !== '--before') {
      for (const mode of ['cross-project-same-generation', 'round-trip-new-generation', 'source-replaced', 'scene-replaced', 'trim-changed', 'narration-edited',
        'in-place-source-change', 'deferred-project-switch', 'save-success-switch', 'save-error-switch']) results.push(await scenario(mode));
    }
  }
  if (!characterize && args[0] !== '--before') {
    for (const mode of ['cross-project', 'same-id-new-generation', 'current-project']) results.push(await queuedSaveScenario(mode));
  }
  console.log(`EXPORT_DURATION_SESSION_REGRESSION=${JSON.stringify({
    mode: characterize ? 'UNSAFE_BASELINE_CHARACTERIZATION' : 'STRICT_REGRESSION',
    harness: 'PASS', parentSourceSha256: createHash('sha256').update(sourceText).digest('hex'),
    executedPrefixSha256: prefixHash, results,
    executedSaveBindingSha256: createHash('sha256').update(bindingSource).digest('hex'),
    mountedCanonicalAcceptance: mountedBoundary,
    qualification: mountedBoundary
      ? 'actual-parent-layout-acknowledgement-in-mounted-React-plus-real-queue-admission-prefix; synthetic-observer-and-save-transport; no-real-backend-or-export-acceptance'
      : 'actual-parent-prefix-pure-reconciler-and-save-binding; synthetic-observer-state-and-save-intent; no-export-or-database-acceptance',
  })}`);
  if (!characterize && results.some(result => result.safety === 'FAIL')) process.exitCode = 1;
} catch (error) {
  console.error('EXPORT_DURATION_SESSION_HARNESS_FAILURE', error);
  process.exitCode = 2;
}
