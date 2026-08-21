#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");
const contractSource = await read("lib/creator/continuityContracts.ts");
const engineSource = await read("lib/creator/sceneContinuity.ts");
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const executableEngine = [
  transpile(contractSource),
  transpile(engineSource.replace(/import \{[\s\S]*?\} from "\.\/continuityContracts";\n/, "")),
].join("\n");
const {
  buildCreatorGenerationContinuityContext,
  buildCreatorProductionIdentity,
  createCreatorTransitionContract,
  guardCreatorSceneContinuity,
  mergeCreatorSceneContinuityState,
  normalizeCreatorSceneContinuityState,
} = await import(`data:text/javascript;base64,${Buffer.from(executableEngine).toString("base64")}`);
const [page, image, production, scriptPlan, flowAudit, costPolicy] = await Promise.all([
  read("app/create/page.tsx"),
  read("app/api/image/route.ts"),
  read("lib/creator/services/creatorProduction.server.ts"),
  read("app/api/creator-script-plan/route.ts"),
  read("lib/video/flowContinuityAudit.ts"),
  read("lib/credits/operationPolicy.ts"),
]);
const { auditFlowContinuityScene } = await import(
  `data:text/javascript;base64,${Buffer.from(transpile(flowAudit)).toString("base64")}`
);

const checks = [];
const check = (name, fn) => {
  fn();
  checks.push(name);
  console.log(`✓ ${name}`);
};

const previous = {
  sceneId: 1,
  charactersPresent: ["Presenter"],
  location: "modern office",
  timeOfDay: "evening",
  lighting: "soft practical light",
  wardrobe: ["Presenter: navy jacket"],
  props: ["open laptop"],
  actionEnd: "presenter turns toward the display",
  screenDirection: "right",
};

check("legacy scenes normalize without invented semantic values", () => {
  assert.equal(normalizeCreatorSceneContinuityState(undefined), undefined);
  assert.equal(normalizeCreatorSceneContinuityState({}), undefined);
  assert.deepEqual(normalizeCreatorSceneContinuityState({ location: "  office  " }), { location: "office" });
});

check("structured continuity normalization preserves typed intent within safety bounds", () => {
  const normalized = normalizeCreatorSceneContinuityState({
    charactersPresent: Array.from({ length: 20 }, (_, index) => ` Presenter ${index} `.repeat(20)),
    wardrobe: Array.from({ length: 20 }, (_, index) => `wardrobe ${index} `.repeat(40)),
    props: Array.from({ length: 20 }, (_, index) => `prop ${index} `.repeat(40)),
    continuityNotes: Array.from({ length: 10 }, (_, index) => `note ${index} `.repeat(80)),
    location: " location ".repeat(100),
    explicitChanges: ["location", "wardrobe", "invalid", "location"],
  });
  assert.deepEqual(normalized.explicitChanges, ["location", "wardrobe"]);
  assert.equal(normalized.charactersPresent.length, 8);
  assert.equal(normalized.wardrobe.length, 8);
  assert.equal(normalized.props.length, 12);
  assert.equal(normalized.continuityNotes.length, 4);
  assert.ok(normalized.charactersPresent.every((value) => value.length <= 80));
  assert.ok(normalized.wardrobe.every((value) => value.length <= 180));
  assert.ok(normalized.props.every((value) => value.length <= 140));
  assert.ok(normalized.continuityNotes.every((value) => value.length <= 240));
  assert.ok(normalized.location.length <= 320);
});

check("production identity uses Character Cast and Visual Bible", () => {
  const identity = buildCreatorProductionIdentity({
    characters: [{ name: "Presenter", appearance: "same face", outfit: "navy jacket" }],
    visualBible: { style: "realistic", palette: "cool blue", camera: "35mm", consistencyRules: "stable brand" },
  });
  assert.equal(identity.characterAnchors[0].name, "Presenter");
  assert.equal(identity.characterAnchors[0].wardrobe, "navy jacket");
  assert.equal(identity.visualStyle, "realistic");
  assert.equal(identity.palette, "cool blue");
  assert.equal(identity.cameraLanguage, "35mm");
});

check("independent does not inherit narrative scene state", () => {
  const contract = createCreatorTransitionContract({ mode: "independent", previousState: previous, currentState: {} });
  assert.deepEqual(contract.inheritedState, {});
  assert.ok(contract.allowedChanges.includes("location"));
});

check("consistent preserves identity/world and permits location or shot change", () => {
  const contract = createCreatorTransitionContract({ mode: "consistent", previousState: previous, currentState: { location: "exterior", cameraIntent: "wide shot" } });
  assert.ok(contract.mustPreserve.includes("recurring character identity"));
  assert.ok(contract.allowedChanges.includes("location"));
  assert.deepEqual(contract.continuityWarnings, []);
});

