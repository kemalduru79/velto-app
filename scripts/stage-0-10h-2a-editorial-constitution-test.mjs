import assert from "node:assert/strict";
import {
  DEFAULT_CREATOR_EDITORIAL_CONSTITUTION,
  createCreatorEditorialContext,
  hasCreatorProfileContext,
  parseCreatorProfile,
} from "../lib/creator/creatorProfile.ts";

const legacy = parseCreatorProfile({
  brandName: "Velto Channel",
  brandVoice: "Calm, analytical and human",
  defaultAudience: "Adults interested in technology and society",
  defaultVisualStyle: "Premium faceless documentary essay",
  defaultCountry: "global",
  defaultFormat: "youtube_video",
  defaultQualityMode: "pro",
  defaultCreditPreference: "balanced",
});

assert.deepEqual(
  legacy.editorialConstitution,
  DEFAULT_CREATOR_EDITORIAL_CONSTITUTION,
  "Legacy v1 creator profiles must remain backward-compatible.",
);
assert.equal(hasCreatorProfileContext(legacy), true);

const profile = parseCreatorProfile({
  editorialConstitution: {
    mission: "Investigate consequential ideas through evidence and human outcomes.",
    audiencePromise: "Separate what is known, argued, forecast, and speculative.",
    editorialPointOfView: "Curious, rigorous, non-sensational documentary essay.",
    evidencePolicy: "anything_goes",
    uncertaintyPolicy: "hide_uncertainty",
    counterEvidencePolicy: "ignore_counterevidence",
    sensationalismPolicy: "maximize_hype",
  },
});

assert.equal(
  profile.editorialConstitution.mission,
  "Investigate consequential ideas through evidence and human outcomes.",
);
assert.equal(profile.editorialConstitution.evidencePolicy, "evidence_first");
assert.equal(profile.editorialConstitution.uncertaintyPolicy, "label_and_scope");
assert.equal(
  profile.editorialConstitution.counterEvidencePolicy,
  "seek_material_counterevidence",
);
assert.equal(profile.editorialConstitution.sensationalismPolicy, "no_overclaiming");

const context = createCreatorEditorialContext(profile);
assert.match(context, /Editorial mission:/);
assert.match(context, /Audience promise:/);
assert.match(context, /Editorial point of view:/);
assert.match(context, /ground factual claims in traceable evidence/);
assert.match(context, /label and scope uncertainty/);
assert.match(context, /seek material counter-evidence/);
assert.match(context, /do not overclaim/);
assert.equal(hasCreatorProfileContext(profile), true);

const oversized = parseCreatorProfile({
  editorialConstitution: {
    mission: "x".repeat(800),
    audiencePromise: "y".repeat(800),
    editorialPointOfView: "z".repeat(800),
  },
});
assert.equal(oversized.editorialConstitution.mission.length, 500);
assert.equal(oversized.editorialConstitution.audiencePromise.length, 400);
assert.equal(oversized.editorialConstitution.editorialPointOfView.length, 500);

console.log("Stage 0.10H-2A editorial constitution tests passed.");
