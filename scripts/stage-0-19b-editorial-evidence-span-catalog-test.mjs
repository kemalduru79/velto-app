import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  compileCanonicalEditorialGraph,
} from "../lib/research/canonicalEditorialGraphCompiler.ts";
import {
  EDITORIAL_EVIDENCE_SEGMENTATION_VERSION,
  EDITORIAL_EVIDENCE_SPAN_CATALOG_VERSION,
  EDITORIAL_EVIDENCE_SPAN_IDENTITY_VERSION,
  assertEditorialEvidenceSpanOwnership,
  createCanonicalEditorialSourceIdentity,
  createEditorialEvidenceSpanCatalog,
  getEditorialEvidenceSpanById,
} from "../lib/research/editorialEvidenceSpanCatalog.ts";
import {
  createEditorialGroundingCandidateSpans,
} from "../lib/research/editorialGroundingRepair.ts";

function source(sourceId, options = {}) {
  return {
    sourceId,
    adapterId: options.adapterId || "web",
    mediaKind: options.mediaKind || "article",
    externalId: options.externalId === undefined ? sourceId : options.externalId,
    title: options.title || `Source ${sourceId}`,
    url: options.url === undefined
      ? `https://example.test/${sourceId}`
      : options.url,
    publisher: options.publisher || "Example Publisher",
    author: options.author === undefined ? null : options.author,
    publishedAt: options.publishedAt || "2026-01-01",
    language: "en",
    summary: options.summary === undefined
      ? "Participants observed the change. Memory remains a conceptual reconstruction."
      : options.summary,
    thumbnailUrl: options.thumbnailUrl === undefined
      ? null
      : options.thumbnailUrl,
    durationSec: null,
    metrics: options.metrics || {},
    sourceMetadata: options.sourceMetadata || {},
  };
}

const sourceA = source("source-a", {
  url: "https://example.test/evidence/?utm_source=campaign&b=2&a=1#fragment",
});
const sourceB = source("source-b", {
  summary: "Researchers measured recall after repeated interviews. The wider theory remains contested.",
});

// 1-3, 12. Frozen content produces byte-equivalent, order-independent catalogs;
// unrelated sources do not perturb existing identities.
const catalog = createEditorialEvidenceSpanCatalog([sourceA, sourceB]);
const repeatedCatalog = createEditorialEvidenceSpanCatalog([sourceA, sourceB]);
assert.equal(JSON.stringify(repeatedCatalog), JSON.stringify(catalog));
const reversedCatalog = createEditorialEvidenceSpanCatalog([sourceB, sourceA]);
assert.deepEqual(reversedCatalog, catalog);
const unrelatedSource = source("source-unrelated", {
  summary: "An unrelated source discusses a separate historical event.",
});
const extendedCatalog = createEditorialEvidenceSpanCatalog([
  unrelatedSource,
  sourceA,
  sourceB,
]);
assert.deepEqual(
  extendedCatalog.spans.filter((span) => span.sourceId !== "source-unrelated"),
  catalog.spans,
);

// Explicit contract/segmentation versioning accompanies every identity.
assert.equal(catalog.version, EDITORIAL_EVIDENCE_SPAN_CATALOG_VERSION);
assert.equal(
  catalog.segmentationVersion,
  EDITORIAL_EVIDENCE_SEGMENTATION_VERSION,
);
assert.equal(
  catalog.spans.every((span) =>
    span.identityVersion === EDITORIAL_EVIDENCE_SPAN_IDENTITY_VERSION &&
    span.segmentationVersion === EDITORIAL_EVIDENCE_SEGMENTATION_VERSION &&
    /^span:v2:[a-f0-9]{64}$/u.test(span.spanId)
  ),
  true,
);

// 4. Any change to frozen evidence-bearing source content changes every span
// identity for that source, even when an individual sentence is unchanged.
const changedContentSource = {
  ...sourceA,
  summary: `${sourceA.summary} A new frozen observation was added.`,
};
const changedContentCatalog = createEditorialEvidenceSpanCatalog([
  changedContentSource,
]);
const originalSourceAIds = new Set(
  catalog.spans
    .filter((span) => span.sourceId === sourceA.sourceId)
    .map((span) => span.spanId),
);
assert.equal(
  changedContentCatalog.spans.every((span) => !originalSourceAIds.has(span.spanId)),
  true,
);

