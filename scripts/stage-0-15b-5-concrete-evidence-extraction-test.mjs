import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  classifyEditorialGroundingSpanSpecificity,
  createEditorialGroundingCandidateSpans,
  installCanonicalEditorialEvidenceSpans,
} from "../lib/research/editorialGroundingRepair.ts";

const source = (sourceId, summary) => ({
  sourceId,
  adapterId: "web",
  mediaKind: "article",
  externalId: sourceId,
  title: `${sourceId} source`,
  url: `https://example.test/${sourceId}`,
  publisher: "Example Research",
  author: null,
  publishedAt: null,
  language: "en",
  summary,
  thumbnailUrl: null,
  durationSec: null,
  metrics: {},
  sourceMetadata: {},
});

const memoryAbstract = "Post-event information can alter memory.";
const memoryConcrete = "After participants were exposed to misleading post-event information, they later reported details introduced by the suggestion.";
const memoryBoundary = "The observed result followed that specific suggestion procedure.";
const memorySource = source(
  "memory",
  `${memoryAbstract} ${memoryConcrete} ${memoryBoundary}`,
);
const memorySpans = createEditorialGroundingCandidateSpans([memorySource]);
const concreteMemorySpan = memorySpans.find((span) => span.text.includes(memoryConcrete));
const abstractMemorySpan = memorySpans.find((span) => span.text.includes(memoryAbstract) && !span.text.includes(memoryConcrete));
assert.ok(concreteMemorySpan);
assert.ok(abstractMemorySpan);
assert.equal(concreteMemorySpan.evidenceSpecificity, "concrete_observation");
assert.equal(abstractMemorySpan.evidenceSpecificity, "abstract_or_conceptual");
assert.ok(
  memorySpans.indexOf(concreteMemorySpan) < memorySpans.indexOf(abstractMemorySpan),
  "concrete grounded evidence is preferred within the same source",
);

const concreteProposal = {
  claims: [{
    claimId: "memory-finding",
    claimType: "RESEARCH_FINDING",
    text: "Post-event suggestion can distort later recall.",
  }],
  evidence: [{
    evidenceId: "memory-evidence",
    sourceId: memorySource.sourceId,
    spanId: concreteMemorySpan.spanId,
    contextNote: memoryBoundary,
  }],
  links: [{ claimId: "memory-finding", evidenceId: "memory-evidence", stance: "supports" }],
};
const installed = installCanonicalEditorialEvidenceSpans({
  proposal: concreteProposal,
  candidateSpans: memorySpans,
});
assert.equal(installed.claims[0].text, "Post-event suggestion can distort later recall.");
assert.equal(installed.evidence[0].excerpt, concreteMemorySpan.text);
assert.equal(installed.evidence[0].sourceId, memorySource.sourceId);
assert.equal(installed.evidence[0].evidenceId, "memory-evidence");
assert.equal(installed.evidence[0].contextNote, memoryBoundary);
assert.notEqual(installed.claims[0].text, installed.evidence[0].excerpt);

const abstractOnly = "Automation exposure varies across occupations.";
const abstractSource = source("work-abstract", abstractOnly);
const abstractSpans = createEditorialGroundingCandidateSpans([abstractSource]);
assert.equal(abstractSpans.length, 1);
assert.equal(abstractSpans[0].evidenceSpecificity, "abstract_or_conceptual");
assert.equal(abstractSpans[0].text, abstractOnly);
assert.doesNotMatch(abstractSpans[0].text, /participants?|sample|survey|percent|procedure/iu);

const workConcrete = "Across measured occupations, analysts compared task-level exposure and found higher exposure in clerical tasks than in outdoor manual tasks.";
const workSource = source("work-concrete", `${abstractOnly} ${workConcrete}`);
const workSpans = createEditorialGroundingCandidateSpans([workSource]);
assert.equal(
  workSpans.find((span) => span.text.includes(workConcrete))?.evidenceSpecificity,
  "concrete_observation",
  "concrete preference is domain-generic",
);

for (const conceptual of [
  "Memory is reconstructive rather than archival.",
  "Identity may be understood as an interpretation of the past.",
]) {
  assert.equal(
    classifyEditorialGroundingSpanSpecificity(conceptual),
    "abstract_or_conceptual",
    "conceptual and theoretical material is not forced into empirical form",
  );
}

const route = await readFile(new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url), "utf8");
assert.match(route, /prefer a claim-relevant candidate marked concrete_observation/);
assert.match(route, /Concrete preference means extraction only/);
assert.match(route, /THEORY, EDITORIAL_INFERENCE, METAPHYSICAL_CLAIM/);
assert.match(route, /Set contextNote only when the selected source span explicitly supplies/);
assert.equal((route.match(/client\.responses\.create\(/g) || []).length, 2, "no provider stage was added");

console.log("Stage 0.15B.5 concrete grounded evidence extraction tests passed.");
