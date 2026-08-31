import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/creatorlab-ux-p2c.css", import.meta.url), "utf8");
const toolbarStart = page.indexOf('data-creator-selected-scenes-toolbar="true"');
const navigatorStart = page.indexOf("<CreatorSceneProductionStatus", toolbarStart);
const activeSceneStart = page.indexOf('className="creatorlab-p2c-active-scene', navigatorStart);

assert.ok(toolbarStart >= 0, "selected-scenes toolbar is rendered");
assert.ok(navigatorStart > toolbarStart, "selected-scenes toolbar renders before the scene navigator");
assert.ok(activeSceneStart > navigatorStart, "active scene workspace follows the navigator");
assert.equal(page.indexOf('data-creator-selected-scenes-toolbar="true"', toolbarStart + 1), -1, "toolbar is rendered once, not below the list");

const toolbar = page.slice(toolbarStart, navigatorStart);
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
assert.match(page.slice(0, toolbarStart), /creatorlab-p2c-scene-rail/);
assert.match(css, /creatorlab-p2c-scene-rail > \.creatorlab-p2c-batch-toolbar/);

console.log("Stage 0.10H selected-scenes toolbar UX test passed.");
