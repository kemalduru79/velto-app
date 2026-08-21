import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const page = read("app/create/page.tsx");
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
  ["shortened scene message", page.includes("Scene shortened by")],
  ["extended scene message", page.includes("Scene extended by")],
  ["exact preview/export copy", page.includes("Preview and export use this same duration")],
  ["short audio matching", matching.includes('"shortened"')],
  ["long audio matching", matching.includes('"extended"')],
  ["stitch measures media", stitchRoute.includes("estimatedAudioDuration")],
  ["stitch exact target", stitchRoute.includes("durationMatch.targetDurationSec")],
  [
    "package exact target before planned",
    packageRoute.indexOf("scene?.timing?.targetSceneDuration") <
      packageRoute.indexOf("scene?.timing?.plannedSceneDuration"),
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
const module = { exports: {} };
new Function("exports", "module", "require", transpiled)(
  module.exports,
  module,
  require,
);
const { matchAudioDurationToScene } = module.exports;

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

const failures = assertions.filter(([, ok]) => !ok);
if (failures.length) {
  for (const [name] of failures) console.error(`FAIL: ${name}`);
  process.exit(1);
}

console.log("VOICE-P1C smoke verification passed.");
console.log(
  `Exact timing example: 3.6s audio + 0.75s tail = ${shorter.targetDurationSec.toFixed(2)}s scene; ${shorter.unnecessaryExtensionRemovedSec.toFixed(2)}s dead tail removed.`,
);
