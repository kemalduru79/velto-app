import type { ResearchSearchCategory, ResearchSearchInput } from "../providers/research/types.ts";
import type { ResearchClaimType } from "./claimEvidenceGraph.ts";
import {
  normalizeCreatorResearchIntent,
  type CreatorResearchIntent,
} from "./creatorResearchIntent.ts";

export type ResearchSearchLanePurpose =
  | "baseline"
  | "primary_source"
  | "supporting_evidence"
  | "counter_evidence"
  | "recent_context";

export type ResearchSearchLane = {
  laneId: string;
  purpose: ResearchSearchLanePurpose;
  required: boolean;
  input: ResearchSearchInput;
};

export type ResearchOrchestrationPlan = {
  version: "0.10H-1F";
  subject: string;
  claimType: ResearchClaimType | null;
  researchIntent?: CreatorResearchIntent;
  researchIntentQueryCoverage?: {
    comparisonQuestionCount: number;
    representedComparisonQuestionCount: number;
    preferredSourceCount: number;
    representedPreferredSourceCount: number;
    requiredSourceCount: number;
    representedRequiredSourceCount: number;
  };
  lanes: ResearchSearchLane[];
};

const ACADEMIC_CLAIM_TYPES = new Set<ResearchClaimType>([
  "RESEARCH_FINDING",
  "THEORY",
  "FORECAST",
  "HYPOTHESIS",
]);

const PRIMARY_SOURCE_CLAIM_TYPES = new Set<ResearchClaimType>([
  "FACT",
  "PRIMARY_SOURCE_CLAIM",
  "EXPERT_OPINION",
]);

const MAX_RESEARCH_QUERY_CHARACTERS = 600;

function cleanSubject(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, MAX_RESEARCH_QUERY_CHARACTERS)
    : "";
}

type ResearchIntentQueryFragment = {
  kind: "comparison_question" | "preferred_source" | "required_source";
  value: string;
};

function appendWholeQueryFragments(
  base: string,
  fragments: readonly ResearchIntentQueryFragment[],
) {
  let query = cleanSubject(base);
  const represented: ResearchIntentQueryFragment[] = [];
  const remaining: ResearchIntentQueryFragment[] = [];
  for (const fragment of fragments) {
    const candidate = `${query} ${fragment.value}`.replace(/\s+/gu, " ").trim();
    if (candidate.length <= MAX_RESEARCH_QUERY_CHARACTERS) {
      query = candidate;
      represented.push(fragment);
    } else {
      remaining.push(fragment);
    }
  }
  return { query, represented, remaining };
}

function clampResults(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(6, Math.max(2, Math.trunc(parsed)))
    : 5;
}

function lane(
  laneId: string,
  purpose: ResearchSearchLanePurpose,
  query: string,
  category: ResearchSearchCategory,
  maxResults: number,
  required = true,
  includeDomains?: string[],
): ResearchSearchLane {
  return {
    laneId,
    purpose,
    required,
    input: {
      query: cleanSubject(query),
      category,
      maxResults,
      ...(includeDomains?.length ? { includeDomains } : {}),
    },
  };
}

/**
 * Creates a small, deterministic research plan for evidence-aware editorial work.
 *
 * This is not a truth-ranking or contradiction engine. Counter-evidence lanes
 * deliberately search for limitations, alternative explanations and competing
 * evidence without deciding which position is correct.
 */
export function createResearchOrchestrationPlan(input: {
  subject: string;
  claimType?: ResearchClaimType | null;
  maxResultsPerLane?: number;
  includeRecentContext?: boolean;
  researchIntent?: CreatorResearchIntent;
}): ResearchOrchestrationPlan {
  const subject = cleanSubject(input.subject);
  if (!subject) throw new Error("RESEARCH_SUBJECT_REQUIRED");

  const claimType = input.claimType || null;
  const maxResults = clampResults(input.maxResultsPerLane);
  const researchIntent = input.researchIntent
    ? normalizeCreatorResearchIntent(input.researchIntent)
    : null;
  const priorityUrls = researchIntent
    ? [...researchIntent.requiredSourceUrls, ...researchIntent.preferredSourceUrls]
    : [];
  const priorityDomains = [...new Set(priorityUrls.map((url) => new URL(url).hostname))];
  const intentFragments: ResearchIntentQueryFragment[] = researchIntent
    ? [
        ...researchIntent.comparisonQuestions.map((value) => ({
          kind: "comparison_question" as const,
          value,
        })),
        ...researchIntent.requiredSourceUrls.map((value) => ({
          kind: "required_source" as const,
          value,
        })),
        ...researchIntent.preferredSourceUrls.map((value) => ({
          kind: "preferred_source" as const,
          value,
        })),
      ]
    : [];
  const baselineAllocation = appendWholeQueryFragments(subject, intentFragments);
  const lanes: ResearchSearchLane[] = [];
  const representedIntentFragments = [...baselineAllocation.represented];

  lanes.push(
    lane("baseline", "baseline", baselineAllocation.query, "web", maxResults, true, priorityDomains),
  );

  if (claimType && PRIMARY_SOURCE_CLAIM_TYPES.has(claimType)) {
    lanes.push(
      lane(
        "primary-source",
        "primary_source",
        `${subject} original source official transcript statement document`,
        "primary",
        maxResults,
      ),
    );
    if (claimType === "PRIMARY_SOURCE_CLAIM") {
      lanes.push(
        lane(
          "primary-transcript-interview",
          "primary_source",
          `${subject} transcript interview`,
          "primary",
          maxResults,
        ),
      );
    }
  } else if (claimType && ACADEMIC_CLAIM_TYPES.has(claimType)) {
    lanes.push(
      lane(
        "supporting-evidence",
        "supporting_evidence",
        `${subject} research evidence study findings`,
        "academic",
        maxResults,
      ),
    );
  }

  if (claimType !== "THOUGHT_EXPERIMENT") {
    const counterCategory: ResearchSearchCategory =
      claimType && ACADEMIC_CLAIM_TYPES.has(claimType) ? "academic" : "web";
    const counterAllocation = appendWholeQueryFragments(
      `${subject} limitations alternative explanations counter evidence criticism`,
      baselineAllocation.remaining,
    );
    representedIntentFragments.push(...counterAllocation.represented);
    lanes.push(
      lane(
        "counter-evidence",
        "counter_evidence",
        counterAllocation.query,
        counterCategory,
        maxResults,
      ),
    );
  }

  const recentContextRequested =
    input.includeRecentContext === true || claimType === "FORECAST";
  if (recentContextRequested && lanes.length < 4) {
    lanes.push(
      lane(
        "recent-context",
        "recent_context",
        `${subject} latest developments`,
        "news",
        maxResults,
        claimType === "FORECAST",
      ),
    );
  }

  return {
    version: "0.10H-1F",
    subject,
    claimType,
    ...(researchIntent ? { researchIntent } : {}),
    ...(researchIntent
      ? {
          researchIntentQueryCoverage: {
            comparisonQuestionCount: researchIntent.comparisonQuestions.length,
            representedComparisonQuestionCount: representedIntentFragments
              .filter((fragment) => fragment.kind === "comparison_question").length,
            preferredSourceCount: researchIntent.preferredSourceUrls.length,
            representedPreferredSourceCount: representedIntentFragments
              .filter((fragment) => fragment.kind === "preferred_source").length,
            requiredSourceCount: researchIntent.requiredSourceUrls.length,
            representedRequiredSourceCount: representedIntentFragments
              .filter((fragment) => fragment.kind === "required_source").length,
          },
        }
      : {}),
    lanes: lanes.slice(0, 4),
  };
}
