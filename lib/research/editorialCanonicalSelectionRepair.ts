import type { ResearchClaimEvidenceGraph } from "./claimEvidenceGraph.ts";
import type { EditorialGroundingCandidateSpan } from "./editorialGroundingRepair.ts";

export type EditorialCanonicalSelectionRepairReason =
  | "not_pathologically_collapsed"
  | "repair_accepted"
  | "repair_still_collapsed"
  | "repair_not_materially_distinct"
  | "repair_invalid"
  | "repair_provider_failed";

export type EditorialCanonicalSelectionRepairDiagnostic = {
  repairTriggered: boolean;
  candidateSpanCount: number;
  distinctCandidateSourceCount: number;
  concreteCandidateSpanCount: number;
  beforeClaimCount: number;
  beforeEvidenceCount: number;
  beforeDistinctSourceCount: number;
  repairProviderDispatched: boolean;
  afterClaimCount: number;
  afterEvidenceCount: number;
  afterDistinctSourceCount: number;
  repairAccepted: boolean;
  reasonCode: EditorialCanonicalSelectionRepairReason;
};

function normalizedIdentity(value: string | null) {
  return (value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

function graphSummary(graph: ResearchClaimEvidenceGraph) {
  const distinctSourceIds = new Set(graph.evidence.map((item) => item.sourceId));
  const linkedClaimIds = new Set(graph.links.map((item) => item.claimId));
  const linkedEvidenceIds = new Set(graph.links.map((item) => item.evidenceId));
  const evidenceById = new Map(graph.evidence.map((item) => [item.evidenceId, item]));
  const linkedSourceIds = new Set(
    [...linkedEvidenceIds].flatMap((evidenceId) => {
      const evidence = evidenceById.get(evidenceId);
      return evidence ? [evidence.sourceId] : [];
    }),
  );
  const distinctClaims = new Set(graph.claims.map((item) =>
    `${item.claimType}\0${normalizedIdentity(item.text)}`
  ));
  const distinctEvidence = new Set(graph.evidence.map((item) =>
    `${item.sourceId}\0${normalizedIdentity(item.excerpt)}`
  ));
  return {
    claimCount: graph.claims.length,
    evidenceCount: graph.evidence.length,
    distinctSourceCount: distinctSourceIds.size,
    distinctClaimCount: distinctClaims.size,
    distinctEvidenceCount: distinctEvidence.size,
    linkedClaimCount: linkedClaimIds.size,
    linkedEvidenceCount: linkedEvidenceIds.size,
    linkedSourceCount: linkedSourceIds.size,
    hasDuplicateClaimAuthority: distinctClaims.size !== graph.claims.length,
    hasDuplicateEvidenceAuthority: distinctEvidence.size !== graph.evidence.length,
  };
}

export function shouldRepairCanonicalEditorialSelection(input: {
  candidateSpans: EditorialGroundingCandidateSpan[];
  graph: ResearchClaimEvidenceGraph;
}) {
  const candidateSourceCount = new Set(
    input.candidateSpans.map((span) => span.sourceId),
  ).size;
  const summary = graphSummary(input.graph);
  return input.candidateSpans.length > 1 &&
    candidateSourceCount > 1 &&
    summary.claimCount === 1 &&
    summary.evidenceCount === 1 &&
    summary.distinctSourceCount === 1;
}

function repairImprovesCanonicalAuthority(input: {
  before: ResearchClaimEvidenceGraph;
  after: ResearchClaimEvidenceGraph;
}) {
  const before = graphSummary(input.before);
  const after = graphSummary(input.after);
  if (
    after.claimCount <= 1 || after.evidenceCount <= 1 || after.distinctSourceCount <= 1 ||
    after.linkedClaimCount <= 1 || after.linkedEvidenceCount <= 1 || after.linkedSourceCount <= 1
  ) {
    return { accepted: false, reasonCode: "repair_still_collapsed" as const };
  }
  const materiallyDistinct = !after.hasDuplicateClaimAuthority &&
    !after.hasDuplicateEvidenceAuthority &&
    after.distinctClaimCount > before.distinctClaimCount &&
    after.distinctEvidenceCount > before.distinctEvidenceCount &&
    after.distinctSourceCount > before.distinctSourceCount;
  return materiallyDistinct
    ? { accepted: true, reasonCode: "repair_accepted" as const }
    : { accepted: false, reasonCode: "repair_not_materially_distinct" as const };
}

export async function repairCollapsedCanonicalEditorialSelection(input: {
  candidateSpans: EditorialGroundingCandidateSpan[];
  graph: ResearchClaimEvidenceGraph;
  requestRepair: () => Promise<unknown>;
  validateRepair: (proposal: unknown) => Promise<ResearchClaimEvidenceGraph>;
}) {
  const candidateSourceCount = new Set(
    input.candidateSpans.map((span) => span.sourceId),
  ).size;
  const concreteCandidateSpanCount = input.candidateSpans.filter(
    (span) => span.evidenceSpecificity === "concrete_observation",
  ).length;
  const before = graphSummary(input.graph);
  const baseDiagnostic = {
    candidateSpanCount: input.candidateSpans.length,
    distinctCandidateSourceCount: candidateSourceCount,
    concreteCandidateSpanCount,
    beforeClaimCount: before.claimCount,
    beforeEvidenceCount: before.evidenceCount,
    beforeDistinctSourceCount: before.distinctSourceCount,
  };

  if (!shouldRepairCanonicalEditorialSelection(input)) {
    return {
      graph: input.graph,
      diagnostic: {
        ...baseDiagnostic,
        repairTriggered: false,
        repairProviderDispatched: false,
        afterClaimCount: before.claimCount,
        afterEvidenceCount: before.evidenceCount,
        afterDistinctSourceCount: before.distinctSourceCount,
        repairAccepted: false,
        reasonCode: "not_pathologically_collapsed",
      } satisfies EditorialCanonicalSelectionRepairDiagnostic,
    };
  }

  let rawRepair: unknown;
  try {
    rawRepair = await input.requestRepair();
  } catch {
    return {
      graph: input.graph,
      diagnostic: {
        ...baseDiagnostic,
        repairTriggered: true,
        repairProviderDispatched: true,
        afterClaimCount: before.claimCount,
        afterEvidenceCount: before.evidenceCount,
        afterDistinctSourceCount: before.distinctSourceCount,
        repairAccepted: false,
        reasonCode: "repair_provider_failed",
      } satisfies EditorialCanonicalSelectionRepairDiagnostic,
    };
  }

  let repairedGraph: ResearchClaimEvidenceGraph;
  try {
    repairedGraph = await input.validateRepair(rawRepair);
  } catch {
    return {
      graph: input.graph,
      diagnostic: {
        ...baseDiagnostic,
        repairTriggered: true,
        repairProviderDispatched: true,
        afterClaimCount: before.claimCount,
        afterEvidenceCount: before.evidenceCount,
        afterDistinctSourceCount: before.distinctSourceCount,
        repairAccepted: false,
        reasonCode: "repair_invalid",
      } satisfies EditorialCanonicalSelectionRepairDiagnostic,
    };
  }

  const after = graphSummary(repairedGraph);
  const selection = repairImprovesCanonicalAuthority({
    before: input.graph,
    after: repairedGraph,
  });
  return {
    graph: selection.accepted ? repairedGraph : input.graph,
    diagnostic: {
      ...baseDiagnostic,
      repairTriggered: true,
      repairProviderDispatched: true,
      afterClaimCount: after.claimCount,
      afterEvidenceCount: after.evidenceCount,
      afterDistinctSourceCount: after.distinctSourceCount,
      repairAccepted: selection.accepted,
      reasonCode: selection.reasonCode,
    } satisfies EditorialCanonicalSelectionRepairDiagnostic,
  };
}
