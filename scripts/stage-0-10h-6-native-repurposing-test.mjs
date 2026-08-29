import assert from "node:assert/strict";
import {
  createCreatorNativeDerivative,
} from "../lib/research/nativeRepurposing.ts";
import {
  createResearchEvidenceSnapshot,
} from "../lib/research/evidenceSnapshot.ts";

const snapshot = createResearchEvidenceSnapshot({
  snapshotId: "evidence-package:stable-1",
  topic: "Native repurposing",
  createdAt: "2026-08-29T00:00:00.000Z",
  graph: {
    version: "0.10H-1B",
    sources: [
      {
        sourceId: "source-primary",
        adapterId: "primary",
        mediaKind: "document",
        externalId: "primary-1",
        title: "Primary source",
        url: "https://example.com/primary",
        publisher: "Example Publisher",
        author: null,
        publishedAt: "2026-08-01T00:00:00.000Z",
        summary: "The measured result improved by 20 percent.",
        language: "en",
        thumbnailUrl: null,
        durationSec: null,
        metrics: {},
        sourceMetadata: {},
      },
      {
        sourceId: "source-counter",
        adapterId: "news",
        mediaKind: "article",
        externalId: "counter-1",
        title: "Counter source",
        url: "https://example.com/counter",
        publisher: "Example News",
        author: null,
        publishedAt: "2026-08-02T00:00:00.000Z",
        summary: "A smaller sample found a weaker effect.",
        language: "en",
        thumbnailUrl: null,
        durationSec: null,
        metrics: {},
        sourceMetadata: {},
      },
    ],
    claims: [{
      claimId: "claim-1",
      claimType: "RESEARCH_FINDING",
      text: "The measured result improved.",
    }],
    evidence: [
      {
        evidenceId: "evidence-support",
        sourceId: "source-primary",
        excerpt: "improved by 20 percent",
        contextNote: null,
        locator: {
          section: "Results",
          page: 2,
          timecodeStartSec: null,
          timecodeEndSec: null,
        },
      },
      {
        evidenceId: "evidence-counter",
        sourceId: "source-counter",
        excerpt: "weaker effect",
        contextNote: "Counterevidence",
        locator: {
          section: null,
          page: null,
          timecodeStartSec: null,
          timecodeEndSec: null,
        },
      },
      {
        evidenceId: "evidence-context",
        sourceId: "source-primary",
        excerpt: "The measured result",
        contextNote: "Measurement context",
        locator: {
          section: "Method",
          page: 1,
          timecodeStartSec: null,
          timecodeEndSec: null,
        },
      },
    ],
    links: [
      {
        claimId: "claim-1",
        evidenceId: "evidence-support",
        stance: "supports",
      },
      {
        claimId: "claim-1",
        evidenceId: "evidence-counter",
        stance: "contradicts",
      },
      {
        claimId: "claim-1",
        evidenceId: "evidence-context",
        stance: "contextualizes",
      },
    ],
  },
  sourceAssessments: [
    {
      sourceId: "source-primary",
      directness: "primary",
      provenanceStatus: "complete",
      reviewStatus: "usable",
      reviewReasons: [],
    },
    {
      sourceId: "source-counter",
      directness: "secondary",
      provenanceStatus: "complete",
      reviewStatus: "usable",
      reviewReasons: [],
    },
  ],
});

const structures = {
  youtube_long_form: {
    format: "youtube_long_form",
    hook: "The result looks simple, but the evidence is not.",
    sections: ["What changed", "What the counterevidence says"],
    closing: "Use the finding with its limits intact.",
  },
  podcast: {
    format: "podcast",
    opening: "Let us unpack the result.",
    segments: ["The primary finding", "The competing interpretation"],
    closing: "Here is what remains uncertain.",
  },
  short_reel: {
    format: "short_reel",
    hook: "A 20 percent result can still mislead you.",
    microArgument: "The sample and counterevidence change what the number means.",
    pacingBeats: ["State the result", "Reveal the limitation", "Resolve the tension"],
    payoff: "Keep the finding; drop the false certainty.",
  },
  carousel_text: {
    format: "carousel_text",
    title: "One result, two readings",
    slides: ["The headline finding", "The counterevidence", "The responsible takeaway"],
    closingCaption: "Save this framework for your next research claim.",
  },
};

function create(format) {
  return createCreatorNativeDerivative({
    derivativeId: `derivative:${format}`,
    format,
    evidenceSnapshot: snapshot,
    claimIds: ["claim-1"],
    structure: structures[format],
    governedSourceMedia: [{
      sourceId: "source-primary",
      sourceMedia: {
        sourceMediaKind: "document",
        sourceUrl: "https://example.com/primary",
        publisher: "Example Publisher",
        rightsholder: "Example Publisher",
        licenseId: "license-reviewed",
        attributionRequired: true,
        attributionText: "Source: Example Publisher",
        rightsState: "cleared",
        rightsReviewNote: "Reviewed for this use.",
      },
    }],
  });
}

