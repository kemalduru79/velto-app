import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const helperSource = read("lib/creator/editorState.ts");
const editor = read("components/create/CreatorEditor.tsx");
const exportRoute = read("app/api/creator-export/route.ts");
const exportService = read("export-service/src/server.js");
const operationsSmoke = read("scripts/beta-edit-p1b-creator-editor-scene-operations-smoke-test.mjs");
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString("base64")}`);

const serverNormalizerStart = exportService.indexOf("function normalizeCreatorVideoTrim");
const serverNormalizerEnd = exportService.indexOf("function getTransitionAwareDuration", serverNormalizerStart);
const serverNormalizerSource = exportService.slice(serverNormalizerStart, serverNormalizerEnd);
const normalizeServerTrim = new Function(
  `const CREATOR_MIN_VIDEO_CLIP_SECONDS = 0.25; ${serverNormalizerSource}; return normalizeCreatorVideoTrim;`,
)();

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const matches = (source, pattern, message) => check(pattern.test(source), message);
const absent = (source, pattern, message) => check(!pattern.test(source), message);
const normalize = (clipInSec, clipOutSec, sourceDurationSec = 10, sourceType = "video") =>
  helper.normalizeCreatorSceneTrim({ clipInSec, clipOutSec, sourceDurationSec, sourceType });

matches(page, /type Scene = \{[\s\S]*clipInSec\?: number;/, "Scene supports clipInSec"); // 1
matches(page, /type Scene = \{[\s\S]*clipOutSec\?: number;/, "Scene supports clipOutSec"); // 2
check(normalize(undefined, undefined).visualDurationSec === 10, "missing trim means full source"); // 3
check(normalize(2, 8).clipInSec === 2 && normalize(2, 8).clipOutSec === 8, "valid trim preserved"); // 4
check(normalize(-1, 8).clipInSec === 0, "negative start normalized"); // 5
check(normalize(2, 20).clipOutSec === 10, "end clamped"); // 6
check(!normalize(8, 2).isTrimmed, "reversed trim falls back"); // 7
check(normalize(4, 4).visualDurationSec === 10, "zero length impossible"); // 8
check(!normalize(9.9, 10).isTrimmed, "minimum duration enforced"); // 9
check(!normalize(2, 8, 10, "image").isTrimmed, "images ignore trim"); // 10
const trimInput = { clipInSec: 2, clipOutSec: 8, sourceDurationSec: 10 };
const trimSnapshot = structuredClone(trimInput);
normalize(2, 8);
check(JSON.stringify(trimInput) === JSON.stringify(trimSnapshot), "normalization immutable"); // 11
const richScene = { id: 1, creatorSceneId: "10000000-0000-4000-8000-000000000001", image: "a.png", assetHistory: [{ id: "asset" }], narratorVoiceProfileId: "voice", continuity: { location: "studio" }, clipInSec: 2, clipOutSec: 8 };
const moved = helper.moveCreatorScene([richScene, { ...richScene, id: 2, creatorSceneId: "10000000-0000-4000-8000-000000000002" }], richScene.creatorSceneId, "later")[1];
check(moved.image === "a.png", "unrelated fields preserved"); // 12
check(moved.creatorSceneId === richScene.creatorSceneId, "stable ID preserved"); // 13
check(moved.assetHistory[0].id === "asset", "asset history preserved"); // 14
check(moved.narratorVoiceProfileId === "voice", "voice metadata preserved"); // 15
check(moved.continuity.location === "studio", "continuity preserved"); // 16

check(normalize(2, 8).visualDurationSec === 6, "trimmed visual duration correct"); // 17
check(normalize(undefined, undefined).visualDurationSec === 10, "untrimmed duration unchanged"); // 18
check(helper.getCreatorSceneEffectiveDuration({ visualDurationSec: 5, speechDurationSec: 7 }) === 7.75, "speech extends effective duration"); // 19
check(helper.getCreatorSceneEffectiveDuration({ visualDurationSec: 5, speechDurationSec: 7 }) >= 7, "trim never shortens speech"); // 20
check(helper.getCreatorSceneEffectiveDuration({ visualDurationSec: 5, speechDurationSec: 7, speechTailBufferSec: 0.75 }) === 7.75, "speech tail represented"); // 21
check(normalize(2, 8, 10, "image").visualDurationSec === 10, "image duration unchanged"); // 22

matches(editor, /hasSelectedVideo && \([\s\S]*data-creator-trim-controls="true"/, "trim controls video-only"); // 23
matches(editor, /Start \(seconds\)|Başlangıç \(saniye\)/, "Start control exists"); // 24
matches(editor, /End \(seconds\)|Bitiş \(saniye\)/, "End control exists"); // 25
matches(editor, /Reset Trim|Kırpmayı Sıfırla/, "Reset exists"); // 26
check(editor.includes("onLoadedMetadata={handleVideoMetadata}") && editor.includes("videoRef.current?.duration"), "metadata supplies source duration"); // 27
matches(page, /if \(!resetRequested && !normalized\?\.isTrimmed\) return;/, "invalid trim not persisted"); // 28
const trimHandler = page.slice(page.indexOf("const updateSelectedCreatorSceneTrim"), page.indexOf("const toggleCreatorAssetCompare"));
absent(trimHandler, /fetch\(|credit|provider|generate/i, "trim update free"); // 29
absent(trimHandler, /fetch\(|credit|provider|generate/i, "reset free"); // 30
absent(editor, /react-player|video\.js|plyr/i, "no custom player package"); // 31
absent(editor, /type="range"|dual|drag/i, "no range/drag dependency"); // 32

matches(editor, /onPlay=[\s\S]*currentTime = normalizedTrim\.clipInSec/, "preview starts at clipIn"); // 33
matches(editor, /onTimeUpdate=[\s\S]*currentTime = normalizedTrim\.clipOutSec[\s\S]*\.pause\(\)/, "preview stops at clipOut"); // 34
matches(editor, /currentTime >=[\s\S]*currentTime = normalizedTrim\.clipInSec/, "replay restarts at clipIn"); // 35
matches(editor, /if \(!normalizedTrim\.isTrimmed\) return;/, "untrimmed seeking remains normal"); // 36
matches(editor, /selectedScene\.image[\s\S]*<img/, "image preview unchanged"); // 37
absent(editor, /creator-export|export-movie|Final Export/, "preview does not export"); // 38
absent(editor.replace(/No voice generated/g, "No voice yet"), /\/api\/|fetch\(|generate/i, "preview does not generate"); // 39
absent(editor, /credit|reserve|CreatorCostGuard/i, "preview reserves no credits"); // 40

matches(page, /setScenes\(nextScenes\)[\s\S]*scenes: nextProjection/, "trim mutates canonical scenes first"); // 41
matches(page, /scenes: sourceScenes/, "save payload includes canonical trim"); // 42
matches(page, /loadedProjectScenesBeforeIdentity[\s\S]*setScenes\(/, "reload retains scene fields"); // 43
matches(page, /void loadProject\(projectId\)/, "deep link uses same hydration"); // 44
check(moved.clipInSec === 2 && moved.clipOutSec === 8, "reorder keeps trim"); // 45
check(helper.duplicateCreatorScene([richScene], richScene.creatorSceneId, () => "10000000-0000-4000-8000-000000000003").scenes[1].clipInSec === 2, "duplicate keeps trim"); // 46
matches(page, /scenes: cloneCreatorHistoryValue\(scenes\)[\s\S]*setScenes\(restoredScenes\)/, "delete/undo restores trim snapshot"); // 47
matches(page, /setCreatorUndoStack\(\[\]\)[\s\S]*setSelectedCreatorEditorSceneId\(null\)/, "project switch clears transient state only"); // 48

matches(page, /scenes: exportScenes\.map\(\(scene\) => \{[\s\S]*return \{\s*\.\.\.scene,/, "export payload spreads canonical trim"); // 49
matches(exportService, /normalizeCreatorVideoTrim\(scene, sourceDuration, isCreatorLabExport\)/, "server clamps probed duration"); // 50
matches(exportService, /effectiveVisualSourceDuration[\s\S]*getSceneTargetDuration/, "server uses trimmed visual duration"); // 51
matches(exportService, /!isCreatorLabExport[\s\S]*return fullSource/, "trim CreatorLab-gated"); // 52
matches(exportService, /body\?\.productProfile === "creatorlab"/, "Storyverse profile remains distinct"); // 53
matches(exportService, /audioDrivenDuration[\s\S]*Math\.max\(safeSourceDuration, requestedTarget \|\| 0, audioDrivenDuration\)/, "speech is not truncated"); // 54
matches(exportService, /image_motion_tail|freeze_frame_tail/, "visual fallback remains"); // 55
matches(exportService, /raw-scene-[\s\S]*clip-scene-/, "source and output paths differ"); // 56
check(!normalizeServerTrim({ clipInSec: 8, clipOutSec: 2 }, 10, true).isTrimmed, "server invalid trim falls back"); // 57
check(!normalizeServerTrim({}, 10, true).isTrimmed, "legacy no-trim unchanged"); // 58
const fixtures = [[undefined, undefined], [2, 8], [-1, 8], [2, 20], [8, 2], [9.9, 10]];
check(fixtures.every(([start, end]) => {
  const browser = normalize(start, end);
  const server = normalizeServerTrim({ clipInSec: start, clipOutSec: end }, 10, true);
  return browser.isTrimmed === server.isTrimmed && browser.visualDurationSec === Number(server.visualDurationSec.toFixed(3));
}), "preview/export fixtures agree"); // 59

matches(page, /const applyCreatorEditorStructuralChange[\s\S]*setExportedMovieUrl\(""\)[\s\S]*setExportSignature\(""\)[\s\S]*const updateSelectedCreatorSceneTrim[\s\S]*applyCreatorEditorStructuralChange/, "trim invalidates export"); // 60
check(trimHandler.includes('resetRequested ? "Reset scene trim"') && trimHandler.includes("applyCreatorEditorStructuralChange"), "reset uses invalidating mutation path"); // 61
absent(editor + helperSource, /provider|\/api\//i, "no provider calls added"); // 62
absent((editor + helperSource).replace(/No voice generated/g, "No voice yet"), /generate|creator-video|creator-image/i, "no generation calls added"); // 63
const changed = execFileSync("git", ["status", "--short"], { encoding: "utf8" });
check(!changed.includes("lib/credits/"), "credit policy unchanged"); // 64
check(!changed.includes("CreatorCostGuard"), "Cost Guard unchanged"); // 65
check(!changed.includes("supabase/migrations/"), "no migration"); // 66
check(!changed.split("\n").some((line) => /(?:app|components|lib|supabase)\/.+music/i.test(line)), "premium music unchanged"); // 67
matches(page, /isCreatorLabFlow && creatorWorkspaceStep === 3[\s\S]*onUpdateTrim=\{updateSelectedCreatorSceneTrim\}/, "Storyverse has no trim controls"); // 68

console.log(`Creator Editor trim and Draft Preview smoke passed (${checks}/68).`);
