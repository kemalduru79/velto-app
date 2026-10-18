import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createCreatorScript, getCreatorScriptDurationContractForScript } from "../lib/creator/creatorScript.ts";
import {
  createCreatorScriptRewriteGoalPlan,
  creatorScriptInstructionRequiresResearch,
  executeCreatorScriptEditorialRewrite,
  isCreatorScriptFullRefinementRuntimeEnabled,
  normalizeCreatorScriptRefinementMode,
  validateCreatorScriptRewriteCandidate,
} from "../lib/creator/creatorScriptEditorialRewrite.ts";
import { applyCreatorScriptProposal, createCreatorScriptProposal, discardCreatorScriptProposal } from "../lib/creator/creatorScriptRevisions.ts";
import { classifyCreatorScriptRefinementFailure } from "../lib/creator/creatorScriptRefinementRuntime.ts";

const words = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");
const context = {
  version: "0.10H-2H",
  sourceVersion: "0.10H-2E",
  editorialConstitution: "Preserve evidence and uncertainty.",
  readiness: { status: "ready", editorialReadinessScore: 95, reviewReasons: [] },
  claims: [
    { claimId: "claim-archive", claimType: "FACT", text: "Archived answers can be replayed.", supportingEvidenceIds: ["e-archive"], counterEvidenceIds: [], contextualEvidenceIds: [] },
  ],
  evidence: [{ evidenceId: "e-archive", sourceId: "source-archive", excerpt: "Archived question and answer material.", contextNote: null, locator: { section: null, page: null, timecodeStartSec: null, timecodeEndSec: null } }],
  sources: [{ sourceId: "source-archive", title: "Archive", url: "https://example.test/archive", publisher: "Archive", author: null, publishedAt: null, directness: "primary", reviewStatus: "usable" }],
};
const script = createCreatorScript({
  title: "Thynel",
  sections: [
    { id: "opening", kind: "opening", heading: "A voice remains", text: words("open", 120), claimIds: ["claim-archive"], evidenceReviewRequired: false },
    { id: "body", kind: "body", heading: "Prediction and identity", text: words("body", 960), claimIds: ["claim-archive"], evidenceReviewRequired: false },
    { id: "conclusion", kind: "conclusion", heading: "What survives", text: words("end", 120), claimIds: [], evidenceReviewRequired: false },
  ],
  targetDurationSec: 525,
  strategyFingerprint: "thynel-fp",
  grounding: { context },
  generatedAt: "2026-10-18T00:00:00.000Z",
  updatedAt: "2026-10-18T00:00:00.000Z",
});
assert.equal(getCreatorScriptDurationContractForScript(script, "en").status, "compliant");

assert.equal(normalizeCreatorScriptRefinementMode("focused_edit", "opening"), "focused_edit");
assert.equal(normalizeCreatorScriptRefinementMode("editorial_rewrite", "whole_script"), "editorial_rewrite");
assert.throws(() => normalizeCreatorScriptRefinementMode(undefined, "whole_script"), /MODE_REQUIRED/);
assert.equal(isCreatorScriptFullRefinementRuntimeEnabled({ NODE_ENV: "production", CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED: "true" }), false);
assert.equal(isCreatorScriptFullRefinementRuntimeEnabled({ NODE_ENV: "test", CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED: "true" }), true);

const instruction = "Replace weak references with documented AI-generated novel replies and the Stanford 1,052-agent behavior-prediction study. Add the identity-fission two-copies paradox; strengthen contrasting positions and the moral ending. Keep the English accessible at B1-B2 and stay below 10:00.";
const goals = createCreatorScriptRewriteGoalPlan(instruction);
assert.ok(goals.some((goal) => goal.kind === "evidence"));
assert.ok(goals.some((goal) => goal.kind === "progression"));
assert.ok(goals.some((goal) => goal.kind === "accessibility"));
assert.equal(creatorScriptInstructionRequiresResearch(instruction), true);