const derivatives = Object.keys(structures).map(create);
for (const derivative of derivatives) {
  assert.equal(derivative.parentEvidence.snapshotId, snapshot.snapshotId);
  assert.equal(derivative.parentEvidence.fingerprint, snapshot.fingerprint);
  assert.equal(derivative.parentEvidence.version, snapshot.version);
  assert.equal(derivative.parentEvidence.graphVersion, snapshot.graphVersion);
  assert.equal(derivative.researchPolicy, "reuse_parent_evidence");
  assert.deepEqual(derivative.lineage.claims.map((claim) => claim.claimId), ["claim-1"]);
  assert.deepEqual(
    derivative.lineage.evidence.map((item) => item.evidenceId).sort(),
    ["evidence-context", "evidence-counter", "evidence-support"],
  );
  assert.ok(derivative.lineage.links.some((link) => link.stance === "supports"));
  assert.ok(derivative.lineage.links.some((link) => link.stance === "contextualizes"));
  assert.ok(derivative.lineage.links.some((link) => link.stance === "contradicts"));
  assert.deepEqual(
    derivative.lineage.sourceAssessments.map((item) => item.sourceId).sort(),
    ["source-counter", "source-primary"],
  );
  assert.equal(
    derivative.lineage.governedSourceMedia[0].sourceMedia.rightsState,
    "cleared",
  );
  assert.equal(
    derivative.lineage.governedSourceMedia[0].sourceMedia.attributionText,
    "Source: Example Publisher",
  );
  assert.equal(
    derivative.lineage.governedSourceMedia[0].sourceMedia.licenseId,
    "license-reviewed",
  );
  assert.equal(
    derivative.lineage.governedSourceMedia[0].sourceMedia.rightsholder,
    "Example Publisher",
  );
}
assert.deepEqual(
  derivatives.map((derivative) => derivative.format).sort(),
  ["carousel_text", "podcast", "short_reel", "youtube_long_form"],
);
assert.equal(new Set(
  derivatives.map((derivative) => derivative.parentEvidence.fingerprint),
).size, 1);

const mutationProbe = create("podcast");
mutationProbe.lineage.claims[0].text = "mutated derivative claim";
mutationProbe.lineage.evidence[0].locator.page = 999;
mutationProbe.lineage.sources[0].metrics.views = 999;
mutationProbe.lineage.sourceAssessments[0].reviewReasons.push("mutated");
assert.equal(snapshot.graph.claims[0].text, "The measured result improved.");
assert.notEqual(snapshot.graph.evidence[0].locator.page, 999);
assert.notEqual(snapshot.graph.sources[0].metrics.views, 999);
assert.deepEqual(snapshot.sourceAssessments[0].reviewReasons, []);

const nativeShort = derivatives.find((item) => item.format === "short_reel");
assert.equal(nativeShort.structure.format, "short_reel");
assert.ok(nativeShort.structure.hook);
assert.ok(nativeShort.structure.microArgument);
assert.ok(nativeShort.structure.pacingBeats.length > 0);
assert.ok(nativeShort.structure.payoff);
assert.equal("clipStartSec" in nativeShort.structure, false);
assert.equal("longFormScript" in nativeShort.structure, false);

assert.throws(
  () => createCreatorNativeDerivative({
    derivativeId: "derivative:invalid",
    format: "short_reel",
    evidenceSnapshot: snapshot,
    claimIds: ["claim-missing"],
    structure: structures.short_reel,
  }),
  /NATIVE_DERIVATIVE_CLAIM_MISSING:claim-missing/,
);
assert.throws(
  () => createCreatorNativeDerivative({
    derivativeId: "derivative:mismatch",
    format: "short_reel",
    evidenceSnapshot: snapshot,
    claimIds: ["claim-1"],
    structure: structures.podcast,
  }),
  /NATIVE_DERIVATIVE_STRUCTURE_FORMAT_MISMATCH/,
);
assert.throws(
  () => createCreatorNativeDerivative({
    derivativeId: "derivative:unsupported",
    format: "automatic_clip",
    evidenceSnapshot: snapshot,
    claimIds: ["claim-1"],
    structure: structures.short_reel,
  }),
  /NATIVE_DERIVATIVE_FORMAT_UNSUPPORTED/,
);

console.log("Stage 0.10H-6 native repurposing tests passed.");
