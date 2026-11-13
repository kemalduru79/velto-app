import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Offline presentation/event-wiring tests. Child widgets and pure imported
// helpers are explicit test doubles; this does not qualify providers or media.
const require = createRequire(import.meta.url);
const jsxRuntime = require('react/jsx-runtime');
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const calls = [];
const widgets = new Map();
function widget(name) {
  if (!widgets.has(name)) widgets.set(name, Object.assign(() => null, { displayName: name }));
  return widgets.get(name);
}
function dependency(specifier) {
  if (specifier === 'react/jsx-runtime') return jsxRuntime;
  return new Proxy({}, { get(_target, key) {
    if (key === '__esModule') return true;
    if (key === 'default') return widget(specifier);
    if (['CREATOR_VOICE_SELECTIONS', 'CREATOR_PLATFORM_IDS', 'CREATOR_QUALITY_MODE_OPTIONS'].includes(key)) return [];
    if (key === 'getCreatorVoiceSelection') return () => ({ descriptionEn: 'Synthetic delivery', descriptionTr: 'Sentetik ifade' });
    if (key === 'getCreatorVoiceSelectionLabel') return () => 'Synthetic voice';
    if (key === 'createDefaultCreatorMusicTimeline') return () => ({ version: 1, placements: [], cues: [] });
    if (key === 'getCreatorMusicSetupMode') return () => 'none';
    if (key === 'DEFAULT_CREATOR_BACKGROUND_MUSIC') return { mode: 'none' };
    return () => ({});
  } });
}
function defaultValue(node) {
  if (!node) return {};
  if (ts.isFunctionTypeNode(node)) return () => defaultValue(node.type);
  if (ts.isArrayTypeNode(node)) return [];
  if (ts.isUnionTypeNode(node)) return defaultValue(node.types.find(t => t.kind === ts.SyntaxKind.NullKeyword || (ts.isLiteralTypeNode(t) && t.literal.kind === ts.SyntaxKind.NullKeyword)) || node.types[0]);
  if (ts.isLiteralTypeNode(node)) {
    if (node.literal.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isNumericLiteral(node.literal)) return Number(node.literal.text);
    if (node.literal.kind === ts.SyntaxKind.TrueKeyword || node.literal.kind === ts.SyntaxKind.FalseKeyword) return node.literal.kind === ts.SyntaxKind.TrueKeyword;
    return node.literal.text;
  }
  if (ts.isTypeOperatorNode(node)) return defaultValue(node.type);
  if (ts.isTypeLiteralNode(node)) return Object.fromEntries(node.members.filter(ts.isPropertySignature).map(p => [p.name.getText(), defaultValue(p.type)]));
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return false;
  if (node.kind === ts.SyntaxKind.NumberKeyword) return 0;
  if (node.kind === ts.SyntaxKind.StringKeyword) return '';
  if (ts.isImportTypeNode(node) && node.qualifier?.getText() === 'Dispatch') return () => {};
  return {};
}
function load(name) {
  const filename = path.join(root, 'components/create', name + '.tsx');
  const text = fs.readFileSync(filename, 'utf8');
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const contract = source.statements.find(s => ts.isTypeAliasDeclaration(s) && s.name.text === name + 'Props');
  assert(contract && ts.isTypeLiteralNode(contract.type));
  let hookCalls = 0;
  function visit(n) { if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^use[A-Z]/.test(n.expression.text)) hookCalls++; ts.forEachChild(n, visit); }
  visit(source);
  assert.equal(hookCalls, 0, 'presentation panels must not acquire hooks or state ownership');
  const props = Object.fromEntries(contract.type.members.map(p => [p.name.getText(), defaultValue(p.type)]));
  for (const [key, value] of Object.entries(props)) if (typeof value === 'function') {
    props[key] = (...args) => { calls.push({ key, args }); return value(...args); };
  }
  const compiled = ts.transpileModule(text, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const testModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(dependency, testModule, testModule.exports);
  return { render: testModule.exports.default, props };
}
function nodes(tree) {
  const found = [];
  function visit(value) { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object' && value.props) { found.push(value); visit(value.props.children); } }
  visit(tree); return found;
}
function text(tree) { if (Array.isArray(tree)) return tree.map(text).join(' '); if (tree && typeof tree === 'object') return text(tree.props?.children); return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : ''; }
function button(tree, label) { const result = nodes(tree).find(n => n.type === 'button' && (text(n).trim() === label || nodes(n.props.children).some(c => c.type === 'strong' && text(c).trim() === label))); assert(result, 'missing button: ' + label); return result; }
function common(props) {
  return { ...props, uiLanguage: 'en', language: 'en', creatorProductionPackage: { title: 'Synthetic preserved project', storyPremise: 'Fictional fixture' }, CREATOR_FORMAT_OPTIONS: [{ value: 'youtube_video', label: 'Long-form Video', guidance: '' }], creatorFormat: 'youtube_video', scenes: [], getCreatorDurationLabel: () => '10 minutes', getCreatorQualityModeLabel: () => 'Standard', currentProjectId: '' };
}
const production = load('CreatorProductionPanel');
let props = common(production.props);
Object.assign(props, { creatorStageVisibility: { production_setup: true, create_review: false }, creatorProductionSubstep: 'setup', characters: [], narratorSettings: { stability: 0.5, similarityBoost: 0.5, style: 0, speed: 1 }, creatorProductionSetupPresentation: { headline: 'Synthetic setup', visualStyleSummary: 'Static', actionRequired: false }, creatorVoiceCreditEstimate: { totalTracks: 0 }, getCreatorVoiceCreditEstimate: () => ({ totalTracks: 0 }), getEffectiveNarratorVoiceProfileId: () => 'default', getEffectiveDialogueVoiceProfileId: () => 'default' });
let tree = production.render(props);
assert.equal(tree.props.id, 'creatorlab-production-canvas');
assert(text(tree).includes('10 minutes'));
assert.equal(calls.some(c => /^(set|handle|onUse|clear|buildStory|continueCreator)/.test(c.key)), false, 'render must not dispatch state, generation or persistence');
button(tree, 'Continue to Create & Review').props.onClick();
assert.equal(calls.at(-1).key, 'selectCreatorProductionSubstep');
assert.deepEqual(calls.at(-1).args, ['create_review']);
calls.length = 0;
button(tree, 'Faceless').props.onClick();
assert(calls.some(c => c.key === 'setCreatorNoCastMode' && c.args[0] === 'faceless'));
const update = calls.find(c => c.key === 'setNarratorSettings').args[0];
assert.deepEqual(update({ voiceId: 'old', preserved: 42 }), { voiceId: '', voiceSelection: undefined, preserved: 42 });
for (const key of ['stopDialoguePlayback', 'stopStoryPlayback', 'clearAllSceneAudioData', 'clearAllSceneDialogueAudioData', 'clearAllSceneTimingData']) assert.equal(calls.filter(c => c.key === key).length, 1);
calls.length = 0;
props = { ...props, creatorStageVisibility: { production_setup: false, create_review: true }, creatorSceneHydrationAuthority: 'recovery_required' };
tree = production.render(props);
assert(text(tree).includes('Saved scenes need recovery'));
assert.equal(nodes(tree).some(n => n.type === 'button' && text(n).trim() === 'Prepare Scenes'), false, 'recovery-required scenes cannot be rebuilt by this view');
assert.equal(calls.length, 0);
props = { ...props, creatorSceneHydrationAuthority: 'empty', buildingStory: false };
tree = production.render(props);
button(tree, 'Prepare Scenes').props.onClick();
assert.equal(calls.at(-1).key, 'buildStory');

const publish = load('CreatorPublishPanel');
props = common(publish.props);
Object.assign(props, { creatorThumbnailStudio: { variants: [], selectedVariantId: '', headline: '', subHeadline: '', headlineColor: '#ffffff', subHeadlineColor: '#ffffff', accentColor: '#ff6b35', headlineScale: 100, focalX: 50, focalY: 50, textPosition: 'center', font: 'cinematic', showHeadline: false, showSubHeadline: false }, creatorThumbnailHistory: [], creatorTargetPlatforms: [], creatorReleaseConfirmationItems: [], creatorPublishReadinessState: 'needs-attention', creatorPublishAttentionItems: [{ key: 'evidence', label: 'Review required' }], creatorPackageReady: false });
calls.length = 0;
tree = publish.render(props);
assert.equal(tree.props.id, 'creatorlab-publish-canvas');
const download = button(tree, 'Approve & Export Creator Package');
assert.equal(download.props.disabled, true, 'an unready package must remain disabled');
assert.equal(calls.some(c => /^(set|handle|toggle)/.test(c.key)), false, 'publish render cannot write or export');
const brief = load('CreateBriefPanel');
props = common(brief.props);
Object.assign(props, { isCreatorLabFlow: true, creatorBriefCanvasVisible: true, creatorNarrativePolicy: undefined, creatorDurationPreset: 'custom', creatorVideoDurationSec: 720, creatorPlatformOutputPlan: [], CreatorWorkspaceIcon: widget('icon'), getCreatorDurationLabel: () => '12 minutes', getCreatorDurationOptions: () => [{ preset: 'video_600', seconds: 600, label: '10 minutes' }, { preset: 'video_900', seconds: 900, label: '15 minutes' }], getCreatorCustomDurationInputValue: () => 12 });
calls.length = 0;
tree = brief.render(props);
assert.equal(tree.props.id, 'creatorlab-brief-canvas');
for (const label of ['10 minutes', '15 minutes']) assert.equal(button(tree, label).props.disabled, false, 'editorial preferences cannot constrain the unqualified general duration UI');
const durationInput = nodes(tree).find(n => n.type === 'input' && n.props.type === 'number' && n.props.value === 12);
assert(durationInput);
assert.equal(calls.some(c => /^(set|handle|createSetup|save)/.test(c.key)), false, 'brief render cannot change configuration or start work');
durationInput.props.onChange({ target: { value: '12.5' } });
assert.equal(calls.at(-1).key, 'handleCreatorCustomDurationChange');
assert.deepEqual(calls.at(-1).args, ['12.5']);
const strategy = load('CreatorStrategyPanel');
props = common(strategy.props);
Object.assign(props, { input: 'Synthetic fictional geopolitical brief', creatorWorkflowLoadingState: { scriptGenerating: false, scenesBuilding: false }, creatorMentorRecommendedIdea: { title: 'Synthetic direction', reason: 'Fixture' }, creatorScriptEditorialState: 'stale', creatorScript: null, creatorSelectedStrategyDirection: { title: 'Synthetic direction' }, creatorSelectedStrategyDirectionId: 'recommended', CreatorWorkspaceIcon: widget('icon') });
calls.length = 0;
tree = strategy.render(props);
assert.equal(tree.props.id, 'creatorlab-strategy-canvas');
assert.equal(calls.some(c => /^(set|handle|navigate)/.test(c.key)), false, 'strategy render grants no approval and initiates no generation');
button(tree, 'Review or edit brief').props.onClick();
assert.equal(calls.at(-1).key, 'navigateCreatorWorkspaceStep');
assert.deepEqual(calls.at(-1).args, [1]);
const rebuild = button(tree, 'Rebuild script');
assert.equal(rebuild.props.onClick, props.handleCreatorProductionPackage, 'existing authority coordinator callback must be preserved');
const legacy = load('StoryverseScenePanel');
props = common(legacy.props);
Object.assign(props, { isCreatorLabFlow: false, scenes: [{ id: 1, narration: 'Synthetic narration', dialogue: '', text: 'Synthetic narration' }], creatorOpsStatus: { status: 'idle', services: {} }, getSceneAudioStatus: () => true });
calls.length = 0;
tree = legacy.render(props);
assert(text(tree).includes('Synthetic narration'));
assert.equal(calls.some(c => /^(set|handle|save|start|renderAll)/.test(c.key)), false, 'legacy scene presentation cannot dispatch work during render');
console.log('CREATOR_STAGE_PANELS=PASS; actual presentation/event handlers; synthetic child/helper doubles; no providers/project access');