const candidate = {
  sections: [
    { id: "opening", text: words("conversation", 120), claimIds: ["claim-novel-replies"], reason: "Open with the verified surprising conversation case." },
    { id: "body", text: words("prediction", 960), claimIds: ["claim-stanford-agents", "claim-identity-fission"], reason: "Contrast behavioral prediction with the two-copies identity paradox." },
    { id: "conclusion", text: words("moral", 120), claimIds: ["claim-identity-fission"], reason: "End on the moral difference between imitation and survival." },
  ],
  goalResults: goals.map((goal) => ({ goalId: goal.goalId, status: "satisfied", sectionIds: goal.kind === "ending" ? ["conclusion"] : ["opening", "body"], summary: `Satisfied ${goal.kind} with a traceable revision.` })),
  evidenceDelta: {
    addedSourceIds: ["source-ai-conversation", "source-stanford-agents", "source-identity-philosophy"],
    removedSourceIds: [],
    retainedSourceIds: ["source-archive"],
    addedClaimIds: ["claim-novel-replies", "claim-stanford-agents", "claim-identity-fission"],
    removedClaimIds: [],
  },
};
const authority = {
  allowedClaimIds: ["claim-archive", "claim-novel-replies", "claim-stanford-agents", "claim-identity-fission"],
  allowedSourceIds: ["source-archive", "source-ai-conversation", "source-stanford-agents", "source-identity-philosophy"],
};
const accepted = validateCreatorScriptRewriteCandidate({ script, language: "en", mode: "research_backed_rewrite", instruction, candidate, ...authority, hardCeilingSec: 600 });
assert.deepEqual(accepted.changedSectionIds, ["opening", "body", "conclusion"]);
assert.ok(accepted.duration.estimatedDurationSec <= 600);
assert.deepEqual(accepted.evidenceDelta.addedSourceIds, candidate.evidenceDelta.addedSourceIds);
assert.throws(() => validateCreatorScriptRewriteCandidate({ script, language: "en", mode: "research_backed_rewrite", instruction, candidate: { ...candidate, sections: candidate.sections.map((section, index) => index === 1 ? { ...section, claimIds: ["invented-claim"] } : section) }, ...authority }), /UNSUPPORTED_NEW_CLAIM/);
assert.throws(() => validateCreatorScriptRewriteCandidate({ script, language: "en", mode: "research_backed_rewrite", instruction, candidate: { ...candidate, evidenceDelta: { ...candidate.evidenceDelta, addedSourceIds: [], addedClaimIds: [] } }, ...authority }), /MISSING_SOURCES/);
assert.throws(() => validateCreatorScriptRewriteCandidate({ script, language: "en", mode: "research_backed_rewrite", instruction, candidate: { ...candidate, goalResults: candidate.goalResults.slice(1) }, ...authority }), /GOAL_MISMATCH/);
assert.throws(() => validateCreatorScriptRewriteCandidate({ script, language: "en", mode: "editorial_rewrite", instruction, candidate, ...authority }), /RESEARCH_REQUIRED/);

const verifiedSources = [
  { sourceId: "academic:stanford-agents", adapterId: "academic", mediaKind: "paper", externalId: "stanford-agents", title: "Generative Agents", url: "https://example.test/stanford-agents", publisher: "Stanford", author: "Research team", publishedAt: "2024-01-01", language: "en", summary: "A controlled simulation used 1,052 agents to study behavior prediction and social interaction.", thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: {} },
  { sourceId: "primary:novel-replies", adapterId: "primary", mediaKind: "document", externalId: "novel-replies", title: "Novel replies archive", url: "https://example.test/novel-replies", publisher: "StoryFile", author: null, publishedAt: null, language: "en", summary: "Archived prompts produced novel AI-generated replies that were not stored as prerecorded answers.", thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: {} },
];
const addedEvidence = [
  { evidenceId: "e-stanford", sourceId: "academic:stanford-agents", excerpt: "A controlled simulation used 1,052 agents to study behavior prediction and social interaction.", contextNote: "Simulation evidence, not proof of personal identity.", locator: { section: null, page: 1, timecodeStartSec: null, timecodeEndSec: null } },
  { evidenceId: "e-replies", sourceId: "primary:novel-replies", excerpt: "Archived prompts produced novel AI-generated replies that were not stored as prerecorded answers.", contextNote: "Demonstrates generative response behavior.", locator: { section: "results", page: null, timecodeStartSec: null, timecodeEndSec: null } },
];
const addedClaims = [
  { claimId: "claim-stanford", claimType: "RESEARCH_FINDING", text: "A Stanford simulation used 1,052 agents to examine predicted social behavior.", propositionKind: "original_research_result", origin: { attributedEntity: "Stanford", referencedWork: "https://example.test/stanford-agents" }, supportingEvidenceIds: ["e-stanford"], counterEvidenceIds: [], contextualEvidenceIds: [] },
  { claimId: "claim-novel", claimType: "PRIMARY_SOURCE_CLAIM", text: "The archive reports novel generated replies rather than only prerecorded answers.", propositionKind: "document_assertion", origin: { attributedEntity: "StoryFile", referencedWork: "https://example.test/novel-replies" }, supportingEvidenceIds: ["e-replies"], counterEvidenceIds: [], contextualEvidenceIds: [] },
];
let researchCalls = 0; let rewriteCalls = 0; let assessmentCalls = 0;
const executed = await executeCreatorScriptEditorialRewrite({
  script, subject: "digital afterlife", instruction, language: "en", mode: "research_backed_rewrite", hardCeilingSec: 600,
  dependencies: {
    research: async () => { researchCalls += 1; return { sources: verifiedSources }; },
    rewrite: async ({ goals: requestedGoals }) => { rewriteCalls += 1; return {
      sections: [
        { id: "opening", kind: "opening", heading: "A reply that was never recorded", text: words("reply", 120), claimIds: ["claim-novel"], evidenceReviewRequired: true },
        { id: "behavior", kind: "body", heading: "Prediction is not survival", text: words("behavior", 480), claimIds: ["claim-stanford"], evidenceReviewRequired: true },
        { id: "identity", kind: "body", heading: "The two-copy problem", text: words("identity", 480), claimIds: [], evidenceReviewRequired: false },
        { id: "conclusion", kind: "conclusion", heading: "What responsibility survives", text: words("moral", 120), claimIds: ["claim-novel", "claim-stanford"], evidenceReviewRequired: true },
      ], addedClaims, addedEvidence, goalResults: requestedGoals.map((goal) => ({ goalId: goal.goalId, status: "satisfied", sectionIds: ["behavior"], summary: "provider claim ignored" })),
    }; },
    assess: async ({ goals: requestedGoals }) => { assessmentCalls += 1; return requestedGoals.map((goal) => ({ goalId: goal.goalId, status: "satisfied", sectionIds: goal.kind === "ending" ? ["conclusion"] : ["opening", "behavior", "identity"], summary: `Independent assessment found a material ${goal.kind} change.` })); },
    now: () => "2026-10-18T01:00:00.000Z",
  },
});
assert.deepEqual([researchCalls, rewriteCalls, assessmentCalls], [1, 1, 1]);
assert.equal(executed.script.sections.some((section) => section.id === "identity"), true);
assert.equal(executed.script.grounding.context.sources.some((source) => source.sourceId === "academic:stanford-agents"), true);
assert.equal(executed.script.sections.find((section) => section.id === "behavior").claimIds.includes("claim-stanford"), true);
assert.ok(getCreatorScriptDurationContractForScript(executed.script, "en").estimatedDurationSec <= 600);
const proposal = createCreatorScriptProposal({ script, scope: "whole_script", instruction, nextScript: executed.script, mode: "research_backed_rewrite", goalResults: executed.goalResults, evidenceDelta: executed.evidenceDelta });
assert.equal(proposal.proposedScript.grounding.context.claims.some((claim) => claim.claimId === "claim-stanford"), true);
const applied = applyCreatorScriptProposal(script, proposal, "en");
assert.equal(applied.revision, script.revision + 1);
assert.equal(applied.grounding.context.evidence.some((item) => item.evidenceId === "e-stanford"), true);
const discarded = discardCreatorScriptProposal({ script, pendingRefinement: proposal }, proposal.proposalId);
assert.equal(discarded.script.grounding.context.claims.some((claim) => claim.claimId === "claim-stanford"), false);
assert.equal(discarded.pendingRefinement, null);
assert.throws(() => applyCreatorScriptProposal({ ...script, revision: script.revision + 1 }, proposal, "en"), /STALE/);

