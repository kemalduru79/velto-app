import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const helperSource = read("lib/creator/editorState.ts");
const page = read("app/create/page.tsx");
const editor = read("components/create/CreatorEditor.tsx");
const timeline = read("components/create/CreatorEditorTimeline.tsx");
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const operations = await import(`data:text/javascript;base64,${Buffer.from(helperJs).toString("base64")}`);

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const matches = (source, pattern, message) => check(pattern.test(source), message);
const absent = (source, pattern, message) => check(!pattern.test(source), message);

const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const C = "10000000-0000-4000-8000-000000000003";
const D = "10000000-0000-4000-8000-000000000004";
const rich = (id, creatorSceneId, label) => ({
  id, creatorSceneId, text: label, narration: `${label} narration`, dialogue: `${label} dialogue`,
  dialogueSpeakerCharacterId: "character-1", image: `${label}.png`, videoUrl: `${label}.mp4`,
  audioUrl: `${label}.mp3`, narratorVoiceProfileId: "velto_balanced",
  narratorVoiceSelection: { id: "voice-1", source: "library" },
  assetHistory: [{ id: `${label}-asset`, kind: "image", url: `${label}.png` }],
  timing: { totalAudioDuration: 4 }, continuity: { location: "studio" },
  visualBlockPlan: [{ id: `${id}.1`, durationSec: 4, purpose: "beat", prompt: "prompt" }],
  videoJobId: `${label}-task`, videoQueueJobId: `${label}-queue`, videoStatus: "done",
});
const source = [rich(8, A, "A"), rich(9, B, "B"), rich(10, C, "C")];
const snapshot = structuredClone(source);

const earlier = operations.moveCreatorScene(source, B, "earlier");
check(earlier[0].creatorSceneId === B, "move earlier resolves stable ID"); // 1
const later = operations.moveCreatorScene(source, B, "later");
check(later[2].creatorSceneId === B, "move later resolves stable ID"); // 2
check(earlier[0].creatorSceneId === B, "moved stable ID preserved"); // 3
check(new Set(earlier.map((scene) => scene.creatorSceneId)).size === 3, "other stable IDs preserved"); // 4
check(operations.moveCreatorScene(source, A, "earlier").map((s) => s.creatorSceneId).join() === [A, B, C].join(), "first cannot move earlier"); // 5
check(operations.moveCreatorScene(source, C, "later").map((s) => s.creatorSceneId).join() === [A, B, C].join(), "last cannot move later"); // 6
check(earlier[0].image === "B.png" && earlier[0].videoUrl === "B.mp4", "reorder preserves media"); // 7
check(earlier[0].audioUrl === "B.mp3" && earlier[0].narratorVoiceSelection.id === "voice-1", "reorder preserves audio/voice"); // 8
check(earlier[0].assetHistory[0].id === "B-asset", "reorder preserves asset history"); // 9
check(earlier[0].dialogueSpeakerCharacterId === "character-1", "reorder preserves speaker binding"); // 10
check(earlier.map((scene) => scene.id).join() === "1,2,3", "numeric IDs reordinalize"); // 11
check(earlier.map((scene) => scene.creatorSceneId).join() === [B, A, C].join(), "stable IDs do not reordinalize"); // 12
check(earlier.some((scene) => scene.creatorSceneId === B), "selected stable scene survives move"); // 13

const removedMiddle = operations.removeCreatorScene(source, B);
check(removedMiddle.removed, "delete resolves stable ID"); // 14
check(!removedMiddle.scenes.some((scene) => scene.creatorSceneId === B), "deleted scene absent"); // 15
check(removedMiddle.scenes.map((scene) => scene.creatorSceneId).join() === [A, C].join(), "unrelated IDs unchanged"); // 16
absent(helperSource, /delete.*(?:storage|provider)|(?:storage|provider).*delete/i, "delete does not delete assets"); // 17
check(!operations.removeCreatorScene([source[0]], A).removed, "final scene protected"); // 18
check(removedMiddle.selectedCreatorSceneId === C, "selection moves next"); // 19
check(operations.removeCreatorScene(source, C).selectedCreatorSceneId === B, "selection falls back previous"); // 20
matches(page, /pushCreatorUndoSnapshot\(undoLabel\)[\s\S]*setScenes\(nextScenes\)/, "snapshot precedes mutation"); // 21
matches(page, /const undoLastCreatorChange[\s\S]*setScenes\(restoredScenes\)/, "undo restores canonical scenes"); // 22
matches(page, /selectedCreatorSceneId: selectedCreatorEditorSceneId[\s\S]*selectCreatorSceneId\(restoredScenes, entry\.selectedCreatorSceneId\)/, "undo restores stable selection"); // 23
matches(page, /scenes: cloneCreatorHistoryValue\(scenes\)/, "undo snapshots rich scene state"); // 24
matches(page, /productionPackage[\s\S]*refinedScenes[\s\S]*setRefinedCreatorScenes/, "undo restores order projections"); // 25

