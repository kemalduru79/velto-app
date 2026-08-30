import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createCreatorProductionSetupPresentation } from "../components/create/creatorProductionSetupPresentation.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(path.join(root, "app/create/page.tsx"), "utf8");
const css = readFileSync(path.join(root, "app/creatorlab-ux-p2c.css"), "utf8");

const validSetup = createCreatorProductionSetupPresentation({
  language: "en",
  presentation: "Narrator-led",
  narrator: "Velto default",
  music: "Off",
  continuity: "Independent scenes",
  visualStyle: "Clean documentary realism",
  musicConfirmationRequired: false,
});

assert.equal(
  validSetup.headline,
  "Narrator-led · Velto default · Music Off · Independent scenes",
  "recommended summary must be derived from the supplied canonical setup values",
);
assert.equal(validSetup.visualStyleSummary, "Clean documentary realism");
assert.equal(validSetup.customizeInitiallyOpen, false);
assert.equal(validSetup.actionRequired, false);

const blockedSetup = createCreatorProductionSetupPresentation({
  language: "en",
  presentation: "Faceless",
  narrator: "Velto default",
  music: "Selected",
  continuity: "Keep continuity",
  visualStyle: "",
  musicConfirmationRequired: true,
});

assert.equal(blockedSetup.customizeInitiallyOpen, true);
assert.equal(blockedSetup.actionRequired, true);
assert.equal(blockedSetup.customizeStatus, "Action required");
assert.equal(blockedSetup.visualStyleSummary, "Velto recommended");

for (const group of ["presentation-cast", "brand-visual", "voice", "music", "continuity"]) {
  assert.match(page, new RegExp(`data-setup-group=["']${group}["']`), `${group} must remain reachable through Customize`);
}

assert.match(page, /<details[\s\S]*id="creatorlab-production-customize"/);
assert.match(page, /open=\{creatorProductionSetupPresentation\.customizeInitiallyOpen \? true : undefined\}/);
assert.match(page, /data-production-primary-continue="true"[\s\S]*selectCreatorProductionSubstep\("create_review"\)/);
assert.equal((page.match(/data-production-primary-continue="true"/g) || []).length, 1, "Production Setup must have one dominant Continue CTA");

// Existing handlers remain authoritative; the setup pass must not introduce parallel state.
for (const handlerContract of [
  /setCreatorNoCastMode\("faceless"\)/,
  /clearAllSceneAudioData\(\)/,
  /applyCreatorVoiceProfile\(/,
  /setCreatorBackgroundMusic\(normalized\)/,
  /setCreatorProjectContinuityMode\(option\.value\)/,
  /saveCreatorProfile/,
]) {
  assert.match(page, handlerContract);
}
assert.doesNotMatch(page, /useState[^\n]*(?:setupCustomize|productionCustomize|recommendedSetup)/i);

for (const responsiveContract of [
  ".creatorlab-setup-recommendation",
  ".creatorlab-setup-customize",
  ".creatorlab-setup-summary-grid",
  "@media (max-width: 760px)",
]) {
  assert.ok(css.includes(responsiveContract), `missing responsive setup contract: ${responsiveContract}`);
}

// The accepted Create & Review selected-scene workspace remains intact.
assert.match(page, /creatorlab-p2c-production-workspace/);
assert.match(page, /scenes\.filter\(\(scene\) => scene\.id === creatorFocusedSceneId\)/);

console.log("Stage 0.10H Production Setup UX tests passed.");
