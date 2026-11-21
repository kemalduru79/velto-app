import { readMountedWorkspacePanel } from "./fixtures/create-workspace-panel-authority.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const production = readMountedWorkspacePanel("CreatorProductionPanel");
const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.doesNotMatch(page, /data-creator-selected-scenes-toolbar="true"/, "Parent cannot duplicate the panel-owned toolbar");
const css = readFileSync(new URL("../app/creatorlab-ux-p2c.css", import.meta.url), "utf8");
const toolbarStart = production.indexOf('data-creator-selected-scenes-toolbar="true"');
const navigatorStart = production.indexOf("<CreatorSceneProductionStatus", toolbarStart);
const activeSceneStart = production.indexOf('className="creatorlab-p2c-active-scene', navigatorStart);

assert.ok(toolbarStart >= 0, "selected-scenes toolbar is rendered");
assert.ok(navigatorStart > toolbarStart, "selected-scenes toolbar renders before the scene navigator");
assert.ok(activeSceneStart > navigatorStart, "active scene workspace follows the navigator");
assert.equal(production.indexOf('data-creator-selected-scenes-toolbar="true"', toolbarStart + 1), -1, "toolbar is rendered once, not below the list");

const toolbar = production.slice(toolbarStart, navigatorStart);
assert.match(toolbar, /creatorSelectedSceneIds\.length/);
assert.match(toolbar, /creatorSelectedMissingVisualCount/);
assert.match(toolbar, /creatorSelectedMissingVoiceCount/);
assert.match(toolbar, /scenes selected/);
assert.match(toolbar, /Visual source/);
assert.match(toolbar, /Velto Recommended/);
assert.match(toolbar, /\["stock", uiLanguage === "en" \? "Stock"/);
assert.match(toolbar, /AI Image/);
assert.match(toolbar, /AI Video/);
assert.match(toolbar, /Generate Visuals/);
assert.match(toolbar, /Generate Voice/);
assert.match(toolbar, /\? "Clear selection" : "Seçimi temizle"/);
assert.match(toolbar, /\? "Photos" : "Fotoğraflar"/);
assert.match(toolbar, /\? "Videos" : "Videolar"/);
assert.doesNotMatch(toolbar, /Output Image|Output Video/);
assert.match(production.slice(0, toolbarStart), /creatorlab-p2c-scene-rail/);
assert.match(css, /creatorlab-p2c-scene-rail > \.creatorlab-p2c-batch-toolbar/);

console.log("Stage 0.10H selected-scenes toolbar UX test passed.");