// 5. Presentation/retrieval metadata is deliberately outside source content
// and span identity.
const metadataVariant = {
  ...sourceA,
  title: "Changed display title",
  publisher: "Changed Publisher",
  author: "Changed Author",
  publishedAt: "2026-09-01",
  thumbnailUrl: "https://example.test/changed.jpg",
  metrics: { views: 999_999, likes: 4_200 },
  sourceMetadata: { retrievalRank: 9, transientLabel: "changed" },
};
assert.deepEqual(
  createEditorialEvidenceSpanCatalog([metadataVariant]),
  createEditorialEvidenceSpanCatalog([sourceA]),
);

// 6, 18. Repeated passage text remains distinct by exact UTF-16 range, and
// every catalog span maps back to the frozen canonical source material.
const repeatedText = "Participants observed the change.";
const repeatedPassageSource = source("source-repeated", {
  summary: `${repeatedText} ${repeatedText}`,
});
const repeatedPassageCatalog = createEditorialEvidenceSpanCatalog([
  repeatedPassageSource,
]);
const repeatedPassages = repeatedPassageCatalog.spans.filter(
  (span) => span.text === repeatedText,
);
assert.equal(repeatedPassages.length, 2);
assert.notEqual(repeatedPassages[0].spanId, repeatedPassages[1].spanId);
assert.notDeepEqual(repeatedPassages[0].range, repeatedPassages[1].range);
for (const span of repeatedPassageCatalog.spans) {
  assert.equal(span.range.unit, "utf16_code_unit");
  assert.equal(
    repeatedPassageSource.summary.slice(span.range.start, span.range.end),
    span.text,
  );
}

// 7. The same canonical URL cannot represent conflicting frozen content in one
// catalog.
assert.throws(
  () => createEditorialEvidenceSpanCatalog([
    sourceA,
    source("source-conflicting-content", {
      url: "https://example.test/evidence?a=1&b=2&utm_medium=duplicate",
      summary: "Conflicting frozen source material.",
    }),
  ]),
  /EDITORIAL_EVIDENCE_CATALOG_SOURCE_CONTENT_CONFLICT/,
);

// 8. Equal canonical URL/content with incompatible source ownership semantics
// is still an ambiguous source-identity collision.
assert.throws(
  () => createEditorialEvidenceSpanCatalog([
    sourceA,
    source("source-conflicting-authority", {
      adapterId: "academic",
      mediaKind: "paper",
      externalId: "different-external-id",
      url: "https://example.test/evidence?b=2&a=1",
      summary: sourceA.summary,
    }),
  ]),
  /EDITORIAL_EVIDENCE_CATALOG_SOURCE_IDENTITY_COLLISION/,
);

// 9-11. Lookup and source ownership are deterministic and fail closed.
const selectedSpan = catalog.spans.find((span) =>
  span.sourceId === sourceA.sourceId
);
assert.ok(selectedSpan);
assert.deepEqual(
  getEditorialEvidenceSpanById(catalog, selectedSpan.spanId),
  selectedSpan,
);
assert.deepEqual(
  assertEditorialEvidenceSpanOwnership({
    catalog,
    spanId: selectedSpan.spanId,
    sourceId: sourceA.sourceId,
  }),
  selectedSpan,
);
assert.throws(
  () => assertEditorialEvidenceSpanOwnership({
    catalog,
    spanId: selectedSpan.spanId,
    sourceId: sourceB.sourceId,
  }),
  /EDITORIAL_EVIDENCE_CATALOG_SPAN_SOURCE_MISMATCH/,
);
assert.throws(
  () => assertEditorialEvidenceSpanOwnership({
    catalog,
    spanId: "span:v2:missing",
    sourceId: sourceA.sourceId,
  }),
  /EDITORIAL_EVIDENCE_CATALOG_SPAN_NOT_FOUND/,
);

