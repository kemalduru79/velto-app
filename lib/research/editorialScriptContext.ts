import {
  createCreatorEditorialContext,
  type CreatorProfile,
} from "../creator/creatorProfile.ts";
import type { ResearchClaimEvidenceGraph } from "./claimEvidenceGraph.ts";
import type { ResearchSourceAssessment } from "./sourceAssessment.ts";
import { createResearchTopicReadiness } from "./topicEvidenceReadiness.ts";

export type EditorialScriptContext = {
  version: "0.10H-2E";
  editorialConstitution: string;
  readiness: {
    status: "blocked" | "review" | "ready";
    editorialReadinessScore: number;
    reviewReasons: string[];
  };
  claims: Array<{
    claimId: string;
    claimType: ResearchClaimEvidenceGraph["claims"][number]["claimType"];
    text: string;
    supportingEvidenceIds: string[];
    counterEvidenceIds: string[];
    contextualEvidenceIds: string[];
  }>;
  evidence: Array<{
    evidenceId: string;
    sourceId: string;
    excerpt: string | null;
    contextNote: string | null;
    locator: ResearchClaimEvidenceGraph["evidence"][number]["locator"];
  }>;
  sources: Array<{
    sourceId: string;
    title: string;
    url: string;
    publisher: string;
    author: string | null;
    publishedAt: string | null;
    directness: ResearchSourceAssessment["directness"];
    reviewStatus: ResearchSourceAssessment["reviewStatus"];
  }>;
};

const MAX_CONTEXT_CLAIMS = 80;
const MAX_CONTEXT_EVIDENCE = 240;
const MAX_CONTEXT_SOURCES = 120;

function evidenceIdsByStance(
  graph: ResearchClaimEvidenceGraph,
  claimId: string,
  stance: ResearchClaimEvidenceGraph["links"][number]["stance"],
) {
  return graph.links
    .filter((link) => link.claimId === claimId && link.stance === stance)
    .map((link) => link.evidenceId);
}

/**
 * Builds the provider-neutral, prompt-safe backstage research context consumed by
 * editorial/script planning. It intentionally excludes provider metadata, costs,
 * API request ids and UI citation markup.
 */
export function createEditorialScriptContext(input: {
  profile: CreatorProfile;
  graph: ResearchClaimEvidenceGraph;
  sourceAssessments: ResearchSourceAssessment[];
}): EditorialScriptContext {
  if (input.graph.claims.length > MAX_CONTEXT_CLAIMS) {
    throw new Error("EDITORIAL_SCRIPT_CONTEXT_TOO_MANY_CLAIMS");
  }
  if (input.graph.evidence.length > MAX_CONTEXT_EVIDENCE) {
    throw new Error("EDITORIAL_SCRIPT_CONTEXT_TOO_MUCH_EVIDENCE");
  }
  if (input.graph.sources.length > MAX_CONTEXT_SOURCES) {
    throw new Error("EDITORIAL_SCRIPT_CONTEXT_TOO_MANY_SOURCES");
  }

  const sourceIdSet = new Set(input.graph.sources.map((source) => source.sourceId));
  const assessmentBySourceId = new Map(
    input.sourceAssessments.map((assessment) => [assessment.sourceId, assessment]),
  );
  for (const assessment of input.sourceAssessments) {
    if (!sourceIdSet.has(assessment.sourceId)) {
      throw new Error(`EDITORIAL_SCRIPT_SOURCE_ASSESSMENT_ORPHAN:${assessment.sourceId}`);
    }
  }

  const readiness = createResearchTopicReadiness({
    graph: input.graph,
    sourceAssessments: input.sourceAssessments,
  });

  return {
    version: "0.10H-2E",
    editorialConstitution: createCreatorEditorialContext(input.profile),
    readiness: {
      status: readiness.status,
      editorialReadinessScore: readiness.editorialReadinessScore,
      reviewReasons: [...readiness.reviewReasons],
    },
    claims: input.graph.claims.map((claim) => ({
      claimId: claim.claimId,
      claimType: claim.claimType,
      text: claim.text,
      supportingEvidenceIds: evidenceIdsByStance(input.graph, claim.claimId, "supports"),
      counterEvidenceIds: evidenceIdsByStance(input.graph, claim.claimId, "contradicts"),
      contextualEvidenceIds: evidenceIdsByStance(input.graph, claim.claimId, "contextualizes"),
    })),
    evidence: input.graph.evidence.map((evidence) => ({
      evidenceId: evidence.evidenceId,
      sourceId: evidence.sourceId,
      excerpt: evidence.excerpt,
      contextNote: evidence.contextNote,
      locator: evidence.locator,
    })),
    sources: input.graph.sources.map((source) => {
      const assessment = assessmentBySourceId.get(source.sourceId);
      return {
        sourceId: source.sourceId,
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        author: source.author,
        publishedAt: source.publishedAt,
        directness: assessment?.directness || "unknown",
        reviewStatus: assessment?.reviewStatus || "review",
      };
    }),
  };
}
