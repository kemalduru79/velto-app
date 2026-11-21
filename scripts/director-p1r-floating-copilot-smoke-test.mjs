import fs from "node:fs";
import assert from "node:assert/strict";

const page = fs.readFileSync("app/create/page.tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(page, /DIRECTOR-P1R FLOATING VELTO COPILOT/);
assert.match(page, /creatorlab-copilot-launcher/);
assert.match(page, /creatorlab-copilot-launcher-brand/);
assert.match(page, /creatorlab-copilot-floating-layer/);
assert.match(page, /creatorlab-copilot-panel/);
assert.match(page, /aria-modal="false"/);
assert.doesNotMatch(page, /\/velto-copilot-director\.png/);
assert.doesNotMatch(
  page,
  /ref=\{creatorDirectorTriggerRef\}[\s\S]{0,500}creatorlab-topbar-tool-button is-director/,
);
assert.match(page, /if \(!isCreatorLabFlow \|\| !creatorProjectsDrawerOpen\)/);
assert.match(page, /if \(!isCreatorLabFlow \|\| !creatorDirectorOpen\)/);
assert.equal(
  packageJson.scripts["test:director-p1r"],
  "node scripts/director-p1r-floating-copilot-smoke-test.mjs",
);

console.log("DIRECTOR-P1R Floating Velto Copilot smoke test passed.");
