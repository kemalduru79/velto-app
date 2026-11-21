import {
  isResearchClaimType,
  type ResearchClaimType,
} from "./claimEvidenceGraph.ts";

export type CreatorResearchMode = "single" | "orchestrated";

export type CreatorResearchOrchestrationRequest = {
  subject: string;
  claimType: ResearchClaimType | null;
  maxResultsPerLane: number;
  includeRecentContext: boolean;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

export function normalizeCreatorResearchMode(value: unknown): CreatorResearchMode {
  const normalized = clean(value, 40).toLowerCase();
  if (!normalized || normalized === "single") return "single";
  if (normalized === "orchestrated") return "orchestrated";
  throw new Error("RESEARCH_MODE_INVALID");
}

export function normalizeCreatorResearchOrchestrationRequest(
  value: unknown,
): CreatorResearchOrchestrationRequest {
  const body = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const subject = clean(body.subject, 600);
  if (!subject) throw new Error("RESEARCH_SUBJECT_REQUIRED");

  const rawClaimType = clean(body.claimType, 80);
  if (rawClaimType && !isResearchClaimType(rawClaimType)) {
    throw new Error("RESEARCH_CLAIM_TYPE_INVALID");
  }

  const requestedMax = Number(body.maxResultsPerLane);
  const maxResultsPerLane = Number.isFinite(requestedMax)
    ? Math.min(6, Math.max(2, Math.trunc(requestedMax)))
    : 5;

  return {
    subject,
    claimType: rawClaimType ? rawClaimType as ResearchClaimType : null,
    maxResultsPerLane,
    includeRecentContext: body.includeRecentContext === true,
  };
}
