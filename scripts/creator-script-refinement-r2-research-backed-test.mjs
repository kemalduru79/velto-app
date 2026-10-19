import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createJiti } from "jiti";
import { createCreatorScript, getCreatorScriptDurationContractForScript } from "../lib/creator/creatorScript.ts";
import { attachCreatorProjectState, buildCreatorProjectState } from "../lib/creator/projectState.ts";
import {
  createCreatorScriptRewriteGoalPlan,
  creatorScriptInstructionRequiresResearch,
  executeCreatorScriptEditorialRewrite,
  isCreatorScriptFullRefinementRuntimeEnabled,
  normalizeCreatorScriptRefinementMode,
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

const stanfordPassage = "A controlled simulation used 1,052 agents to study behavior prediction and social interaction.";
const repliesPassage = "Archived prompts produced novel AI-generated replies that were not stored as prerecorded answers.";
const passageMetadata = (passage) => ({ provenanceVerified: true, highlightCount: 1, verifiedPassageAuthority: "exa-source-highlight-v1", verifiedPassage1: passage, verifiedPassage1Digest: createHash("sha256").update(passage).digest("hex"), verifiedPassage1Locator: "exa-highlight:1" });
const verifiedSources = [
  { sourceId: "academic:stanford-agents", adapterId: "academic", mediaKind: "paper", externalId: "stanford-agents", title: "Generative Agents", url: "https://example.test/stanford-agents", publisher: "Stanford", author: "Research team", publishedAt: "2024-01-01", language: "en", summary: "Discovery summary is not evidence.", thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: passageMetadata(stanfordPassage) },
  { sourceId: "primary:novel-replies", adapterId: "primary", mediaKind: "document", externalId: "novel-replies", title: "Novel replies archive", url: "https://example.test/novel-replies", publisher: "StoryFile", author: null, publishedAt: null, language: "en", summary: "Discovery summary is not evidence.", thumbnailUrl: null, durationSec: null, metrics: {}, sourceMetadata: passageMetadata(repliesPassage) },
];
const addedEvidence = [
  { evidenceId: "e-stanford", sourceId: "academic:stanford-agents", excerpt: stanfordPassage, contextNote: "Simulation evidence, not proof of personal identity.", locator: { section: "exa-highlight:1", page: null, timecodeStartSec: null, timecodeEndSec: null } },
  { evidenceId: "e-replies", sourceId: "primary:novel-replies", excerpt: repliesPassage, contextNote: "Demonstrates generative response behavior.", locator: { section: "exa-highlight:1", page: null, timecodeStartSec: null, timecodeEndSec: null } },
];
const addedClaims = [
  { claimId: "claim-stanford", claimType: "RESEARCH_FINDING", text: "A Stanford simulation used 1,052 agents to examine predicted social behavior.", propositionKind: "original_research_result", origin: { attributedEntity: "Stanford", referencedWork: "https://example.test/stanford-agents" }, supportingEvidenceIds: ["e-stanford"], counterEvidenceIds: [], contextualEvidenceIds: [] },
  { claimId: "claim-novel", claimType: "PRIMARY_SOURCE_CLAIM", text: "The archive reports novel generated replies rather than only prerecorded answers.", propositionKind: "document_assertion", origin: { attributedEntity: "StoryFile", referencedWork: "https://example.test/novel-replies" }, supportingEvidenceIds: ["e-replies"], counterEvidenceIds: [], contextualEvidenceIds: [] },
];
let researchCalls = 0; let rewriteCalls = 0; let assessmentCalls = 0;
const verifiedEvidence = addedEvidence.map((evidence) => ({ sourceId: evidence.sourceId, excerpt: evidence.excerpt, locator: evidence.locator, passageDigest: createHash("sha256").update(evidence.excerpt).digest("hex"), authority: "exa-source-highlight-v1" }));
const rewrittenSections = [
  { id: "opening", kind: "opening", heading: "A reply that was never recorded", text: words("reply", 120), claimIds: ["claim-novel"], evidenceReviewRequired: true, lineage: { sourceSectionIds: ["opening"] } },
  { id: "behavior", kind: "body", heading: "Prediction is not survival", text: words("behavior", 480), claimIds: ["claim-stanford"], evidenceReviewRequired: true, lineage: { sourceSectionIds: ["body"] } },
  { id: "identity", kind: "body", heading: "The two-copy problem", text: words("identity", 480), claimIds: [], evidenceReviewRequired: false, lineage: { sourceSectionIds: ["body"] } },
  { id: "conclusion", kind: "conclusion", heading: "What responsibility survives", text: words("moral", 120), claimIds: ["claim-novel", "claim-stanford"], evidenceReviewRequired: true, lineage: { sourceSectionIds: ["conclusion"] } },
];
const supportedClaims = async () => addedClaims.map((claim) => ({ claimId: claim.claimId, status: "supported", evidenceIds: claim.supportingEvidenceIds, summary: "The canonical passage substantively entails this bounded claim." }));
const executed = await executeCreatorScriptEditorialRewrite({
  script, subject: "digital afterlife", instruction, language: "en", mode: "research_backed_rewrite",
  dependencies: {
    research: async () => { researchCalls += 1; return { sources: verifiedSources, verifiedEvidence }; },
    rewrite: async ({ goals: requestedGoals }) => { rewriteCalls += 1; return {
      sections: rewrittenSections, addedClaims, addedEvidence, goalResults: requestedGoals.map((goal) => ({ goalId: goal.goalId, status: "satisfied", sectionIds: ["behavior"], summary: "provider claim ignored" })),
    }; },
    verifyClaims: supportedClaims,
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

await assert.rejects(() => executeCreatorScriptEditorialRewrite({ script, subject: "digital afterlife", instruction, language: "en", mode: "research_backed_rewrite", dependencies: { research: async () => ({ sources: [], verifiedEvidence: [] }), rewrite: async () => { throw new Error("should not run"); }, verifyClaims: async () => [], assess: async () => [] } }), /MISSING_SOURCES/);
const executeInvalid = (overrides) => executeCreatorScriptEditorialRewrite({ script, subject: "digital afterlife", instruction, language: "en", mode: "research_backed_rewrite", dependencies: { research: async () => ({ sources: verifiedSources, verifiedEvidence }), rewrite: async () => ({ sections: rewrittenSections, addedClaims, addedEvidence, goalResults: [] }), verifyClaims: supportedClaims, assess: async ({ goals: requestedGoals }) => requestedGoals.map((goal) => ({ goalId: goal.goalId, status: "satisfied", sectionIds: ["opening"], summary: "ok" })), ...overrides } });
await assert.rejects(() => executeInvalid({ rewrite: async () => ({ sections: rewrittenSections.map((section, index) => index === 1 ? { ...section, claimIds: ["unknown"] } : section), addedClaims, addedEvidence, goalResults: [] }) }), /UNSUPPORTED_NEW_CLAIM/);
await assert.rejects(() => executeInvalid({ rewrite: async () => ({ sections: rewrittenSections, addedClaims: [addedClaims[0], addedClaims[0]], addedEvidence: [addedEvidence[0]], goalResults: [] }) }), /CLAIM_AUTHORITY_INVALID/);
await assert.rejects(() => executeInvalid({ rewrite: async () => ({ sections: rewrittenSections, addedClaims: [{ ...addedClaims[0], supportingEvidenceIds: ["missing-evidence"] }], addedEvidence: [addedEvidence[0]], goalResults: [] }) }), /UNSUPPORTED_NEW_CLAIM/);
await assert.rejects(() => executeInvalid({ rewrite: async () => ({ sections: rewrittenSections.map((section, index) => index === 1 ? { ...section, lineage: { sourceSectionIds: ["missing"] } } : section), addedClaims, addedEvidence, goalResults: [] }) }), /SECTION_MAPPING_INVALID/);
await assert.rejects(() => executeInvalid({ research: async () => ({ sources: verifiedSources, verifiedEvidence: [] }) }), /MISSING_VERIFIED_EVIDENCE/);
await assert.rejects(() => executeInvalid({ research: async () => ({ sources: [{ ...verifiedSources[0], sourceMetadata: {} }], verifiedEvidence: [{ ...verifiedEvidence[0], sourceId: verifiedSources[0].sourceId, passageDigest: "0".repeat(64) }] }) }), /SOURCE_AUTHORITY_INVALID|SOURCE_PROVENANCE_INVALID/);
await assert.rejects(() => executeInvalid({ rewrite: async () => ({ sections: rewrittenSections, addedClaims, addedEvidence: [{ ...addedEvidence[0], excerpt: "Fabricated passage that never appeared in the canonical source record." }], goalResults: [] }) }), /SOURCE_AUTHORITY_INVALID/);
await assert.rejects(() => executeInvalid({ verifyClaims: async () => addedClaims.map((claim) => ({ claimId: claim.claimId, status: "contradicted", evidenceIds: claim.supportingEvidenceIds, summary: "The passage states the opposite." })) }), /CLAIM_EVIDENCE_MISMATCH/);
await assert.rejects(() => executeInvalid({ assess: async () => [] }), /GOAL_MISMATCH/);

const longScript = createCreatorScript({ ...script, targetDurationSec: 900, sections: script.sections.map((section, index) => ({ ...section, text: words(`long${index}-`, index === 1 ? 1800 : 180) })) });
assert.equal(getCreatorScriptDurationContractForScript(longScript, "en").status, "compliant");
const longCandidate = longScript.sections.map((section) => ({ ...section, text: `${section.text} revised`, lineage: { sourceSectionIds: [section.id] } }));
const longResult = await executeCreatorScriptEditorialRewrite({ script: longScript, subject: "long documentary", instruction: "Improve progression without changing duration.", language: "en", mode: "editorial_rewrite", dependencies: { research: async () => ({ sources: [], verifiedEvidence: [] }), rewrite: async () => ({ sections: longCandidate, addedClaims: [], addedEvidence: [], goalResults: [] }), verifyClaims: async () => [], assess: async ({ goals: requestedGoals }) => requestedGoals.map((goal) => ({ goalId: goal.goalId, status: "satisfied", sectionIds: ["body"], summary: "Progression changed." })) } });
assert.ok(getCreatorScriptDurationContractForScript(longResult.script, "en").estimatedDurationSec > 600, "persisted 15-minute configuration is valid");

// Exercise the actual HTTP route with injected auth, persistence and provider
// dependencies. Invalid research authority must fail before any project write.
const jiti = createJiti(import.meta.url, { interopDefault: true, alias: { "@": new URL("..", import.meta.url).pathname.replace(/\/$/, ""), "server-only": new URL("../lib/creator/projectState.ts", import.meta.url).pathname } });
const { POST } = await jiti.import("../app/api/creator-script/refine/route.ts");
const handleRefinement = POST.handleForTest;
const scenes = Array.from({ length: 36 }, (_, index) => ({ id: `scene-${index + 1}` }));
const protectedScript = createCreatorScript({ ...script, sections: [{ ...script.sections[0] }, { ...script.sections[1], id: "body-1", text: words("body-a", 320) }, { ...script.sections[1], id: "body-2", text: words("body-b", 320) }, { ...script.sections[1], id: "body-3", text: words("body-c", 320) }, { ...script.sections[2] }] });
const protectedCandidateSections = protectedScript.sections.map((section) => ({ ...section, text: `${section.text} revised`, claimIds: section.kind === "opening" ? ["claim-novel"] : section.kind === "body" ? ["claim-stanford"] : [], lineage: { sourceSectionIds: [section.id] } }));
const lineageCandidate = [
  { ...protectedScript.sections[0], text: `${protectedScript.sections[0].text} revised`, lineage: { sourceSectionIds: ["opening"] } },
  { ...protectedScript.sections[2], text: `${protectedScript.sections[2].text} reordered`, lineage: { sourceSectionIds: ["body-2"] } },
  { ...protectedScript.sections[1], id: "body-merged", text: `${protectedScript.sections[1].text} ${protectedScript.sections[3].text}`, lineage: { sourceSectionIds: ["body-1", "body-3"] } },
  { ...protectedScript.sections[4], text: `${protectedScript.sections[4].text} revised`, lineage: { sourceSectionIds: ["conclusion"] } },
];
const lineageResult = await executeCreatorScriptEditorialRewrite({ script: protectedScript, subject: "digital afterlife", instruction: "Reorder the body chapters and merge overlapping material.", language: "en", mode: "editorial_rewrite", dependencies: { research: async () => ({ sources: [], verifiedEvidence: [] }), rewrite: async () => ({ sections: lineageCandidate, addedClaims: [], addedEvidence: [], goalResults: [] }), verifyClaims: async () => [], assess: async ({ goals: requestedGoals }) => requestedGoals.map((goal) => ({ goalId: goal.goalId, status: "satisfied", sectionIds: ["body-2", "body-merged"], summary: "The requested reorder and merge are present." })) } });
assert.deepEqual(lineageResult.script.sections.map((section) => section.id), ["opening", "body-2", "body-merged", "conclusion"]);
await assert.rejects(() => executeCreatorScriptEditorialRewrite({ script: protectedScript, subject: "digital afterlife", instruction: "Merge the body.", language: "en", mode: "editorial_rewrite", dependencies: { research: async () => ({ sources: [], verifiedEvidence: [] }), rewrite: async () => ({ sections: lineageCandidate.map((section) => section.id === "body-merged" ? { ...section, lineage: { sourceSectionIds: ["body-1"] } } : section), addedClaims: [], addedEvidence: [], goalResults: [] }), verifyClaims: async () => [], assess: async () => [] } }), /SECTION_MAPPING_INVALID/);
const projectState = buildCreatorProjectState({ brief: { topic: "digital afterlife", language: "en", country: "US", ageGroup: "adult", contentType: "documentary", format: "youtube_video", durationPreset: "custom", durationSec: 525, customDurationSec: 525, qualityMode: "quality", targetPlatforms: ["youtube"] }, strategy: { mentorResult: null, selectedDirectionId: "direction-1", selectedHook: "hook", strategyFingerprint: protectedScript.strategyFingerprint, script: protectedScript, pendingRefinement: null, revisionHistory: [] }, production: { package: null, refinedScenes: [], backgroundMusic: null, projectContinuityMode: "continuous", sceneContinuityModes: {}, voicePreferences: null }, createReview: { scenes }, publish: { metadata: null, thumbnail: null, thumbnailDesign: null, confirmations: {}, packageDownloaded: false, packageSignature: "", finalVideoUrl: "", finalVideoSignature: "" } });
const persistedProject = { id: "project-r2", owner_user_id: "owner-r2", flow_type: "creator_lab", updated_at: "2026-10-19T00:00:00.000Z", scenes, exported_movie_result: attachCreatorProjectState({}, projectState) };
let routeWrites = 0;
const priorOfflineGate = process.env.CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED;
const priorNodeEnv = process.env.NODE_ENV;
const priorOpenAiKey = process.env.OPENAI_API_KEY;
process.env.CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED = "true";
process.env.NODE_ENV = "test";
process.env.OPENAI_API_KEY = "offline-not-used";
const routeResponse = await handleRefinement(new Request("http://localhost/api/creator-script/refine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: persistedProject.id, action: "generate", scope: "whole_script", mode: "research_backed_rewrite", revision: protectedScript.revision, instruction }) }), {
  authenticate: async () => ({ id: "owner-r2", email: "offline@test.invalid", providerUser: { id: "owner-r2" } }),
  persistence: () => ({ projectRepository: { getForOwner: async () => structuredClone(persistedProject), saveForOwner: async () => { routeWrites += 1; throw new Error("unexpected write"); } } }),
  editorialProviders: () => ({ research: async () => ({ sources: verifiedSources, verifiedEvidence }), rewrite: async () => ({ sections: protectedCandidateSections, addedClaims, addedEvidence: [{ ...addedEvidence[0], excerpt: "Fabricated passage that is not present in the canonical passage catalog." }], goalResults: [] }), verifyClaims: supportedClaims, assess: async () => [] }),
});
const routePayload = await routeResponse.json();
assert.equal(routeResponse.status, 422, JSON.stringify(routePayload));
assert.equal(routePayload.code, "CREATOR_SCRIPT_REFINEMENT_SOURCE_AUTHORITY_INVALID");
assert.equal(routeWrites, 0);
assert.equal(persistedProject.scenes.length, 36);
assert.equal(persistedProject.exported_movie_result.creatorProjectState.strategy.script.sections.length, 5);
if (priorOfflineGate === undefined) delete process.env.CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED; else process.env.CREATOR_SCRIPT_FULL_REFINEMENT_OFFLINE_ENABLED = priorOfflineGate;
if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv;
if (priorOpenAiKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = priorOpenAiKey;

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