await assert.rejects(() => executeCreatorScriptEditorialRewrite({ script, subject: "digital afterlife", instruction, language: "en", mode: "research_backed_rewrite", dependencies: { research: async () => ({ sources: [] }), rewrite: async () => { throw new Error("should not run"); }, assess: async () => [] } }), /MISSING_SOURCES/);
await assert.rejects(() => executeCreatorScriptEditorialRewrite({ script, subject: "digital afterlife", instruction, language: "en", mode: "research_backed_rewrite", dependencies: { research: async () => ({ sources: verifiedSources }), rewrite: async () => ({ sections: executed.script.sections, addedClaims: [{ ...addedClaims[0], text: "Stanford proved 99 percent accuracy." }], addedEvidence: [addedEvidence[0]], goalResults: [] }), assess: async () => [] } }), /UNSUPPORTED_NEW_CLAIM|GOAL_MISMATCH/);

for (const code of ["CREATOR_SCRIPT_FULL_REFINEMENT_DEFERRED", "CREATOR_SCRIPT_REFINEMENT_MISSING_SOURCES", "CREATOR_SCRIPT_REFINEMENT_UNSUPPORTED_NEW_CLAIM", "CREATOR_SCRIPT_REFINEMENT_GOAL_MISMATCH", "CREATOR_SCRIPT_REFINEMENT_PROVIDER_OUTPUT_INVALID"]) {
  assert.equal(classifyCreatorScriptRefinementFailure(new Error(code)).code, code);
}

const route = await readFile(new URL("../app/api/creator-script/refine/route.ts", import.meta.url), "utf8");
const component = await readFile(new URL("../components/create/CreatorScriptReview.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/create/page.tsx", import.meta.url), "utf8");
assert.match(route, /normalizeCreatorScriptRefinementMode/);
assert.match(route, /executeCreatorScriptEditorialRewrite/);
assert.match(route, /CREATOR_SCRIPT_FULL_REFINEMENT_PRODUCTION_ENABLED/);
assert.match(route, /CREATOR_SCRIPT_REFINEMENT_STAGE/);
assert.match(component, /option value="editorial_rewrite"/);
assert.match(component, /option value="research_backed_rewrite"/);
assert.match(component, /scope: "whole_script", mode: refinementTarget/);
assert.doesNotMatch(component, /pendingRefinement\.scope !== "whole_script"/);
assert.match(page, /mode: "focused_edit" \| "editorial_rewrite" \| "research_backed_rewrite"/);
assert.doesNotMatch(page.slice(page.indexOf("const handleRefineCreatorScript"), page.indexOf("const handleOptimizeScenes")), /setCreatorSelectedWorkspaceStep|setCreatorProductionSubstep/);

console.log("CREATOR_SCRIPT_REFINEMENT_R2_RESEARCH_BACKED=PASS");
