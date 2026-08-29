import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adaptYoutubeResearchCandidate } from "../lib/research/youtubeSourceAdapter.ts";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import { assessResearchSource } from "../lib/research/sourceAssessment.ts";
import { createResearchEvidenceSnapshot } from "../lib/research/evidenceSnapshot.ts";

const source = adaptYoutubeResearchCandidate({
  id: "abc123",
  title: "Primary interview",
  description: "A first-person statement from the speaker.",
  channel: "Example Publisher",
  publishedAt: "2026-08-20T10:00:00Z",
  views: 1000,
  likes: 50,
  durationSec: 600,
  url: "https://www.youtube.com/watch?v=abc123",
}, "en");
assert.ok(source);

const primaryAssessment = assessResearchSource(source, "primary");
assert.equal(primaryAssessment.provenanceStatus, "complete");
assert.equal(primaryAssessment.reviewStatus, "usable");
assert.deepEqual(primaryAssessment.reviewReasons, []);

const unknownAssessment = assessResearchSource(source);
assert.equal(unknownAssessment.reviewStatus, "review");
assert.match(unknownAssessment.reviewReasons.join(" "), /SOURCE_DIRECTNESS_REVIEW/);

const graph = createResearchClaimEvidenceGraph({
  sources: [source],
  claims: [{
    claimId: "claim:1",
    claimType: "FORECAST",
    text: "The speaker forecasts a material change within a decade.",
  }],
  evidence: [{
    evidenceId: "evidence:1",
    sourceId: source.sourceId,
    excerpt: "within the next ten years",
    contextNote: "This is presented as a forecast, not as an established fact.",
    locator: {
      section: null,
      page: null,
      timecodeStartSec: 132,
      timecodeEndSec: 141,
    },
  }],
  links: [{
    claimId: "claim:1",
    evidenceId: "evidence:1",
    stance: "supports",
  }],
});

const snapshot = createResearchEvidenceSnapshot({
  snapshotId: "snapshot:1",
  topic: "Future of work",
  createdAt: "2026-08-29T12:00:00Z",
  graph,
  sourceAssessments: [primaryAssessment],
});
assert.equal(snapshot.version, "0.10H-1C");
assert.equal(snapshot.graphVersion, "0.10H-1B");
assert.match(snapshot.fingerprint, /^H1C-/);

const sameEvidence = createResearchEvidenceSnapshot({
  snapshotId: "snapshot:2",
  topic: "Future of work",
  createdAt: "2026-08-30T12:00:00Z",
  graph,
  sourceAssessments: [primaryAssessment],
});
assert.equal(snapshot.fingerprint, sameEvidence.fingerprint);

assert.throws(
  () => createResearchEvidenceSnapshot({
    snapshotId: "snapshot:bad",
    topic: "Future of work",
    graph,
    sourceAssessments: [{ ...primaryAssessment, sourceId: "youtube:missing" }],
  }),
  /SNAPSHOT_ASSESSMENT_SOURCE_MISSING/,
);

const assessmentSource = readFileSync(
  new URL("../lib/research/sourceAssessment.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(assessmentSource, /truthScore|ideologyScore/i);

console.log("Stage 0.10H-1C evidence freeze tests passed.");
