import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ts from "typescript";
import { CREATOR_COST_BASIS_LABEL, CREATOR_DEFAULT_VIDEO_SCENE_COST_USD } from "../lib/creatorCostConfig.ts";

// Compile real local declarations, without evaluating application imports.
// Provider/auth/economics are explicit synthetic ports; no real authority is tested.
const require = createRequire(import.meta.url);
const { NextResponse } = require("next/server");
const root = process.cwd();
const beforeIndex = process.argv.indexOf("--before");
const beforeRoot = beforeIndex >= 0 ? process.argv[beforeIndex + 1] : null;
const outputIndex = process.argv.indexOf("--output");
const pure = {
  intelligence: { file: "app/api/build-story/route.ts", names: ["normalizeSceneIntelligence"] },
  voice: { file: "app/api/tts/route.ts", names: ["getDefaultSettingsForRole", "hasVoiceSettingsReadValue", "mergeVoiceSettings"] },
};
const routes = ["bulk-ideas", "creator-mentor", "creator-youtube-metadata", "optimize-scenes", "optimize-scenes-ai", "story-setup", "youtube-pattern-engine"];
function compile(base, file, names) {
  const source = fs.readFileSync(path.join(base, file), "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const statements = sf.statements.filter((node) => !ts.isImportDeclaration(node) && (!names || ts.isFunctionDeclaration(node) && names.includes(node.name?.text)));
  return ts.transpileModule(statements.map((node) => node.getText(sf)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
}
function evaluate(js, ports = {}) {
  const exports = {};
  new Function("exports", ...Object.keys(ports), js)(exports, ...Object.values(ports));
  return exports;
}
function pureModules(base) {
  return Object.fromEntries(Object.entries(pure).map(([name, f]) => {
    let js = compile(base, f.file, f.names);
    const exportedName = name === "voice" ? "mergeVoiceSettings" : "normalizeSceneIntelligence";
    js += `\nexports.fn = ${exportedName};`;
    return [name, evaluate(js).fn];
  }));
}
const current = pureModules(root);
const prior = beforeRoot ? pureModules(beforeRoot) : null;
let assertions = 0;
const totals = { pure: 0, handlers: 0 };
function equal(actual, expected, label, family = "pure") {
  assert.deepEqual(actual, expected, label);
  assertions += 1; totals[family] += 1;
}
function observe(fn, args) {
  try { return { value: fn(...args) }; } catch (e) { return { error: e?.name, message: e?.message }; }
}
function freeze(v) {
  if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); }
  return v;
}
equal(current.intelligence(undefined), { scene_type: "discovery", emotional_intensity: 5, pacing_level: "medium", curiosity_score: 5, tension_score: 4, climax_level: 3 }, "intelligence missing defaults");
equal(current.intelligence({ scene_type: "hook", emotional_intensity: 0, pacing_level: "fast", curiosity_score: 10.6, tension_score: "2.5", climax_level: "invalid" }), { scene_type: "hook", emotional_intensity: 1, pacing_level: "fast", curiosity_score: 10, tension_score: 3, climax_level: 3 }, "intelligence exact numeric rules");
equal(current.voice("narrator", null), { stability: .55, similarity_boost: .82, style: .22, speed: .9 }, "voice narrator defaults");
equal(current.voice("character", { stability: 0, similarityBoost: .2, speed: 0 }), { stability: 0, similarity_boost: .2, style: .48, speed: 0 }, "voice camel-case legacy and zero");
equal(current.voice("joe", { similarity_boost: .4, similarityBoost: .9, style: "invalid" }), { stability: .34, similarity_boost: .4, style: .48, speed: .96 }, "voice snake-case precedence");
const raw = [undefined, null, false, true, 0, -1, NaN, Infinity, -Infinity, "", "hook", "action", "invalid", {}, [], Symbol("synthetic"), 1n];
let seed = 0x4508;
const rnd = (n) => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
const fixtures = [...raw];
for (let i = 0; i < 300; i += 1) fixtures.push(Object.fromEntries(["scene_type", "pacing_level", "emotional_intensity", "curiosity_score", "tension_score", "climax_level", "stability", "similarity_boost", "similarityBoost", "style", "speed"].map((key) => [key, raw[rnd(raw.length)]])));
if (prior) {
  for (const fixture of fixtures) {
    freeze(fixture);
    equal(observe(current.intelligence, [fixture]), observe(prior.intelligence, [fixture]), "intelligence malformed/frozen equivalence");
    for (const role of ["narrator", "character", "joe", "historical-role"]) equal(observe(current.voice, [role, fixture]), observe(prior.voice, [role, fixture]), "voice malformed/frozen equivalence");
  }
  function volatile() {
    const events = []; let n = 0;
    const value = new Proxy({ get scene_type() { return n++ === 0 ? "hook" : "historical-return"; }, get stability() { return n++ === 0 ? .3 : "original volatile return"; }, similarity_boost: .6, speed: .9 }, { get(t, k, r) { events.push(String(k)); return Reflect.get(t, k, r); } });
    return { value, events };
  }
  for (const name of ["intelligence", "voice"]) {
    const a = volatile(); const b = volatile(); const args = (x) => name === "voice" ? ["narrator", x.value] : [x.value];
    equal(observe(current[name], args(b)), observe(prior[name], args(a)), `${name} repeated reads`);
    equal(b.events, a.events, `${name} getter order/count`);
  }
}
const code = Object.fromEntries(routes.map((route) => [route, { current: compile(root, `app/api/${route}/route.ts`), before: beforeRoot ? compile(beforeRoot, `app/api/${route}/route.ts`) : null }]));
const validBody = () => freeze({ topics: ["Synthetic idea"], topic: "Synthetic topic", prompt: "Synthetic idea", language: "en", videoDurationSec: 600, scenes: [{ id: 1, text: "run explains", narration: "N", dialogue: "D" }], package: { title: "Synthetic", scenes: [{ id: 1, text: "N", narration: "N", dialogue: "D" }] }, videos: [{ id: "offline", title: "Synthetic title", views: 42, likes: 4, durationSec: 90 }] });
const goodPayload = { ideas: [{ title: "Title", concept: "Concept", score: .5 }], videoIdeas: [{ title: "Title", concept: "Concept" }], title: "Synthetic", storyPremise: "Synthetic premise", characters: [{ name: "Joe" }], visualBible: { style: "Synthetic" }, titleOptions: ["Synthetic"], items: [{ sceneId: 1, exportMode: "image", confidence: "high", reason: "Synthetic" }] };
async function runHandler(route, js, scenario) {
  const events = []; const request = { async json() { events.push("request.json"); if (scenario.requestError) throw scenario.requestError(); return scenario.body ? scenario.body(events) : validBody(); } };
  const providerError = scenario.providerError ? scenario.providerError() : null;
  const response = { output_text: scenario.raw ?? JSON.stringify(goodPayload), choices: [{ message: { content: scenario.raw ?? JSON.stringify(goodPayload) } }] };
  class SyntheticOpenAI { constructor() { events.push("provider.construct"); this.responses = { create: this.create }; this.chat = { completions: { create: this.create } }; } async create(args) { events.push(["provider.create", JSON.stringify(args)]); if (scenario.providerError) throw providerError; return response; } }
  const ports = {
    NextResponse, OpenAI: SyntheticOpenAI,
    process: { env: { OPENAI_API_KEY: "synthetic-no-authority", NODE_ENV: scenario.development ? "development" : "production" } },
    console: { error(...args) { events.push(["console.error", typeof args[0] === "string" ? args[0] : typeof args[0], args.length]); } },
    async enforceCreatorApiBoundary(req, id) { events.push(["auth-port", id]); if (scenario.authDenied) return { ok: false, response: NextResponse.json({ error: "synthetic-denied" }, { status: 401 }) }; return { ok: true, context: { body: await req.json() } }; },
    async recordOpenAITextEconomics(args) { events.push(["economic-port", args.route, args.operationType, args.model]); },
    CREATOR_COST_BASIS_LABEL, CREATOR_DEFAULT_VIDEO_SCENE_COST_USD,
    fetch() { throw Error("Unexpected network forbidden in offline type regression"); },
  };
  try { const exported = evaluate(js, ports); const result = await exported.POST(request); return { status: result.status, headers: [...result.headers], body: await result.text(), events }; }
  catch (error) { return { exception: { name: error?.name, message: error?.message }, events }; }
}
const scenarios = [
  { name: "success" }, { name: "auth-denied", authDenied: true }, { name: "empty-request", body: () => ({}) }, { name: "malformed-json", raw: "not-json" }, { name: "null-json", raw: "null" }, { name: "scalar-json", raw: "42" }, { name: "empty-json", raw: "{}" },
  { name: "malformed-rows", raw: JSON.stringify({ ideas: [null, 1, false, {}], videoIdeas: [null], items: [null, {}, { sceneId: "1", exportMode: "invalid" }] }) },
  ...[null, undefined, 0, "", false, "legacy warning", 17, NaN, Infinity, Symbol("message"), 1n, { detail: "legacy message object" }, ["legacy message array"]].map((message, index) => ({ name: `legacy-error-${index}`, providerError: () => ({ message }) })),
  { name: "real-error", providerError: () => Error("synthetic provider failure") }, { name: "null-error", providerError: () => null }, { name: "primitive-error", providerError: () => "synthetic primitive" },
  { name: "request-error", requestError: () => ({ message: "synthetic request failure" }) },
  { name: "volatile-error", development: true, providerError: () => { let n = 0; const error = Error("base"); Object.defineProperty(error, "message", { get() { return n++ ? "second read" : "first read"; } }); return error; } },
  { name: "pattern-numeric-error", body: () => ({ ...validBody(), videos: [{ title: "Synthetic", views: Symbol("invalid numeric input") }] }) },
  { name: "legacy-string-match", raw: JSON.stringify({ items: [{ sceneId: "1", exportMode: "video", confidence: "high", reason: "numeric correspondence" }] }) },
  { name: "all-video-rebalance", body: () => freeze({ ...validBody(), scenes: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, text: "explain" })) }), raw: JSON.stringify({ items: Array.from({ length: 6 }, (_, i) => ({ sceneId: i + 1, exportMode: "video", confidence: "high", reason: "synthetic proposal" })) }) },
  { name: "traced-source", body: (events) => {
    const row = new Proxy({ id: 1, text: "run", narration: "explains", dialogue: "D" }, { get(t, k, r) { events.push(`scene-get:${String(k)}`); return Reflect.get(t, k, r); }, set() { throw Error("Unexpected source mutation"); } });
    return { ...validBody(), scenes: [row], package: { scenes: [row] } };
  } },
  { name: "frozen-source-rows", body: () => freeze({ ...validBody(), scenes: [null, false, { id: 0, text: 42 }, { id: "4", text: "running", narration: "explain" }], package: { scenes: [null, false, { id: "legacy-id", text: 42 }] } }) },
];
const handlerRows = [];
for (const route of routes) for (const scenario of scenarios) {
  const actual = await runHandler(route, code[route].current, scenario);
  assert(!JSON.stringify(actual).includes("Unexpected network forbidden"), `${route}/${scenario.name}: unexpected network`);
  if (code[route].before) equal(actual, await runHandler(route, code[route].before, scenario), `${route}/${scenario.name}`, "handlers");
  if (scenario.name === "success") {
    equal(actual.status, 200, `${route}/success status`, "handlers"); assert(!actual.exception);
    const body = JSON.parse(actual.body);
    if (route === "bulk-ideas") equal(body.ideas[0].title, "Title", "bulk validated title", "handlers");
    if (route === "creator-mentor") equal(body.analysis.videoIdeas[0].title, "Title", "mentor actual normalized title", "handlers");
    if (route === "creator-youtube-metadata") equal(body.metadata.recommendedTitle, "Synthetic", "metadata projection", "handlers");
    if (route === "optimize-scenes") equal(body.result[0].exportMode, "video", "rule optimizer unchanged threshold", "handlers");
    if (route === "optimize-scenes-ai") equal(body.result[0].exportMode, "image", "AI result match projection", "handlers");
    if (route === "story-setup") equal(body.characters[0].name, "Joe", "story setup character contract", "handlers");
    if (route === "youtube-pattern-engine") equal(body.success, true, "pattern response", "handlers");
  }
  if (scenario.authDenied && ["creator-mentor", "creator-youtube-metadata"].includes(route)) {
    equal(actual.status, 401, "denied authority remains blocked", "handlers");
    equal(actual.events.some((e) => e === "provider.construct"), false, "no provider admission after denial", "handlers");
  }
  handlerRows.push({ route, scenario: scenario.name, result: "PASS" });
}
const result = { assertions, pureAssertions: totals.pure, handlerAssertions: totals.handlers, beforeAfter: Boolean(beforeRoot), actualHandlerCases: handlerRows.length, authProviderAndEconomics: "SYNTHETIC_PORTS_NOT_QUALIFIED", networkRequests: 0, projectOrMediaWrites: 0, handlers: handlerRows };
if (outputIndex >= 0) fs.writeFileSync(process.argv[outputIndex + 1], JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
console.log(`SAFE_TYPE_BOUNDARIES=PASS; ${assertions} assertions; ${handlerRows.length} actual-handler scenarios; before/after=${Boolean(beforeRoot)}; synthetic ports only`);