check("previous inherits missing state and action handoff", () => {
  const contract = createCreatorTransitionContract({ mode: "previous", previousState: previous, currentState: { sceneId: 2 } });
  assert.equal(contract.inheritedState.location, "modern office");
  assert.equal(contract.inheritedState.actionStart, previous.actionEnd);
  const guard = guardCreatorSceneContinuity(contract);
  assert.equal(guard.status, "repair_available");
  assert.deepEqual(guard.contradictions, []);
});

check("previous retains explicit allowed change without false contradiction", () => {
  const context = buildCreatorGenerationContinuityContext({
    mode: "previous",
    previousState: previous,
    currentState: {
      location: "street exterior",
      timeOfDay: "night",
      explicitChanges: ["location", "timeOfDay"],
    },
  });
  const contract = context.transition;
  assert.equal(contract.inheritedState.location, undefined);
  assert.deepEqual(contract.continuityWarnings, []);
  assert.deepEqual(contract.explicitChanges, ["location", "timeOfDay"]);
  assert.equal(contract.fallbackRecommendation, "establishing");
});

check("previous unexplained location change produces review and recommendation", () => {
  const context = buildCreatorGenerationContinuityContext({
    mode: "previous",
    previousState: previous,
    currentState: { location: "street exterior" },
  });
  assert.equal(context.guard.status, "review_recommended");
  assert.ok(context.guard.contradictions.some((value) => value.includes("location")));
  assert.equal(context.transition.fallbackRecommendation, "establishing");
});

check("consistent mode reviews recurring-character wardrobe drift only", () => {
  const drift = buildCreatorGenerationContinuityContext({
    mode: "consistent",
    previousState: previous,
    currentState: {
      charactersPresent: [" presenter "],
      wardrobe: ["Presenter: red shirt"],
      location: "exterior",
    },
  });
  assert.equal(drift.guard.status, "review_recommended");
  assert.ok(drift.guard.contradictions.some((value) => value.includes("wardrobe")));
  assert.ok(drift.guard.contradictions.every((value) => !value.includes("location")));

  const explicit = buildCreatorGenerationContinuityContext({
    mode: "consistent",
    previousState: previous,
    currentState: {
      charactersPresent: ["Presenter"],
      wardrobe: ["Presenter: red shirt"],
      explicitChanges: ["wardrobe"],
    },
  });
  assert.equal(explicit.guard.status, "safe");
  assert.ok(explicit.transition.allowedChanges.includes("wardrobe"));

  const unrelated = buildCreatorGenerationContinuityContext({
    mode: "consistent",
    previousState: previous,
    currentState: {
      charactersPresent: ["Guest"],
      wardrobe: ["Guest: red shirt"],
    },
  });
  assert.equal(unrelated.guard.status, "safe");
});

check("consistent wardrobe matching ignores new guests and ambiguous arrays", () => {
  const guestAdded = buildCreatorGenerationContinuityContext({
    mode: "consistent",
    previousState: previous,
    currentState: {
      charactersPresent: ["Presenter", "Guest"],
      wardrobe: ["Presenter: navy jacket", "Guest: red shirt"],
    },
  });
  assert.equal(guestAdded.guard.status, "safe");

  const ambiguous = buildCreatorGenerationContinuityContext({
    mode: "consistent",
    previousState: {
      charactersPresent: ["Presenter", "Producer"],
      wardrobe: ["navy jacket", "black shirt"],
    },
    currentState: {
      charactersPresent: ["Presenter", "Producer", "Guest"],
      wardrobe: ["navy jacket", "black shirt", "red shirt"],
    },
  });
  assert.equal(ambiguous.guard.status, "safe");
});

check("script-plan continuity merge patches fields without dropping state", () => {
  const base = {
    charactersPresent: ["Presenter"],
    location: "office",
    wardrobe: ["Presenter: navy jacket"],
    lighting: "warm",
    explicitChanges: ["wardrobe"],
  };
  const merged = mergeCreatorSceneContinuityState(base, {
    location: " exterior ",
    explicitChanges: ["location"],
  });
  assert.deepEqual(merged, {
    charactersPresent: ["Presenter"],
    wardrobe: ["Presenter: navy jacket"],
    location: "exterior",
    lighting: "warm",
    explicitChanges: ["location"],
  });

  const omittedIntent = mergeCreatorSceneContinuityState(base, {
    location: "studio",
  });
  assert.deepEqual(omittedIntent.explicitChanges, ["wardrobe"]);
  assert.equal(omittedIntent.location, "studio");

  const clearedIntent = mergeCreatorSceneContinuityState(base, {
    explicitChanges: [],
  });
  assert.equal(clearedIntent.explicitChanges, undefined);
  assert.deepEqual(clearedIntent.charactersPresent, ["Presenter"]);

  const bounded = mergeCreatorSceneContinuityState(base, {
    location: "x".repeat(1000),
    props: Array.from({ length: 30 }, (_, index) => `prop-${index}`),
  });
  assert.equal(bounded.location.length, 320);
  assert.equal(bounded.props.length, 12);
});

