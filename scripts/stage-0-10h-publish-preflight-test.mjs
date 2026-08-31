import assert from "node:assert/strict";
import fs from "node:fs";
import { createCreatorPublishPreflight } from "../lib/creator/publishPreflight.ts";

const page = fs.readFileSync(new URL("../app/create/page.tsx", import.meta.url), "utf8");
const ready = createCreatorPublishPreflight({
  contentReady: true,
  visualsReady: true,
  voiceReady: true,
  evidenceVerified: true,
  rightsConfirmed: true,
  outputReady: true,
});

assert.deepEqual(ready.map((item) => item.category), [
  "content",
  "visuals",
  "voice",
  "evidence",
  "rights",
  "output",
]);
assert.ok(ready.every((item) => item.status === "ready"));

const pending = createCreatorPublishPreflight({
  contentReady: true,
  visualsReady: false,
  voiceReady: false,
  evidenceVerified: false,
  rightsConfirmed: false,
  outputReady: false,
});
const status = Object.fromEntries(pending.map((item) => [item.category, item.status]));
assert.equal(status.visuals, "action_required");
assert.equal(status.voice, "action_required");
assert.equal(status.evidence, "review");
assert.equal(status.rights, "review");
assert.equal(status.output, "blocked");

assert.match(page, /visualsReady: creatorProjectReadiness\?\.visuals === "ready"/);
assert.match(page, /voiceReady: creatorProjectReadiness\?\.voiceOver === "ready"/);
assert.match(page, /evidenceVerified: creatorReleaseConfirmations\.claimsVerified/);
assert.match(page, /rightsConfirmed: creatorReleaseConfirmations\.rightsConfirmed/);
assert.match(page, /creatorProductionComplete &&/);
assert.match(page, /data-creator-publish-preflight/);
assert.match(page, /creatorPublishSystemChecks\.map/);
assert.match(page, /creatorReleaseConfirmationItems\.map/);
assert.match(page, /disabled=\{isDownloadingCreatorPackage \|\| !creatorPackageReady\}/);

const helperSource = fs.readFileSync(new URL("../lib/creator/publishPreflight.ts", import.meta.url), "utf8");
assert.doesNotMatch(helperSource, /fetch\(|OpenAI|Exa|provider|credits?/i);
assert.doesNotMatch(page.slice(page.indexOf("data-creator-publish-preflight"), page.indexOf("data-creator-publish-preflight") + 1800), /credits?|provider|OpenAI|Exa/i);

console.log("STAGE_0_10H_PUBLISH_PREFLIGHT=PASS");
