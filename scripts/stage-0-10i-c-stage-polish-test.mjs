import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const polish = fs.readFileSync(new URL("../app/creatorlab-ux-i-c.css", import.meta.url), "utf8");
const critical = fs.readFileSync(new URL("./stage-0-8a-critical-regression.mjs", import.meta.url), "utf8");

assert.match(layout, /import "\.\/creatorlab-ux-i-b\.css";\s*import "\.\/creatorlab-ux-i-c\.css";/);
assert.match(polish, /\.creatorlab-premium-surface/);
assert.doesNotMatch(polish, /:root|--cl-[\w-]+\s*:/, "I-C consumes rather than duplicates canonical tokens");
assert.doesNotMatch(polish, /#[0-9a-f]{3,8}/i, "I-C adds no decorative color palette");
assert.doesNotMatch(polish, /(?:OpenAI|Exa|Pexels|Runway|Azure)/i, "providers remain backstage");
assert.doesNotMatch(polish, /storyverse/i, "polish remains scoped through the CreatorLab surface");

// Brief retains every functional surface while establishing one visual hierarchy.
for (const contract of [
  /<CreatorOutcomeStart/,
  /id="creatorlab-topic-input"/,
  /id="creatorlab-brand-memory"/,
  /id="creatorlab-brief-settings"/,
  /creatorlab-brief-core-grid/,
  /creatorlab-format-choice-grid/,
  /creatorlab-platform-choice-grid/,
  /id="creatorlab-brief-action"/,
  /ui\.analyzeContentOpportunity/,
]) assert.match(page, contract);
assert.match(polish, /creatorlab-uxp2a-outcome-grid[\s\S]*?grid-template-columns/);
assert.match(polish, /creatorlab-topic-card[\s\S]*?var\(--cl-shadow-surface\)/);
assert.match(polish, /creatorlab-brand-memory[\s\S]*?var\(--cl-surface-muted\)/);

// Strategy recommendation, hooks, alternatives, optional evidence and empty state remain intact.
for (const contract of [
  /id="creatorlab-strategy-recommendation"/,
  /creatorlab-strategy-hook-options/,
  /creatorStrategyAlternativeDirections\.map/,
  /Add market evidence/,
  /creatorMarketEvidenceReviewOpen/,
  /Approve Strategy & Build Scenes/,
  /Strategy is not ready yet/,
  /Return to Brief/,
]) assert.match(page, contract);
assert.match(polish, /creatorlab-strategy-recommendation\.is-selected[\s\S]*?var\(--cl-primary\)/);
assert.match(polish, /creatorlab-strategy-hook-selector[\s\S]*?var\(--cl-info-soft\)/);
assert.match(polish, /#creatorlab-strategy-youtube[\s\S]*?var\(--cl-surface-muted\)/);
assert.match(page, /data-project-load-feedback=/);

// Production Setup keeps canonical recommendations, customization, controls and premium confirmation.
for (const contract of [
  /creatorlab-setup-recommendation/,
  /creatorlab-setup-summary-grid/,
  /id="creatorlab-production-customize"/,
  /creatorlab-setup-group/,
  /creatorMusicConfirmationRequired/,
  /Continue to Create & Review/,
]) assert.match(page, contract);
assert.match(polish, /creatorlab-setup-recommendation[\s\S]*?var\(--cl-accent-border\)/);
assert.match(polish, /creatorlab-setup-customize:not|creatorlab-setup-customize/);

// Presentation work cannot introduce product calls, economics, persistence, or workflow transitions.
assert.doesNotMatch(polish, /fetch\(|\/api\/|credits?|economics|localStorage|supabase/i);
assert.match(critical, /scripts\/stage-0-10i-c-stage-polish-test\.mjs/);

console.log("STAGE_0_10I_C_STAGE_POLISH=PASS");
