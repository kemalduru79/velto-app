import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCanonicalEditorialCapabilitySnapshot,
  repairCollapsedCanonicalEditorialSelection,
} from "../lib/research/editorialCanonicalSelectionRepair.ts";

const sources = [
  ["source-1", "Researchers asked 120 participants to compare records and found a measured difference after the procedure."],
  ["source-2", "The reported comparison applied only under the documented procedure and did not establish that every recollection changes."],
  ["source-3", "A separate documented observation established another bounded finding."],
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

function graph({ uncertainty = false, diversity = false } = {}) {
  const claims = [{ claimId: "claim-base", claimType: "RESEARCH_FINDING", text: "A procedure produced a measured difference." }];
  const evidence = [{ evidenceId: "evidence-base", sourceId: "source-1", excerpt: sources[0].summary, contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }];
  const links = [{ claimId: "claim-base", evidenceId: "evidence-base", stance: "supports" }];
  if (uncertainty) {
    claims.push({ claimId: "claim-limit", claimType: "FACT", text: "The finding has a documented boundary." });
    evidence.push({ evidenceId: "evidence-limit", sourceId: "source-2", excerpt: sources[1].summary, contextNote: "Procedure-specific boundary.", locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } });
    links.push({ claimId: "claim-limit", evidenceId: "evidence-limit", stance: "contextualizes" });
  }
  if (diversity) {
    claims.push({ claimId: "claim-distinct", claimType: "FACT", text: "A separate grounded observation was documented." });
    evidence.push({ evidenceId: "evidence-distinct", sourceId: "source-3", excerpt: sources[2].summary, contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } });
    links.push({ claimId: "claim-distinct", evidenceId: "evidence-distinct", stance: "supports" });
  }
  return { version: "0.10H-1B", sources, claims, evidence, links };
}

const base = graph();
const completed = graph({ uncertainty: true, diversity: true });

async function run({ first = base, outcome = "additions_found", candidate = completed, invalid = false } = {}) {
  let providerCalls = 0;
  let researchCalls = 0;
  const result = await repairCollapsedCanonicalEditorialSelection({
    candidateSpans: candidates,
    graph: first,
    requestRepair: async () => {
      providerCalls += 1;
      return { repairOutcome: outcome, canonicalGraph: candidate };
    },
    validateRepair: async (proposal) => {
      if (invalid) throw new Error("invalid grounded addition");
      return proposal;
    },
  });
  return { result, providerCalls, researchCalls };
}

const additions = await run();
assert.equal(additions.result.diagnostic.repairAccepted, true);
assert.equal(additions.result.diagnostic.reasonCode, "repair_accepted");
assert.deepEqual([
  additions.result.diagnostic.providerParsedClaimCount,
  additions.result.diagnostic.providerParsedEvidenceCount,
  additions.result.diagnostic.providerParsedLinkCount,
], [3, 3, 3]);
assert.deepEqual([
  additions.result.diagnostic.postValidationClaimCount,
  additions.result.diagnostic.postValidationEvidenceCount,
  additions.result.diagnostic.postValidationLinkCount,
], [3, 3, 3]);
assert.deepEqual([
  additions.result.diagnostic.finalRepairClaimCount,
  additions.result.diagnostic.finalRepairEvidenceCount,
  additions.result.diagnostic.finalRepairDistinctSourceCount,
], [3, 3, 3]);
assert.equal(createCanonicalEditorialCapabilitySnapshot(additions.result.graph).hasUncertaintyCapability, true);

const noAddition = await run({ outcome: "no_qualifying_addition", candidate: base });
assert.equal(noAddition.result.graph, base);
assert.equal(noAddition.result.diagnostic.repairAccepted, false);
assert.equal(noAddition.result.diagnostic.reasonCode, "no_qualifying_addition");
assert.deepEqual([
  noAddition.result.diagnostic.providerParsedClaimCount,
  noAddition.result.diagnostic.postValidationClaimCount,
  noAddition.result.diagnostic.finalRepairClaimCount,
], [1, 1, 1]);

const falseAddition = await run({ candidate: base });
assert.equal(falseAddition.result.graph, base);
assert.equal(falseAddition.result.diagnostic.reasonCode, "declared_additions_but_no_material_change");

const invalidAddition = await run({ invalid: true });
assert.equal(invalidAddition.result.graph, base);
assert.equal(invalidAddition.result.diagnostic.reasonCode, "repair_invalid");
assert.equal(invalidAddition.result.diagnostic.providerParsedClaimCount, 3);
assert.equal(invalidAddition.result.diagnostic.postValidationClaimCount, null);

const healthy = completed;
const healthyFirstPass = await run({ first: healthy, candidate: healthy });
assert.equal(healthyFirstPass.providerCalls, 0);
assert.equal(healthyFirstPass.result.graph, healthy);
assert.equal(healthyFirstPass.result.diagnostic.providerParsedClaimCount, null);

for (const fixture of [additions, noAddition, falseAddition, invalidAddition, healthyFirstPass]) {
  assert.ok(fixture.providerCalls <= 1, "repair remains bounded to one optional provider call");
  assert.equal(fixture.researchCalls, 0, "repair performs no research expansion");
}

const route = await readFile(new URL("../app/api/creator-editorial-analysis/route.ts", import.meta.url), "utf8");
assert.ok(route.includes('enum: ["additions_found", "no_qualifying_addition"]'));
assert.ok(route.includes('required: ["repairOutcome", "canonicalGraph"]'));
assert.ok(route.includes('repairOutcome: "additions_found | no_qualifying_addition"'));
assert.ok(route.includes("You MUST choose exactly one repairOutcome"));
assert.ok(route.includes("Do not return the unchanged base graph under additions_found"));
assert.ok(!route.includes("If the discovery material supports no additional materially distinct authority, return the base graph unchanged."));

console.log("Stage 0.15B.6I repair contract disambiguation: PASS");
