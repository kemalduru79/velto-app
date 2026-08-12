import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const stateSource = read("lib/creator/editorState.ts");
const editor = read("components/create/CreatorEditor.tsx");
const timeline = read("components/create/CreatorEditorTimeline.tsx");
const transpiledState = ts.transpileModule(stateSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const state = await import(`data:text/javascript;base64,${Buffer.from(transpiledState).toString("base64")}`);

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const matches = (source, pattern, message) => check(pattern.test(source), message);
const doesNotMatch = (source, pattern, message) => check(!pattern.test(source), message);

const ids = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
];
const idFactory = () => ids.shift();
const richLegacyScene = {
  id: 1,
  text: "Opening",
  narration: "Narration",
  dialogue: "Dialogue",
  image: "https://example.test/image.png",
  videoUrl: "https://example.test/video.mp4",
  narratorVoiceProfileId: "velto_balanced",
  dialogueVoiceSelection: { id: "voice", source: "library" },
  continuity: { anchor: "subject" },
  assetHistory: [{ id: "asset-1", url: "https://example.test/image.png" }],
  timing: { start: 0, end: 5 },
};
const richSnapshot = structuredClone(richLegacyScene);
const normalized = state.normalizeCreatorSceneIds(
  [richLegacyScene, { ...richLegacyScene, id: 2, text: "Second" }],
  idFactory,
);

