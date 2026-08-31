import assert from "node:assert/strict";
import fs from "node:fs";
import { creatorStageAfterSuccess } from "../lib/creator/stageNavigation.ts";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const exportStart = page.indexOf("const handleExportMovie");
const exportEnd = page.indexOf("const handleCreateShareLink", exportStart);
const exportHandler = page.slice(exportStart, exportEnd);
const loadStart = page.indexOf("const savedExportedMovieUrl");
const loadEnd = page.indexOf("const loadedMentorResult", loadStart);
const reloadPath = page.slice(loadStart, loadEnd);

assert.equal(creatorStageAfterSuccess(3, "production_setup_continued"), 4);
assert.equal(creatorStageAfterSuccess(4, "strategy_approved"), 4, "older success never moves backward");

const persistedIndex = exportHandler.indexOf("finalProductionPersisted = true");
const advanceIndex = exportHandler.indexOf('creatorStageAfterSuccess(current, "production_setup_continued")');
assert.ok(persistedIndex >= 0 && advanceIndex > persistedIndex, "Publish follows successful persistence");
assert.match(exportHandler, /if \(isCreatorLabFlow && finalProductionPersisted\)/);
assert.doesNotMatch(exportHandler.slice(0, persistedIndex), /production_setup_continued/);
assert.match(reloadPath, /if \(savedExportedMovieUrl && project\.export_signature\)/);
assert.match(reloadPath, /creatorStageAfterSuccess\(current, "production_setup_continued"\)/);

assert.match(page, /const automaticTargetStep = Math\.min\(creatorProgressStep, 3\)/);
assert.match(page, /setCreatorSelectedWorkspaceStep\(step\)/, "manual stage navigation remains available");

console.log("STAGE_0_10H_PRODUCTION_PUBLISH_NAVIGATION=PASS");
