/**
 * Stage 4B2 consent/scope preflight. This module is pure and never authorizes
 * network calls. A later trusted human-approval boundary must validate provenance
 * of the approval record before enabling any live provider adapter.
 */
export type CreatorScriptStage4B2SourceScope = {
  url: string;
  authority: "original_research" | "primary_document" | "secondary_reporting" | "unknown";
};

export type CreatorScriptStage4B2ApprovalDraft = {
  approvalReference: string;
  approvedAt: string;
  expiresAt: string;
  syntheticProjectId: string;
  researchQuery: string;
  instruction: string;
  approvedMaxCostUsd: number;
  approvedMaxExaRequests: number;
  approvedMaxOpenAiRequests: number;
  approvedMaxOutputTokensPerRequest: number;
  allowedSources: CreatorScriptStage4B2SourceScope[];
};

export type CreatorScriptStage4B2PreflightRequest = {
  syntheticProjectId: string;
  researchQuery: string;
  instruction: string;
  discoveredSourceUrls?: string[];
};

const validNumber = (value: number) => Number.isFinite(value) && value > 0;
const hasSafePositiveCount = (value: number) => Number.isSafeInteger(value) && value > 0;
const safeIso = (value: string) => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/u.test(value) && Number.isFinite(Date.parse(value));

/** Strict canonicalization is for *matching* only. Fetch still needs SSRF/DNS checks. */
export function canonicalStage4B2ApprovedUrl(value: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("STAGE_4B2_SOURCE_URL_INVALID"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname ||
      parsed.hostname === "localhost" || parsed.hostname.endsWith(".local") || parsed.hostname.endsWith(".localhost")) {
    throw new Error("STAGE_4B2_SOURCE_URL_INVALID");
  }
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.toString();
}

export function prepareCreatorScriptStage4B2Approval(input: {
  approval?: CreatorScriptStage4B2ApprovalDraft | null;
  request: CreatorScriptStage4B2PreflightRequest;
  now?: string;
}) {
  const failures: string[] = [];
  const approval = input.approval;
  const request = input.request;
  if (!request.syntheticProjectId.startsWith("synthetic-acceptance-")) failures.push("SYNTHETIC_PROJECT_REQUIRED");
  if (!request.researchQuery.trim() || !request.instruction.trim()) failures.push("TEST_SCOPE_REQUIRED");
  if (!approval) {
    return {
      status: "REVIEW_REQUIRED" as const,
      readyToExecuteLive: false as const,
      approvedMaxCostUsd: 0,
      approvedSources: [] as CreatorScriptStage4B2SourceScope[],
      blockers: [...failures, "EXPLICIT_USER_APPROVAL_NOT_PROVIDED", "TRUSTED_LIVE_ADAPTER_NOT_ENABLED"],
    };
  }
  if (!approval.approvalReference?.trim() || approval.approvalReference.length > 160) failures.push("APPROVAL_REFERENCE_INVALID");
  if (!safeIso(approval.approvedAt) || !safeIso(approval.expiresAt)) failures.push("APPROVAL_DATES_INVALID");
  else {
    const now = input.now === undefined ? Date.now() : Date.parse(input.now);
    if (!Number.isFinite(now) || Date.parse(approval.approvedAt) > now ||
        Date.parse(approval.expiresAt) <= now ||
        Date.parse(approval.expiresAt) <= Date.parse(approval.approvedAt)) failures.push("APPROVAL_NOT_ACTIVE");
  }
  if (approval.syntheticProjectId !== request.syntheticProjectId || approval.researchQuery !== request.researchQuery ||
      approval.instruction !== request.instruction) failures.push("APPROVAL_SCOPE_MISMATCH");
  if (!validNumber(approval.approvedMaxCostUsd) ||
      !hasSafePositiveCount(approval.approvedMaxExaRequests) ||
      !hasSafePositiveCount(approval.approvedMaxOpenAiRequests) ||
      !hasSafePositiveCount(approval.approvedMaxOutputTokensPerRequest)) failures.push("APPROVAL_LIMIT_INVALID");
  // One Stage 4B2 acceptance trial, not a product-wide usage restriction.
  if (approval.approvedMaxExaRequests !== 1 || approval.approvedMaxOpenAiRequests !== 3) failures.push("STAGE_4B2_TRIAL_CALL_SCOPE_INVALID");
  let allowed: CreatorScriptStage4B2SourceScope[] = [];
  try {
    allowed = (approval.allowedSources || []).map((item) => ({
      url: canonicalStage4B2ApprovedUrl(item.url),
      authority: item.authority,
    }));
    if (!allowed.length || allowed.length > 5 || new Set(allowed.map((item) => item.url)).size !== allowed.length ||
        allowed.some((item) => !["original_research", "primary_document", "secondary_reporting", "unknown"].includes(item.authority))) {
      failures.push("APPROVED_SOURCE_SCOPE_INVALID");
    }
    if (request.discoveredSourceUrls) {
      const permitted = new Set(allowed.map((item) => item.url));
      if (!request.discoveredSourceUrls.length ||
          request.discoveredSourceUrls.some((url) => !permitted.has(canonicalStage4B2ApprovedUrl(url)))) {
        failures.push("DISCOVERED_SOURCE_OUTSIDE_APPROVED_SCOPE");
      }
    }
  } catch {
    failures.push("APPROVED_SOURCE_SCOPE_INVALID");
  }
  // A submitted form/JSON record is not verifiable proof of consent.
  // The runner remains hard-blocked until a trusted, separately reviewed live adapter exists.
  return {
    status: failures.length ? "BLOCKED" as const : "REVIEW_REQUIRED" as const,
    readyToExecuteLive: false as const,
    approvedMaxCostUsd: failures.length ? 0 : approval.approvedMaxCostUsd,
    approvedSources: failures.length ? [] as CreatorScriptStage4B2SourceScope[] : allowed,
    blockers: failures.length ? failures : ["APPROVAL_PROVENANCE_NOT_INDEPENDENTLY_VERIFIED", "TRUSTED_LIVE_ADAPTER_NOT_ENABLED"],
  };
}
