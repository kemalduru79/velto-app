import {prepareCreatorEditorialReviewContext} from "./creatorScriptEditorialReviewContext.ts";
import { createHash } from "node:crypto";
import { canonicalCreatorScriptBuildJson, type CreatorScriptBuildRecord, type CreatorScriptBuildSnapshot } from "./creatorScriptBuild.ts";
import { normalizeCreatorScriptBuildAuthorityResultFromCheckpoint, type CreatorScriptBuildAuthorityStageResult } from "./creatorScriptBuildAuthorityCoordinator.ts";
import { createResearchClaimEvidenceGraph } from "../research/claimEvidenceGraph.ts";
import { applyCounterEvidenceScopeReview, createScriptPlannerGenerationGroundingGate, type ScriptPlannerEditorialContext } from "../research/scriptPlannerEditorialContext.ts";
export type CreatorEditorialReviewDecision = {
    reviewId: string;
    confirmed: true;
    excludedClaimIds: string[];
    rationale: string;
    storyStructure: null | "geopolitical_fiction_2055_2075_v1";
};
const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, max) : "";
function sortedUniqueIds(values: readonly string[], code: string) {
    const normalized = values.map((value) => clean(value, 300));
    if (normalized.some((value) => !value) ||
        new Set(normalized).size !== normalized.length) {
        throw new Error(code);
    }
    return normalized.toSorted((left, right) => left.localeCompare(right));
}
export function createPermittedGraph(authority: CreatorScriptBuildAuthorityStageResult) {
    const permittedClaimIds = sortedUniqueIds(authority.permittedClaimIds, "CREATOR_SCRIPT_BUILD_PERMITTED_CLAIMS_INVALID");
    const excluded = new Set([
        ...authority.excludedPrimaryClaimIds,
        ...authority.unresolvedClaimIds,
    ]);
    if (permittedClaimIds.some((claimId) => excluded.has(claimId))) {
        throw new Error("CREATOR_SCRIPT_BUILD_PERMITTED_CLAIM_EXCLUDED");
    }
    const permittedSet = new Set(permittedClaimIds);
    const graphClaimIds = new Set(authority.graph.claims.map((claim) => claim.claimId));
    const missing = permittedClaimIds.find((claimId) => !graphClaimIds.has(claimId));
    if (missing) {
        throw new Error(`CREATOR_SCRIPT_BUILD_PERMITTED_CLAIM_MISSING:${missing}`);
    }
    const claims = authority.graph.claims
        .filter((claim) => permittedSet.has(claim.claimId))
        .toSorted((left, right) => left.claimId.localeCompare(right.claimId));
    if (claims.length === 0) {
        throw new Error("CREATOR_SCRIPT_BUILD_PERMITTED_CLAIMS_REQUIRED");
    }
    const links = authority.graph.links
        .filter((link) => permittedSet.has(link.claimId))
        .toSorted((left, right) => {
        const claimOrder = left.claimId.localeCompare(right.claimId);
        if (claimOrder !== 0)
            return claimOrder;
        const evidenceOrder = left.evidenceId.localeCompare(right.evidenceId);
        return evidenceOrder !== 0
            ? evidenceOrder
            : left.stance.localeCompare(right.stance);
    });
    const evidenceIds = new Set(links.map((link) => link.evidenceId));
    const evidence = authority.graph.evidence
        .filter((item) => evidenceIds.has(item.evidenceId))
        .toSorted((left, right) => left.evidenceId.localeCompare(right.evidenceId));
    const sourceIds = new Set(evidence.map((item) => item.sourceId));
    const sources = authority.graph.sources
        .filter((source) => sourceIds.has(source.sourceId))
        .toSorted((left, right) => left.sourceId.localeCompare(right.sourceId));
    const assessmentBySourceId = new Map(authority.sourceAssessments.map((item) => [item.sourceId, item]));
    const sourceAssessments = sources.map((source) => {
        const assessment = assessmentBySourceId.get(source.sourceId);
        if (!assessment) {
            throw new Error(`CREATOR_SCRIPT_BUILD_SOURCE_ASSESSMENT_MISSING:${source.sourceId}`);
        }
        return assessment;
    });
    return {
        graph: createResearchClaimEvidenceGraph({ sources, claims, evidence, links }),
        sourceAssessments,
        permittedClaimIds,
    };
}
export function createBuildEditorialReview(input: {
    buildId: string;
    snapshot: CreatorScriptBuildSnapshot;
    authority: CreatorScriptBuildAuthorityStageResult;
}) {
    const prepared=prepareCreatorEditorialReviewContext({creatorProfile:input.snapshot.creatorProfile,language:input.snapshot.language,requestedDurationSeconds:input.snapshot.requestedDurationSeconds,narrativePolicy:input.snapshot.strategy.narrativePolicy,graph:input.authority.graph,sourceAssessments:input.authority.sourceAssessments});
    const reviewId=createHash("sha256").update(canonicalCreatorScriptBuildJson({version:"creator-editorial-review-v1",buildId:input.buildId,snapshot:input.snapshot,graph:input.authority.graph,assessments:input.authority.sourceAssessments,standardPlan:prepared.standardPlan,fictionPlan:prepared.fictionPlan})).digest("hex");
    return {...prepared,reviewId};
}

