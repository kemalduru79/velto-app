import {prepareCreatorLongFormSectionPlanForAvailableEvidence} from "../research/creatorLongFormEvidenceReadiness.ts";
import {createCreatorScriptSectionBudgetPlan,getCreatorScriptDurationContract,shouldUseCreatorScriptSectionNativeGeneration} from "./creatorScript.ts";
import {createValidatedEditorialAnalysis} from "../research/editorialAnalysisContract.ts";
import {createEditorialScriptContext} from "../research/editorialScriptContext.ts";
import {parseCreatorProfile} from "./creatorProfile.ts";
import {createCounterEvidenceReview,createScriptPlannerGenerationGroundingGate,normalizeScriptPlannerEditorialContext} from "../research/scriptPlannerEditorialContext.ts";
import type {CreatorScriptBuildSnapshot} from "./creatorScriptBuild.ts";
import type {CreatorScriptBuildAuthorityStageResult} from "./creatorScriptBuildAuthorityCoordinator.ts";

/** Same validated evidence and section preview for server builds and local owner review.
 * Pure projection only: no approval, runtime operation, fingerprint rewrite or write. */
export function prepareCreatorEditorialReviewContext(input: Pick<CreatorScriptBuildSnapshot,"creatorProfile"|"language"|"requestedDurationSeconds"> & Pick<CreatorScriptBuildAuthorityStageResult,"graph"|"sourceAssessments"> & {narrativePolicy?: CreatorScriptBuildSnapshot["strategy"]["narrativePolicy"]}) {
    const projection = { graph: input.graph, sourceAssessments: input.sourceAssessments };
    // Verify passages against the retained independent research material again.
    createValidatedEditorialAnalysis({ sources: projection.graph.sources, proposal: projection.graph, requirePropositionAuthority: true });
    const context = normalizeScriptPlannerEditorialContext(createEditorialScriptContext({ profile: parseCreatorProfile(input.creatorProfile), graph: projection.graph, sourceAssessments: [...projection.sourceAssessments] }));
    if (!context)
        throw Error("CREATOR_EDITORIAL_REVIEW_CONTEXT_REQUIRED");
    const counterReview = createCounterEvidenceReview(context);
    const passages = (ids: string[]) => ids.flatMap(id => { const e = context.evidence.find(e => e.evidenceId === id); const source = context.sources.find(s => s.sourceId === e?.sourceId); return e?.excerpt && source ? [{ ...e, source }] : []; });
    const standardPlan = createCreatorScriptSectionBudgetPlan({ targetDurationSec: input.requestedDurationSeconds, language: input.language,hasMaterialCounterview:context.claims.some(c=>c.counterEvidenceIds.length>0),narrativePolicy:input.narrativePolicy });
    const fictionAvailable = !input.narrativePolicy && context.claims.some(c => c.claimType === "THOUGHT_EXPERIMENT");
    const fictionPlan = fictionAvailable ? createCreatorScriptSectionBudgetPlan({ targetDurationSec: input.requestedDurationSeconds, language: input.language, storyStructure: "geopolitical_fiction_2055_2075_v1" }) : null;
    const sectionNative=shouldUseCreatorScriptSectionNativeGeneration(getCreatorScriptDurationContract({targetDurationSec:input.requestedDurationSeconds,language:input.language,actualWordCount:0}).targetWordCount);
    const standardPrepared = prepareCreatorLongFormSectionPlanForAvailableEvidence({ context, plan: standardPlan, sectionNative });
    const fictionPrepared = fictionPlan ? prepareCreatorLongFormSectionPlanForAvailableEvidence({ context, plan: fictionPlan, sectionNative }) : null;
    return { standardPlan: standardPrepared.plan, fictionPlan: fictionPrepared?.plan || null, standardReadiness: standardPrepared.finalReadiness, fictionReadiness: fictionPrepared?.finalReadiness || null, version: "creator-editorial-review-v1" as const,  durationSec: input.requestedDurationSeconds, context, counterReview,
        claims: context.claims.map(c => ({ ...c, support: passages(c.supportingEvidenceIds), counter: passages(c.counterEvidenceIds), contextual: passages(c.contextualEvidenceIds), canExclude: counterReview.claims.find(x => x.claimId === c.claimId)?.canExclude === true, outcome: counterReview.claims.find(x => x.claimId === c.claimId)?.outcome || "not_required" as const })),
        reasonCodes: createScriptPlannerGenerationGroundingGate(context).reasonCodes,
        fictionAvailable };
}