import assert from "node:assert/strict";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import { createScriptEvidenceBindingMap } from "../lib/research/scriptEvidenceBinding.ts";

const source = (sourceId) => ({
  sourceId,
  adapterId: "web",
  mediaKind: "webpage",
  externalId: sourceId,
  title: sourceId,
  url: `https://example.com/${sourceId}`,
  publisher: "Example Publisher",
  author: null,
  publishedAt: null,
  language: "en",
  summary: null,
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
});
const locator = {
  section: null,
  page: null,
  timecodeStartSec: null,
  timecodeEndSec: null,
};

const graph = createResearchClaimEvidenceGraph({
  sources: [source("s1"), source("s2")],
  claims: [
    { claimId: "c1", claimType: "FACT", text: "A documented factual claim." },
    { claimId: "c2", claimType: "FORECAST", text: "A forecast claim." },
    { claimId: "c3", claimType: "THOUGHT_EXPERIMENT", text: "A hypothetical scenario." },
  ],
  evidence: [
    { evidenceId: "e1", sourceId: "s1", excerpt: "Fact support", contextNote: null, locator },
    { evidenceId: "e2", sourceId: "s1", excerpt: "Forecast support", contextNote: null, locator },
    { evidenceId: "e3", sourceId: "s2", excerpt: "Forecast counterpoint", contextNote: null, locator },
    { evidenceId: "e4", sourceId: "s2", excerpt: "Additional context", contextNote: null, locator },
  ],
  links: [
    { claimId: "c1", evidenceId: "e1", stance: "supports" },
    { claimId: "c2", evidenceId: "e2", stance: "supports" },
    { claimId: "c2", evidenceId: "e3", stance: "contradicts" },
    { claimId: "c2", evidenceId: "e4", stance: "contextualizes" },
  ],
});

const map = createScriptEvidenceBindingMap({
  graph,
  statements: [
    {
      statementId: "scene-1-statement-1",
      sceneId: 1,
      text: "  The documented fact establishes the starting point.  ",
      evidenceMode: "required",
      claimIds: ["c1"],
    },
    {
      statementId: "scene-2-statement-1",
      sceneId: 2,
      text: "The forecast is plausible, but an alternative scenario also exists.",
      evidenceMode: "required",
      claimIds: ["c2", "c2"],
    },
    {
      statementId: "scene-3-statement-1",
      sceneId: 3,
      text: "Imagine the opposite outcome for a moment.",
      evidenceMode: "not_required",
      claimIds: ["c3"],
    },
  ],
});

assert.equal(map.version, "0.10H-2C");
assert.equal(map.statements[0].text, "The documented fact establishes the starting point.");
assert.equal(map.statements[0].traceabilityStatus, "traceable");
assert.deepEqual(map.statements[0].supportingEvidenceIds, ["e1"]);
assert.deepEqual(map.statements[0].supportingSourceIds, ["s1"]);
assert.equal(map.statements[1].traceabilityStatus, "traceable");
assert.deepEqual(map.statements[1].claimReferences, [
  { claimId: "c2", claimType: "FORECAST" },
]);
assert.deepEqual(map.statements[1].supportingSourceIds, ["s1"]);
assert.deepEqual(map.statements[1].counterSourceIds, ["s2"]);
assert.deepEqual(map.statements[1].contextualSourceIds, ["s2"]);
assert.equal(map.statements[2].traceabilityStatus, "not_required");

const partialGraph = createResearchClaimEvidenceGraph({
  sources: [source("s1")],
  claims: [
    { claimId: "c1", claimType: "FACT", text: "First claim." },
    { claimId: "c4", claimType: "FACT", text: "Second claim." },
  ],
  evidence: [
    { evidenceId: "e1", sourceId: "s1", excerpt: "First support", contextNote: null, locator },
  ],
  links: [
    { claimId: "c1", evidenceId: "e1", stance: "supports" },
  ],
});
const partial = createScriptEvidenceBindingMap({
  graph: partialGraph,
  statements: [
    { statementId: "partial", sceneId: 1, text: "Two claims in one sentence.", evidenceMode: "required", claimIds: ["c1", "c4"] },
  ],
});
assert.equal(partial.statements[0].traceabilityStatus, "partial");

assert.throws(
  () => createScriptEvidenceBindingMap({
    graph,
    statements: [
      { statementId: "missing", sceneId: 1, text: "Missing claim reference.", evidenceMode: "required", claimIds: ["does-not-exist"] },
    ],
  }),
  /SCRIPT_STATEMENT_CLAIM_MISSING/,
);
assert.throws(
  () => createScriptEvidenceBindingMap({
    graph,
    statements: [
      { statementId: "required", sceneId: 1, text: "Claimless factual statement.", evidenceMode: "required", claimIds: [] },
    ],
  }),
  /SCRIPT_STATEMENT_CLAIM_REQUIRED/,
);
assert.throws(
  () => createScriptEvidenceBindingMap({
    graph,
    statements: [
      { statementId: "dup", sceneId: 1, text: "One.", evidenceMode: "not_required", claimIds: [] },
      { statementId: "dup", sceneId: 2, text: "Two.", evidenceMode: "not_required", claimIds: [] },
    ],
  }),
  /SCRIPT_STATEMENT_ID_DUPLICATE/,
);

console.log("Stage 0.10H-2C script evidence binding tests passed.");
