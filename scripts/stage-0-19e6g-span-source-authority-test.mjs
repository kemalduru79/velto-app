import assert from "node:assert/strict";

const {
  compileCanonicalEditorialGraph,
} = await import("../lib/research/canonicalEditorialGraphCompiler.ts");
const {
  createEditorialEvidenceSpanCatalog,
} = await import("../lib/research/editorialEvidenceSpanCatalog.ts");

function source({
  sourceId,
  url,
  summary,
}) {
  return {
    sourceId,
    adapterId: "web",
    mediaKind: "webpage",
    externalId: url,
    title: sourceId,
    url,
    publisher: new URL(url).hostname,
    author: null,
    publishedAt: null,
    language: "en",
    summary,
    thumbnailUrl: null,
    durationSec: null,
    metrics: {},
    sourceMetadata: {},
  };
}

const sourceA = source({
  sourceId: "web:https://a.example/article",
  url: "https://a.example/article",
  summary:
    "Workers reported lower job stability after automation adoption. "
    + "The survey compared employment outcomes before and after the change.",
});

const sourceB = source({
  sourceId: "web:https://b.example/article",
  url: "https://b.example/article",
  summary:
    "A separate analysis discussed social status and identity outside paid work. "
    + "It did not report the employment comparison from the other source.",
});

const sources = [sourceA, sourceB];
const catalog = createEditorialEvidenceSpanCatalog(sources);
const spanA = catalog.spans.find((span) => span.sourceId === sourceA.sourceId);
assert.ok(spanA, "source A must produce at least one canonical span");

function proposal(selection) {
  return {
    items: [{
      claim: {
        text: "Automation can affect job stability.",
        claimType: "FACT",
        propositionKind: "document_assertion",
        origin: {
          attributedEntity: null,
          referencedWork: sourceA.sourceId,
        },
      },
      evidenceSelections: [selection],
    }],
  };
}

const repaired = compileCanonicalEditorialGraph({
  proposal: proposal({
    // Deliberately wrong but still valid source: spanId belongs to source A.
    sourceId: sourceB.sourceId,
    spanId: spanA.spanId,
    stance: "supports",
    contextNote: "The selected canonical span is the evidence authority.",
  }),
  sources,
  spanCatalog: catalog.spans,
});

assert.equal(repaired.evidence.length, 1);
assert.equal(
  repaired.evidence[0].sourceId,
  sourceA.sourceId,
  "server-owned spanId must install catalog-authoritative source ownership",
);
assert.equal(repaired.links.length, 1);

assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: proposal({
      sourceId: "web:https://unknown.example/article",
      spanId: spanA.spanId,
      stance: "supports",
      contextNote: null,
    }),
    sources,
    spanCatalog: catalog.spans,
  }),
  /CANONICAL_EDITORIAL_SOURCE_NOT_FOUND:web:https:\/\/unknown\.example\/article/u,
  "unknown provider source IDs must remain fail-closed",
);

assert.throws(
  () => compileCanonicalEditorialGraph({
    proposal: proposal({
      sourceId: sourceA.sourceId,
      spanId: `span:v2:${"0".repeat(64)}`,
      stance: "supports",
      contextNote: null,
    }),
    sources,
    spanCatalog: catalog.spans,
  }),
  /CANONICAL_EDITORIAL_SPAN_NOT_FOUND/u,
  "unknown span IDs must remain fail-closed",
);

console.log("stage-0-19e6g-span-source-authority-test: PASS");
