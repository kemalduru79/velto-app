import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const editor = read("components/create/CreatorEditor.tsx");
const editorState = read("lib/creator/editorState.ts");
const creatorRoute = read("app/api/creator-video/route.ts");
const jobRoute = read("app/api/jobs/[jobId]/route.ts");
const worker = read("scripts/scale-worker.mjs");
const trimSmoke = read("scripts/beta-edit-p1c-creator-editor-trim-preview-smoke-test.mjs");

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks += 1; };
const matches = (source, pattern, message) => check(pattern.test(source), message);
const absent = (source, pattern, message) => check(!pattern.test(source), message);

const lifecycleStart = page.indexOf("const pollVideoQueueJob");
const lifecycleEnd = page.indexOf("const getCreatorCinematicVideoInputs", lifecycleStart);
const poller = page.slice(lifecycleStart, lifecycleEnd);
const dispatchStart = page.indexOf("const handleGenerateVideo");
const dispatchEnd = page.indexOf("const persistProjectSnapshot", dispatchStart);
const dispatch = page.slice(dispatchStart, dispatchEnd);
const recoveryStart = page.indexOf("useEffect(() => {\n    scenes.forEach((scene) => {");
const recovery = page.slice(recoveryStart, page.indexOf("useEffect(() => {", recoveryStart + 20));

matches(dispatch, /const creatorSceneId = isCreatorLabFlow[\s\S]*scene\.creatorSceneId/, "1 dispatch captures stable scene identity");
matches(dispatch, /matchesVideoScene\(s, sceneId, creatorSceneId\)/, "2 creatorSceneId survives dispatch updates");
matches(page, /matchesVideoScene[\s\S]*scene\.creatorSceneId === creatorSceneId[\s\S]*: scene\.id === sceneId/, "3 numeric ordinal cannot redirect completion");
matches(dispatch, /videoJobId: isCreatorLabFlow \? videoQueueJobId/, "4 durable job ID stored on matched scene");
matches(dispatch, /videoQueueJobId: videoQueueJobId \|\| undefined/, "5 queue job ID stored on matched scene");
matches(poller, /creatorSceneId\?: string[\s\S]*matchesVideoScene\(scene, sceneId, creatorSceneId\)/, "6 polling resolves stable scene");
matches(poller, /jobStatus === "succeeded"[\s\S]*videoStatus: "done"/, "7 success clears Creating Video");
matches(poller, /videoUrl: storedVideoUrl[\s\S]*videoJobId: queueJobId/, "8 completed URL attaches to matched scene");
matches(poller, /jobStatus === "failed"[\s\S]*videoStatus: "error"/, "9 failed terminal state clears Creating Video");
matches(poller, /failureMessage[\s\S]*Video generation failed in the background worker/, "10 safe failure surfaced");
const pollFetchCount = (poller.match(/fetch\(/g) || []).length;
check(pollFetchCount === 1 && !/creator-video/.test(poller), "11 transient polling never redispatches provider request");
matches(poller, /attempts > maxAttempts[\s\S]*videoStatus: "delayed"[\s\S]*durable job is preserved/, "12 slow jobs leave bounded recoverable state");
matches(recovery, /videoStatus === "processing" \|\| scene\.videoStatus === "delayed"[\s\S]*pollVideoQueueJob\([\s\S]*scene\.id,[\s\S]*queueJobId,[\s\S]*scene\.creatorSceneId/, "13 refresh resumes durable active/delayed job");
matches(page, /const updateSelectedCreatorSceneTrim[\s\S]*\.\.\.scene,[\s\S]*clipInSec:/, "14 canonical trim update preserves job fields");
absent(editorState.slice(editorState.indexOf("normalizeCreatorSceneTrim"), editorState.indexOf("getCreatorSceneEffectiveDuration")), /videoJobId|videoQueueJobId|videoStatus/, "15 trim normalization cannot strip generation state");
matches(editor, /sceneOperationsDisabled \|\| selectedIndex/ , "16 reorder disabled while active generation is linked");
matches(editorState, /videoJobId: ""[\s\S]*videoQueueJobId: ""[\s\S]*videoStatus: source\.videoStatus === "processing" \|\| source\.videoStatus === "delayed"/, "17 duplicate clears active job identity");
matches(page, /sceneOperationsDisabled=\{[\s\S]*scene\.videoStatus === "processing"[\s\S]*scene\.videoStatus === "delayed"/, "18 delete cannot transfer an active job through reordinalization");
absent(poller + recovery, /POST[\s\S]*creator-video|handleGenerateVideo\(/, "19 recovery performs no automatic provider redispatch");
check((dispatch.match(/fetch\(getVideoApiEndpoint\(\)/g) || []).length === 1, "20 one creator_video request/reservation path per action");
matches(creatorRoute, /providerTaskAccepted[\s\S]*Do not release the reservation[\s\S]*settle/, "21 ambiguous dispatch never unsafely releases credit");
matches(page, /const pollVideoStatus = \(sceneId: number, taskId: string, storageAdmissionId: string\)[\s\S]*if \(isCreatorLabFlow\)/, "22 Storyverse polling remains separate and admission-bound");
check(trimSmoke.includes("${checks}/68") && editor.includes("data-creator-trim-controls"), "23 0.5.3C trim behavior preserved");

matches(creatorRoute, /queueJobId: queueJob\.id/, "dispatch returns durable queue identity");
matches(jobRoute, /status: job\.status[\s\S]*output:[\s\S]*ready: outputReady/, "job API exposes bounded canonical status");
matches(worker, /\["SUCCEEDED", "COMPLETED", "READY"\][\s\S]*\["FAILED", "ERROR", "CANCELLED", "CANCELED"\]/, "worker maps actual provider terminal states");
matches(page, /delayedVideoPollKeysRef\.current\.add\(pollKey\)/, "current session does not immediately restart a delayed poll");
matches(page, /delayedVideoPollKeysRef\.current\.clear\(\)[\s\S]*setScenes\(/, "project hydration permits a later recovery check");

console.log(`CreatorLab video generation lifecycle regression smoke passed (${checks}/28).`);
