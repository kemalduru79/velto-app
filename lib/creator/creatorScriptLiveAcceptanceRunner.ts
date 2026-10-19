import "server-only";

import { createHash } from "node:crypto";
import { executeCreatorScriptEditorialRewrite, type CreatorScriptClaimEvidenceAssessment, type CreatorScriptEditorialRewriteResult, type CreatorScriptRewriteProviderCandidate, type CreatorScriptRewriteResearchResult } from "./creatorScriptEditorialRewrite.ts";
import type { CreatorScript } from "./creatorScript.ts";
import { createCreatorScriptLiveAcceptanceBudget, DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION, type CreatorScriptAcceptanceUsage, type CreatorScriptLiveAcceptanceAuthorization } from "./creatorScriptLiveAcceptanceBudget.ts";
import { acquireOriginalSourceDocument, type OriginalSourceAcquisitionProvenance } from "../research/originalSourceAcquisition.server.ts";
import { assessOriginalSourceClaimAuthority, verifyOriginalSourceEvidence, type OriginalSourceDocument, type OriginalSourceClaimAuthorityResult } from "../research/originalSourceEvidence.ts";
import type { ResearchEvidence } from "../research/claimEvidenceGraph.ts";
import type { ResearchSource } from "../research/sourceContract.ts";

export type AcceptanceProviderResult<T> = { value: T; usage: Omit<CreatorScriptAcceptanceUsage, "provider"> };
type ProviderContext = { signal: AbortSignal; maxOutputTokens: number };

export type CreatorScriptLiveAcceptanceProviders = {
  research: (input: ProviderContext) => Promise<AcceptanceProviderResult<CreatorScriptRewriteResearchResult>>;
  rewrite: (input: ProviderContext & { research: CreatorScriptRewriteResearchResult }) => Promise<AcceptanceProviderResult<CreatorScriptRewriteProviderCandidate>>;
  verifyClaims: (input: ProviderContext & { candidate: CreatorScriptRewriteProviderCandidate; sources: ResearchSource[] }) => Promise<AcceptanceProviderResult<CreatorScriptClaimEvidenceAssessment[]>>;
  assessGoals: (input: ProviderContext & { before: CreatorScript; after: CreatorScript }) => Promise<AcceptanceProviderResult<CreatorScriptEditorialRewriteResult["goalResults"]>>;
};

export type CreatorScriptAcceptanceStageTrace = {
  stage: "research_acquisition" | "source_passage_verification" | "script_rewriting" | "claim_evidence_assessment" | "editorial_goal_assessment" | "proposal_validation" | "persistence";
  timingKind: "actual_runtime";
  outcome: "completed" | "failed" | "timed_out" | "interrupted";
  elapsedMs: number;
  diagnostic: string | null;
};

const stableDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const failureOutcome = (error: unknown) => {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  return { diagnostic: message, outcome: /TIMEOUT/u.test(message) ? "timed_out" as const : /ABORT|INTERRUPT/u.test(message) ? "interrupted" as const : "failed" as const };
};

