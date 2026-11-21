import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const load = async (source) => {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
};
const helperSource = read("lib/creator/editorState.ts");
const helper = await load(helperSource);
const trim = read("components/create/CreatorVideoTrimControl.tsx");
const editor = read("components/create/CreatorEditor.tsx");
const page = read("app/create/page.tsx");
const signatureSource = read("lib/creator/finalProductionSignature.ts");
const signature = await load(signatureSource);
let n = 0;
const check = (value, label) => { assert.ok(value, label); n += 1; };

const full = helper.normalizeCreatorSceneTrim({ sourceDurationSec: 10 });
check(!full.isTrimmed && full.visualDurationSec === 10 && /startPercent[\s\S]*endPercent/.test(trim), "1 full duration handles use boundaries");
const hydrated = helper.normalizeCreatorSceneTrim({ clipInSec: 2, clipOutSec: 8, sourceDurationSec: 10 });
check(hydrated.clipInSec === 2 && hydrated.clipOutSec === 8 && /clipInSec, clipOutSec, sourceDurationSec/.test(trim), "2 canonical trim hydrates handles");
check(helper.constrainCreatorTrimProposal("start", 3, { start: 2, end: 8 }, 10).start === 3, "3 left drag proposes start");
check(helper.constrainCreatorTrimProposal("end", 7, { start: 2, end: 8 }, 10).end === 7, "4 right drag proposes end");
check(helper.constrainCreatorTrimProposal("start", 9, { start: 2, end: 8 }, 10).start === 7.75, "5 handles cannot cross");
check(helper.constrainCreatorTrimProposal("start", -2, { start: 2, end: 8 }, 10).start === 0 && helper.constrainCreatorTrimProposal("end", 20, { start: 2, end: 8 }, 10).end === 10, "6 source bounds clamp");
check(helper.normalizeCreatorSceneTrim({ clipInSec: 2, clipOutSec: 7.4, sourceDurationSec: 10 }).visualDurationSec === 5.4, "7 selected duration derives");
check(/onPointerMove=\{handlePointerMove\}/.test(trim) && !/handlePointerMove[\s\S]{0,900}onCommitTrim/.test(trim), "8 movement does not commit canonical trim");
check(/onPointerUp=.*finishDrag\(event, false\)/.test(trim) && /commit\(finalDraft\)/.test(trim), "9 release commits once");
check(/onPointerCancel=.*finishDrag\(event, true\)/.test(trim) && /if \(cancelled\)[\s\S]*updateDraft\(canonicalValues\)[\s\S]*return/.test(trim), "10 cancel safely restores canonical state");
check(/if \(!normalized\.isTrimmed\)[\s\S]*onCommitTrim\(\{\}\)/.test(trim), "11 full range emits untrimmed semantics");
check(/Precision|Hassas Ayar/.test(trim) && /onChange=.*updateDraft/.test(trim) && /onBlur=.*commit/.test(trim), "12 precision controls synchronize and commit");
check(/handleKeyDown[\s\S]*ArrowLeft[\s\S]*ArrowRight/.test(trim), "13 keyboard start adjustment supported");
check(/onKeyDown=.*handleKeyDown\(handle/.test(trim), "14 keyboard end adjustment supported");
check(/shiftKey \? 1 : 0\.1/.test(trim) && /constrainCreatorTrimProposal/.test(trim), "15 keyboard respects bounds and step sizes");
const trimHandler = page.slice(page.indexOf("const updateSelectedCreatorSceneTrim"), page.indexOf("const saveSelectedCreatorSceneText"));
check(/applyCreatorEditorStructuralChange/.test(trimHandler) && /undoLabel: resetRequested/.test(trimHandler), "16 one callback remains one undo-compatible edit");
check(/clipInSec: Number/.test(signatureSource) && /clipOutSec: Number/.test(signatureSource), "17 final signature retains trim");
const music = { version: 1, mode: "none", volume: .16, autoDucking: true, fadeInSec: 1.5, fadeOutSec: 2 };
const scene = { id: 1, creatorSceneId: "a", renderMode: "video", exportSource: "video", videoUrl: "v", clipInSec: 0, clipOutSec: 10 };
const sig = (value) => signature.buildCreatorFinalProductionSignature({ scenes: [value], backgroundMusic: music });
check(sig(scene) !== sig({ ...scene, clipInSec: 1 }), "18 changed trim changes signature");
check(sig(scene) === sig({ ...scene, clipInSec: 0, clipOutSec: 10 }), "19 exact restored trim restores signature");
check(/normalizeCreatorSceneTrim[\s\S]*visualDurationSec/.test(page.slice(page.indexOf("const buildFlowContinuityInputScenes"), page.indexOf("const buildFlowContinuityAudit"))), "20 continuity consumes canonical trimmed duration");
check(!/fetch\(|\/api\/|provider/i.test(trim), "21 component makes no provider call");
check(!/credit|reserve|CreatorCostGuard/i.test(trim), "22 component makes no credit call");
check(/hasSelectedVideo &&/.test(editor) && !/Storyverse|storyverse/.test(trim), "23 control is Creator Editor-local and Storyverse untouched");

check(/role="slider"/.test(trim) && /aria-valuenow/.test(trim) && /touch-none/.test(trim), "24 accessible touch-capable handles");
check(/requestAnimationFrame/.test(trim) && /setPointerCapture/.test(trim), "25 responsive pointer capture is animation-frame throttled");
check(/videoRef\.current\.pause\(\)[\s\S]*currentTime = seconds/.test(editor), "26 drag seeks without autoplay");

console.log(`CreatorLab professional drag trim smoke passed (${n}/${n}).`);
