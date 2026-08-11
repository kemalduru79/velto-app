import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/create/page.tsx");
const subnav = read("components/create/CreatorProductionSubnav.tsx");
const summary = read("components/create/CreatorProductionSetupSummary.tsx");
const identity = read("lib/creator/characterIdentity.ts");
const music = read("components/create/CreatorBackgroundMusic.tsx");
const exportRoute = read("app/api/creator-export/route.ts");

for (const label of ["Brief", "Strategy", "Production", "Publish"]) {
  assert.match(page, new RegExp(label));
}
assert.match(subnav, /"setup" \| "create_review"/);
assert.match(subnav, /Setup/);
assert.match(subnav, /Create & Review/);
assert.match(subnav, /data-production-substep-selected=\{active \? "true" : "false"\}/);
assert.match(subnav, /border-blue-600 bg-white/);
assert.match(subnav, /border-transparent text-slate-400/);
assert.doesNotMatch(subnav, /fetch\(|credits|provider/i);
assert.match(page, /useState<CreatorProductionSubstep>\("setup"\)/);
assert.match(page, /selectCreatorProductionSubstep\("create_review"\)/);
assert.match(summary, /Edit Setup/);
assert.doesNotMatch(summary, /fetch\(|credits|provider/i);

const setupStart = page.indexOf('data-production-substep="setup"');
const setupEnd = page.indexOf('creatorProductionSubstep === "create_review" && (scenes.length', setupStart);
const setupSource = page.slice(setupStart, setupEnd);
assert.match(setupSource, /Production approach/i);
assert.match(setupSource, /Brand foundation/i);
assert.match(setupSource, /Visual direction/i);
assert.match(setupSource, /Cast & Voices/i);
assert.match(setupSource, /Presenters and personas/i);
assert.match(setupSource, /CreatorBackgroundMusic/);
assert.match(setupSource, /Visual Continuity/);
assert.match(setupSource, /Continue to Create & Review/);
assert.match(setupSource, /data-production-primary-continue="true"/);
assert.match(setupSource, /onClick=\{\(\) => selectCreatorProductionSubstep\("create_review"\)\}/);
assert.doesNotMatch(setupSource, /data-production-primary-continue[\s\S]{0,500}(fetch\(|continueCreatorProduction|credits|provider)/i);
assert.doesNotMatch(setupSource, /Mini Timeline/);
assert.doesNotMatch(setupSource, /Scene workspace/);
assert.doesNotMatch(setupSource, /continueCreatorProduction|creatorlab-production-action/);

assert.match(page, /Default Character Voice/);
assert.match(page, /Project narrator voice/);
assert.match(page, /Browse character voices/);
assert.match(page, /Browse character voices[\s\S]{0,200}border-violet-200 bg-violet-50|border-violet-200 bg-violet-50[\s\S]{0,300}Browse character voices/);
assert.doesNotMatch(page, /No bound speakers|No bound dialogue speakers/);
assert.match(page, /Character voices · Not needed for this project/);
assert.match(page, /Character voices · No character dialogue yet/);
assert.match(page, /Use Default Character Voice/);
assert.match(page, /characterId: character\.id/);
assert.match(page, /character\.id === voiceLibraryTarget\.characterId/);
assert.match(page, /voiceSelection: characterSelection/);
assert.match(page, /speakerCharacterId: scene\?\.dialogueSpeakerCharacterId/);
assert.match(page, /matchingCharacter\?\.voiceSelection[\s\S]*narratorSettings\.dialogueVoiceSelection/);
assert.doesNotMatch(
  page.slice(page.indexOf("const getEffectiveDialogueVoiceProfileId"), page.indexOf("const getVoiceLibraryTargetSelection")),
  /toLocaleLowerCase|characters\[0\]|characterIndex/,
);
assert.match(identity, /resolveCreatorDialogueSpeaker/);
assert.doesNotMatch(identity, /character\.name|characters\[0\]/);
assert.doesNotMatch(page, /multi-track dialogue mixer|speaker segmentation/i);

assert.match(page, /creatorBoundDialogueCharacterIds/);
assert.match(page, /creatorResolvedCharacterVoiceCount/);
assert.match(page, /getCreatorVoiceCreditEstimate\(scenes\)\.totalTracks/);
assert.match(page, /Credits are charged only when generation starts/);

assert.match(page, /CreatorProductionSetupSummary/);
assert.match(summary, /data-production-compact-header/);
assert.doesNotMatch(summary, /Production Setup/);
assert.doesNotMatch(page, /Approved production plan/);
assert.match(page, /data-production-compact-progress/);
assert.match(
  page,
  /const creatorFinalVideoProgressDetail = creatorProductionComplete[\s\S]*?"Ready"[\s\S]*?creatorFinalVideoReadiness\?\.canStartFinalVideo[\s\S]*?"Ready to build"[\s\S]*?"Waiting for assets"/,
);
assert.match(page, /detail: creatorFinalVideoProgressDetail/);
assert.doesNotMatch(
  page,
  /detail: creatorProductionComplete[\s\S]{0,240}"Waiting for assets"/,
);
assert.match(page, /All production assets are ready/);
assert.match(page, /Continue · Build Final Video/);
assert.match(page, /data-production-compact-action/);
assert.match(page, /Mini timeline/i);
assert.match(page, /Dialogue speaker/);
assert.match(page, /scene\.dialogueSpeakerCharacterId/);
assert.match(page, /creatorSceneContinuityModes/);
const createReviewStart = page.indexOf('creatorProductionSubstep === "create_review" && (scenes.length');
const compactHeaderIndex = page.indexOf("<CreatorProductionSetupSummary");
const compactProgressIndex = page.indexOf('data-production-compact-progress="true"', createReviewStart);
const sceneWorkspaceIndex = page.indexOf('id="creatorlab-production-storyboard"', createReviewStart);
assert.ok(compactHeaderIndex >= 0 && compactProgressIndex >= 0 && sceneWorkspaceIndex > compactProgressIndex);
assert.doesNotMatch(page.slice(compactProgressIndex, sceneWorkspaceIndex), /Approved production plan|Production Setup/);

assert.match(page, /if \(value === "setup"\) return "setup"/);
assert.match(page, /if \(value === "review"\) return "create_review"/);
assert.match(page, /onChange=\{selectCreatorProductionSubstep\}/);
assert.doesNotMatch(subnav, /dashboard|overview|assets|timeline/i);

const referencePreviewCssStart = page.indexOf(".creatorlab-cast-reference-image {");
const referencePreviewCssEnd = page.indexOf("}", referencePreviewCssStart);
const referencePreviewCss = page.slice(referencePreviewCssStart, referencePreviewCssEnd + 1);
assert.ok(referencePreviewCssStart >= 0);
assert.match(referencePreviewCss, /width: min\(100%, 380px\)/);
assert.match(referencePreviewCss, /height: auto/);
assert.match(referencePreviewCss, /object-fit: contain/);
assert.doesNotMatch(referencePreviewCss, /object-fit: cover|aspect-ratio|height:\s*\d/);

assert.match(music, /No Music/);
assert.match(music, /Auto Match/);
assert.match(music, /Browse Music/);
assert.match(page, /isCreatorPremiumMusicTrackId/);
assert.match(exportRoute, /creator_premium_music_confirmation_required/);

assert.match(page, /"independent" as const/);
assert.match(page, /"consistent" as const/);
assert.match(page, /"selective" as const/);
assert.match(page, /Independent scenes/);
assert.match(page, /Keep continuity/);
assert.match(page, /Choose per scene/);

assert.match(page, /isCreatorLabFlow && creatorWorkspaceStep === 3/);
assert.match(page, /voiceSelection: narratorSettings\.voiceSelection/);
assert.match(page, /dialogueVoiceSelection: narratorSettings\.dialogueVoiceSelection/);
assert.match(page, /characters,/);
assert.match(page, /scenes: sourceScenes/);

console.log("CreatorLab Production UX consolidation smoke passed (58/58).");
