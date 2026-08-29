import assert from "node:assert/strict";
import fs from "node:fs";
import { createCreatorSourceMediaUsage } from "../lib/creator/sourceMediaUsage.ts";
import { normalizeCreatorSourceMediaMetadata } from "../lib/creator/sourceMedia.ts";

const fullVideo = normalizeCreatorSourceMediaMetadata({
  sourceMediaKind: "video",
  sourceUrl: "https://example.com/full-video",
  publisher: "Example",
  rightsState: "review_required",
  sourceDurationSec: 20,
});

const trimmed = createCreatorSourceMediaUsage({
  sourceMedia: fullVideo,
  sceneTrim: { clipInSec: 2.5, clipOutSec: 8.75 },
  sceneSourceDurationSec: 20,
});
assert.equal(trimmed.isTrimmed, true);
assert.equal(trimmed.visualDurationSec, 6.25);
assert.equal(trimmed.sourceMedia.timecodeStartSec, 2.5);
assert.equal(trimmed.sourceMedia.timecodeEndSec, 8.75);
assert.equal(trimmed.sourceMedia.sourceDurationSec, 20);
assert.equal(trimmed.sourceMedia.rightsState, "review_required");

const excerpt = normalizeCreatorSourceMediaMetadata({
  sourceMediaKind: "video",
  sourceUrl: "https://example.com/original-video",
  publisher: "Example",
  rightsState: "review_required",
  sourceDurationSec: 100,
  timecodeStartSec: 40,
  timecodeEndSec: 50,
});
const excerptTrimmed = createCreatorSourceMediaUsage({
  sourceMedia: excerpt,
  sceneTrim: { clipInSec: 1, clipOutSec: 5 },
  sceneSourceDurationSec: 10,
});
assert.equal(excerptTrimmed.isTrimmed, true);
assert.equal(excerptTrimmed.visualDurationSec, 4);
assert.equal(excerptTrimmed.sourceMedia.timecodeStartSec, 41);
assert.equal(excerptTrimmed.sourceMedia.timecodeEndSec, 45);
assert.equal(excerptTrimmed.sourceMedia.sourceDurationSec, 100);

const invalidTinyTrim = createCreatorSourceMediaUsage({
  sourceMedia: excerpt,
  sceneTrim: { clipInSec: 2, clipOutSec: 2.1 },
  sceneSourceDurationSec: 10,
});
assert.equal(invalidTinyTrim.isTrimmed, false);
assert.equal(invalidTinyTrim.visualDurationSec, 10);
assert.equal(invalidTinyTrim.sourceMedia.timecodeStartSec, 40);
assert.equal(invalidTinyTrim.sourceMedia.timecodeEndSec, 50);

const image = normalizeCreatorSourceMediaMetadata({
  sourceMediaKind: "image",
  sourceUrl: "https://example.com/image",
  rightsState: "review_required",
});
const imageUsage = createCreatorSourceMediaUsage({
  sourceMedia: image,
  sceneTrim: { clipInSec: 1, clipOutSec: 3 },
  sceneSourceDurationSec: 5,
});
assert.equal(imageUsage.isTrimmed, false);
assert.equal(imageUsage.sourceMedia.timecodeStartSec, null);
assert.equal(imageUsage.sourceMedia.timecodeEndSec, null);

const usageSource = fs.readFileSync("lib/creator/sourceMediaUsage.ts", "utf8");
assert.match(usageSource, /normalizeCreatorSceneTrim/);
assert.match(usageSource, /No second clip editor or trim algorithm is introduced here/);
assert.doesNotMatch(usageSource, /constrainCreatorTrimProposal|CREATOR_MIN_VIDEO_CLIP_SECONDS\s*=/);

console.log("Stage 0.10H-3E source media trim bridge tests passed.");
