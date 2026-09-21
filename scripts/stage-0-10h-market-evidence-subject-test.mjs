import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveCreatorMarketEvidenceSubject } from "../lib/creator/marketEvidenceSubject.ts";
import {
  attachCreatorProjectState,
  buildCreatorProjectState,
  readCreatorProjectState,
} from "../lib/creator/projectState.ts";

const detailedBrief = `PROJECT Create the first flagship documentary essay for THYNEL.
BRAND THYNEL Website: thynel.net Social: @thynelmedia
THYNEL POSITIONING: premium documentary essays about memory and identity.
PRODUCTION INSTRUCTIONS: build a thoughtful five-minute film.`;
const recommendedSubject =
  "How reconstructive memory and false memories shape personal identity and self-narrative";
const mentorResult = {
  audienceInsight: [],
  hookPatterns: [],
  videoIdeas: [
    { title: recommendedSubject, concept: "Recommended" },
    { title: "Why your memories rewrite who you are", concept: "Alternative" },
  ],
  recommendedIdea: { title: recommendedSubject, reason: "Focused editorial direction" },
  productionPlan: [],
};

assert.equal(
  resolveCreatorMarketEvidenceSubject({
    briefTopic: detailedBrief,
    selectedDirectionId: "recommended",
    recommendedIdea: mentorResult.recommendedIdea,
    videoIdeas: mentorResult.videoIdeas,
  }),
  recommendedSubject,
  "brand and project metadata must not leak into the Market Evidence subject",
);
assert.equal(
  resolveCreatorMarketEvidenceSubject({
    briefTopic: detailedBrief,
    selectedDirectionId: "alternative-1",
    recommendedIdea: mentorResult.recommendedIdea,
    videoIdeas: mentorResult.videoIdeas,
  }),
  "Why your memories rewrite who you are",
  "the selected canonical strategy direction must update the subject",
);
assert.equal(
  resolveCreatorMarketEvidenceSubject({
    briefTopic: "How does sleep affect memory?",
    selectedDirectionId: "recommended",
  }),
  "How does sleep affect memory?",
  "legacy projects with an already-concise topic must remain supported",
);
assert.equal(
  resolveCreatorMarketEvidenceSubject({
    briefTopic: detailedBrief,
    selectedDirectionId: "recommended",
  }),
  "",
  "metadata-heavy briefs without a canonical direction must fail closed",
);

const snapshot = buildCreatorProjectState({
  brief: {
    topic: detailedBrief,
    language: "en",
    country: "US",
    ageGroup: "adult",
    contentType: "documentary",
    format: "landscape",
    durationPreset: "video_300",
    durationSec: 300,
    customDurationSec: 300,
    qualityMode: "standard",
    targetPlatforms: ["youtube"],
  },
  strategy: {
    mentorResult: {
      ...mentorResult,
      marketEvidence: {
        subject: recommendedSubject,
        videos: [],
        patternSummary: null,
      },
    },
    selectedDirectionId: "recommended",
    selectedHook: "",
    script: null,
  },
  production: {
    package: null,
    refinedScenes: [],
    backgroundMusic: null,
    audioTimeline: null,
    projectContinuityMode: "independent",
    sceneContinuityModes: {},
    voicePreferences: null,
  },
  createReview: { scenes: [] },
  publish: {
    metadata: null,
    thumbnail: null,
    thumbnailDesign: null,
    confirmations: {},
    packageDownloaded: false,
    packageSignature: "",
    finalVideoUrl: "",
    finalVideoSignature: "",
  },
  navigation: { workspaceStep: 2, productionSubstep: "setup" },
});
const restored = readCreatorProjectState({
  exported_movie_result: attachCreatorProjectState({}, snapshot),
  input_prompt: detailedBrief,
});
assert.equal(
  restored?.strategy.mentorResult?.marketEvidence?.subject,
  recommendedSubject,
  "the exact subject used for research must survive project persistence",
);

const page = readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const handler = page.slice(
  page.indexOf("const handleYoutubeResearch = async"),
  page.indexOf("const handleBulkGenerateIdeas = async"),
);
const marketPanel = page.slice(
  page.indexOf('{creatorMarketEvidenceReviewOpen && ('),
  page.indexOf('{isCreatorLabFlow && (creatorStageVisibility.production_setup'),
);
assert.match(handler, /topic: creatorMarketEvidenceSubject/);
assert.match(handler, /subject: creatorMarketEvidenceSubject/);
assert.match(handler, /strategySelection:\s*\{\s*directionId: creatorSelectedStrategyDirectionId,\s*hook: creatorSelectedHookPattern/);
assert.doesNotMatch(handler, /topic: normalizeCreatorTopicAuthority\(input\)/);
assert.match(marketPanel, /<strong>\{creatorMarketEvidenceSubject\}<\/strong>/);
assert.doesNotMatch(marketPanel, /<strong>\{input\.trim\(\)\}<\/strong>/);
assert.match(marketPanel, /youtubeResearchVideos\.length === 0/);
assert.match(marketPanel, /video\.thumbnail \? <img/);
assert.match(marketPanel, /<div className="creatorlab-strategy-empty">/);
assert.match(handler, /catch \(e: any\)[\s\S]*setError\(/);
assert.match(
  page,
  /\.creatorlab-strategy-video-thumb\s*\{[\s\S]*?background: #eceae5;/,
  "missing thumbnails must retain the light neutral placeholder instead of a black panel",
);
assert.doesNotMatch(
  marketPanel,
  /creatorlab-p2c-editor-preview-canvas/,
  "the separate dark media-preview canvas must not be part of Market Evidence",
);

console.log("Stage 0.10H Market Evidence subject test passed.");
