import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  isCreatorProjectOperationActive,
  isCreatorProjectSaveBindingActive,
  resolveCreatorProjectRevisionAdvance,
} from '../lib/creator/projectSaveCoordinator.ts';
import { CreatorProjectSaveError } from '../lib/creator/projectSaveErrors.ts';

// Actual parent function bodies; only auth, transport, timing and React setters
// are synthetic. No application/provider/database module is executed.
// Optional --before PATH characterizes the reviewed vulnerable before-image.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
assert(args.length === 0 || args.length === 2 && args[0] === '--before', 'Usage: node --experimental-strip-types scripts/creator-stale-origin-safety-test.mjs [--before PATH]');
const afterText = fs.readFileSync(path.join(root, 'app/create/page.tsx'), 'utf8');
assert(!/useCreatorProjectSession|projectSessionProjection|projectSession\./u.test(afterText), 'Safety-only page must not depend on controller extraction');
const initialRevision = '2030-01-01T00:00:00.000Z';
const responseRevision = '2030-01-01T00:00:01.000Z';
const replacementRevision = '2030-01-01T00:00:02.000Z';
const syntheticToken = 'synthetic-no-authority';
const scenarios = [];

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`TEST_TIMEOUT: ${label}`)), 2000); }),
    ]);
  } finally { clearTimeout(timer); }
}
function definitions(text) {
  const source = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
      ['handleRefineCreatorScript', 'executePersistProject'].includes(node.name.text)) {
      assert(!found.has(node.name.text), 'Parent handler must be unambiguous');
      found.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(found.size, 2, 'Both real parent handlers must be present');
  const statements = found.get('executePersistProject').body.statements;
  const responseIndex = statements.findIndex(statement => ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(declaration => declaration.name.getText(source) === 'data' &&
      declaration.initializer?.getText(source) === 'await readCreatorProjectSaveResponse(res)'));
  assert(responseIndex >= 0, 'Save response tail must start immediately after real response parsing');
  return {
    refinement: found.get('handleRefineCreatorScript').getText(source),
    saveTail: statements.slice(responseIndex + 1).map(statement => statement.getText(source)).join('\n'),
  };
}
function compile(code, ports) {
  const { outputText, diagnostics } = ts.transpileModule(code, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  });
  assert(!diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error));
  return new Function(...Object.keys(ports), outputText)(...Object.values(ports));
}
const helpers = { isCreatorProjectOperationActive, isCreatorProjectSaveBindingActive, resolveCreatorProjectRevisionAdvance, CreatorProjectSaveError };
async function refinementCase(source, mode, fixed) {
  const auth = deferred(), transport = deferred(), parsed = deferred();
  const dispatched = deferred(), parsing = deferred(), updates = [];
  const project = { current: 'synthetic-a' }, generation = { current: 1 };
  const revision = { current: initialRevision }, script = { current: { revision: 2 } };
  const state = { pending: null, errors: [], messages: [], requests: [] };
  const proposal = { proposalId: 'synthetic-proposal', baseRevision: 2 };
  const switchProject = () => {
    project.current = 'synthetic-b'; generation.current++; revision.current = replacementRevision;
  };
  const run = compile(`return ${source.refinement};`, {
    ...helpers,
    creatorScriptRef: script,
    getCreatorScriptDocumentText: () => 'Synthetic source document',
    getAccessTokenOrThrow: () => auth.promise,
    fetch: (url, options) => {
      assert.equal(url, '/api/creator-script/refine');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, `Bearer ${syntheticToken}`);
      state.requests.push(JSON.parse(options.body));
      dispatched.resolve(); return transport.promise;
    },
    currentProjectIdRef: project,
    currentProjectId: 'synthetic-a',
    projectGenerationRef: generation,
    projectUpdatedAtRef: revision,
    setCreatorScriptPendingRefinement: update => {
      if (mode === 'deferred-updater') updates.push(update);
      else state.pending = typeof update === 'function' ? update(state.pending) : update;
    },
    setError: value => state.errors.push(value),
    setSaveMessage: value => state.messages.push(value),
    uiLanguage: 'en',
  });
  const completion = run({ scope: 'opening', mode: 'focused_edit', instruction: 'Synthetic test only' });
  if (mode === 'auth-switch') switchProject();
  auth.resolve(syntheticToken);
  if (!(fixed && mode === 'auth-switch')) {
    await bounded(dispatched.promise, 'refinement dispatch');
    if (mode === 'project-switch') switchProject();
    if (mode === 'same-id-generation') { generation.current++; revision.current = replacementRevision; }
    if (mode === 'round-trip') { switchProject(); project.current = 'synthetic-a'; generation.current++; }
    if (mode === 'script-revision') script.current = { revision: 3 };
    transport.resolve({ ok: true, json: () => { parsing.resolve(); return parsed.promise; } });
    await bounded(parsing.promise, 'refinement response parsing');
    if (mode === 'json-switch') switchProject();
    parsed.resolve({ pendingRefinement: proposal, project: { id: 'synthetic-a', updated_at: responseRevision } });
  }
  const returned = await bounded(completion, 'refinement completion');
  if (mode === 'deferred-updater') {
    switchProject();
    for (const update of updates) state.pending = typeof update === 'function' ? update(state.pending) : update;
  }
  const expectedInstall = !fixed || mode === 'current';
  assert.equal(state.pending !== null, expectedInstall);
  if (expectedInstall) assert.deepEqual(state.pending, proposal);
  assert.equal(state.requests.length, fixed && mode === 'auth-switch' ? 0 : 1);
  if (fixed && mode !== 'auth-switch') assert.equal(state.requests[0].projectId, 'synthetic-a', 'Dispatch must use captured project identity');
  const responseAdopted = revision.current === responseRevision;
  assert.equal(responseAdopted, mode === 'deferred-updater' ? false : !fixed || mode === 'current');
  if (fixed && mode !== 'current' && mode !== 'deferred-updater') {
    assert.equal(returned, false); assert.deepEqual(state.errors, []); assert.deepEqual(state.messages, []);
  }
  if (mode === 'current') assert.equal(returned, true);
  return { installed: state.pending !== null, responseAdopted, dispatches: state.requests.length };
}
async function saveCase(source, mode, fixed) {
  const project = { current: mode === 'different-project' ? 'synthetic-b' : 'synthetic-a' };
  const generation = { current: mode === 'same-id-generation' ? 2 : 1 };
  const revision = { current: initialRevision }, mutations = [];
  const run = compile(`return async () => { ${source.saveTail} };`, {
    ...helpers,
    lifecycleOverrides: {},
    data: { project: { id: mode === 'response-identity-mismatch' ? 'synthetic-wrong' : 'synthetic-a', updated_at: responseRevision }, mode: 'updated' },
    res: { status: 200 }, effectiveProjectId: 'synthetic-a',
    currentProjectIdRef: project, projectUpdatedAtRef: revision, projectGenerationRef: generation,
    requestBinding: { originProjectId: 'synthetic-a', projectId: 'synthetic-a', expectedUpdatedAt: initialRevision, generation: 1 },
    setCurrentProjectId: value => mutations.push(['projectId', value]),
    setLoadProjectId: value => mutations.push(['loadId', value]),
    replaceProjectUrlIdentity: value => mutations.push(['url', value]),
    isCreatorLabFlow: true,
    setCreatorPublishReadinessRevision: () => mutations.push(['readiness']),
    fetchProjects: async () => mutations.push(['projectList']),
    showManualMessage: true,
    setSaveMessage: value => mutations.push(['message', value]),
    ui: { projectSaved: 'synthetic-created', projectUpdated: 'synthetic-updated' },
  });
  if (mode === 'response-identity-mismatch') await assert.rejects(run(), error => error instanceof CreatorProjectSaveError && error.code === 'PROJECT_SAVE_RESPONSE_IDENTITY_INVALID');
  else await run();
  const responseAdopted = revision.current === responseRevision;
  assert.equal(responseAdopted, mode === 'current' || !fixed && mode === 'same-id-generation');
  if (mode === 'current') {
    assert.equal(project.current, 'synthetic-a');
    assert.deepEqual(mutations.map(value => value[0]), ['projectId', 'loadId', 'url', 'readiness', 'projectList', 'message']);
  } else {
    assert.deepEqual(mutations, [], 'A stale/invalid response cannot rebind identity, URL, feedback or list state');
    assert.equal(project.current, mode === 'different-project' ? 'synthetic-b' : 'synthetic-a');
  }
  return { responseAdopted, downstreamMutations: mutations.length };
}
const cases = [
  ...['current', 'project-switch', 'same-id-generation', 'round-trip', 'script-revision', 'auth-switch', 'json-switch', 'deferred-updater'].map(mode => ({ name: `refinement/${mode}`, run: refinementCase, mode })),
  ...['current', 'same-id-generation', 'different-project', 'response-identity-mismatch'].map(mode => ({ name: `save/${mode}`, run: saveCase, mode })),
];
const beforeSource = args.length ? definitions(fs.readFileSync(path.resolve(args[1]), 'utf8')) : null;
const afterSource = definitions(afterText);
for (const scenario of cases) {
  const before = beforeSource ? await scenario.run(beforeSource, scenario.mode, false) : undefined;
  const after = await scenario.run(afterSource, scenario.mode, true);
  scenarios.push({ scenario: scenario.name, ...(before ? { before } : {}), after });
  console.log(`PASS ${scenario.name}${before ? ' / before failure characterization + after protection' : ''}`);
}
console.log(`STALE_ORIGIN_SAFETY_RESULT=${JSON.stringify({ scenarios: scenarios.length, executions: scenarios.length * (beforeSource ? 2 : 1), sourceMode: 'actual-parent-functions', realNetworkRequests: 0, productionAccess: false, scenariosDetail: scenarios })}`);
