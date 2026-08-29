import type { ResearchSearchCategory, ResearchSearchInput } from "../providers/research/types.ts";
import type { ResearchClaimType } from "./claimEvidenceGraph.ts";

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

function cleanSubject(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, 600)
    : "";
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
): ResearchSearchLane {
  return {
    laneId,
    purpose,
    required,
    input: {
      query: cleanSubject(query),
      category,
      maxResults,
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
}): ResearchOrchestrationPlan {
  const subject = cleanSubject(input.subject);
  if (!subject) throw new Error("RESEARCH_SUBJECT_REQUIRED");

  const claimType = input.claimType || null;
  const maxResults = clampResults(input.maxResultsPerLane);
  const lanes: ResearchSearchLane[] = [];

  lanes.push(
    lane("baseline", "baseline", subject, "web", maxResults),
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
    lanes.push(
      lane(
        "counter-evidence",
        "counter_evidence",
        `${subject} limitations alternative explanations counter evidence criticism`,
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
    lanes: lanes.slice(0, 4),
  };
}
