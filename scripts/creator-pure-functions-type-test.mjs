import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";
import { CREATOR_COST_BASIS_LABEL } from "../lib/creatorCostConfig.ts";

// Compile only these actual pure declarations. Never import/evaluate a route,
// authentication adapter, provider, database client, fetcher or media writer.
const root = process.cwd();
const beforeArg = process.argv.indexOf("--before");
const beforeRoot = beforeArg >= 0 ? process.argv[beforeArg + 1] : null;
const outputArg = process.argv.indexOf("--output");
const families = {
  score: { file: "app/api/optimize-scenes/route.ts", names: ["safeText", "includesAny", "hasSceneScoreReadValue", "scoreScene"] },
  fallback: { file: "app/api/optimize-scenes-ai/route.ts", names: ["safeString", "hasFallbackSceneReadValue", "fallbackOptimizeScenes", "buildSummary"] },
  captions: { file: "app/api/export-creator-package/route.ts", names: ["safeString", "hasCaptionReadValue", "captionReadValue", "getSceneDuration", "getSceneCaptionText", "createCaptionCues", "formatTimestamp", "createSrt", "createVtt", "createProductionSummary"] },
};
function load(base, family) {
  const text = fs.readFileSync(path.join(base, family.file), "utf8");
  const sf = ts.createSourceFile(family.file, text, ts.ScriptTarget.Latest, true);
  const declarations = sf.statements.filter((node) => ts.isFunctionDeclaration(node) && family.names.includes(node.name?.text));
  const compiled = ts.transpileModule(declarations.map((node) => `export ${node.getText(sf)}`).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  new Function("exports", "CREATOR_COST_BASIS_LABEL", compiled)(exports, CREATOR_COST_BASIS_LABEL);
  return exports;
}
const current = Object.fromEntries(Object.entries(families).map(([name, family]) => [name, load(root, family)]));
const prior = beforeRoot ? Object.fromEntries(Object.entries(families).map(([name, family]) => [name, load(beforeRoot, family)])) : null;
let checks = 0;
const rows = [];
function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function observe(fn, args) {
  try { return { value: fn(...args) }; }
  catch (error) { return { error: error.name, message: error.message }; }
}
function equal(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  checks += 1;
}
function compare(family, name, args, label) {
  if (prior) equal(observe(current[family][name], args), observe(prior[family][name], args), `${family}/${name}/${label}`);
}

// Independent expected outputs protect against comparing two equally wrong functions.
const { scoreScene } = current.score;
equal(scoreScene(null), { score: 0, reasons: [] }, "null scene fallback");
equal(scoreScene({ text: "RUN SURPRISE EXPLAINS" }), { score: 4, reasons: ["visible motion or action", "strong reveal or emotional beat", "explanation-heavy scene can work as image"] }, "score weights/order and case folding");
equal(scoreScene({ narration: "x".repeat(260) }), { score: 0, reasons: [] }, "260-character boundary");
equal(scoreScene({ narration: "x".repeat(261) }), { score: -1, reasons: ["long narration favors lower-cost image scene"] }, "261-character boundary");
equal(scoreScene({ text: 42, narration: false, dialogue: {} }), { score: 0, reasons: [] }, "non-string fields stay empty");
equal(scoreScene({ text: { toString() { throw Error("non-string must not be coerced"); } } }), { score: 0, reasons: [] }, "non-string fields stay empty without coercion");
const fallback = current.fallback.fallbackOptimizeScenes([{ id: 0, text: "run" }, { id: 8, text: "run explains" }, { text: "running" }], 0.17);
equal(fallback.map((item) => [item.sceneId, item.exportMode, item.confidence, item.estimatedCostUsd]), [[1, "video", "medium", 0.17], [8, "image", "medium", 0], [3, "video", "high", 0.17]], "fallback IDs/ranking/price");
equal(current.fallback.buildSummary(fallback, 0.17).recommendedVideoScenes, 2, "fallback summary count");
const c = current.captions;
equal(c.getSceneDuration({ id: 1, timing: { targetSceneDuration: "2.75", plannedSceneDuration: 99 }, durationSec: 40 }, 0, { targetSceneDurationSec: 90 }, { scenes: [{ id: 1, durationMatch: { targetDurationSec: 8 } }] }), 2.75, "measured duration wins");
equal(c.getSceneDuration({}, 0, {}, {}), 5, "legacy duration fallback");
equal(c.getSceneDuration({ durationSec: -1 }, 0, { targetSceneDurationSec: "6" }, {}), 6, "invalid candidate skipped");
equal(c.getSceneCaptionText({ narration: " narrator ", dialogue: " dialogue ", text: "fallback" }), "narrator\ndialogue", "narration/dialogue order");
equal(c.getSceneCaptionText({ narration: 4, dialogue: null, text: " fallback " }), "fallback", "caption text fallback");
equal(c.createCaptionCues([{ text: "One", durationSec: 0.1 }, { durationSec: 2 }, { narration: "Three", durationSec: 1.25 }], {}, {}), [{ index: 1, startSec: 0, endSec: 0.5, text: "One" }, { index: 2, startSec: 2.5, endSec: 3.75, text: "Three" }], "caption floor and uncaptained gap");
equal(c.formatTimestamp(3661.2345, ","), "01:01:01,235", "timestamp rounding");
equal(c.createSrt([{ index: 1, startSec: 0, endSec: 1.25, text: "Hello" }]), "1\n00:00:00,000 --> 00:00:01,250\nHello\n", "SRT bytes");
equal(c.createVtt([{ index: 1, startSec: 0, endSec: 1.25, text: "Hello" }]), "WEBVTT\n\n00:00:00.000 --> 00:00:01.250\nHello\n", "VTT bytes");

const primitives = [undefined, null, false, true, 0, -1, 1, NaN, Infinity, -Infinity, "", " ", "0", "3.5", "NaN", "run explains", [], {}, Symbol("synthetic"), 12n];
let seed = 0x4507;
const random = (n) => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
const scenes = [...primitives, { text: "run dramatic question" }, { narration: "X".repeat(260) }, { narration: "X".repeat(261) }, { text: " ", narration: " explain ", dialogue: " jump " }];
for (let i = 0; i < 300; i += 1) scenes.push(Object.fromEntries(["id", "text", "narration", "dialogue", "motionHint", "cameraDirection", "emotion", "visualPrompt", "durationSec", "videoDurationSeconds", "timing"].map((key) => [key, primitives[random(primitives.length)]])));
for (const [index, scene] of scenes.entries()) {
  freeze(scene);
  compare("score", "scoreScene", [scene], index);
  for (const cost of [0, 0.17, -1, NaN, Infinity]) compare("fallback", "fallbackOptimizeScenes", [[scene], cost], `${index}/${cost}`);
  compare("captions", "getSceneCaptionText", [scene], index);
  compare("captions", "getSceneDuration", [scene, index, {}, {}], index);
}
const numerics = [...primitives, -0, 0.001, 0.5, 260, 261, Number.MAX_VALUE, Number.MIN_VALUE, Number.MAX_SAFE_INTEGER, "1e3", " 6 ", { valueOf() { return 7; } }, { valueOf() { throw Error("synthetic coercion failure"); } }];
for (let i = 0; i < numerics.length; i += 1) {
  for (let slot = 0; slot < 7; slot += 1) {
    const scene = { id: 1, timing: {}, durationSec: undefined };
    const pkg = {};
    const timeline = { scenes: [{ id: "1", durationMatch: {} }] };
    [scene.timing, scene, timeline.scenes[0].durationMatch, timeline.scenes[0], scene.timing, scene, pkg][slot][["targetSceneDuration", "durationSec", "targetDurationSec", "targetVisualSeconds", "plannedSceneDuration", "videoDurationSeconds", "targetSceneDurationSec"][slot]] = numerics[i];
    freeze(scene); freeze(pkg); freeze(timeline);
    compare("captions", "getSceneDuration", [scene, 0, pkg, timeline], `candidate-${slot}-${i}`);
  }
}
const arrays = [[], new Array(3), [null], [{ narration: "A", durationSec: 0.1 }, { text: "B", timing: { targetSceneDuration: 4.25 } }], ...Array.from({ length: 100 }, () => Array.from({ length: random(8) }, () => scenes[random(scenes.length)]))];
for (let i = 0; i < arrays.length; i += 1) {
  const a = freeze(arrays[i]);
  compare("fallback", "fallbackOptimizeScenes", [a, 0.17], i);
  for (const plan of [null, {}, { scenes: new Array(2) }, { scenes: [{ id: 1, targetVisualSeconds: 8 }] }]) compare("captions", "createCaptionCues", [a, {}, freeze(plan)], i);
  const cues = observe(c.createCaptionCues, [a, {}, {}]);
  if ("value" in cues) {
    compare("captions", "createSrt", [cues.value], i);
    compare("captions", "createVtt", [cues.value], i);
    const summary = { title: "Synthetic", recommendedTitle: "Title", description: "Description", language: "en", format: "long", qualityMode: "standard", scenes: a, cues: cues.value, includedVideoFile: "", includedThumbnailFile: "", targetPlatforms: [] };
    compare("captions", "createProductionSummary", [freeze(summary)], i);
  }
}
for (const invalid of [undefined, null, false, 1, "wrong", {}]) {
  compare("fallback", "fallbackOptimizeScenes", [invalid, 0.17], "malformed collection");
  compare("captions", "createCaptionCues", [invalid, {}, {}], "malformed collection");
}
for (const list of arrays) for (const cost of [0, 0.17, -1, NaN, Infinity]) {
  const result = observe(current.fallback.fallbackOptimizeScenes, [list, cost]);
  if ("value" in result) compare("fallback", "buildSummary", [freeze(result.value), cost], "summary equivalence");
}
function volatileTiming() {
  let reads = 0;
  return { get timing() { return reads++ === 0 ? { targetSceneDuration: 2 } : { plannedSceneDuration: 9 }; } };
}
function volatilePlan() {
  let reads = 0;
  return { get scenes() { return reads++ === 0 ? [] : null; } };
}
if (prior) {
  equal(observe(c.getSceneDuration, [volatileTiming(), 0, {}, {}]), observe(prior.captions.getSceneDuration, [volatileTiming(), 0, {}, {}]), "timing reads not cached");
  equal(observe(c.getSceneDuration, [{}, 0, {}, volatilePlan()]), observe(prior.captions.getSceneDuration, [{}, 0, {}, volatilePlan()]), "volatile timeline original exception");
}
for (const seconds of numerics) for (const separator of [",", "."]) compare("captions", "formatTimestamp", [seconds, separator], "timestamp");
function traced() {
  const events = [];
  const wrap = (name, value) => new Proxy(value, { get(target, key, receiver) { events.push(`${name}.${String(key)}`); return Reflect.get(target, key, receiver); } });
  return { events, scene: wrap("scene", { id: 1, text: "run explains", narration: "N", dialogue: "D", timing: wrap("timing", { targetSceneDuration: 1 }) }), pkg: wrap("package", { targetSceneDurationSec: 9 }), plan: wrap("plan", { scenes: [wrap("timeline", { id: 1, durationMatch: wrap("match", { targetDurationSec: 4 }) })] }) };
}
if (prior) for (const [family, fn] of [["score", "scoreScene"], ["fallback", "fallbackOptimizeScenes"], ["captions", "getSceneDuration"], ["captions", "getSceneCaptionText"], ["captions", "createCaptionCues"]]) {
  const old = traced(); const next = traced();
  const args = (x) => fn === "fallbackOptimizeScenes" ? [[x.scene], 0.17] : fn === "createCaptionCues" ? [[x.scene], x.pkg, x.plan] : fn === "getSceneDuration" ? [x.scene, 0, x.pkg, x.plan] : [x.scene];
  equal(observe(current[family][fn], args(next)), observe(prior[family][fn], args(old)), `${fn}/getters`);
  equal(next.events, old.events, `${fn}/getter-order-count`);
}
for (const proto of [String.prototype, Number.prototype]) {
  const saved = Object.getOwnPropertyDescriptor(proto, "narration");
  try {
    Object.defineProperty(proto, "narration", { configurable: true, get() { assert(["string", "number"].includes(typeof this)); return "run explains"; } });
    for (const value of ["boxed", 7]) {
      compare("score", "scoreScene", [value], "primitive receiver");
      compare("fallback", "fallbackOptimizeScenes", [[value], 0.17], "primitive receiver");
      compare("captions", "getSceneCaptionText", [value], "primitive receiver");
    }
  } finally { if (saved) Object.defineProperty(proto, "narration", saved); else delete proto.narration; }
}
rows.push({ family: "score", functions: ["scoreScene"], protected: "score weights, substring matching, case-folding, order, 260/261 boundary and malformed fallbacks" }, { family: "fallback", functions: ["fallbackOptimizeScenes", "buildSummary"], protected: "motion/explanation term counts, scene IDs, prices, ordering and summary" }, { family: "captions", functions: ["getSceneDuration", "getSceneCaptionText", "createCaptionCues", "formatTimestamp", "createSrt", "createVtt", "createProductionSummary"], protected: "duration precedence/coercion, timing floor, gaps, caption/summary bytes and fallback" });
const result = { checks, beforeAfter: Boolean(prior), actualPureDeclarations: true, routesProvidersDatabaseOrMediaExecuted: false, families: rows };
if (outputArg >= 0) fs.writeFileSync(process.argv[outputArg + 1], JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
console.log(`PURE_FUNCTION_TYPE_REGRESSIONS=PASS; ${checks} assertions; before/after=${Boolean(prior)}; no route/provider execution`);
