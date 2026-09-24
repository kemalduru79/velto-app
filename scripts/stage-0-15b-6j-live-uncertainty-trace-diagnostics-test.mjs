import assert from "node:assert/strict";
import { writeFile, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import {
  repairCollapsedCanonicalEditorialSelection,
} from "../lib/research/editorialCanonicalSelectionRepair.ts";

const sources = [
  ["source-1", "Researchers asked 120 participants to compare records and found a measured difference after the procedure."],
  ["source-2", "The comparison applied only under the documented procedure and did not establish that every recollection changes."],
  ["source-3", "A separate grounded observation supports the baseline account."],
].map(([sourceId, summary]) => ({
  sourceId, adapterId: "academic", mediaKind: "paper", externalId: null,
  title: sourceId, url: `https://example.test/${sourceId}`, publisher: "Fixture",
  author: null, publishedAt: null, language: "en", summary,
  thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: {},
}));
const candidates = sources.map((source, index) => ({
  spanId: `span-${index + 1}-1`, sourceId: source.sourceId, text: source.summary,
  evidenceSpecificity: index === 0 ? "concrete_observation" : "abstract_or_conceptual",
  researchPurposes: index === 1 ? ["counter_evidence"] : ["baseline"],
}));

function graph({ completed = false } = {}) {
  const claims = [{ claimId: "claim-base", claimType: "RESEARCH_FINDING", text: "A measured difference was observed." }];
  const evidence = [{ evidenceId: "evidence-base", sourceId: "source-1", excerpt: sources[0].summary, contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }];
  const links = [{ claimId: "claim-base", evidenceId: "evidence-base", stance: "supports" }];
  if (completed) {
    claims.push(
      { claimId: "claim-limit", claimType: "FACT", text: "The finding has a procedure-specific boundary." },
      { claimId: "claim-support", claimType: "FACT", text: "A separate observation supports the baseline." },
    );
    evidence.push(
      { evidenceId: "evidence-limit", sourceId: "source-2", excerpt: sources[1].summary, contextNote: "Procedure-specific boundary.", locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } },
      { evidenceId: "evidence-support", sourceId: "source-3", excerpt: sources[2].summary, contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } },
    );
    links.push(
      { claimId: "claim-limit", evidenceId: "evidence-limit", stance: "contextualizes" },
      { claimId: "claim-support", evidenceId: "evidence-support", stance: "supports" },
    );
  }
  return { version: "0.10H-1B", sources, claims, evidence, links };
}

const base = graph();
const completed = graph({ completed: true });
const result = await repairCollapsedCanonicalEditorialSelection({
  candidateSpans: candidates,
  graph: base,
  requestRepair: async () => ({ repairOutcome: "additions_found", canonicalGraph: {
    claims: completed.claims,
    evidence: completed.evidence.map((item, index) => ({
      evidenceId: item.evidenceId,
      sourceId: item.sourceId,
      spanId: candidates[index].spanId,
      contextNote: item.contextNote,
    })),
    links: completed.links,
  } }),
  validateRepair: async () => completed,
});

assert.deepEqual(result.diagnostic.counterPurposeDiscoveryCandidates, [{
  spanId: "span-2-1", sourceId: "source-2",
}]);
assert.deepEqual(result.diagnostic.returnedAuthorities.map((item) => ({
  claimId: item.claimId, claimType: item.claimType, evidenceId: item.evidenceId,
  selectedSpanId: item.selectedSpanId, sourceId: item.sourceId, stance: item.stance,
})), [
  { claimId: "claim-base", claimType: "RESEARCH_FINDING", evidenceId: "evidence-base", selectedSpanId: "span-1-1", sourceId: "source-1", stance: "supports" },
  { claimId: "claim-limit", claimType: "FACT", evidenceId: "evidence-limit", selectedSpanId: "span-2-1", sourceId: "source-2", stance: "contextualizes" },
  { claimId: "claim-support", claimType: "FACT", evidenceId: "evidence-support", selectedSpanId: "span-3-1", sourceId: "source-3", stance: "supports" },
]);
assert.deepEqual(result.diagnostic.validatedAuthorities.map((item) => ({
  claimId: item.claimId, selectedSpanId: item.selectedSpanId,
  stance: item.stance, hasUncertaintyCapability: item.hasUncertaintyCapability,
})), [
  { claimId: "claim-base", selectedSpanId: "span-1-1", stance: "supports", hasUncertaintyCapability: false },
  { claimId: "claim-limit", selectedSpanId: "span-2-1", stance: "contextualizes", hasUncertaintyCapability: true },
  { claimId: "claim-support", selectedSpanId: "span-3-1", stance: "supports", hasUncertaintyCapability: false },
]);

const serializedDiagnostic = JSON.stringify(result.diagnostic);
for (const prohibited of ["excerpt", "contextNote", "claim-base text", ...sources.map((source) => source.summary)]) {
  assert.ok(!serializedDiagnostic.includes(prohibited), `runtime diagnostic must not contain ${prohibited}`);
}

const fixturePath = "/private/tmp/stage-0-15b-6j-captured-request.json";
await writeFile(fixturePath, JSON.stringify({ discoveryCandidateSpans: candidates }));
const reviewedText = execFileSync(process.execPath, [
  new URL("./stage-0-15b-6j-review-captured-span.mjs", import.meta.url).pathname,
  fixturePath,
  "span-2-1",
  "source-2",
], { encoding: "utf8" }).trim();
assert.equal(reviewedText, sources[1].summary);
await unlink(fixturePath);

console.log("Stage 0.15B.6J live uncertainty trace diagnostics: PASS");
