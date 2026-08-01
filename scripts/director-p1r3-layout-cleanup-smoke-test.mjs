import fs from "node:fs";
import assert from "node:assert/strict";

const page = fs.readFileSync("app/create/page.tsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(page, /DIRECTOR-P1R3 COPILOT LAYOUT CLEANUP/);
assert.match(page, /creatorlab-copilot-header-brand/);
assert.match(page, /creatorlab-copilot-launcher-brand/);
assert.match(page, /Ask your Creative Director/);
assert.doesNotMatch(page, /creatorlab-director-empty-brand/);
assert.doesNotMatch(page, /creatorlab-director-empty-brand-mark/);
assert.doesNotMatch(page, /creatorlab-director-empty-brand-name/);
assert.doesNotMatch(page, /Workspace status and next action/);
assert.doesNotMatch(page, /Çalışma alanı durumu ve sonraki aksiyon/);
assert.doesNotMatch(page, /<details className="creatorlab-director-status-details">/);
assert.equal(
  packageJson.scripts["test:director-p1r3"],
  "node scripts/director-p1r3-layout-cleanup-smoke-test.mjs",
);

console.log("DIRECTOR-P1R3 Copilot Layout Cleanup smoke test passed.");
