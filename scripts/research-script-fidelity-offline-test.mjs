import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCreatorScriptNarrationEditorialContext, createCreatorScriptSectionBudgetPlan } from "../lib/creator/creatorScript.ts";
import { buildCreatorEvidencePromptPack, buildCreatorSectionEvidencePromptPack, createSourceAwareEvidencePackContext, prepareCompactEmpiricalDocumentaryPlan } from "../lib/research/creatorEvidencePack.ts";
import { reviewCompactDocumentaryDraft, reviewScriptResearchFidelity } from "../lib/research/scriptEvidenceQa.ts";

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
const basePlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: 180, language: "en" });
const compactContext = { ...context, evidence: [evidence("e1", "s1", "Researchers randomly assigned tasks: 16 experienced developers completed 246 tasks and took 19% longer with AI. Developers initially expected a 24% speedup and reported their implementation time."), evidence("e2", "s2", "The February 2026 discussion described a separate August 2025 experiment and its recruitment and measurement difficulties.")], claims: context.claims };
const compactPlan = prepareCompactEmpiricalDocumentaryPlan({ plan: basePlan, context: compactContext, format: "analytical documentary" });
assert.notEqual(compactPlan, basePlan);
assert(compactPlan[1].ownershipBoundary.owns.includes("grounded_demonstration"));
assert(compactPlan[2].ownershipBoundary.owns.includes("limits"));
assert.deepEqual(compactPlan.map(s => [s.minimumWords, s.targetWords, s.maximumWords]), basePlan.map(s => [s.minimumWords, s.targetWords, s.maximumWords]));
assert.equal(prepareCompactEmpiricalDocumentaryPlan({ plan: basePlan, context: compactContext, format: "fictional documentary" }), basePlan);
const otherContext = { ...unrelated, evidence: [evidence("ea", "a", "Researchers assigned 42 participants and measured outcomes in a controlled trial."), unrelated.evidence[1]] };
assert.notEqual(prepareCompactEmpiricalDocumentaryPlan({ plan: basePlan, context: otherContext, format: "documentary" }), basePlan);
assert.equal(prepareCompactEmpiricalDocumentaryPlan({ plan: basePlan, context: compactContext, format: "educational explainer" }), basePlan);
const unit = buildCreatorSectionEvidencePromptPack({ context: compactContext, section: compactPlan[1], eligibleClaimIds: ["c2", "c1"], maxUnits: 5 });
assert.equal(unit.units[0].claimId, "c1");
assert.match(unit.units[0].supportingEvidence[0].excerpt, /16 experienced developers.*246 tasks.*19%.*24%/);
assert.equal(unit.units[0].sourceRefs[0].publishedAt, "2025-07-10");
assert.equal(unit.units[1].sourceRefs[0].publishedAt, "2026-02-24");
assert.match(unit.units[1].supportingEvidence[0].excerpt, /separate August 2025 experiment/);
const diagnosticPlan = compactPlan.map(s => ({ ...s, minimumWords: 1, maximumWords: 300 }));
const weak = [
  { id: "opening", kind: "opening", text: "What happened?", claimIds: [] },
  { id: "section-1", kind: "body", text: "This definitely proves every developer always gets slower with AI.", claimIds: [] },
  { id: "section-2", kind: "body", text: "This definitely proves every developer always gets slower with AI.", claimIds: [] },
  { id: "conclusion", kind: "conclusion", text: "What next? What now?", claimIds: [] },
];
const stronger = [
  { id: "opening", kind: "opening", text: "A surprising result raises a question?", claimIds: ["c1"] },
  { id: "section-1", kind: "body", text: "Researchers assigned tasks to 16 developers and measured 246 tasks, finding 19% longer completion times.", claimIds: ["c1"] },
  { id: "section-2", kind: "body", text: "The later study faced selection challenges, a separate boundary on interpretation.", claimIds: ["c2"] },
  { id: "conclusion", kind: "conclusion", text: "What can measurement reveal about work?", claimIds: [] },
];
assert(reviewCompactDocumentaryDraft({ sections: weak, plan: diagnosticPlan }).issues.length > reviewCompactDocumentaryDraft({ sections: stronger, plan: diagnosticPlan }).issues.length);
assert.equal(JSON.stringify(context), original, "quality diagnostics must not alter research snapshots");
const route = readFileSync("app/api/creator-script-plan/route.ts", "utf8");
assert.match(route, /compactEmpirical \? buildCreatorSectionEvidencePromptPack/);
assert.match(route, /concreteEvidenceMomentGuidance: compactEmpirical \|\|/);
assert.match(route, /evidenceMomentContext:[\s\S]*: evidenceMomentPack/);
console.log("RESEARCH_SCRIPT_FIDELITY_OFFLINE=PASS");
