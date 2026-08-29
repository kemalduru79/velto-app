import assert from "node:assert/strict";
import fs from "node:fs";
import { createCreatorEvidenceVisualContext } from "../lib/creator/evidenceVisualContext.ts";

const graph = {
  version: "0.10H-1B",
  sources: [],
  claims: [
    { claimId: "fact-1", claimType: "FACT", text: "A measured fact" },
    { claimId: "finding-1", claimType: "RESEARCH_FINDING", text: "A research finding" },
    { claimId: "primary-1", claimType: "PRIMARY_SOURCE_CLAIM", text: "A primary-source claim" },
  ],
  evidence: [
    { evidenceId: "e-fact", sourceId: "s-data", excerpt: "42 percent", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } },
    { evidenceId: "e-quote", sourceId: "s-primary", excerpt: "I said this", contextNote: null, locator: { section: null, page: null, timecodeStartSec: 10, timecodeEndSec: 14 } },
  ],
  links: [],
};

const bindings = {
  version: "0.10H-2C",
  statements: [
    {
      statementId: "st-1",
      sceneId: 1,
      text: "Fact narration",
      evidenceMode: "required",
      claimReferences: [{ claimId: "fact-1", claimType: "FACT" }],
      supportingEvidenceIds: ["e-fact"],
      supportingSourceIds: ["s-data"],
      counterEvidenceIds: [], counterSourceIds: [], contextualEvidenceIds: [], contextualSourceIds: [],
      traceabilityStatus: "traceable",
    },
    {
      statementId: "st-2",
      sceneId: 1,
      text: "Primary claim narration",
      evidenceMode: "required",
      claimReferences: [{ claimId: "primary-1", claimType: "PRIMARY_SOURCE_CLAIM" }],
      supportingEvidenceIds: ["e-quote"],
      supportingSourceIds: ["s-primary"],
      counterEvidenceIds: [], counterSourceIds: [], contextualEvidenceIds: [], contextualSourceIds: [],
      traceabilityStatus: "traceable",
    },
    {
      statementId: "st-3",
      sceneId: 2,
      text: "Partial finding",
      evidenceMode: "required",
      claimReferences: [{ claimId: "finding-1", claimType: "RESEARCH_FINDING" }],
      supportingEvidenceIds: ["e-fact"],
      supportingSourceIds: ["s-data"],
      counterEvidenceIds: [], counterSourceIds: [], contextualEvidenceIds: [], contextualSourceIds: [],
      traceabilityStatus: "partial",
    },
  ],
};

const sceneOne = createCreatorEvidenceVisualContext({ sceneId: 1, bindings, graph });
assert.equal(sceneOne.version, "0.10H-4D");
assert.equal(sceneOne.statementCount, 2);
assert.equal(sceneOne.traceableStatementCount, 2);
assert.equal(sceneOne.supportingEvidenceCount, 2);
assert.equal(sceneOne.supportingSourceCount, 2);
assert.equal(sceneOne.factClaimCount, 1);
assert.equal(sceneOne.primarySourceClaimCount, 1);
assert.equal(sceneOne.dataVisualCandidate, true);
assert.equal(sceneOne.quoteCardCandidate, true);
assert.equal(sceneOne.quoteCardRequiresReview, true);
assert.equal(sceneOne.sourceCardCandidate, true);

const sceneTwo = createCreatorEvidenceVisualContext({ sceneId: 2, bindings, graph });
assert.equal(sceneTwo.statementCount, 1);
assert.equal(sceneTwo.traceableStatementCount, 0);
assert.equal(sceneTwo.dataVisualCandidate, false, "partial traceability must not drive evidence visuals");
assert.equal(sceneTwo.quoteCardCandidate, false);
assert.equal(sceneTwo.sourceCardCandidate, false);

const source = fs.readFileSync("lib/creator/evidenceVisualContext.ts", "utf8");
assert.doesNotMatch(source, /providerName|providerRequestId|providerCostUsd|rawProviderPayload/);
assert.doesNotMatch(source, /quoteText:|excerpt:/, "Evidence visual context must not expose quote/excerpt content");

console.log("Stage 0.10H-4D evidence visual context tests passed.");