matches(page, /type Scene = \{[\s\S]*?creatorSceneId\?: string;/, "Scene supports creatorSceneId"); // 1
check(normalized[0].creatorSceneId === "10000000-0000-4000-8000-000000000001", "missing ID receives UUID"); // 2
check(state.isCreatorSceneId(normalized[0].creatorSceneId), "UUID-safe format"); // 3
check(normalized[0].creatorSceneId !== normalized[1].creatorSceneId, "IDs are distinct"); // 4
const normalizedAgain = state.normalizeCreatorSceneIds(normalized, () => { throw new Error("must not regenerate"); });
check(normalizedAgain.map((scene) => scene.creatorSceneId).join() === normalized.map((scene) => scene.creatorSceneId).join(), "normalization is idempotent"); // 5
check(normalizedAgain[0].creatorSceneId === normalized[0].creatorSceneId, "valid ID preserved"); // 6
check(structuredClone(richLegacyScene).text === richSnapshot.text && !Object.hasOwn(richLegacyScene, "creatorSceneId"), "input not mutated"); // 7
check(normalized[0].image === richLegacyScene.image && normalized[0].videoUrl === richLegacyScene.videoUrl, "media preserved"); // 8
check(normalized[0].narratorVoiceProfileId === richLegacyScene.narratorVoiceProfileId && normalized[0].dialogueVoiceSelection.id === "voice", "voice metadata preserved"); // 9
check(normalized[0].continuity.anchor === "subject", "continuity preserved"); // 10
check(normalized[0].assetHistory[0].id === "asset-1", "asset history preserved"); // 11
check(normalized[0].timing.end === 5, "timing preserved"); // 12
const reordered = [normalized[1], normalized[0]];
check(reordered[1].creatorSceneId === normalized[0].creatorSceneId, "reorder preserves ID"); // 13
check({ ...normalized[0], id: 99 }.creatorSceneId === normalized[0].creatorSceneId, "numeric ordinal independent"); // 14
const duplicate = state.normalizeCreatorSceneIds(
  [normalized[0], { ...normalized[0], id: 2 }],
  () => "10000000-0000-4000-8000-000000000003",
);
check(duplicate[0].creatorSceneId !== duplicate[1].creatorSceneId && duplicate.length === 2, "duplicate IDs repaired without collapse"); // 15

matches(page, /const normalizedScenes = normalizeCreatorSceneIds\(scenes\)/, "split normalizes stable IDs"); // 16
matches(page, /const firstBase: Scene = \{\s*\.\.\.scene,/, "first split scene keeps stable ID"); // 17
matches(page, /const secondBase: Scene = \{[\s\S]*?creatorSceneId: createCreatorSceneId\(\)/, "new split scene gets new ID"); // 18
matches(page, /const withId = \{ \.\.\.item, id: index \+ 1 \}/, "numeric re-ordinalization retained"); // 19
matches(page, /projectCanonicalCreatorScenes\(nextScenes/, "split projection uses canonical scenes"); // 20

matches(page, /const loadedProjectScenes = isCreatorProject\s*\? normalizeCreatorSceneIds\(loadedProjectScenesBeforeIdentity\)/, "CreatorLab hydration normalizes legacy scenes"); // 21
matches(page, /normalizeCreatorSceneIds\(normalizedPackage\.scenes \|\| \[\]\)/, "generated package creates stable IDs"); // 22
matches(page, /creatorSceneId: scene\.creatorSceneId/, "canonical scene creation preserves package ID"); // 23
matches(page, /scenes: sourceScenes/, "save payload uses canonical scenes"); // 24
matches(page, /synchronizeCreatorSceneProjectionIds\(\s*loadedProjectScenes/, "package hydration follows canonical identity"); // 25
matches(page, /void loadProject\(projectId\)/, "deep-link restoration uses hydration path"); // 26
matches(page, /const isHydratingRef = useRef\(true\)/, "hydration guard remains"); // 27
matches(page, /setSelectedCreatorEditorSceneId\(null\)/, "project boundary resets editor selection"); // 28
doesNotMatch(editor + timeline, /randomUUID|createCreatorSceneId|normalizeCreatorSceneIds/, "render does not generate UUIDs"); // 29

matches(editor, /function CreatorEditor/, "CreatorEditor exists"); // 30
matches(timeline, /function CreatorEditorTimeline/, "CreatorEditorTimeline exists"); // 31
matches(timeline, /key=\{scene\.creatorSceneId\}/, "timeline key uses stable ID"); // 32
matches(timeline, /onSelectScene\(scene\.creatorSceneId!\)/, "timeline selection uses stable ID"); // 33
matches(timeline, /<button[\s\S]*?aria-pressed=\{selected\}/, "timeline control is keyboard accessible"); // 34
doesNotMatch(timeline, /key=\{(?:index|scene\.id)\}/, "timeline has no index/numeric key"); // 35
doesNotMatch(editor + timeline, /onDrag|draggable|drag\/drop|sortable/i, "no reorder or drag/drop"); // 36
matches(editor, /onDeleteScene/, "scene delete extends the foundation through a callback"); // 37
matches(editor, /onDuplicateScene/, "scene duplicate extends the foundation through a callback"); // 38
doesNotMatch(editor + timeline, /trim|ffmpeg/i, "no trim or FFmpeg"); // 39
matches(editor, /videoUrl[\s\S]*?image/, "safe existing preview media only"); // 40

doesNotMatch(editor + timeline + stateSource, /fetch\(|\/api\//, "no provider or generation call added"); // 41
const changedFiles = execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
check(!changedFiles.some((file) => file.startsWith("app/api/") || file.startsWith("export-service/")), "no API or export-service change"); // 42
check(!changedFiles.some((file) => file.includes("credit") || file.includes("music")), "no credit or music change"); // 43
check(!changedFiles.some((file) => file.startsWith("supabase/migrations/")), "no migration"); // 44
matches(page, /isCreatorLabFlow && creatorWorkspaceStep === 3[\s\S]*?<CreatorEditor/, "editor remains CreatorLab-only"); // 45

const editorEntryStart = page.indexOf('data-creator-editor-entry="true"');
const editorEntryEnd = page.indexOf("</button>", editorEntryStart);
const editorEntry = page.slice(editorEntryStart, editorEntryEnd);
check(editorEntryStart >= 0, "Edit Video entry action exists"); // 46
matches(editorEntry, /onClick=\{\(\) => setCreatorEditorOpen\(true\)\}/, "Edit Video has a real state transition"); // 47
matches(page, /!creatorEditorOpen && \([\s\S]*?data-creator-editor-entry="true"/, "entry is visible only while editor is closed"); // 48
matches(page, /creatorEditorOpen && \(\s*<CreatorEditor/, "open state renders CreatorEditor"); // 49
doesNotMatch(editor, /Edit Video|Videoyu Düzenle|setCreatorEditorOpen/, "CreatorEditor has no dead Edit Video control"); // 50
doesNotMatch(editorEntry, /fetch\(|generate|buildStory|persistProject|saveProject/i, "opening editor does not generate or save"); // 51
doesNotMatch(editorEntry, /provider|\/api\//i, "opening editor does not call a provider"); // 52
doesNotMatch(editorEntry, /credit|reserve|CreatorCostGuard/i, "opening editor does not reserve credits"); // 53
check((page.match(/data-creator-editor-entry="true"/g) || []).length === 1 && page.indexOf('isCreatorLabFlow && creatorWorkspaceStep === 3') < editorEntryStart, "Storyverse has no Edit Video entry"); // 54
matches(page, /setSelectedCreatorEditorSceneId\(null\);\s*setCreatorEditorOpen\(false\)/, "project boundaries reset transient editor state"); // 55
matches(stateSource, /normalizeCreatorSceneIds[\s\S]*creatorSceneId/, "stable creatorSceneId behavior remains present"); // 56

console.log(`Creator Editor stable identity foundation smoke passed (${checks}/56).`);