check("first scene cannot depend on previous state", () => {
  const contract = createCreatorTransitionContract({ mode: "previous", previousState: previous, currentState: {}, isFirstScene: true });
  assert.equal(contract.mode, "independent");
  assert.deepEqual(contract.inheritedState, {});
});

check("direct continuation contradictions are deterministic", () => {
  const contract = createCreatorTransitionContract({
    mode: "previous",
    previousState: previous,
    currentState: { wardrobe: ["Presenter: red shirt"], location: "warehouse", timeOfDay: "morning", actionStart: "presenter walks away", screenDirection: "left" },
  });
  assert.ok(contract.continuityWarnings.some((value) => value.includes("wardrobe")));
  assert.ok(contract.continuityWarnings.some((value) => value.includes("location")));
  assert.ok(contract.continuityWarnings.some((value) => value.includes("timeOfDay")));
  assert.ok(contract.continuityWarnings.some((value) => value.includes("actionStart")));
  assert.ok(contract.continuityWarnings.some((value) => value.includes("screenDirection")));
  assert.equal(guardCreatorSceneContinuity(contract).status, "review_recommended");
});

check("fallback recommendations are context only and never dispatch", () => {
  const context = buildCreatorGenerationContinuityContext({ mode: "previous", previousState: previous, currentState: { location: "exterior" } });
  assert.equal(context.transition.fallbackRecommendation, "establishing");
  const bridge = createCreatorTransitionContract({ mode: "previous", previousState: previous, currentState: { timeOfDay: "morning" } });
  const broll = createCreatorTransitionContract({ mode: "previous", previousState: previous, currentState: { cameraIntent: "B-roll detail" } });
  const cutaway = createCreatorTransitionContract({ mode: "previous", previousState: previous, currentState: { cameraIntent: "cutaway insert" } });
  assert.equal(bridge.fallbackRecommendation, "bridge");
  assert.equal(broll.fallbackRecommendation, "broll");
  assert.equal(cutaway.fallbackRecommendation, "cutaway");
  assert.doesNotMatch(engineSource, /fetch\(|responses\.create|provider|reserveMeteredOperation/);
});

check("existing model calls are extended rather than multiplied", () => {
  assert.match(production, /continuityNotes/);
  assert.match(production, /explicitChanges/);
  assert.match(scriptPlan, /Preserve supplied structured continuity metadata/);
  assert.match(scriptPlan, /mergeCreatorSceneContinuityState/);
  assert.equal((production.match(/responses\.create\(/g) || []).length, 1);
  assert.equal((scriptPlan.match(/responses\.create\(/g) || []).length, 1);
  assert.doesNotMatch(production + scriptPlan, /continuity-validator|continuity\/route/);
});

check("image integration keeps canonical priorities and legacy fallback", () => {
  for (const marker of ["Canonical Character Cast / persona bible", "Visual Bible", "Adjacent-scene continuity", "CRITICAL CHARACTER LOCK", "reference image"])
    assert.ok(image.includes(marker), `missing image priority marker: ${marker}`);
  assert.match(image, /Structured production continuity/);
  assert.match(image, /legacy adjacent-scene context/);
  assert.match(page, /previousScene: toContinuityScene/);
  assert.match(page, /structuredContext/);
  assert.match(page, /type CreatorProductionScene = \{[\s\S]*continuity\?: CreatorSceneContinuityState/);
  assert.match(page, /continuityMode === "independent"/);
  assert.doesNotMatch(image, /suppliedStructured\.transition|suppliedStructured\.guard/);
  assert.match(image, /currentState: suppliedStructured\.currentState/);
  assert.match(image, /explicit wardrobe change may change clothing only/);
});

check("measured video duration exposes planned-tail visual gaps", () => {
  const audit = auditFlowContinuityScene({
    id: 2,
    source: "video",
    targetDurationSec: 10,
    videoDurationSec: 5,
    visualBlocks: [{ type: "video_clip", source: "planning", durationSec: 10 }],
    hasNarration: true,
    narrationDurationSec: 8,
  });
  assert.equal(audit.durationSource, "video_request");
  assert.equal(audit.visualDurationSec, 5);
  assert.equal(audit.uncoveredDurationSec, 5);
  assert.ok(audit.risks.includes("visual_gap"));
  assert.ok(audit.risks.includes("freeze_frame_risk"));
  assert.equal(audit.audioOverflowSec, 0);
});

check("regression boundaries remain intact", () => {
  assert.match(costPolicy, /creator_image/);
  assert.match(page, /CreatorOutcomeStart/);
  assert.match(page, /creatorProfile/);
  assert.match(page, /CREATOR_PLATFORM_PRESETS/);
  assert.doesNotMatch(image, /provider names/i);
  assert.match(flowAudit, /freeze_frame_risk|freezeRiskScenes/);
  assert.doesNotMatch(flowAudit, /CreatorSceneContinuityState|TransitionContract/);
});

console.log(`\nCreatorLab scene continuity smoke test passed (${checks.length} checks).`);