const duplicated = operations.duplicateCreatorScene(source, B, () => D);
check(duplicated.scenes[2].creatorSceneId === D, "duplicate inserted after source"); // 26
check(duplicated.scenes[2].creatorSceneId !== B, "duplicate gets new stable ID"); // 27
check(duplicated.scenes[1].creatorSceneId === B, "original ID unchanged"); // 28
check(duplicated.scenes[2].text === "B" && duplicated.scenes[2].dialogue === "B dialogue", "duplicate content preserved"); // 29
check(duplicated.scenes[2].image === "B.png" && duplicated.scenes[2].audioUrl === "B.mp3", "completed media reused"); // 30
check(duplicated.scenes[2].videoJobId === "", "provider task ID cleared"); // 31
check(duplicated.scenes[2].videoQueueJobId === "", "queue identity cleared"); // 32
absent(duplicated.scenes[2].creatorSceneId, /B-task|B-queue/, "paid identity not copied into stable ID"); // 33
const processingDuplicate = operations.duplicateCreatorScene([{ ...source[1], videoStatus: "processing" }], B, () => D);
check(processingDuplicate.scenes[1].videoStatus === "idle", "processing state reset"); // 34
check(duplicated.selectedCreatorSceneId === D, "duplicate becomes selected"); // 35
check(duplicated.scenes.map((scene) => scene.id).join() === "1,2,3,4", "duplicate reordinalizes safely"); // 36
matches(page, /projectCreatorEditorScenes\(nextScenes\)[\s\S]*scenes: nextProjection/, "duplicate reaches save projection"); // 37

check(JSON.stringify(source) === JSON.stringify(snapshot), "operations mutate no input"); // 38
matches(page, /setScenes\(nextScenes\)[\s\S]*setCreatorProductionPackage/, "canonical scenes remain authority"); // 39
matches(page, /scenes: nextProjection/, "production package follows order"); // 40
matches(page, /setRefinedCreatorScenes\(\(prev\)[\s\S]*nextProjection/, "refined projection follows order"); // 41
matches(page, /const secondBase: Scene = \{[\s\S]*creatorSceneId: createCreatorSceneId\(\)/, "split remains stable-ID-safe"); // 42
matches(page, /setCreatorTimelinePreviewPlan\(null\)[\s\S]*setCreatorEditPlan\(null\)/, "timeline projections invalidated without generation"); // 43

matches(editor, /Scene Actions|Sahne İşlemleri/, "selected scene actions exist"); // 44
matches(editor, /onMoveScene\("earlier"\)[\s\S]*disabled=\{selectedIndex <= 0\}/, "Move Earlier boundary disabled"); // 45
matches(editor, /onMoveScene\("later"\)[\s\S]*disabled=\{selectedIndex < 0 \|\| selectedIndex >= scenes\.length - 1\}/, "Move Later boundary disabled"); // 46
matches(editor, /onDuplicateScene[\s\S]*Duplicate/, "Duplicate action exists"); // 47
matches(editor, /onDeleteScene[\s\S]*Delete/, "Delete action exists"); // 48
matches(editor, /canUndo && \([\s\S]*onClick=\{onUndo\}/, "Undo action is conditional"); // 49
check((editor.match(/<button/g) || []).length >= 5 && (editor.match(/aria-label=/g) || []).length >= 6, "actions use accessible buttons"); // 50
absent(editor + timeline, /onDrag|draggable|sortable|dnd/i, "no drag/drop dependency"); // 51
absent(editor + timeline, /trim/i, "no trim controls"); // 52
absent(editor, /textarea|voice editor|onChange=/i, "no text/voice editor"); // 53

const operationBlock = page.slice(page.indexOf("const applyCreatorEditorStructuralChange"), page.indexOf("const toggleCreatorAssetCompare"));
absent(operationBlock, /fetch\(|\/api\/|generate/i, "operations call no generation route"); // 54
absent(operationBlock, /provider/i, "operations call no provider"); // 55
absent(operationBlock, /credit|reserve|CreatorCostGuard/i, "operations reserve no credits"); // 56
const changed = execFileSync("git", ["status", "--short"], { encoding: "utf8" });
check(!changed.includes("lib/credits/") && !changed.includes("CreatorCostGuard"), "Cost Guard policy unchanged"); // 57
check(!changed.includes("export-service/"), "export-service unchanged"); // 58
check(!changed.includes("supabase/migrations/"), "no migration"); // 59
check(!changed.toLowerCase().includes("music"), "premium music unchanged"); // 60
matches(page, /isCreatorLabFlow && creatorWorkspaceStep === 3[\s\S]*onMoveScene=\{moveSelectedCreatorEditorScene\}/, "Storyverse operations absent"); // 61
matches(page, /setCreatorUndoStack\(\[\]\)[\s\S]*setSelectedCreatorEditorSceneId\(null\)[\s\S]*setCreatorEditorOpen\(false\)/, "project boundary resets operation state"); // 62

console.log(`Creator Editor scene operations smoke passed (${checks}/62).`);
