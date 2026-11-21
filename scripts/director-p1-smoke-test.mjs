import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("app/create/page.tsx", "utf8");
const route = [
  "app/api/creator-director/route.ts",
  "lib/creator/services/creatorDirector.server.ts",
].map((file) => fs.readFileSync(file, "utf8")).join("\n");

assert.match(page, /DIRECTOR-P1 VELTO COPILOT/);
assert.match(route, /DIRECTOR-P1 VELTO COPILOT/);
assert.match(page, /Velto Copilot/);
assert.match(page, /Creative Director/);
assert.match(page, /Studio Help/);
assert.match(page, /CREATOR_COPILOT_STORAGE_PREFIX/);
assert.match(page, /creatorCopilotStorageReadyRef/);
assert.match(page, /message\.followUps/);
assert.match(page, /workspaceStage/);
assert.match(route, /Reply in the language used in the CURRENT USER MESSAGE/);
assert.match(route, /responseLanguage: "auto"/);
assert.match(route, /navigate_workspace_stage/);
assert.match(route, /followUps/);
assert.match(route, /workflow_guidance/);

const paidStart = route.indexOf("const PAID_ACTION_TYPES");
const paidEnd = route.indexOf("]);", paidStart);
assert.ok(paidStart >= 0 && paidEnd > paidStart);
assert.doesNotMatch(
  route.slice(paidStart, paidEnd + 3),
  /navigate_workspace_stage/,
);

console.log("DIRECTOR-P1 Velto Copilot smoke test passed.");