export async function runCreatorScriptControlledLiveAcceptance(input: {
  syntheticProjectId: string;
  script: CreatorScript;
  scenes: unknown[];
  instruction: string;
  language: "tr" | "en";
  authorization?: CreatorScriptLiveAcceptanceAuthorization;
  authorities: Record<string, OriginalSourceDocument["authority"]>;
  providers: CreatorScriptLiveAcceptanceProviders;
  acquireDocument?: typeof acquireOriginalSourceDocument;
  estimatedCostsUsd?: { exa: number; openai: number };
  stageTimeoutMs?: number;
  now?: () => number;
}) {
  if (!input.syntheticProjectId.startsWith("synthetic-acceptance-")) throw new Error("CREATOR_REFINEMENT_SYNTHETIC_PROJECT_REQUIRED");
  const canonicalBefore = stableDigest({ script: input.script, scenes: input.scenes });
  const traceId = `stage-4b1-${stableDigest([input.syntheticProjectId, input.instruction, canonicalBefore]).slice(0, 24)}`;
  const traces: CreatorScriptAcceptanceStageTrace[] = [];
  const now = input.now ?? (() => performance.now());
  const timeoutMs = input.stageTimeoutMs ?? 120_000;
  const authorization = input.authorization ?? DEFAULT_CREATOR_SCRIPT_LIVE_ACCEPTANCE_AUTHORIZATION;
  let budget: ReturnType<typeof createCreatorScriptLiveAcceptanceBudget>;
  try {
    budget = createCreatorScriptLiveAcceptanceBudget(authorization);
  } catch (error) {
    return { traceId, status: "BLOCKED" as const, preview: null, claimAuthority: [], missingSourceCoverage: [], verifiedPassageIds: [], sourceIds: [], traces, budget: { executionKind: authorization.executionKind, liveProvidersAuthorized: false, approvedMaxCostUsd: authorization.approvedMaxCostUsd, estimatedCostUsd: 0, reportedCostUsd: 0, costLimitExceeded: false, requestCounts: { exa: 0, openai: 0 }, approvedRequestLimits: { exa: authorization.approvedMaxExaRequests, openai: authorization.approvedMaxOpenAiRequests }, approvedMaxOutputTokensPerRequest: authorization.approvedMaxOutputTokensPerRequest, usage: [] }, zeroWriteProof: { beforeSha256: canonicalBefore, afterSha256: canonicalBefore, unchanged: true }, warnings: ["PREVIEW_REJECTED", "NO_APPLY_PATH", "LIVE_AUTHORIZATION_REJECTED"], diagnostic: error instanceof Error ? error.message : "UNKNOWN" };
  }
  const acquired = new Map<string, { document: OriginalSourceDocument; provenance: OriginalSourceAcquisitionProvenance }>();
  const acquireDocument = input.acquireDocument ?? acquireOriginalSourceDocument;
  let research: CreatorScriptRewriteResearchResult | null = null;
  let candidate: CreatorScriptRewriteProviderCandidate | null = null;
  let semanticAssessments: CreatorScriptClaimEvidenceAssessment[] = [];
  let rewriteResult: CreatorScriptEditorialRewriteResult | null = null;
  let claimAuthority: OriginalSourceClaimAuthorityResult[] = [];

  const runStage = async <T>(stage: CreatorScriptAcceptanceStageTrace["stage"], operation: (signal: AbortSignal) => Promise<T>) => {
    const started = now(); const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("CREATOR_REFINEMENT_STAGE_TIMEOUT")), timeoutMs);
    try {
      const value = await operation(controller.signal);
      traces.push({ stage, timingKind: "actual_runtime", outcome: "completed", elapsedMs: Math.max(0, now() - started), diagnostic: null });
      return value;
    } catch (error) {
      const normalized = controller.signal.aborted ? new Error("CREATOR_REFINEMENT_STAGE_TIMEOUT") : error;
      traces.push({ stage, timingKind: "actual_runtime", elapsedMs: Math.max(0, now() - started), ...failureOutcome(normalized) });
      throw normalized;
    } finally { clearTimeout(timer); }
  };

  const providerCall = async <T>(provider: "exa" | "openai", signal: AbortSignal, operation: (context: ProviderContext) => Promise<AcceptanceProviderResult<T>>) => {
    const estimatedCostUsd = input.estimatedCostsUsd?.[provider] ?? 0;
    budget.reserve(provider, estimatedCostUsd, authorization.approvedMaxOutputTokensPerRequest);
    const result = await operation({ signal, maxOutputTokens: authorization.approvedMaxOutputTokensPerRequest });
    budget.record({ provider, ...result.usage });
    if (budget.report().costLimitExceeded) throw new Error("CREATOR_REFINEMENT_LIVE_BUDGET_EXHAUSTED");
    return result.value;
  };

  try {
    research = await runStage("research_acquisition", async (signal) => {
      const result = await providerCall("exa", signal, input.providers.research);
      for (const source of result.sources) {
        const authority = input.authorities[source.sourceId];
        if (!authority) throw new Error("CREATOR_REFINEMENT_SOURCE_AUTHORITY_MISSING");
        acquired.set(source.sourceId, await acquireDocument({ source, authority }));
      }
      return result;
    });
    await runStage("source_passage_verification", async () => {
      if (!research?.verifiedEvidence.length) throw new Error("CREATOR_REFINEMENT_MISSING_VERIFIED_EVIDENCE");
      for (const [index, passage] of research.verifiedEvidence.entries()) {
        const source = research.sources.find((item) => item.sourceId === passage.sourceId);
        const document = acquired.get(passage.sourceId)?.document;
        if (!source || !document) throw new Error("CREATOR_REFINEMENT_SOURCE_PROVENANCE_INVALID");
        const evidence: ResearchEvidence = { evidenceId: `research-passage-${index + 1}`, sourceId: passage.sourceId, excerpt: passage.excerpt, contextNote: null, locator: passage.locator };
        if (verifyOriginalSourceEvidence({ source, evidence, document }).state !== "source_verified") throw new Error("CREATOR_REFINEMENT_SOURCE_PROVENANCE_INVALID");
      }
    });
    rewriteResult = await executeCreatorScriptEditorialRewrite({
      script: structuredClone(input.script), subject: input.syntheticProjectId, instruction: input.instruction, language: input.language, mode: "research_backed_rewrite",
      dependencies: {
        research: async () => research!,
        rewrite: async () => runStage("script_rewriting", async (signal) => {
          candidate = await providerCall("openai", signal, (context) => input.providers.rewrite({ ...context, research: research! }));
          return candidate;
        }),
        verifyClaims: async () => runStage("claim_evidence_assessment", async (signal) => {
          semanticAssessments = await providerCall("openai", signal, (context) => input.providers.verifyClaims({ ...context, candidate: candidate!, sources: research!.sources }));
          return semanticAssessments;
        }),
        assess: async ({ before, after }) => runStage("editorial_goal_assessment", async (signal) => providerCall("openai", signal, (context) => input.providers.assessGoals({ ...context, before, after }))),
      },
    });
    claimAuthority = await runStage("proposal_validation", async () => {
      const sourceById = new Map(research!.sources.map((source) => [source.sourceId, source]));
      const assessmentByClaim = new Map(semanticAssessments.map((assessment) => [assessment.claimId, assessment]));
      return candidate!.addedClaims.map((claim): OriginalSourceClaimAuthorityResult => {
        const supporting = candidate!.addedEvidence.filter((evidence) => claim.supportingEvidenceIds.includes(evidence.evidenceId));
        const fidelity = supporting.map((evidence) => {
          const source = sourceById.get(evidence.sourceId); const document = acquired.get(evidence.sourceId)?.document;
          if (!source) throw new Error("CREATOR_REFINEMENT_SOURCE_PROVENANCE_INVALID");
          return verifyOriginalSourceEvidence({ source, evidence, document });
        });
        const assessment = assessmentByClaim.get(claim.claimId) ?? { status: "unsupported" as const, evidenceIds: [] };
        return assessOriginalSourceClaimAuthority({ claim, evidence: candidate!.addedEvidence, sources: research!.sources, fidelity, semanticAssessment: assessment });
      });
    });
    if (claimAuthority.some((item) => item.status !== "accepted")) throw new Error("CREATOR_REFINEMENT_ORIGINAL_SOURCE_AUTHORITY_REJECTED");
    await runStage("persistence", async () => {
      if (stableDigest({ script: input.script, scenes: input.scenes }) !== canonicalBefore) throw new Error("CREATOR_REFINEMENT_ZERO_WRITE_VIOLATION");
    });
    return { traceId, status: authorization.executionKind === "live" ? "READY_FOR_CONTROLLED_LIVE_ACCEPTANCE" as const : "REVIEW_REQUIRED" as const, preview: rewriteResult.script, claimAuthority, missingSourceCoverage: [], verifiedPassageIds: candidate!.addedEvidence.map((item) => item.evidenceId), sourceIds: research.sources.map((item) => item.sourceId), traces, budget: budget.report(), zeroWriteProof: { beforeSha256: canonicalBefore, afterSha256: stableDigest({ script: input.script, scenes: input.scenes }), unchanged: true }, warnings: ["PREVIEW_ONLY", "NO_APPLY_PATH", ...(authorization.executionKind === "mock" ? ["MOCK_PROVIDERS_ONLY"] : [])] };
  } catch (error) {
    return { traceId, status: "BLOCKED" as const, preview: null, claimAuthority, missingSourceCoverage: claimAuthority.filter((item) => item.status !== "accepted").map((item) => item.claimId), verifiedPassageIds: [], sourceIds: research?.sources.map((item) => item.sourceId) ?? [], traces, budget: budget.report(), zeroWriteProof: { beforeSha256: canonicalBefore, afterSha256: stableDigest({ script: input.script, scenes: input.scenes }), unchanged: stableDigest({ script: input.script, scenes: input.scenes }) === canonicalBefore }, warnings: ["PREVIEW_REJECTED", "NO_APPLY_PATH"], diagnostic: error instanceof Error ? error.message : "UNKNOWN" };
  }
}
