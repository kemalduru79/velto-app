import assert from "node:assert/strict";
import { createCreatorScriptNarrationEditorialContext } from "../lib/creator/creatorScript.ts";
import { buildCreatorEvidencePromptPack, createSourceAwareEvidencePackContext } from "../lib/research/creatorEvidencePack.ts";
import { reviewScriptResearchFidelity } from "../lib/research/scriptEvidenceQa.ts";

const source = (sourceId, title, publishedAt) => ({ sourceId, title, publishedAt, url: `https://example.test/${sourceId}`, publisher: "Research group", author: null, directness: "primary", reviewStatus: "usable", searchLane: "baseline", sourceKind: "paper" });
const evidence = (evidenceId, sourceId, excerpt) => ({ evidenceId, sourceId, excerpt, contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } });
const claim = (claimId, text, evidenceId) => ({ claimId, text, claimType: "RESEARCH_FINDING", supportingEvidenceIds: [evidenceId], counterEvidenceIds: [], contextualEvidenceIds: [] });
const context = {
  version: "0.10H-2H", sourceVersion: "0.10H-2E", editorialConstitution: "Grounded research.",
  readiness: { status: "ready", editorialReadinessScore: 100, reviewReasons: [], primarySourceRequiredClaimIds: [], primarySourceCoveredClaimIds: [] },
  sources: [source("s1", "Original developer study", "2025-07-10"), source("s2", "Later recruitment update", "2026-02-24")],
  evidence: [evidence("e1", "s1", "In 2025, 16 developers completed 246 tasks; tasks took 19% longer."), evidence("e2", "s2", "A later experiment encountered recruitment and retention selection effects.")],
  claims: [claim("c1", "The original experiment involved 16 developers and 246 tasks and found a 19% slowdown.", "e1"), claim("c2", "The later experiment encountered selection effects.", "e2")],
};
const original = JSON.stringify(context);
const projected = createCreatorScriptNarrationEditorialContext(context);
const packContext = createSourceAwareEvidencePackContext({ narrationContext: projected, originalContext: context });
const pack = buildCreatorEvidencePromptPack({ context: packContext });
assert.equal(pack[0].sourceRefs[0].title, "Original developer study");
assert.equal(pack[0].sourceRefs[0].publishedAt, "2025-07-10");
assert.equal(pack[0].supportingEvidence[0].sourceId, "s1");
assert.match(pack[0].supportingEvidence[0].excerpt, /16 developers.*246 tasks.*19%/);
assert.equal(pack[1].sourceRefs[0].sourceId, "s2");
assert.equal(JSON.stringify(context), original, "projection must not mutate research");
const check = (text, claimIds) => reviewScriptResearchFidelity({ sections: [{ id: "body", text, claimIds }], context: projected });
assert.equal(check("16 developers completed 246 tasks, taking 19% longer.", ["c1"]).issues.length, 0);
assert(check("The 2025 result was slower because of later selection effects.", ["c1", "c2"]).issues.some((issue) => issue.code === "CAUSAL_ATTRIBUTION_REVIEW"));
assert(check("The 2025 result was slower because of later selection effects.", ["c1", "c2"]).issues.some((issue) => issue.code === "MULTIPLE_SOURCE_ATTRIBUTION_REVIEW"));
assert(check("The trial involved 999 developers.", ["c1"]).issues.some((issue) => issue.code === "NUMERIC_ATTRIBUTION_REVIEW"));
const unrelated = { ...projected, sources: [source("a", "Ocean sampling", "2018-01-01"), source("b", "Ocean sampling follow-up", "2022-01-01")], evidence: [evidence("ea", "a", "In 2017, 42 samples were measured."), evidence("eb", "b", "The later survey had missing measurements.")], claims: [claim("a1", "42 samples were measured in 2017.", "ea"), claim("b1", "The later survey had missing measurements.", "eb")] };
assert(reviewScriptResearchFidelity({ context: unrelated, sections: [{ id: "ocean", claimIds: ["a1", "b1"], text: "The 2017 survey measured 42 samples because of missing measurements." }] }).issues.some((issue) => issue.code === "MULTIPLE_SOURCE_ATTRIBUTION_REVIEW"));
console.log("RESEARCH_SCRIPT_FIDELITY_OFFLINE=PASS");
