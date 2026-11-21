import type { ResearchSourceMediaReference } from "../research/sourceMediaReference.ts";
import type {
  ResearchSourceAssessment,
  ResearchSourceDirectness,
  ResearchSourceReviewStatus,
} from "../research/sourceAssessment.ts";
import type {
  CreatorSourceMediaKind,
  CreatorSourceMediaRightsState,
} from "./sourceMedia.ts";

export const CREATOR_DOCUMENTARY_SOURCE_CONTEXT_VERSION = "0.10H-4B" as const;

export type CreatorDocumentarySourceRoutingStatus =
  | "candidate"
  | "review_required"
  | "excluded";

export type CreatorDocumentarySourceCandidate = {
  researchSourceId: string;
  title: string;
  sourceUrl: string;
  sourceMediaKind: CreatorSourceMediaKind;
  rightsState: CreatorSourceMediaRightsState;
  directness: ResearchSourceDirectness;
  reviewStatus: ResearchSourceReviewStatus;
  routingStatus: CreatorDocumentarySourceRoutingStatus;
};

export type CreatorDocumentarySourceContext = {
  version: typeof CREATOR_DOCUMENTARY_SOURCE_CONTEXT_VERSION;
  sourceReferenceCount: number;
  routingCandidateCount: number;
  sourceClipCandidateCount: number;
  sourceImageCandidateCount: number;
  primarySourceClipCandidateCount: number;
  primarySourceImageCandidateCount: number;
  rightsReviewRequiredCount: number;
  excludedCount: number;
  candidates: CreatorDocumentarySourceCandidate[];
};

function routingStatus(input: {
  rightsState: CreatorSourceMediaRightsState;
  reviewStatus: ResearchSourceReviewStatus;
}): CreatorDocumentarySourceRoutingStatus {
  if (
    input.rightsState === "restricted" ||
    input.reviewStatus === "insufficient"
  ) {
    return "excluded";
  }
  if (
    input.rightsState !== "cleared" ||
    input.reviewStatus !== "usable"
  ) {
    return "review_required";
  }
  return "candidate";
}

/**
 * Creates provider-neutral source availability signals for documentary
 * production planning. This does not make a legal clearance decision. Sources
 * requiring rights/editorial review can remain planning candidates while later
 * governance gates retain responsibility for publication review.
 */
export function createCreatorDocumentarySourceContext(input: {
  references: readonly ResearchSourceMediaReference[];
  assessments?: readonly ResearchSourceAssessment[];
}): CreatorDocumentarySourceContext {
  const assessmentBySourceId = new Map(
    (input.assessments || []).map((assessment) => [assessment.sourceId, assessment]),
  );
  const seen = new Set<string>();
  const candidates: CreatorDocumentarySourceCandidate[] = [];

  for (const reference of input.references.slice(0, 80)) {
    const sourceId = reference.researchSourceId.trim();
    if (!sourceId || seen.has(sourceId)) continue;
    seen.add(sourceId);

    const assessment = assessmentBySourceId.get(sourceId);
    const directness = assessment?.directness || "unknown";
    const reviewStatus = assessment?.reviewStatus || "review";
    const status = routingStatus({
      rightsState: reference.sourceMedia.rightsState,
      reviewStatus,
    });

    candidates.push({
      researchSourceId: sourceId,
      title: reference.title.trim().slice(0, 500),
      sourceUrl: reference.sourceMedia.sourceUrl,
      sourceMediaKind: reference.sourceMedia.sourceMediaKind,
      rightsState: reference.sourceMedia.rightsState,
      directness,
      reviewStatus,
      routingStatus: status,
    });
  }

  const routingCandidates = candidates.filter(
    (candidate) => candidate.routingStatus !== "excluded",
  );
  const sourceClips = routingCandidates.filter(
    (candidate) => candidate.sourceMediaKind === "video",
  );
  const sourceImages = routingCandidates.filter(
    (candidate) => candidate.sourceMediaKind === "image",
  );

  return {
    version: CREATOR_DOCUMENTARY_SOURCE_CONTEXT_VERSION,
    sourceReferenceCount: candidates.length,
    routingCandidateCount: routingCandidates.length,
    sourceClipCandidateCount: sourceClips.length,
    sourceImageCandidateCount: sourceImages.length,
    primarySourceClipCandidateCount: sourceClips.filter(
      (candidate) => candidate.directness === "primary",
    ).length,
    primarySourceImageCandidateCount: sourceImages.filter(
      (candidate) => candidate.directness === "primary",
    ).length,
    rightsReviewRequiredCount: routingCandidates.filter(
      (candidate) => candidate.routingStatus === "review_required",
    ).length,
    excludedCount: candidates.length - routingCandidates.length,
    candidates,
  };
}
