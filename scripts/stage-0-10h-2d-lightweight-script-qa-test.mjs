import assert from "node:assert/strict";
import { createResearchClaimEvidenceGraph } from "../lib/research/claimEvidenceGraph.ts";
import { createScriptEvidenceBindingMap } from "../lib/research/scriptEvidenceBinding.ts";
import { createScriptQaReport } from "../lib/research/scriptEvidenceQa.ts";

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
    { claimId: "fact", claimType: "FACT", text: "A documented fact." },
    { claimId: "forecast", claimType: "FORECAST", text: "A future forecast." },
  ],
  evidence: [
    { evidenceId: "e-fact", sourceId: "s1", excerpt: "Fact support", contextNote: null, locator },
    { evidenceId: "e-forecast", sourceId: "s1", excerpt: "Forecast support", contextNote: null, locator },
    { evidenceId: "e-counter", sourceId: "s2", excerpt: "Alternative scenario", contextNote: null, locator },
  ],
  links: [
    { claimId: "fact", evidenceId: "e-fact", stance: "supports" },
    { claimId: "forecast", evidenceId: "e-forecast", stance: "supports" },
    { claimId: "forecast", evidenceId: "e-counter", stance: "contradicts" },
  ],
});

const ready = createScriptQaReport(createScriptEvidenceBindingMap({
  graph,
  statements: [
    { statementId: "fact-ready", sceneId: 1, text: "The record shows the documented fact.", evidenceMode: "required", claimIds: ["fact"] },
    { statementId: "forecast-ready", sceneId: 2, text: "This may happen; however, an alternative scenario also exists.", evidenceMode: "required", claimIds: ["forecast"] },
  ],
}));
assert.equal(ready.status, "ready");
assert.equal(ready.issues.length, 0);

const certainty = createScriptQaReport(createScriptEvidenceBindingMap({
  graph,
  statements: [
    { statementId: "certainty", sceneId: 1, text: "This will definitely happen.", evidenceMode: "required", claimIds: ["forecast"] },
  ],
}));
assert.equal(certainty.status, "review");
assert.ok(certainty.issues.some((issue) => issue.code === "CLAIM_CERTAINTY_MISMATCH"));
assert.ok(certainty.issues.some((issue) => issue.code === "COUNTER_EVIDENCE_NOT_REFLECTED"));

const counterMissing = createScriptQaReport(createScriptEvidenceBindingMap({
  graph,
  statements: [
    { statementId: "counter", sceneId: 1, text: "The forecast points to a future outcome.", evidenceMode: "required", claimIds: ["forecast"] },
  ],
}));
assert.equal(counterMissing.status, "review");
assert.deepEqual(
  counterMissing.issues.map((issue) => issue.code),
  ["COUNTER_EVIDENCE_NOT_REFLECTED"],
);

const untraceableGraph = createResearchClaimEvidenceGraph({
  sources: [],
  claims: [{ claimId: "fact", claimType: "FACT", text: "Unsupported fact." }],
  evidence: [],
  links: [],
});
const blocked = createScriptQaReport(createScriptEvidenceBindingMap({
  graph: untraceableGraph,
  statements: [
    { statementId: "blocked", sceneId: 1, text: "An unsupported factual statement.", evidenceMode: "required", claimIds: ["fact"] },
  ],
}));
assert.equal(blocked.status, "blocked");
assert.equal(blocked.blockedIssueCount, 1);
assert.equal(blocked.issues[0].code, "STATEMENT_TRACEABILITY_REQUIRED");

const modeMismatch = createScriptQaReport(createScriptEvidenceBindingMap({
  graph,
  statements: [
    { statementId: "mode", sceneId: 1, text: "A factual statement is presented.", evidenceMode: "not_required", claimIds: ["fact"] },
  ],
}));
assert.equal(modeMismatch.status, "review");
assert.ok(modeMismatch.issues.some((issue) => issue.code === "EVIDENCE_MODE_MISMATCH"));

console.log("Stage 0.10H-2D lightweight script QA tests passed.");
