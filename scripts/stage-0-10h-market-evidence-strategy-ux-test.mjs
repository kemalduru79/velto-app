import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const cardStart = page.indexOf('{uiLanguage === "en" ? "Market evidence"');
const cardEnd = page.indexOf('className="creatorlab-strategy-signal-card is-decision"', cardStart + 1);
const card = page.slice(cardStart, cardEnd);
const researchHandler = page.slice(
  page.indexOf("const handleYoutubeResearch = async"),
  page.indexOf("const handleYoutubePatternEngine = async"),
);
const strategySection = page.slice(
  page.indexOf('{isCreatorLabFlow && creatorStageVisibility.strategy && creatorMentorResult'),
  page.indexOf('{isCreatorLabFlow && (creatorStageVisibility.production_setup'),
);
const approvalAction = strategySection.slice(
  strategySection.indexOf("onClick={handleCreatorProductionPackage}") - 180,
  strategySection.indexOf("onClick={handleCreatorProductionPackage}") + 520,
);

assert.match(card, /"Not added"/);
assert.match(card, /"Included"/);
assert.match(card, /"Add market evidence"/);
assert.match(card, /"Review"/);
assert.match(card, /Optional market and trend signals to strengthen positioning/);
assert.doesNotMatch(card, />Optional</);
assert.doesNotMatch(card, /Research optional|Exa|OpenAI|provider/i);

assert.match(researchHandler, /fetch\("\/api\/youtube-research"/);
assert.match(researchHandler, /marketEvidence:\s*\{\s*videos: relevantVideos/);
assert.match(researchHandler, /persistProject\(false, \{ creatorMentorResult: nextMentorResult \}\)/);
assert.doesNotMatch(researchHandler, /\/api\/creator-research|\/api\/creator-editorial-analysis/);
assert.match(page, /loadedMentorResult\?\.marketEvidence\?\.videos/);
assert.match(page, /loadedMentorResult\?\.marketEvidence\?\.patternSummary/);

assert.match(strategySection, /onClick=\{handleCreatorProductionPackage\}/);
assert.match(strategySection, /Approve Strategy & Build Scenes/);
assert.doesNotMatch(approvalAction, /youtubeResearchVideos|youtubePatternSummary/);
assert.match(page, /creatorStageAfterSuccess\(current, "brief_completed"\)/);
assert.match(page, /creatorStageAfterSuccess\(current, "strategy_approved"\)/);

console.log("Stage 0.10H Market Evidence Strategy UX test passed.");
