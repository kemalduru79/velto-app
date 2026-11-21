import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const scenes = read("components/create/CreatorSceneProductionStatus.tsx");
const layout = read("app/creatorlab-ux-i-d.css");

const workspaceStart = page.indexOf('id="creatorlab-production-storyboard"');
const stripStart = page.indexOf("<CreatorSceneProductionStatus", workspaceStart);
const selectedStart = page.indexOf('className="creatorlab-p2c-active-scene space-y-3"', workspaceStart);
assert.ok(workspaceStart >= 0 && stripStart > workspaceStart && selectedStart > stripStart, "scene strip precedes selected-scene workspace");
assert.match(scenes, /data-scene-navigator-layout="horizontal"/);
assert.match(scenes, /data-horizontal-scene-strip="true"/);
assert.match(layout, /#creatorlab-production-storyboard\.creatorlab-p2c-production-workspace \{\s*display: block;/);
assert.match(layout, /creatorlab-p2c-scene-operations-list \{[\s\S]*?display: flex;[\s\S]*?flex-wrap: nowrap;[\s\S]*?overflow-x: auto;/);
assert.match(layout, /creatorlab-p2c-scene-operations-list > li \{[\s\S]*?flex: 0 0/);
assert.match(layout, /creatorlab-p2c-active-scene \{[\s\S]*?width: 100%;/);
assert.match(page, /creatorSelectedSceneIds\.length > 1 \|\| creatorVisualDispatchCountdown/);
for (const tab of ["script", "visual", "audio", "music"]) assert.match(page, new RegExp(`activeSceneInspectorTab === "${tab}"`));
for (const completion of [
  'data-complete={sceneDraftHealth.status === "ready"}',
  "data-complete={visualReady}",
  "data-complete={voiceReady}",
  'data-complete="true"',
]) assert.ok(page.includes(completion), `tab completion marker ${completion}`);
const tabStart = page.indexOf('className="scene-production-navigator sticky');
const scriptPanelStart = page.indexOf('id={`scene-${scene.id}-script-panel`}', tabStart);
const alternativesStart = page.indexOf('data-opening-alternatives="collapsed"', scriptPanelStart);
assert.ok(tabStart < scriptPanelStart && alternativesStart > scriptPanelStart, "opening alternatives live inside Script after tab navigation");
assert.doesNotMatch(page, /data-opening-alternatives="collapsed"[^>]+open/);
assert.match(page, /<CreatorProductionSetupSummary/);
assert.match(page, /data-production-compact-progress="true"/);
assert.match(page, /creatorNextProductionAction\.buttonLabel/);
assert.match(page, /Selected Scene \$\{String\(index \+ 1\)\.padStart\(2, "0"\)\}/);
assert.match(page, /creatorlab-p2c-focused-scene-heading/);
assert.doesNotMatch(page, /scene-production-navigator__progress/);
assert.doesNotMatch(scenes, /music|track/i);
assert.match(page, /\(scenePrimaryActionUsesCredits \|\| sceneDraftHealth\.status !== "ready" \|\| motionFailed\) && <div className="creatorlab-p2c-scene-next-action"/);
assert.match(layout, /scene-production-navigator__tabs \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);[\s\S]*?overflow: visible;[\s\S]*?border-bottom:/);
assert.match(layout, /scene-production-tab \{[\s\S]*?width: auto;[\s\S]*?min-width: 0;/);
assert.match(layout, /scene-production-tab\[data-state="ready"\][\s\S]*?background: transparent !important;[\s\S]*?box-shadow: none !important;/);
assert.match(layout, /scene-production-tab\[data-state="active"\][\s\S]*?background: transparent !important;[\s\S]*?border-bottom-color:[\s\S]*?box-shadow: none !important;/);
assert.match(layout, /scene-production-tab__icon,[\s\S]*?scene-production-tab__subtitle \{\s*display: none !important;/);
assert.match(layout, /scene-production-tab\[data-complete="true"\] \.scene-production-tab__icon \{[\s\S]*?display: inline !important;[\s\S]*?color: var\(--cl-success\) !important;[\s\S]*?background: transparent !important;/);
assert.match(layout, /scene-production-tab\[data-state="active"\] \.scene-production-tab__title \{[\s\S]*?color: var\(--cl-text-primary\) !important;[\s\S]*?font-weight: 700;/);
assert.match(page, /className="creatorlab-scene-visual-workspace"/);
assert.match(layout, /creatorlab-scene-visual-workspace \{[\s\S]*?width: 100%;[\s\S]*?min-width: 0;[\s\S]*?box-sizing: border-box;/);
assert.match(layout, /@media \(min-width: 1024px\) \{[\s\S]*?creatorlab-scene-visual-workspace \{[\s\S]*?grid-template-columns: minmax\(0, 2fr\) minmax\(280px, 1fr\);/);
assert.match(layout, /creatorlab-scene-visual-storage \{\s*grid-column: 1 \/ -1;/);
assert.match(layout, /creatorlab-editorial-script-metrics > div \{[\s\S]*?background: transparent;/);
assert.match(layout, /creatorlab-p2c-production-plan \{[\s\S]*?border-radius: var\(--cl-radius-surface\) var\(--cl-radius-surface\) 0 0;/);
assert.match(layout, /creatorlab-p2c-production-status \{[\s\S]*?border-top: 1px solid var\(--cl-border\);[\s\S]*?border-radius: 0 0 var\(--cl-radius-surface\) var\(--cl-radius-surface\);/);
assert.match(page, /\(creatorTimelineNeedsAttention \|\| creatorMusicConfirmationRequired\) && \([\s\S]*?<strong>\{creatorNextProductionAction\.title\}<\/strong>/);

console.log("STAGE_0_13C_E_SPACIOUS_CREATE_REVIEW_LAYOUT=PASS");
