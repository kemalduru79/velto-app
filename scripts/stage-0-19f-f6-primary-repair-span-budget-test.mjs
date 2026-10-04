import assert from "node:assert/strict";
import fs from "node:fs";

import {
  boundCreatorScriptBuildPrimaryRepairCandidateSources,
} from "../lib/creator/creatorScriptBuildAuthorityCoordinator.ts";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import { createEditorialEvidenceSpanCatalog } from "../lib/research/editorialEvidenceSpanCatalog.ts";
import { createEditorialPrimaryCoverageRepairContext } from "../lib/research/editorialPrimaryCoverageRepair.ts";
import { MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST } from "../lib/research/editorialGroundingRepair.ts";

const secondary = {
  sourceId: "web:https://secondary.example/work",
  adapterId: "web",
  mediaKind: "webpage",
  externalId: null,
  title: "Secondary work overview",
  url: "https://secondary.example/work",
  publisher: "Secondary",
  author: "Reporter",
  publishedAt: null,
  language: "en",
  summary: "A secondary account reports Daniel Susskind's view about technological unemployment.",
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
};

const claim = {
  claimId: "claim-primary",
  claimType: "FACT",
  text: "Daniel Susskind stated that technological unemployment may reduce paid work.",
  propositionKind: "attributed_statement",
  origin: {
    attributedEntity: "Daniel Susskind",
    referencedWork: null,
  },
};

const frozenGraph = createResearchClaimEvidenceGraph({
  sources: [secondary],
  claims: [claim],
  evidence: [{
    evidenceId: "evidence-secondary",
    sourceId: secondary.sourceId,
    excerpt: secondary.summary,
    contextNote: null,
    locator: {
      section: null,
      page: null,
      timecodeStartSec: null,
      timecodeEndSec: null,
    },
  }],
  links: [{
    claimId: claim.claimId,
    evidenceId: "evidence-secondary",
    stance: "supports",
  }],
});

const verboseSummary = Array.from(
  { length: 12 },
  (_, index) =>
    `Daniel Susskind reported bounded primary observation number ${index + 1} about technological unemployment and paid work.`,
).join(" ");

const candidateSources = Array.from({ length: 8 }, (_, index) => ({
  sourceId: `primary:https://primary.example/susskind-${index + 1}`,
  adapterId: "primary",
  mediaKind: "document",
  externalId: `susskind-${index + 1}`,
  title: `Daniel Susskind primary statement ${index + 1}`,
  url: `https://primary.example/susskind-${index + 1}`,
  publisher: "Daniel Susskind Archive",
  author: "Daniel Susskind",
  publishedAt: null,
  language: "en",
  summary: verboseSummary,
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
}));

const fullCatalog = createEditorialEvidenceSpanCatalog(candidateSources);
assert.ok(
  fullCatalog.spans.length > MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST,
  "fixture must reproduce an oversized primary-acquisition span catalog",
);

const targets = [{
  claimId: claim.claimId,
  canonicalClaimType: claim.claimType,
  acquisitionClaimType: "PRIMARY_SOURCE_CLAIM",
  propositionKind: claim.propositionKind,
  subject: claim.text,
}];

const bounded = boundCreatorScriptBuildPrimaryRepairCandidateSources({
  frozenGraph,
  targets,
  candidateSources,
});
const boundedReversed = boundCreatorScriptBuildPrimaryRepairCandidateSources({
  frozenGraph,
  targets,
  candidateSources: [...candidateSources].reverse(),
});

assert.ok(bounded.length > 0);
assert.ok(bounded.length < candidateSources.length);
assert.deepEqual(
  bounded.map((source) => source.sourceId),
  boundedReversed.map((source) => source.sourceId),
  "budgeting must be deterministic regardless of provider source ordering",
);
const boundedCatalog = createEditorialEvidenceSpanCatalog(bounded);
assert.ok(
  boundedCatalog.spans.length <= MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST,
);

const context = createEditorialPrimaryCoverageRepairContext({
  frozenGraph,
  originalPrimaryRequiredClaimIds: [claim.claimId],
  candidateSources: bounded,
  creatorProfile: {},
});
assert.ok(context.candidateSpans.length > 0);
assert.ok(
  context.candidateSpans.length <= MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST,
);

const coordinator = fs.readFileSync(
  new URL("../lib/creator/creatorScriptBuildAuthorityCoordinator.ts", import.meta.url),
  "utf8",
);
assert.match(
  coordinator,
  /candidateSources = boundCreatorScriptBuildPrimaryRepairCandidateSources\(\{/u,
);
assert.match(
  coordinator,
  /candidateSources: deduplicateAcquiredSources\(\{/u,
);
assert.match(
  coordinator,
  /MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST/u,
);

console.log("stage-0-19f-f6-primary-repair-span-budget-test: PASS");
