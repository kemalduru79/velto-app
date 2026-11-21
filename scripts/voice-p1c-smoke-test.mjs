import { readMountedWorkspacePanel } from "./fixtures/create-workspace-panel-authority.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const page = read("app/create/page.tsx");
const productionPanel = readMountedWorkspacePanel("CreatorProductionPanel");
const matchingPath = path.join(root, "lib/video/audioDurationMatching.ts");
const matching = fs.readFileSync(matchingPath, "utf8");
const packageRoute = read("app/api/export-creator-package/route.ts");
const stitchRoute = [
  read("lib/video/stitching/nativeMedia.server.ts"),
  read("lib/video/stitching/stitchVideoService.server.ts"),
].join("\n");

const assertions = [
  ["VOICE-P1C marker", page.includes("VELTO_VOICE_P1C")],
  ["secondary voice button", page.includes("creatorlab-voice-change-button")],
  ["primary generate button", page.includes("creatorlab-voice-generate-button")],
  ["listen button separated", page.includes("creatorlab-voice-listen-button")],
  ["exact timing lock", page.includes("exactTimingLocked")],
  ["shortened scene message", productionPanel.includes("Scene shortened by")],
  ["extended scene message", productionPanel.includes("Scene extended by")],
  ["exact preview/export copy", productionPanel.includes("Preview and export use this same duration")],
  ["short audio matching", matching.includes('"shortened"')],
  ["long audio matching", matching.includes('"extended"')],
  ["stitch measures media", stitchRoute.includes("estimatedAudioDuration")],
  ["stitch exact target", stitchRoute.includes("durationMatch.targetDurationSec")],
  [
    "package exact target before planned",
    packageRoute.indexOf("captionReadValue(scene?.timing)?.targetSceneDuration") >= 0 &&
    packageRoute.indexOf("captionReadValue(scene?.timing)?.plannedSceneDuration") >= 0 &&
    packageRoute.indexOf("captionReadValue(scene?.timing)?.targetSceneDuration") <
      packageRoute.indexOf("captionReadValue(scene?.timing)?.plannedSceneDuration"),
  ],
];

const require = createRequire(import.meta.url);
const ts = require("typescript");
const transpiled = ts.transpileModule(matching, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: matchingPath,
}).outputText;
const testModule = { exports: {} };
new Function("exports", "module", "require", transpiled)(
  testModule.exports,
  testModule,
  require,
);
const { matchAudioDurationToScene } = testModule.exports;

const shorter = matchAudioDurationToScene({
  audioDurationSec: 3.6,
  plannedDurationSec: 7.6,
  minDurationSec: 3,
  maxDurationSec: 30,
  preferredMaxSceneDurationSec: 20,
  tailBufferSec: 0.75,
});
assertions.push(
  ["3.6s audio becomes 4.35s exact scene", shorter.targetDurationSec === 4.35],
  ["3.25s dead tail removed", shorter.unnecessaryExtensionRemovedSec === 3.25],
  ["short example classified correctly", shorter.status === "shortened"],
);

const longer = matchAudioDurationToScene({
  audioDurationSec: 8,
  plannedDurationSec: 7.6,
  minDurationSec: 3,
  maxDurationSec: 30,
  preferredMaxSceneDurationSec: 20,
  tailBufferSec: 0.75,
});
assertions.push(
  ["8s audio becomes 8.75s exact scene", longer.targetDurationSec === 8.75],
  ["long example classified correctly", longer.status === "extended"],
);

// Execute the unique original timing-copy branches from the parent-bound
// panel. Retained text alone must not hide a disabled or changed condition.
const panelSource = ts.createSourceFile(
  "CreatorProductionPanel.tsx", productionPanel, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
);
function evaluateVoiceTimingCopy(needle, condition, ports) {
  const expressions = [];
  function visit(node) {
    if (ts.isJsxExpression(node) && ts.isConditionalExpression(node.expression) &&
      node.expression.condition.getText(panelSource) === condition &&
      node.expression.getText(panelSource).includes(needle)) expressions.push(node.expression);
    ts.forEachChild(node, visit);
  }
  visit(panelSource);
  if (expressions.length !== 1) throw Error("Voice timing copy must have one authoritative expression");
  const compiled = ts.transpileModule(
    `const timingCopy = (${expressions[0].getText(panelSource)});`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } },
  ).outputText;
  return new Function(...Object.keys(ports), compiled + "\nreturn timingCopy;")(...Object.values(ports));
}
const copyPorts = {
  scene: { timing: { transitionTail: 0.75 } },
  sceneNarratorVoiceRoute: { timingStatus: "ready" },
  exactTimingLocked: true,
  timingDeltaSec: -1.1,
  uiLanguage: "en",
  CREATOR_SPEECH_TAIL_BUFFER_SECONDS: 0.75,
};
const deltaCopy = (ports) => evaluateVoiceTimingCopy(
  "Scene shortened by", "scene.timing?.splitRecommended", ports,
);
const durationCopy = (ports) => evaluateVoiceTimingCopy(
  "Preview and export use this same duration", "exactTimingLocked", ports,
);
assertions.push(
  ["mounted panel shortened branch", deltaCopy(copyPorts).startsWith("Scene shortened by 1.1s.")],
  ["mounted panel extended branch", deltaCopy({ ...copyPorts, timingDeltaSec: 1.2 }).startsWith("Scene extended by 1.2s")],
  ["unmeasured audio cannot claim exact shortening", deltaCopy({ ...copyPorts, exactTimingLocked: false }).startsWith("The script fits the planned window.")],
  ["aligned measured audio", deltaCopy({ ...copyPorts, timingDeltaSec: 0 }) === "Measured audio and scene duration are exactly aligned."],
  ["split warning precedes timing copy", deltaCopy({ ...copyPorts, scene: { timing: { splitRecommended: true, recommendedSplitCount: 3 } } }).startsWith("Split into 3 scenes")],
  ["blocked route warning precedes timing copy", deltaCopy({ ...copyPorts, sceneNarratorVoiceRoute: { timingStatus: "blocked" } }).startsWith("The estimated speech exceeds this scene.")],
  ["tight route warning precedes timing copy", deltaCopy({ ...copyPorts, sceneNarratorVoiceRoute: { timingStatus: "tight" } }).startsWith("Speech is close to the safe limit.")],
  ["measured duration copy retains transition tail and parity", durationCopy(copyPorts).includes("0.75s transition tail. Preview and export use this same duration.")],
  ["unmeasured duration copy remains blocked", durationCopy({ ...copyPorts, exactTimingLocked: false }) === "Generate the missing voice track to measure audio and lock the exact scene duration."],
);

const failures = assertions.filter(([, ok]) => !ok);
if (failures.length) {
  for (const [name] of failures) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log("VOICE-P1C smoke verification passed.");
console.log(
  `Exact timing example: 3.6s audio + 0.75s tail = ${shorter.targetDurationSec.toFixed(2)}s scene; ${shorter.unnecessaryExtensionRemovedSec.toFixed(2)}s dead tail removed.`,
);
