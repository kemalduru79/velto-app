import assert from "node:assert/strict";

const {
  deduplicateAcquiredSources,
} = await import("../lib/creator/creatorScriptBuildAuthorityCoordinator.ts");

function researchSource({ sourceId, url, summary }) {
  return {
    sourceId,
    adapterId: "web",
    mediaKind: "webpage",
    externalId: url,
    title: "Stable source title",
    url,
    publisher: new URL(url).hostname,
    author: "Author",
    publishedAt: "2020-01-01T00:00:00.000Z",
    language: "en",
    summary,
    thumbnailUrl: null,
    durationSec: null,
    metrics: {},
    sourceMetadata: {
      highlightCount: 1,
      provenanceKind: null,
      provenanceVerified: false,
    },
  };
}

const sourceId = "web:https://example.com/article";
const url = "https://example.com/article";

const frozenSource = researchSource({
  sourceId,
  url,
  summary: "Frozen editorial summary.",
});

const acquiredVariant = researchSource({
  sourceId,
  url,
  summary: "Different query-dependent acquisition summary.",
});

const claim = {
  claimId: "claim-1",
  claimType: "FACT",
  text: "The source states the relevant proposition.",
  propositionKind: "document_assertion",
  origin: {
    attributedEntity: null,
    referencedWork: sourceId,
  },
};

const frozenGraph = {
  version: "0.10H-1B",
  sources: [frozenSource],
  claims: [claim],
  evidence: [],
  links: [],
};

const targets = [{
  claimId: claim.claimId,
  canonicalClaimType: claim.claimType,
  acquisitionClaimType: "PRIMARY_SOURCE_CLAIM",
  propositionKind: claim.propositionKind,
  subject: claim.text,
}];

const retained = deduplicateAcquiredSources({
  frozenGraph,
  targets,
  acquiredSources: [acquiredVariant],
});

assert.equal(retained.length, 1);
assert.equal(
  retained[0].summary,
  frozenSource.summary,
  "same source identity must preserve frozen editorial source content",
);
assert.deepEqual(
  retained[0],
  frozenSource,
  "primary acquisition must not mutate a frozen source through a new snippet",
);

const conflictingIdentity = researchSource({
  sourceId,
  url: "https://different.example/article",
  summary: "Conflicting source identity.",
});

assert.throws(
  () => deduplicateAcquiredSources({
    frozenGraph,
    targets,
    acquiredSources: [conflictingIdentity],
  }),
  /CREATOR_SCRIPT_BUILD_PRIMARY_SOURCE_ID_CONFLICT:web:https:\/\/example\.com\/article/u,
  "same sourceId with a different canonical URL must remain fail-closed",
);

console.log("stage-0-19e6i-frozen-source-ingestion-test: PASS");
