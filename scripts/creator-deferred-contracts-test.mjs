import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import ts from "typescript";

// Actual module declarations; external services are fail-closed synthetic ports.
// This qualifies local contracts, not provider responses, RLS or production data.
const require = createRequire(import.meta.url);
const { NextResponse, NextRequest } = require("next/server");
const root = process.cwd();
const beforeAt = process.argv.indexOf("--before");
const before = beforeAt < 0 ? null : process.argv[beforeAt + 1];
const outputAt = process.argv.indexOf("--output");
let assertions = 0;
function equal(a, b, label) { assert.deepEqual(a, b, label); assertions += 1; }
function compile(base, file, extra = "") {
  const sf = ts.createSourceFile(file, fs.readFileSync(path.join(base, file), "utf8"), ts.ScriptTarget.Latest, true);
  return ts.transpileModule(sf.statements.filter((n) => !ts.isImportDeclaration(n) && !(ts.isExportDeclaration(n) && n.moduleSpecifier)).map((n) => n.getText(sf)).join("\n") + extra, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
}
function evaluate(code, ports = {}) {
  const exports = {};
  new Function("exports", ...Object.keys(ports), code)(exports, ...Object.values(ports));
  return exports;
}
function errorShape(error) { return { name: error?.name, message: error?.message }; }
function observe(fn, value) { try { return { value: fn(value) }; } catch (error) { return { error: errorShape(error) }; } }
function freeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const storyFile = "app/api/story-setup/route.ts";
const youtubeFile = "app/api/youtube-research/route.ts";
const httpFile = "lib/observability/http.ts";
const currentStory = compile(root, storyFile, "\nexports.guide = ensureDefaultGuideCharacter;");
const priorStory = before ? compile(before, storyFile, "\nexports.guide = ensureDefaultGuideCharacter;") : null;
const currentYoutube = compile(root, youtubeFile);
const priorYoutube = before ? compile(before, youtubeFile) : null;
async function runStory(code, scenario) {
  const events = [];
  class SyntheticOpenAI {
    constructor() { events.push("provider.construct"); this.responses = { create: this.create }; }
    async create(args) { events.push(["provider", JSON.stringify(args)]); if (scenario.providerError) throw scenario.providerError(); return { output_text: scenario.raw ?? JSON.stringify(scenario.value) }; }
  }
  const loadedRoute = evaluate(code, {
    NextResponse, OpenAI: SyntheticOpenAI, process: { env: { OPENAI_API_KEY: "synthetic-no-authority", NODE_ENV: "development" } },
    console: { error(...args) { events.push(["error", args.length]); } },
    async recordOpenAITextEconomics(args) { events.push(["economics", args.route, args.operationType, args.model]); },
    fetch() { throw Error("Unexpected network forbidden"); },
  });
  const req = { async json() { events.push("request.json"); if (scenario.requestError) throw scenario.requestError(); return scenario.body ?? { prompt: "Synthetic story", language: "en" }; } };
  try { const result = await loadedRoute.POST(req); return { status: result.status, headers: [...result.headers], body: await result.text(), events }; }
  catch (error) { return { error: errorShape(error), events }; }
}
const setup = (characters = [], visualBible = {}) => ({ title: "Synthetic", storyPremise: "Premise", characters, visualBible });
const primitives = [null, false, true, 0, -1, "", "historical", [], {}, ["legacy"], { name: "Joe" }, { name: " J o e " }];
const stories = [{ name: "valid", value: setup([{ name: "Joe", age: "10" }], { style: "cinematic" }) }, ...primitives.map((value, i) => ({ name: `envelope-${i}`, value })), ...primitives.map((value, i) => ({ name: `character-${i}`, value: setup([value]) })), ...primitives.map((value, i) => ({ name: `bible-${i}`, value: setup([], value) })), { name: "legacy-truthy", value: { title: 42, storyPremise: [1], characters: [{ name: ["Joe"], age: 42, appearance: {}, outfit: true, accessory: 0, personality: [1], referenceImage: {} }], visualBible: { style: 42, palette: {}, camera: true, consistencyRules: [1] } } }, { name: "malformed-json", raw: "not-json" }, { name: "fenced-json", raw: `\x60\x60\x60json\n${JSON.stringify(setup())}\n\x60\x60\x60` }, { name: "empty-request", value: setup(), body: {} }, { name: "invalid-prompt", value: setup(), body: { prompt: 42 } }, { name: "provider-failure", providerError: () => Error("synthetic-provider") }, { name: "request-failure", requestError: () => Error("synthetic-request") }];
for (const scenario of stories) {
  freeze(scenario.value);
  const result = await runStory(currentStory, scenario);
  if (priorStory) equal(result, await runStory(priorStory, scenario), `story/${scenario.name} exact response/order`);
  if (scenario.name === "valid") { equal(result.status, 200, "valid story status"); equal(JSON.parse(result.body).characters[0].name, "Joe", "guide retained"); }
  if (scenario.name === "legacy-truthy") { const body = JSON.parse(result.body); equal(body.title, 42, "no title coercion"); equal(body.characters[0].age, 42, "no field coercion"); equal(body.visualBible.style, 42, "no bible coercion"); }
  if (scenario.name === "invalid-prompt") { equal(result.status, 400, "invalid prompt rejected"); equal(result.events.some((e) => Array.isArray(e) && e[0] === "provider"), false, "no dispatch after prompt denial"); }
  if (scenario.name === "envelope-0") equal(result.status, 500, "null envelope rejected");
}
const guideNow = evaluate(currentStory).guide;
const guideOld = priorStory ? evaluate(priorStory).guide : null;
const rawFields = [...primitives, undefined, NaN, Infinity, Symbol("synthetic"), 1n];
const guides = [...rawFields, ...rawFields.map((value) => [{ name: "Joe", age: value, appearance: value, outfit: value, accessory: value, personality: value }]), ...rawFields.map((value) => [{ name: value }])];
if (guideOld) for (const value of guides) equal(observe(guideNow, freeze(value)), observe(guideOld, freeze(value)), "guide malformed/historical/default equivalence");
if (guideOld) {
  const traced = () => { const events = []; let reads = 0; return { events, value: [new Proxy({ name: "Joe", get age() { return reads++ ? "second" : 0; } }, { get(t, k, r) { events.push(String(k)); return Reflect.get(t, k, r); }, set() { throw Error("input mutation forbidden"); } })] }; };
  const a = traced(); const b = traced(); equal(observe(guideNow, b.value), observe(guideOld, a.value), "guide volatile output"); equal(b.events, a.events, "guide read count/order");
}
async function runYoutube(code, scenario) {
  const events = []; let calls = 0;
  const loadedRoute = evaluate(code, {
    NextResponse, OpenAI: class { constructor() { throw Error("Provider must not be invoked"); } },
    process: { env: { YOUTUBE_API_KEY: scenario.missingKey ? "" : "synthetic-no-authority" } },
    console: { error(...args) { events.push(["error", args.length]); } },
    recordOpenAITextEconomics() { throw Error("Provider economics must not be invoked"); },
    async fetch(url, options) {
      const parsed = new URL(url); equal(parsed.hostname, "www.googleapis.com", "only intended synthetic port");
      events.push(["fetch-port", parsed.pathname, parsed.searchParams.get("id"), options]); calls += 1;
      if (scenario.fetchError) throw scenario.fetchError();
      const value = calls === 1 ? (scenario.search ? scenario.search(events) : { items: [{ id: { videoId: "offline" } }] }) : (scenario.videos ? scenario.videos(events) : { items: [{ id: "offline", snippet: { title: "Synthetic topic", description: "Synthetic topic", channelTitle: "channel" }, statistics: { viewCount: "12" }, contentDetails: { duration: "PT1M" } }] });
      return { ok: !scenario.denied, status: scenario.denied ? 403 : 200, async json() { return value; } };
    },
  });
  try { const result = await loadedRoute.POST({ async json() { events.push("request.json"); if (scenario.requestError) throw Error("synthetic request"); return scenario.body ?? { topic: "Synthetic topic", language: "en" }; } }); return { status: result.status, body: await result.text(), headers: [...result.headers], events }; }
  catch (error) { return { error: errorShape(error), events }; }
}
const youtube = [{ name: "valid" }, ...rawFields.map((value, i) => ({ name: `item-${i}`, search: () => ({ items: [value] }) })), ...rawFields.map((value, i) => ({ name: `id-${i}`, search: () => ({ items: [{ id: value }] }) })), ...rawFields.map((value, i) => ({ name: `video-id-${i}`, search: () => ({ items: [{ id: { videoId: value } }] }) })), { name: "truncation", search: () => ({ items: Array.from({ length: 40 }, (_, i) => ({ id: { videoId: `id-${i}` } })) }) }, { name: "missing-items", search: () => ({}) }, { name: "wrong-items", search: () => ({ items: {} }) }, { name: "null-envelope", search: () => null }, { name: "denied", denied: true, search: () => ({ error: { message: "synthetic denied" } }) }, { name: "no-key", missingKey: true }, { name: "empty-topic", body: {} }, { name: "request-error", requestError: true }, { name: "fetch-error", fetchError: () => Error("synthetic fetch") }, { name: "traced", search: (events) => ({ items: [new Proxy({ id: new Proxy({ videoId: "offline" }, { get(t, k, r) { events.push(`id:${String(k)}`); return Reflect.get(t, k, r); } }) }, { get(t, k, r) { events.push(`item:${String(k)}`); return Reflect.get(t, k, r); } })] }) }];
for (const scenario of youtube) {
  const result = await runYoutube(currentYoutube, scenario);
  if (priorYoutube) equal(result, await runYoutube(priorYoutube, scenario), `youtube/${scenario.name} exact response/order/coercion`);
  if (scenario.name === "valid") { equal(result.status, 200, "valid YouTube status"); equal(JSON.parse(result.body).videos[0].id, "offline", "candidate retained"); }
  if (["empty-topic", "request-error"].includes(scenario.name)) { equal(result.status, 400, "topic denied"); equal(result.events.length, 1, "no fetch after denial"); }
  if (scenario.name === "denied") equal(result.status, 403, "remote denial preserved");
  if (scenario.name === "wrong-items") equal(result.status, 500, "wrong collection remains rejected");
  if (scenario.name === "truncation") equal(result.events.find((e) => Array.isArray(e) && e[1].endsWith("/videos"))[2].split(",").length, 25, "25-ID cap unchanged");
}
// Real AsyncLocalStorage/context logic. No logs, metrics or external writes escape.
const contextCode = compile(root, "lib/observability/context.ts");
async function runWrapper(code, scenario) {
  const events = []; let clock = 0;
  const context = evaluate(contextCode, { AsyncLocalStorage, randomUUID: () => "synthetic-id" });
  const ports = { ...context, performance: { now() { events.push("clock"); return clock += 5; } }, createLogger() { events.push("logger"); return { info(...args) { events.push(["info", ...args]); }, error(message, error, detail) { events.push(["error", message, errorShape(error), detail]); } }; }, incrementCounter(...args) { events.push(["counter", ...args]); }, observeHistogram(...args) { events.push(["histogram", ...args]); } };
  const fn = evaluate(code, ports).withObservedApiRoute;
  let resolve; const pending = new Promise((r) => { resolve = r; });
  const request = new NextRequest("http://127.0.0.1/synthetic", { method: "GET", headers: { "x-request-id": "synthetic-request", "x-trace-id": "synthetic-trace" } });
  const routeContext = { params: Promise.resolve({ jobId: "synthetic" }) };
  const sentinel = Error("synthetic failure");
  function handler(...args) { events.push(["handler", args[0] === request, args[1] === routeContext, args.length, context.getObservabilityContext()]); if (scenario.fail) throw sentinel; if (scenario.asyncFail) return Promise.reject(sentinel); const response = scenario.immutable ? Response.redirect("http://127.0.0.1/redirect") : NextResponse.json({ ok: true }, { status: scenario.status || 200 }); return scenario.pending ? pending.then(() => response) : scenario.async ? Promise.resolve(response) : response; }
  handler.attached = "not copied";
  const wrapper = fn("synthetic.route", handler);
  equal(wrapper.length, 0, "variadic runtime arity unchanged"); equal(wrapper.attached, undefined, "no false callable-property contract");
  const result = scenario.noRequest ? wrapper() : wrapper(request, routeContext);
  equal(result instanceof Promise, true, "always returns Promise even for sync handler");
  if (scenario.pending) { equal(events.some((e) => Array.isArray(e) && e[0] === "counter"), false, "no settlement before await"); resolve(); }
  let settled;
  try { const response = await result; settled = { status: response.status, body: await response.text(), headers: [...response.headers], isNextResponse: response instanceof NextResponse }; }
  catch (error) { settled = { error: errorShape(error), sameSentinel: error === sentinel }; }
  equal(context.getObservabilityContext(), {}, "context restored outside request");
  return { settled, events };
}
const currentHttp = compile(root, httpFile); const priorHttp = before ? compile(before, httpFile) : null;
if (priorHttp) equal(currentHttp, priorHttp, "observability emitted JS is byte-identical");
const wrappers = [{ name: "sync" }, { name: "async", async: true }, { name: "pending", pending: true }, ...[201, 301, 404, 503].map((status) => ({ name: `status-${status}`, status })), { name: "sync-failure", fail: true }, { name: "async-failure", asyncFail: true }, { name: "immutable-response", immutable: true }, { name: "missing-request", noRequest: true }];
for (const scenario of wrappers) {
  const result = await runWrapper(currentHttp, scenario);
  if (priorHttp) equal(result, await runWrapper(priorHttp, scenario), `wrapper/${scenario.name} exact response/order/error/context`);
  if (scenario.fail || scenario.asyncFail) equal(result.settled.sameSentinel, true, "original error rethrown");
  if (scenario.name === "sync") { equal(result.settled.status, 200, "sync success"); equal(result.settled.headers.find(([k]) => k === "x-request-id")[1], "synthetic-request", "correlation header"); }
}
// Characterize deferred contracts from their actual expressions and handler.
// These tests document unchecked values; they do not approve a stronger schema.
function findNode(file, predicate) {
  const sf = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function walk(n) { if (!found && predicate(n, sf)) found = n; ts.forEachChild(n, walk); }
  walk(sf); assert(found, file); return { node: found, sf };
}
function expressionFunction(expression, parameters) {
  const code = ts.transpileModule(`exports.fn=(${parameters})=>(${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {}; new Function("exports", "require", code)(exports, require); return exports.fn;
}
const page = "app/create/page.tsx";
const previewNode = findNode(page, (n) => ts.isVariableDeclaration(n) && n.name.getText() === "getProjectPreviewImage");
const preview = expressionFunction(previewNode.node.initializer.getText(previewNode.sf), "");
const previewFn = preview();
for (const value of [null, undefined, {}, { scenes: null }, { scenes: "legacy" }, { scenes: [null, {}, { image: 0 }] }]) equal(previewFn(value), "", "preview malformed/missing fallback");
for (const image of ["/synthetic.png", 42, true, { legacy: true }, ["legacy"]]) { const fixture = freeze({ scenes: [{ image: "" }, { image }, { image: "later" }] }); equal(previewFn(fixture), image, "preview retains exact arbitrary first truthy field"); }
const flowNode = findNode(page, (n) => ts.isVariableDeclaration(n) && n.name.getText() === "activeFlowKey");
const flow = expressionFunction(flowNode.node.initializer.getText(flowNode.sf), "selectedFlow,selectedFlowKey");
const flows = evaluate(compile(root, "lib/flows.ts"));
for (const [key, expected] of [["creator_lab", "creator_lab"], ["creatorlab", "creator_lab"], ["storyverse", "storyverse"], ["unknown", "storyverse"], [undefined, "storyverse"], [null, "storyverse"]]) equal(flow(flows.getFlowByKey(key), key), expected, "factory-owned flow selection");
for (const id of ["legacy-id", 42, { legacy: true }]) equal(flow({ key: "", id }, "fallback"), id, "undeclared legacy flow fallback is not silently removed/coerced");
equal(flow(null, "fallback"), "fallback", "selected key fallback"); equal(flow(null, ""), "storyverse", "default flow fallback");
const privatePage = "app/episode/[projectId]/page.tsx";
const { renderToStaticMarkup } = require("react-dom/server");
for (const field of ["characters", "scenes"]) {
  const found = findNode(privatePage, (n, sf) => ts.isCallExpression(n) && n.expression.getText(sf) === `project.${field}?.map`);
  const render = expressionFunction(found.node.getText(found.sf), "project");
  equal(observe((v) => renderToStaticMarkup(render(v)), { [field]: [] }).value, "", `private ${field} empty array`);
  equal(observe((v) => renderToStaticMarkup(render(v)), { [field]: null }).value, "", `private ${field} historical null`);
  equal(observe((v) => renderToStaticMarkup(render(v)), { [field]: "wrong" }).error.name, "TypeError", `private ${field} wrong collection remains rejected`);
  equal(observe((v) => renderToStaticMarkup(render(v)), { [field]: [null] }).error.name, "TypeError", `private ${field} null rows remain rejected`);
  const good = field === "characters" ? { name: "Joe", personality: "curious" } : { narration: "Synthetic narration" };
  equal(typeof observe((v) => renderToStaticMarkup(render(v)), { [field]: [good] }).value, "string", `private ${field} valid values render`);
  const bad = field === "characters" ? { name: { legacy: true } } : { narration: { legacy: true } };
  equal(observe((v) => renderToStaticMarkup(render(v)), { [field]: [bad] }).error.name, "Error", `private ${field} opaque objects are not certified React children`);
}
const audio = evaluate(compile(root, "lib/video/audioDurationMatching.ts"));
const visual = evaluate(compile(root, "lib/video/visualFiller.ts"));
const duration = evaluate(compile(root, "lib/video/videoDurationPolicy.ts"));
const timeline = evaluate(compile(root, "lib/video/timelineSync.ts"), { ...audio, ...visual, ...duration });
async function runLegacyStory(base, value) {
  const events = [];
  const route = evaluate(compile(base, "app/api/story/route.ts"), { NextResponse, process: { env: { OPENAI_API_KEY: "synthetic-no-authority" } }, OpenAI: class { constructor() { this.responses = { async create() { events.push("provider-port"); return { output_text: JSON.stringify(value) }; } }; } }, async recordOpenAITextEconomics() { events.push("economic-port"); }, createTimelineSyncPlan: timeline.createTimelineSyncPlan, console: { error() { events.push("error"); } } });
  const response = await route.POST({ async json() { return { prompt: "Synthetic" }; } }); return { status: response.status, body: await response.text(), events };
}
const legacyStoryCases = [null, {}, { title: "Synthetic", characters: [], visualBible: {}, scenes: [] }, ...[null, true, 42, "historical", {}, { id: "7", text: 42, narration: ["legacy"], targetDurationSec: "7" }, { id: 1, text: "Synthetic scene" }].map((scene) => ({ title: "Synthetic", characters: [], visualBible: {}, scenes: [scene] }))];
for (const value of legacyStoryCases) { const result = await runLegacyStory(root, value); if (before) equal(result, await runLegacyStory(before, value), "legacy story exact handler and actual timeline contract"); }
equal((await runLegacyStory(root, legacyStoryCases.at(-1))).status, 200, "valid timeline scene succeeds");
equal((await runLegacyStory(root, legacyStoryCases[3])).status, 500, "null timeline row remains rejected");

// The public API already sanitizes these arrays with the existing DTO mapper.
// Type-only reuse must preserve the entire emitted component and every effect.
const publicFile = "app/episode/public/[shareId]/page.tsx";
if (before) equal(compile(root, publicFile), compile(before, publicFile), "public episode emitted JS byte-identical");
const projection = evaluate(compile(root, "lib/security/publicStoryverseProjection.ts"));
const original = freeze({ title: "Synthetic public episode", language: "en", flow_type: "storyverse", story_premise: "Premise", characters: [{ name: "Joe", age: "10", personality: "curious", referenceImage: "https://example.invalid/portrait.png" }], scenes: [{ id: 1, text: "Scene", image: "/synthetic.png", videoUrl: "https://example.invalid/video.mp4" }], published_at: "2026-01-01", exported_movie_url: "https://example.invalid/final.mp4" });
const dto = projection.mapPublicStoryverseEpisode(original);
equal(dto.characters[0].name, "Joe", "public mapper character contract");
equal(dto.scenes[0].image, "/synthetic.png", "public mapper image contract");
for (const raw of [null, false, 42, "legacy", [], {}, { name: 42, referenceImage: "javascript:alert(1)" }]) {
  const result = projection.mapPublicStoryverseEpisode({ ...original, characters: [raw], scenes: [raw] });
  equal(result.characters.every((r) => Object.values(r).every((v) => typeof v === "string")), true, "public character projection never claims raw field authority");
  equal(result.scenes.every((r) => Object.entries(r).every(([k, v]) => k === "id" ? typeof v === "string" || typeof v === "number" : typeof v === "string")), true, "public scene projection remains typed");
}
equal(projection.mapPublicStoryverseEpisode({ ...original, flow_type: "creator_lab" }), null, "public flow exclusion retained");
equal(projection.mapPublicStoryverseEpisode({ ...original, language: "invalid" }), null, "public language guard retained");
equal(projection.mapPublicStoryverseEpisode({ ...original, scenes: [{ image: "javascript:alert(1)", videoUrl: "//unsafe.invalid/video" }] }).scenes[0], {}, "unsafe public media remain omitted");

// M2 raw command/history views: execute the actual declarations. These tests
// preserve legacy data; returned actions remain pending and never authorize execution.
function directorModule(base, events) {
  const file = path.join(base, page);
  const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(["CREATOR_DIRECTOR_ACTION_TYPES", "normalizeCreatorDirectorActions", "parseCreatorCopilotMessages"]);
  const selected = sf.statements.filter((node) =>
    (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => names.has(d.name.getText(sf)))),
  );
  equal(selected.length, 3, "M2 executes the three actual command/history declarations");
  const code = ts.transpileModule(selected.map((n) => n.getText(sf)).join("\n") +
    "\nexports.actions=normalizeCreatorDirectorActions;exports.messages=parseCreatorCopilotMessages;", {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  class FixedDate extends Date {
    constructor(value = 1700000000000) { super(value); events.push("date.construct"); }
    static now() { events.push("date.now"); return 1700000000000; }
  }
  return evaluate(code, { Date: FixedDate });
}
function directorOutcome(base, kind, createInput) {
  const events = [];
  const fn = directorModule(base, events)[kind];
  const input = createInput(events);
  return { outcome: observe(fn, input), events };
}
const action = (extra = {}) => ({ type: "update_brief_topic", payload: {}, ...extra });
const actionCases = [
  ...[undefined, null, false, 0, 42, "legacy", {}, []].map((value, index) => ({ name: `outer-${index}`, input: () => value })),
  ...[undefined, null, false, 0, "", "invented", ["update_brief_topic"], { toString: () => "update_brief_topic" }]
    .map((type, index) => ({ name: `unqualified-type-${index}`, input: () => [action({ type })] })),
  { name: "valid", input: () => freeze([action({ id: "synthetic", title: " title ", payload: { topic: " topic " } })]) },
  { name: "limits", input: () => freeze(Array.from({ length: 5 }, (_, i) => action({ id: String(i), title: "t".repeat(150), description: "d".repeat(450), changes: Array.from({ length: 7 }, () => ({ label: "l".repeat(150), before: "b".repeat(550), after: "a".repeat(550) })) }))) },
  { name: "coercion", input: () => freeze([action({ id: 7, title: 42, description: ["legacy"], impact: "release", requiresExplicitConfirmation: "yes", payload: { sceneId: "7", sceneIds: ["2", 2, 0, -1, "bad", Infinity], workspaceStage: "5", renderMode: "video" } })]) },
  { name: "raw-changes", input: () => freeze([action({ changes: [null, false, 42, "legacy"] })]) },
  { name: "sparse", input: () => { const rows = []; rows.length = 5; rows[1] = action(); return rows; } },
  { name: "throwing-coercion", input: () => [action({ title: { toString() { throw Error("synthetic title coercion"); } } })] },
  { name: "throwing-getter", input: () => [Object.defineProperty(action(), "type", { get() { throw Error("synthetic type read"); } })] },
  { name: "volatile-and-proxy", input: (events) => {
    let titleReads = 0;
    return [new Proxy(action({ get title() { return ++titleReads === 1 ? " first " : "second"; }, payload: new Proxy({ sceneId: "7" }, { get(t, k, r) { events.push(`payload:${String(k)}`); return Reflect.get(t, k, r); } }) }), { get(t, k, r) { events.push(`action:${String(k)}`); return Reflect.get(t, k, r); } })];
  } },
];
const message = (extra = {}) => ({ id: "synthetic", role: "assistant", content: " saved ", createdAt: "retained-date", ...extra });
const messageCases = [
  ...[null, "", "not json", "null", "{}", "42", "[]"].map((value, index) => ({ name: `outer-${index}`, input: () => value })),
  { name: "valid", input: () => JSON.stringify([message({ intent: "studio_help", actions: [action()] })]) },
  { name: "raw-intent-array", input: () => JSON.stringify([message({ intent: ["studio_help"] })]) },
  { name: "raw-intent-object", input: () => JSON.stringify([message({ intent: {} })]) },
  { name: "wrong-role", input: () => JSON.stringify([message({ role: ["assistant"] }), message({ content: 42 })]) },
  { name: "limits", input: () => JSON.stringify(Array.from({ length: 35 }, (_, i) => message({ id: String(i), content: "x".repeat(5100), actions: [action({ status: "applied" })], followUps: [" first ", "first", 42, "b".repeat(190), "third", "fourth"] }))) },
  { name: "legacy-usage", input: () => JSON.stringify([message({ usage: ["legacy"], createdAt: 42 })]) },
];
for (const [kind, cases] of [["actions", actionCases], ["messages", messageCases]]) {
  for (const scenario of cases) {
    const actual = directorOutcome(root, kind, scenario.input);
    if (before) equal(actual, directorOutcome(before, kind, scenario.input), `M2 ${kind}/${scenario.name}: output/error/getter/clock equivalence`);
    if (kind === "actions" && scenario.name.startsWith("unqualified-type")) equal(actual.outcome.value, [], "unqualified action type cannot become pending authority");
    if (kind === "actions" && scenario.name === "limits") {
      equal(actual.outcome.value.length, 2, "action cap retained");
      equal(actual.outcome.value[0].changes.length, 4, "change cap retained");
      equal(actual.outcome.value[0].title.length, 120, "title cap retained");
    }
    if (kind === "actions" && scenario.name === "coercion") {
      equal(actual.outcome.value[0].payload.sceneIds, [2], "scene numeric coercion/filter/order retained");
      equal(actual.outcome.value[0].payload.workspaceStage, 5, "stage coercion retained");
      equal(actual.outcome.value[0].requiresExplicitConfirmation, true, "confirmation flag retained without executing action");
    }
    if (actual.outcome.value && Array.isArray(actual.outcome.value)) {
      const actions = kind === "actions" ? actual.outcome.value : actual.outcome.value.flatMap((m) => m.actions);
      equal(actions.every((a) => a.status === "pending"), true, "normalization never applies or starts an action");
    }
    if (kind === "messages" && scenario.name === "raw-intent-array") equal(actual.outcome.value[0].intent, ["studio_help"], "historical unqualified intent is preserved, not silently certified or coerced");
    if (kind === "messages" && scenario.name === "limits") {
      equal(actual.outcome.value.length, 30, "history retains last thirty entries");
      equal(actual.outcome.value[0].id, "5", "history order retained");
      equal(actual.outcome.value[0].content.length, 5000, "content cap retained");
      equal(actual.outcome.value[0].followUps.length, 3, "follow-up cap retained");
    }
  }
}
// Exercise raw-row and raw-payload fallbacks in the ordinary standalone run.
// Expected values are the retained before-image's output, not a second normalizer.
const fallbackAction = { id: "m2-fallback", type: "update_brief_topic", title: "Fallback control", payload: {} };
const fallbackExpected = [{
  id: "m2-fallback",
  type: "update_brief_topic",
  title: "Fallback control",
  description: "",
  impact: "none",
  requiresExplicitConfirmation: false,
  changes: [],
  payload: {
    topic: null, hook: null, sceneId: null, sceneIds: [], narration: null,
    dialogue: null, renderMode: null, thumbnailHeadline: null,
    thumbnailSubHeadline: null, thumbnailSceneId: null, workspaceStage: null,
  },
  status: "pending",
}];
const fallbackCases = [
  { name: "mixed-null-row", input: () => freeze([null, { ...fallbackAction }]) },
  { name: "null-payload", input: () => freeze([{ ...fallbackAction, payload: null }]) },
  { name: "missing-payload", input: () => freeze([{ id: "m2-fallback", type: "update_brief_topic", title: "Fallback control" }]) },
];
for (const scenario of fallbackCases) {
  const actual = directorOutcome(root, "actions", scenario.input);
  equal(actual.outcome.error, undefined, `M2 fallback ${scenario.name} must not throw`);
  equal(actual.outcome.value, fallbackExpected, `M2 fallback ${scenario.name} retains the valid pending action and exact payload defaults`);
  if (before) equal(actual, directorOutcome(before, "actions", scenario.input), `M2 fallback ${scenario.name} before-image output and observations`);
}

// Sprint 13 raw-read contracts. Real declarations/handlers, no reproduced logic.
// These inputs characterize legacy behavior; they grant no execution authority.
const changeExpected = { label: "Change", before: "—", after: "—" };
const rawChangeCases = [
  ...[null, undefined, false, true, 0, 42, "", "legacy", 1n, Symbol("raw"), [], {}]
    .map((v, i) => ({ name: `unqualified-row-${i}`, create: () => [v], expected: [changeExpected] })),
  { name: "missing-collection", create: () => undefined, expected: [] },
  { name: "null-collection", create: () => null, expected: [] },
  { name: "wrong-collection", create: () => ({ label: "not an array" }), expected: [] },
  { name: "coercion", create: () => [{ label: 42, before: ["old"], after: true }], expected: [{ label: "42", before: "old", after: "true" }] },
  { name: "falsy", create: () => [{ label: 0, before: false, after: "" }], expected: [changeExpected] },
  { name: "truthy-whitespace", create: () => [{ label: "   ", before: " \n ", after: "  " }], expected: [{ label: "", before: "", after: "" }] },
  { name: "unicode-trim", create: () => [{ label: " \u00e9😀 ", before: " old ", after: " new " }], expected: [{ label: "\u00e9😀", before: "old", after: "new" }] },
  { name: "lengths", create: () => [{ label: "l".repeat(130), before: "b".repeat(530), after: "a".repeat(530) }], expected: [{ label: "l".repeat(120), before: "b".repeat(520), after: "a".repeat(520) }] },
  { name: "cap-and-order", create: () => Array.from({ length: 7 }, (_, i) => ({ label: `L${i}`, before: `B${i}`, after: `A${i}` })), expected: Array.from({ length: 4 }, (_, i) => ({ label: `L${i}`, before: `B${i}`, after: `A${i}` })) },
  { name: "sparse", create: () => { const rows = []; rows.length = 3; rows[2] = {}; return rows; }, sparse: true },
  { name: "inherited", create: () => [Object.create({ label: " inherited ", before: " old ", after: " new " })], expected: [{ label: "inherited", before: "old", after: "new" }] },
  { name: "primitive-prototype", create: () => [42], prototype: true, expected: [{ label: "boxed", before: "—", after: "—" }] },
  { name: "throwing-label", create: () => [{ get label() { throw Error("raw-change-label"); } }], error: { name: "Error", message: "raw-change-label" } },
  { name: "throwing-coercion", create: () => [{ before: { toString() { throw Error("raw-change-string"); } } }], error: { name: "Error", message: "raw-change-string" } },
  { name: "get-order", create: (events) => [new Proxy({ label: " L ", before: " B ", after: " A " }, { get(t, k, r) { events.push(String(k)); return Reflect.get(t, k, r); }, set() { throw Error("raw input mutation"); } })], expected: [{ label: "L", before: "B", after: "A" }], reads: ["label", "before", "after"] },
  { name: "coercion-order", create: (events) => [{ get label() { events.push("label"); return { toString() { events.push("label.string"); return " L "; } }; }, get before() { events.push("before"); return " B "; }, get after() { events.push("after"); return " A "; } }], expected: [{ label: "L", before: "B", after: "A" }], reads: ["label", "label.string", "before", "after"] },
];
for (const scenario of rawChangeCases) {
  const run = (base) => {
    const events = []; const fn = directorModule(base, [])["actions"];
    const changes = scenario.create(events); const input = [action({ id: "raw-contract", changes })];
    let previous;
    if (scenario.prototype) { previous = Object.getOwnPropertyDescriptor(Number.prototype, "label"); Object.defineProperty(Number.prototype, "label", { configurable: true, value: " boxed " }); }
    try { return { outcome: observe(fn, input), events }; }
    finally { if (scenario.prototype) { if (previous) Object.defineProperty(Number.prototype, "label", previous); else delete Number.prototype.label; } }
  };
  const actual = run(root);
  if (before) equal(actual, run(before), `raw change ${scenario.name} before/after value/error/read-order`);
  if (scenario.error) equal(actual.outcome.error, scenario.error, `raw change ${scenario.name} retains exact rejection`);
  else {
    equal(actual.outcome.error, undefined, `raw change ${scenario.name} must not throw`);
    const value = actual.outcome.value[0];
    equal(value.status, "pending", `raw change ${scenario.name} never applies an action`);
    if (scenario.sparse) { equal(value.changes.length, 3, "raw change holes retained"); equal(0 in value.changes, false, "raw change hole is not filled"); equal(value.changes[2], changeExpected, "raw sparse row fallback"); }
    else equal(value.changes, scenario.expected, `raw change ${scenario.name} exact formatter output`);
    if (scenario.reads) equal(actual.events, scenario.reads, `raw change ${scenario.name} exact read/coercion order`);
    // Exact JSON output, including sparse-array null serialization.
    if (scenario.sparse) equal(JSON.stringify(value.changes), '[null,null,{"label":"Change","before":"—","after":"—"}]', "raw sparse JSON contract");
    else equal(JSON.stringify(value.changes), JSON.stringify(scenario.expected), `raw change ${scenario.name} exact JSON bytes`);
  }
}

const detailBase = { id: "raw-id", snippet: { title: "Synthetic topic", description: "Synthetic topic", channelTitle: "channel", publishedAt: "2025-01-01", thumbnails: { high: { url: "/high.png" }, medium: { url: "/medium.png" }, default: { url: "/default.png" } } }, statistics: { viewCount: "12", likeCount: "3" }, contentDetails: { duration: "PT1H2M3S" } };
const detailCases = [
  { name: "valid", videos: () => ({ items: [detailBase] }), status: 200, duration: 3723 },
  ...[null, undefined, false, true, 0, 42, "legacy", {}, []].map((value, i) => ({ name: `row-${i}`, videos: () => ({ items: [value] }), status: i < 2 ? 500 : 200 })),
  ...[undefined, null, "", false, 0, "PT0S", "PT1.5M", "not ISO", "PT2H3M4S", 42, [], {}].map((value, i) => ({ name: `duration-${i}`, videos: () => ({ items: [{ ...detailBase, contentDetails: { duration: value } }] }), status: i >= 9 ? 500 : 200, duration: i === 8 ? 7384 : 0 })),
  ...[undefined, null, false, 42, {}, ["raw"]].map((value, i) => ({ name: `nested-${i}`, videos: () => ({ items: [{ id: "raw-id", snippet: value, statistics: value, contentDetails: value }] }), status: 200 })),
  { name: "raw-fields", videos: () => ({ items: [{ ...detailBase, id: { legacy: true }, snippet: { ...detailBase.snippet, title: { legacy: true }, publishedAt: 42 }, statistics: { viewCount: "bad", likeCount: "2.5" } }] }), status: 200 },
  { name: "duration-custom-match", videos: () => ({ items: [{ ...detailBase, contentDetails: { duration: { match() { return ["", "1", "2", "3"]; } } } }] }), status: 200, duration: 3723 },
  { name: "irrelevant", videos: () => ({ items: [{ ...detailBase, snippet: { title: "unrelated", description: "unrelated", channelTitle: "other" } }] }), status: 200 },
  { name: "ordered", videos: () => ({ items: [{ ...detailBase, id: "low", statistics: { viewCount: "2" } }, { ...detailBase, id: "tie-a", statistics: { viewCount: "9" } }, { ...detailBase, id: "tie-b", statistics: { viewCount: "9" } }] }), status: 200 },
  { name: "null-items", videos: () => ({ items: null }), status: 200 },
  { name: "wrong-items", videos: () => ({ items: {} }), status: 500 },
  { name: "null-result", videos: () => null, status: 500 },
  { name: "traced", videos: (events) => ({ items: [new Proxy(detailBase, { get(t, k, r) { events.push(`details:${String(k)}`); return Reflect.get(t, k, r); }, set() { throw Error("raw YouTube mutation"); } })] }), status: 200, duration: 3723 },
];
for (const scenario of detailCases) {
  const actual = await runYoutube(currentYoutube, scenario);
  if (priorYoutube) equal(actual, await runYoutube(priorYoutube, scenario), `raw YouTube ${scenario.name} exact response/ordering/errors`);
  equal(actual.status, scenario.status, `raw YouTube ${scenario.name} response status`);
  const body = JSON.parse(actual.body);
  if (scenario.duration !== undefined && actual.status === 200) equal(body.videos[0].durationSec, scenario.duration, `raw YouTube ${scenario.name} exact duration interpretation`);
  if (["duration-9", "duration-10", "duration-11"].includes(scenario.name)) equal(body.error, "duration.match is not a function", "raw truthy non-matcher remains rejected without coercion");
  if (scenario.name === "raw-fields") { equal(body.videos[0].id, { legacy: true }, "raw id not silently string-qualified"); equal(body.videos[0].title, { legacy: true }, "raw title not silently string-qualified"); equal(body.videos[0].publishedAt, 42, "raw date not silently string-qualified"); equal(body.videos[0].views, null, "NaN serialized as null"); equal(body.videos[0].likes, 2.5, "fractional count conversion retained"); }
  if (scenario.name === "irrelevant") { equal(body.videos.length, 0, "irrelevant candidate remains excluded"); equal(body.filteredOutCount, 1, "irrelevant exclusion counted"); }
  if (scenario.name === "ordered") { equal(body.videos.map((v) => v.id), ["tie-a", "tie-b", "low"], "stable score/views ordering and exact IDs"); equal(body.videos.map((v) => v.durationSec), [3723, 3723, 3723], "duration ordering retained"); }
  if (scenario.name === "valid") { equal(body.videos[0].thumbnail, "/high.png", "high thumbnail fallback first"); equal(body.videos[0].url, "https://www.youtube.com/watch?v=raw-id", "exact source ID URL"); }
}

const rawTimelineCases = [
  ...[null, undefined, false, 42, "legacy", {}, []].map((row, i) => ({ name: `row-${i}`, scenes: [row], invalid: i < 2 })),
  { name: "missing-fields", scenes: [{}] },
  { name: "historical-fields", scenes: [{ id: "7", text: 42, narration: ["legacy"], dialogue: true, estimatedSpeechSeconds: "12", speechWordCount: "9", targetDurationSec: "7" }] },
  { name: "duration-boundaries", scenes: [{ id: 0, narration: "one two", estimatedSpeechSeconds: 0, speechWordCount: 0, targetDurationSec: 0 }, { id: -2, narration: "three", estimatedSpeechSeconds: NaN, speechWordCount: Infinity, targetDurationSec: -1 }, { id: 9, narration: "four", estimatedSpeechSeconds: 1.25, speechWordCount: 3, targetDurationSec: 6.25 }] },
  { name: "ordering", scenes: [{ id: "9", text: "first" }, { id: 2, text: "second" }, { id: "9", text: "duplicate" }] },
  { name: "sparse", scenes: Object.assign(new Array(3), { 2: { id: 3, text: "last" } }) },
];
const loadTimeline = (base) => evaluate(compile(base, "lib/video/timelineSync.ts"), { ...evaluate(compile(base, "lib/video/audioDurationMatching.ts")), ...evaluate(compile(base, "lib/video/visualFiller.ts")), ...evaluate(compile(base, "lib/video/videoDurationPolicy.ts")) });
const currentRawTimeline = loadTimeline(root); const beforeRawTimeline = before ? loadTimeline(before) : null;
for (const product of ["storyverse", "creatorlab"]) for (const scenario of rawTimelineCases) {
  const args = freeze({ product, qualityTier: product === "storyverse" ? "lite" : "standard", durationSec: 21, sceneCount: scenario.scenes.length, scenes: scenario.scenes });
  const actual = observe(currentRawTimeline.createTimelineSyncPlan, args);
  if (beforeRawTimeline) equal(actual, observe(beforeRawTimeline.createTimelineSyncPlan, args), `raw timeline ${product}/${scenario.name} exact plan/rejection`);
  if (scenario.invalid) equal(actual.error.name, "TypeError", `raw timeline ${product}/${scenario.name} nullish row not silently admitted`);
  else {
    equal(actual.error, undefined, `raw timeline ${product}/${scenario.name} retained inputs`);
    if (scenario.name === "ordering") { equal(actual.value.scenes.map((s) => s.id), [9, 2, 9], "raw timeline exact numeric IDs, duplicates and order"); equal(actual.value.scenes.map((s) => s.speechText), ["first", "second", "duplicate"], "raw timeline narration order unchanged"); }
    if (scenario.name === "historical-fields") { equal(actual.value.scenes[0].id, 7, "timeline numeric string id interpretation retained"); equal(actual.value.scenes[0].speechText, "legacy true", "timeline historical coercion retained"); equal(actual.value.scenes[0].speechWordCount, 2, "numeric string word count not certified as number"); }
    if (scenario.name === "row-5") equal(actual.value.scenes[0].speechText, "", "timeline missing text fallback");
  }
}

// Sprint 14 ingestion contracts: execute genuine routes with synthetic I/O.
async function inspectRawStory(base, scenario) {
  const events = [];
  const actualTimeline = loadTimeline(base);
  const api = evaluate(compile(base, "app/api/story/route.ts"), {
    NextResponse,
    process: { env: { OPENAI_API_KEY: scenario.noKey ? "" : "synthetic-no-authority" } },
    OpenAI: class { constructor() { events.push("client.construct"); this.responses = { async create(args) { events.push(["provider.port", args.model, args.input]); if (scenario.providerFailure) throw Error("synthetic story provider failure"); return { output_text: scenario.raw ?? JSON.stringify(scenario.value) }; } }; } },
    async recordOpenAITextEconomics(args) { events.push(["economics.port", args.route, args.operationType, args.model]); if (scenario.economicsFailure) throw Error("synthetic economics failure"); },
    createTimelineSyncPlan(args) { events.push(["timeline", args.sceneCount, args.durationSec]); return actualTimeline.createTimelineSyncPlan(args); },
    console: { error(_label, error) { events.push(["error", error?.name, error?.message]); } },
  });
  const response = await api.POST({ async json() { events.push("request.json"); if (scenario.requestFailure) throw Error("synthetic story request failure"); return scenario.request ?? { prompt: "Synthetic story input" }; } });
  return { status: response.status, headers: [...response.headers], body: await response.text(), events };
}
const rawStoryBase = { title: "Raw story", characters: [], visualBible: {}, scenes: [{ id: "9", text: "Synthetic narration" }] };
const ingestionStoryCases = [
  { name: "valid", value: rawStoryBase, status: 200 },
  ...[undefined, null, false, 0, "", {}, "legacy", ["legacy"]].map((v, i) => ({ name: `characters-${i}`, value: { ...rawStoryBase, characters: v }, status: i === 7 ? 200 : 500 })),
  ...[undefined, null, false, 0, "", {}, "legacy"].map((v, i) => ({ name: `scenes-${i}`, value: { ...rawStoryBase, scenes: v }, status: 500 })),
  ...[undefined, null, false, 0, ""].map((v, i) => ({ name: `title-${i}`, value: { ...rawStoryBase, title: v }, status: 500 })),
  ...[undefined, null, false, 0, ""].map((v, i) => ({ name: `bible-${i}`, value: { ...rawStoryBase, visualBible: v }, status: 500 })),
  { name: "raw-envelope-fields", value: { ...rawStoryBase, title: 42, characters: [null, 42, { legacy: true }], visualBible: true }, status: 200 },
  { name: "scene-null", value: { ...rawStoryBase, scenes: [null] }, status: 500 },
  { name: "scene-primitives", value: { ...rawStoryBase, scenes: [true, 42, "legacy", {}] }, status: 200 },
  { name: "scene-identity-order", value: { ...rawStoryBase, scenes: [{ id: "9", text: "first" }, { id: 2, text: "second" }, { id: "9", text: "duplicate" }] }, status: 200 },
  { name: "numeric-interpretation", value: { ...rawStoryBase, scenes: [{ id: "7", text: 42, narration: ["legacy"], dialogue: true, estimatedSpeechSeconds: "12", speechWordCount: "9", targetDurationSec: "7" }] }, status: 200 },
  { name: "fenced", raw: `\x60\x60\x60json\n${JSON.stringify(rawStoryBase)}\n\x60\x60\x60`, status: 200 },
  { name: "brace-slice", raw: `synthetic prefix ${JSON.stringify(rawStoryBase)} trailing`, status: 200 },
  { name: "invalid-json", raw: "invalid-json", status: 500 },
  { name: "null-json", raw: "null", status: 500 },
  { name: "no-key", value: rawStoryBase, noKey: true, status: 500 },
  { name: "empty-prompt", value: rawStoryBase, request: {}, status: 400 },
  { name: "wrong-prompt", value: rawStoryBase, request: { prompt: 42 }, status: 500 },
  { name: "request-failure", value: rawStoryBase, requestFailure: true, status: 500 },
  { name: "provider-failure", value: rawStoryBase, providerFailure: true, status: 500 },
  { name: "economics-failure", value: rawStoryBase, economicsFailure: true, status: 500 },
];
for (const scenario of ingestionStoryCases) {
  const actual = await inspectRawStory(root, scenario);
  if (before) equal(actual, await inspectRawStory(before, scenario), `ingestion story ${scenario.name} response/identity/order equivalence`);
  equal(actual.status, scenario.status, `ingestion story ${scenario.name} retained response status`);
  const body = JSON.parse(actual.body);
  if (scenario.name === "valid") { equal(body.scenes, rawStoryBase.scenes, "ingestion story raw scenes unchanged"); equal(body.timelineSyncPlan.scenes[0].id, 9, "ingestion story numeric timeline ID"); equal(body.timelineSyncPlan.durationSec, 7, "ingestion story seconds per scene"); }
  if (scenario.name === "scene-identity-order") { equal(body.scenes, scenario.value.scenes, "ingestion story source IDs and order preserved"); equal(body.timelineSyncPlan.scenes.map((s) => s.id), [9, 2, 9], "ingestion timeline IDs/order/duplicates preserved"); equal(body.timelineSyncPlan.scenes.map((s) => s.speechText), ["first", "second", "duplicate"], "ingestion timeline narration relationship"); equal(body.timelineSyncPlan.durationSec, 21, "ingestion story total duration derives from scene count"); }
  if (scenario.name === "numeric-interpretation") { equal(body.timelineSyncPlan.scenes[0].speechWordCount, 2, "ingestion timeline numeric strings not finite-number authority"); equal(body.scenes[0].speechWordCount, "9", "ingestion raw timing not rewritten"); }
  if (scenario.name === "raw-envelope-fields") { equal(body.title, 42, "ingestion story title not string-certified"); equal(body.visualBible, true, "ingestion story visual bible not object-certified"); equal(body.characters, scenario.value.characters, "ingestion historical characters not silently filtered"); }
  if (scenario.name === "no-key") equal(actual.events, [["error", "Error", "OPENAI_API_KEY is missing"]], "missing key stops before request/provider/economics");
  if (scenario.name === "empty-prompt") equal(actual.events, ["client.construct", "request.json"], "prompt denial precedes dispatch");
  if (scenario.name === "invalid-json") { equal(body.raw, "invalid-json", "parse failure retains exact raw output"); equal(actual.events.some((e) => Array.isArray(e) && e[0] === "timeline"), false, "invalid JSON cannot enter timeline"); }
  if (scenario.status === 500 && (scenario.name.startsWith("characters-") || scenario.name.startsWith("scenes-"))) equal(actual.events.some((e) => Array.isArray(e) && e[0] === "timeline"), false, "malformed collections stop before timeline");
}

const ingestionMetadataCases = [];
const metadataInputs = [
  { value: undefined, displayed: "" }, { value: null, displayed: "" },
  { value: false, displayed: "" }, { value: 0, displayed: "" },
  { value: "", displayed: "" }, { value: 42, displayed: 42 },
  { value: [], displayed: [] }, { value: { legacy: true }, displayed: { legacy: true } },
  { value: ["legacy"], displayed: ["legacy"] },
];
for (const field of ["id", "title", "description", "channel", "publishedAt", "thumbnail"]) {
  for (const [i, values] of metadataInputs.entries()) ingestionMetadataCases.push({ field, ...values, name: `${field}-${i}` });
}
for (const scenario of ingestionMetadataCases) {
  const input = () => {
    const row = { ...detailBase, snippet: { ...detailBase.snippet, thumbnails: { high: {}, medium: {}, default: {} } } };
    if (scenario.field === "id") row.id = scenario.value;
    else if (scenario.field === "thumbnail") row.snippet.thumbnails.high.url = scenario.value;
    else row.snippet[scenario.field === "channel" ? "channelTitle" : scenario.field] = scenario.value;
    return { items: [row] };
  };
  const actual = await runYoutube(currentYoutube, { videos: input });
  if (priorYoutube) equal(actual, await runYoutube(priorYoutube, { videos: input }), `ingestion metadata ${scenario.name} exact response/order`);
  equal(actual.status, 200, `ingestion metadata ${scenario.name} retains status`);
  const video = JSON.parse(actual.body).videos[0];
  // Baseline-derived field values: only ID lacks the existing falsy fallback.
  const exposed = scenario.field !== "description";
  const expected = !exposed ? undefined : scenario.field === "id" ? scenario.value : scenario.displayed;
  equal(video[scenario.field], expected, `ingestion metadata ${scenario.name} is not silently retyped or coerced`);
  equal(Object.hasOwn(video, scenario.field), exposed && !(scenario.field === "id" && scenario.value === undefined), `ingestion metadata ${scenario.name} exact serialized field presence`);
  equal(video.durationSec, 3723, "raw metadata cannot change seconds conversion");
}
// Type contracts remain honest: metadata access does not certify source values.
const rawEnvelope = findNode("app/api/story/route.ts", (n) => ts.isTypeAliasDeclaration(n) && n.name.text === "RawStoryEnvelopeRead");
const rawEnvelopeMembers = rawEnvelope.node.type.types[0].typeArguments[0].members;
equal(rawEnvelopeMembers.map((m) => [m.name.getText(rawEnvelope.sf), m.type.kind, Boolean(m.questionToken)]), ["title", "characters", "visualBible", "scenes"].map((name) => [name, ts.SyntaxKind.UnknownKeyword, true]), "raw story fields stay optional unknown before existing guards");
const rawCandidate = findNode(youtubeFile, (n) => ts.isTypeAliasDeclaration(n) && n.name.text === "RawCandidateVideo");
for (const field of ["id", "title", "description", "channel", "publishedAt", "thumbnail"]) equal(rawCandidate.node.type.members.find((m) => m.name.getText(rawCandidate.sf) === field).type.kind, ts.SyntaxKind.UnknownKeyword, `raw candidate ${field} does not claim provider qualification`);
for (const [field, kind] of [["views", ts.SyntaxKind.NumberKeyword], ["likes", ts.SyntaxKind.NumberKeyword], ["durationSec", ts.SyntaxKind.NumberKeyword], ["url", ts.SyntaxKind.StringKeyword]]) equal(rawCandidate.node.type.members.find((m) => m.name.getText(rawCandidate.sf) === field).type.kind, kind, `converted candidate ${field} keeps its contract`);
if (before) for (const file of ["app/api/story/route.ts", youtubeFile]) {
  const emit = (base) => ts.transpileModule(fs.readFileSync(path.join(base, file), "utf8"), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.ESNext } }).outputText;
  equal(emit(root), emit(before), `ingestion complete ${file} emitted JS byte-identical`);
}

if (before) {
  const emitParent = (base) => ts.transpileModule(fs.readFileSync(path.join(base, page), "utf8"), {
    fileName: "page.tsx", compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  equal(emitParent(root), emitParent(before), "M2 complete parent emitted JavaScript is byte-identical");
}

const result = { assertions, beforeAfter: Boolean(before), actualStoryHandlerCases: stories.length, guideFixtures: guides.length, actualYoutubeHandlerCases: youtube.length, actualObservedWrapperCases: wrappers.length, deferredLegacyStoryCases: legacyStoryCases.length, deferredContractFamilies: ["preview", "flow", "private-episode", "legacy-story"], m2ActionCases: actionCases.length, m2MessageCases: messageCases.length, m2FallbackCases: fallbackCases.length, sprint13: { changeCases: rawChangeCases.length, youtubeDetailCases: detailCases.length, timelineCases: rawTimelineCases.length }, sprint14: { storyCases: ingestionStoryCases.length, metadataCases: ingestionMetadataCases.length }, realContextAsyncLocalStorage: true, syntheticExternalPorts: true, liveRequests: 0, projectMediaWrites: 0 };
if (outputAt >= 0) fs.writeFileSync(process.argv[outputAt + 1], JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
console.log(`DEFERRED_CONTRACTS=PASS ${JSON.stringify(result)}`);