export type CreatorBuildEditorialReview = ReturnType<typeof createBuildEditorialReview>;
export function reviewForBuild(build: CreatorScriptBuildRecord) {
    const checkpoint = build.checkpoints.authority;
    if (checkpoint?.status !== "COMPLETED")
        throw Error("CREATOR_EDITORIAL_REVIEW_AUTHORITY_REQUIRED");
    return createBuildEditorialReview({ buildId: build.buildId, snapshot: build.snapshot, authority: normalizeCreatorScriptBuildAuthorityResultFromCheckpoint(checkpoint.outputReference) });
}
export function applyBuildEditorialReview(input: {
    buildId: string;
    snapshot: CreatorScriptBuildSnapshot;
    authority: CreatorScriptBuildAuthorityStageResult;
    decision: unknown;
}): {
    context: ScriptPlannerEditorialContext;
    decision: CreatorEditorialReviewDecision;
    sectionPlan: CreatorBuildEditorialReview["standardPlan"];
} {
    const view = createBuildEditorialReview(input);
    const d = input.decision as CreatorEditorialReviewDecision | null;
    if (!d || typeof d !== "object" || Array.isArray(d) || Object.keys(d).sort().join(",") !== "confirmed,excludedClaimIds,rationale,reviewId,storyStructure" || d.confirmed !== true || d.reviewId !== view.reviewId || !Array.isArray(d.excludedClaimIds) || d.excludedClaimIds.some(id => typeof id !== "string") || new Set(d.excludedClaimIds).size !== d.excludedClaimIds.length || typeof d.rationale !== "string" || d.rationale.trim().length < 12 || d.rationale.length > 1000 || ![null, "geopolitical_fiction_2055_2075_v1"].includes(d.storyStructure))
        throw Error("CREATOR_EDITORIAL_REVIEW_INVALID_OR_STALE");
    if (d.storyStructure && !view.fictionAvailable)
        throw Error("CREATOR_EDITORIAL_REVIEW_FICTION_SCOPE_INVALID");
    const projection = { graph: input.authority.graph, sourceAssessments: input.authority.sourceAssessments };
    let context = view.context;
    try {
        if (d.excludedClaimIds.length || view.counterReview.unresolvedClaimIds.length)
            context = applyCounterEvidenceScopeReview(view.context, { snapshotFingerprint: view.counterReview.snapshotFingerprint, excludedClaimIds: d.excludedClaimIds, rationale: d.rationale, confirmed: true }, projection.graph);
    }
    catch {
        throw Error("CREATOR_EDITORIAL_REVIEW_UNRESOLVED");
    }
    if (!createScriptPlannerGenerationGroundingGate(context).eligible)
        throw Error("CREATOR_EDITORIAL_REVIEW_EVIDENCE_BLOCKED");
    const sectionPlan=d.storyStructure?view.fictionPlan:view.standardPlan;
    if(!sectionPlan)throw Error("CREATOR_EDITORIAL_REVIEW_PLAN_REQUIRED");
    return { context, decision: structuredClone(d), sectionPlan:structuredClone(sectionPlan) };
}