// 13. The shared segmentation authority preserves existing evidence
// specificity without making it part of source identity.
assert.equal(
  catalog.spans.some((span) =>
    span.sourceId === sourceA.sourceId &&
    span.evidenceSpecificity === "concrete_observation"
  ),
  true,
);
assert.equal(
  catalog.spans.some((span) =>
    span.sourceId === sourceA.sourceId &&
    span.evidenceSpecificity === "abstract_or_conceptual"
  ),
  true,
);

// 14. V1 retains the exact positional ID, ordering, text, and specificity
// contract while consuming the extracted shared segmentation routine.
const v1FixtureSources = [
  source("source-a", {
    summary: "Participants observed change. The result increased by 20 percent.",
  }),
  source("source-b", {
    summary: "A conceptual summary remains abstract.",
  }),
];
assert.deepEqual(createEditorialGroundingCandidateSpans(v1FixtureSources), [
  {
    spanId: "span-1-1",
    sourceId: "source-a",
    text: "Participants observed change.",
    evidenceSpecificity: "concrete_observation",
  },
  {
    spanId: "span-1-3",
    sourceId: "source-a",
    text: "Participants observed change. The result increased by 20 percent.",
    evidenceSpecificity: "concrete_observation",
  },
  {
    spanId: "span-1-2",
    sourceId: "source-a",
    text: "The result increased by 20 percent.",
    evidenceSpecificity: "abstract_or_conceptual",
  },
  {
    spanId: "span-2-1",
    sourceId: "source-b",
    text: "A conceptual summary remains abstract.",
    evidenceSpecificity: "abstract_or_conceptual",
  },
]);

// 15-16. Stage 0.19A consumes the V2 catalog structurally. Canonical graph
// output remains byte-equivalent when source input order changes.
const compilerSpan = catalog.spans.find((span) =>
  span.sourceId === sourceA.sourceId &&
  span.text === "Participants observed the change."
);
assert.ok(compilerSpan);
const proposal = {
  items: [{
    claim: {
      text: "Participants observed the change.",
      claimType: "RESEARCH_FINDING",
      propositionKind: "world_state",
      origin: { attributedEntity: null, referencedWork: null },
    },
    evidenceSelections: [{
      sourceId: sourceA.sourceId,
      spanId: compilerSpan.spanId,
      stance: "supports",
      contextNote: "Direct canonical observation.",
    }],
  }],
};
const compiled = compileCanonicalEditorialGraph({
  proposal,
  sources: [sourceA, sourceB],
  spanCatalog: catalog.spans,
});
const compiledFromReversedSources = compileCanonicalEditorialGraph({
  proposal,
  sources: [sourceB, sourceA],
  spanCatalog: catalog.spans.toReversed(),
});
assert.deepEqual(compiledFromReversedSources, compiled);
assert.equal(compiled.evidence[0].excerpt, compilerSpan.text);
assert.equal(compiled.evidence[0].sourceId, compilerSpan.sourceId);

// Canonical source identity uses the repository URL authority, then an
// adapter/external-ID fallback, then a sourceId fallback.
assert.equal(
  createCanonicalEditorialSourceIdentity(sourceA),
  "url:https://example.test/evidence?a=1&b=2",
);
assert.equal(
  createCanonicalEditorialSourceIdentity(source("external-fallback", {
    url: "",
    adapterId: "academic",
    externalId: "paper-42",
  })),
  'adapter-external:{"adapterId":"academic","externalId":"paper-42"}',
);
assert.equal(
  createCanonicalEditorialSourceIdentity(source("source-id-fallback", {
    url: "",
    externalId: null,
  })),
  "source-id:source-id-fallback",
);

// 17. Static guard: V2 identity contains no clock, randomness, UUID, or array
// index authority. Behavioral order invariance is asserted above.
const catalogSource = await readFile(
  new URL("../lib/research/editorialEvidenceSpanCatalog.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  catalogSource,
  /Date\.now|Math\.random|randomUUID|sourceIndex|spanIndex/u,
);

console.log("Stage 0.19B editorial evidence span catalog tests passed.");
