import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { createCreatorPublishPreflight } from "../lib/creator/publishPreflight.ts";
import { CREATOR_VISUAL_SOURCE_METHODS } from "../lib/creator/visualSourceMethod.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const globals = read("app/globals.css");
const layout = read("app/layout.tsx");
const page = read("app/create/page.tsx");
const layers = ["b", "c", "d", "e"].map((stage) => ({
  path: `app/creatorlab-ux-i-${stage}.css`,
  source: read(`app/creatorlab-ux-i-${stage}.css`),
}));
const critical = read("scripts/stage-0-8a-critical-regression.mjs");

assert.match(globals, /--cl-font-ui:\s*var\(--font-geist-sans\)/);
assert.match(globals, /--cl-type-meta:\s*12px/);
for (const token of [
  "bg", "surface", "surface-muted", "border", "text-primary", "text-secondary",
  "text-muted", "primary", "primary-hover", "success", "warning", "danger",
  "space-1", "space-2", "space-3", "space-4", "space-6", "space-8",
  "radius-control", "radius-surface", "radius-workspace", "radius-pill",
]) {
  const declaration = new RegExp(`--cl-${token}:`, "g");
  assert.equal((globals.match(declaration) || []).length, 1, `${token} has one authoritative declaration`);
  for (const layer of layers) {
    assert.equal((layer.source.match(declaration) || []).length, 0, `${layer.path} consumes ${token}`);
  }
}

assert.match(
  layout,
  /import "\.\/creatorlab-ux-i-b\.css";\s*import "\.\/creatorlab-ux-i-c\.css";\s*import "\.\/creatorlab-ux-i-d\.css";\s*import "\.\/creatorlab-ux-i-e\.css";/,
  "the closed visual layers remain loaded in order",
);
for (const layer of layers) {
  assert.doesNotMatch(layer.source, /:root|--cl-[\w-]+\s*:/, `${layer.path} does not create a parallel token source`);
  assert.doesNotMatch(layer.source, /storyverse/i, `${layer.path} remains CreatorLab-scoped`);
  assert.doesNotMatch(layer.source, /fetch\(|\/api\/|supabase|credits?|economics|provider/i);
}

const consolidated = layers.map((layer) => layer.source).join("\n");
for (const breakpoint of ["1180", "1023", "720"]) {
  assert.match(consolidated, new RegExp(`@media \\(max-width: ${breakpoint}px\\)`));
}
for (const obsoleteBreakpoint of ["1100", "760", "520"]) {
  assert.doesNotMatch(consolidated, new RegExp(`@media \\(max-width: ${obsoleteBreakpoint}px\\)`));
}
assert.equal((consolidated.match(/@media \(prefers-reduced-motion: reduce\)/g) || []).length, 2);
assert.match(globals, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.creatorlab-premium-surface \*/);
assert.match(layers.at(-1).source, /@media \(forced-colors: active\)/);
assert.match(layers[0].source, /:focus-visible[\s\S]*?var\(--cl-primary\)/);

assert.match(page, /const \[creatorProductionCustomizeOpen, setCreatorProductionCustomizeOpen\][\s\S]*?useState\(true\)/);
const customizeStart = page.indexOf('id="creatorlab-production-customize"');
const customize = page.slice(customizeStart, customizeStart + 900);
assert.ok(customizeStart > -1);
assert.match(customize, /open=\{creatorProductionCustomizeOpen\}/);
assert.match(customize, /onToggle=\{\(event\)[\s\S]*?setCreatorProductionCustomizeOpen\(event\.currentTarget\.open\)/);
assert.doesNotMatch(customize, /Optional|creatorlab-setup-customize-status/);

assert.deepEqual(
  CREATOR_VISUAL_SOURCE_METHODS,
  ["recommended", "stock", "ai_image", "ai_video", "upload"],
  "the exact five source methods remain unchanged",
);
for (const label of ["Velto Recommended", "Stock", "AI Image", "AI Video", "Upload"]) {
  assert.match(page, new RegExp(label));
}

assert.deepEqual(
  createCreatorPublishPreflight({
    contentReady: true,
    visualsReady: true,
    voiceReady: true,
    evidenceVerified: true,
    rightsConfirmed: true,
    outputReady: true,
  }).map((item) => item.category),
  ["content", "visuals", "voice", "evidence", "rights", "output"],
  "the exact six Publish preflight categories remain unchanged",
);

const changed = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
  .trimEnd().split("\n").filter(Boolean)
  .map((line) => line.slice(3).split(" -> ").at(-1));
const presentationOnly = new Set([
  "app/creatorlab-ux-i-b.css",
  "app/creatorlab-ux-i-c.css",
  "scripts/stage-0-10i-b-visual-system-test.mjs",
  "scripts/stage-0-10i-f-visual-consolidation-test.mjs",
  "scripts/stage-0-8a-critical-regression.mjs",
  "scripts/stage-0-8g-architecture-closure-test.mjs",
  "app/api/creator-upload/route.ts",
  "app/api/export-creator-package/route.ts",
  "docs/STAGE-0.11B-CAPACITY-BASELINE.md",
  "lib/observability/capacity.ts",
  "lib/observability/index.ts",
  "lib/performance/",
  "lib/persistence/jobs/supabaseJobQueueRepository.ts",
  "lib/providers/stock/service.server.ts",
  "lib/worker/runtime.mjs",
  "scripts/stage-0-8f-a-health-observability-test.mjs",
  "scripts/stage-0-8f-b-recovery-operator-test.mjs",
  "scripts/stage-0-11b-load-concurrency-test.mjs",
  "scripts/stage-0-11b-load-harness.mjs",
  "components/create/CreatorUploadPicker.tsx",
  "lib/creator/directUpload.ts",
  "lib/performance/reliabilityHarness.ts",
  "lib/persistence/storage/supabaseObjectStorageRepository.ts",
  "lib/persistence/storage/persistenceError.ts",
  "lib/persistence/storage/types.ts",
  "scripts/stage-0-10h-custom-upload-test.mjs",
  "scripts/stage-0-11c-bottleneck-reliability-recovery-test.mjs",
  "docs/STAGE-0.11C-RELIABILITY.md",
  "docs/STAGE-0.11D-SCALE-ECONOMICS.md",
  "lib/economics/scaleEnvelope.ts",
  "scripts/stage-0-11d-scale-economics-test.mjs",
  "docs/STAGE-0.11E-AZURE-READINESS-GATE.md",
  "scripts/stage-0-11e-azure-readiness-gate-test.mjs",
]);
assert.deepEqual(changed.filter((path) => !presentationOnly.has(path)), []);
assert.equal(
  (critical.match(/scripts\/stage-0-10i-f-visual-consolidation-test\.mjs/g) || []).length,
  1,
  "I-F is registered exactly once in the critical suite",
);

console.log("STAGE_0_10I_F_VISUAL_CONSOLIDATION=PASS");
