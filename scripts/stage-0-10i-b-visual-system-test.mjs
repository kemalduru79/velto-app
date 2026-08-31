import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const chrome = fs.readFileSync(new URL("../app/creatorlab-ux-i-b.css", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const tokenSources = [globals, chrome, page].join("\n");

const canonicalTokens = {
  "--cl-bg": "#f7f8fa",
  "--cl-surface": "#ffffff",
  "--cl-surface-muted": "#f3f5f8",
  "--cl-border": "#dfe4eb",
  "--cl-text-primary": "#14233b",
  "--cl-text-secondary": "#475569",
  "--cl-text-muted": "#64748b",
  "--cl-primary": "#1769e0",
  "--cl-primary-hover": "#125bc5",
  "--cl-success": "#18865b",
  "--cl-warning": "#a76416",
  "--cl-danger": "#b83a45",
};

for (const [token, value] of Object.entries(canonicalTokens)) {
  assert.equal((tokenSources.match(new RegExp(`${token}:`, "g")) || []).length, 1, `${token} has one authority`);
  assert.match(globals, new RegExp(`${token}:\\s*${value.replace("#", "#")}`));
}

assert.match(globals, /--cl-font-ui:\s*var\(--font-geist-sans\)/);
assert.match(globals, /--cl-type-meta:\s*12px/);
assert.doesNotMatch(chrome, /font-size:\s*(?:[0-9]|1[01])px/);
assert.match(layout, /import "\.\/creatorlab-ux-i-b\.css"/);

assert.match(chrome, /data-workflow-state="current"[\s\S]*?var\(--cl-primary\)/);
assert.match(chrome, /data-workflow-state="completed"/);
assert.match(chrome, /data-workflow-state="future"/);
assert.doesNotMatch(chrome, /data-workflow-state="current"[\s\S]{0,300}(?:purple|orange|cyan|gradient)/i);
assert.match(chrome, /data-creator-manual-save="true"[\s\S]*?var\(--cl-surface\)/);

for (const variant of ["primary", "secondary", "ghost", "destructive"]) {
  assert.match(chrome, new RegExp(`creatorlab-button-${variant}`));
}
assert.match(chrome, /:disabled/);
assert.match(chrome, /\[aria-busy="true"\]/);

for (const status of ["ready", "in-progress", "review", "action-required", "blocked"]) {
  assert.match(chrome, new RegExp(`data-status="${status}"`));
}

for (const surface of ["workspace", "group", "info", "selected", "alert"]) {
  assert.match(chrome, new RegExp(`creatorlab-surface-${surface}`));
}
assert.match(chrome, /:focus-visible[\s\S]*?outline:\s*2px solid var\(--cl-primary\)/);
assert.doesNotMatch(chrome, /#[0-9a-f]{3,8}/i, "chrome consumes tokens without a decorative palette");
assert.doesNotMatch(chrome, /storyverse/i, "new baseline is CreatorLab-scoped");

const changed = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
  .trimEnd()
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(3));
const allowed = new Set([
  "app/create/page.tsx",
  "app/creatorlab-ux-i-b.css",
  "app/globals.css",
  "app/layout.tsx",
  "scripts/stage-0-10i-b-visual-system-test.mjs",
  "scripts/stage-0-8a-critical-regression.mjs",
  "scripts/stage-0-8g-architecture-closure-test.mjs",
]);
assert.deepEqual(changed.filter((file) => !allowed.has(file)), []);

console.log("STAGE_0_10I_B_VISUAL_SYSTEM=PASS");
