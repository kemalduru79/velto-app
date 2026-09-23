import type { ResearchClaimEvidenceGraph } from "./claimEvidenceGraph.ts";
import type { EditorialGroundingCandidateSpan } from "./editorialGroundingRepair.ts";

export type EditorialCanonicalSelectionRepairReason =
  | "not_pathologically_collapsed"
  | "repair_accepted"
  | "repair_still_collapsed"
  | "repair_dropped_base"
  | "repair_not_materially_distinct"
  | "repair_invalid"
  | "repair_provider_failed";

export type EditorialCanonicalSelectionRepairDiagnostic = {
  repairTriggered: boolean;
  candidateSpanCount: number;
  distinctCandidateSourceCount: number;
  concreteCandidateSpanCount: number;
  discoveryCandidateSpanCount: number;
  discoveryDistinctSourceCount: number;
  discoveryConcreteCandidateCount: number;
  excludedAlreadyRepresentedSourceCount: number;
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

export const MAX_EDITORIAL_CANONICAL_DISCOVERY_SPANS = 24;
const MAX_EDITORIAL_CANONICAL_DISCOVERY_SPANS_PER_SOURCE = 3;

function sourceBalancedSpans(spans: EditorialGroundingCandidateSpan[]) {
  const sourceOrder = [...new Set(spans.map((span) => span.sourceId))];
  const queues = new Map(sourceOrder.map((sourceId) => {
    const sourceSpans = spans.filter((span) => span.sourceId === sourceId);
    const concrete = sourceSpans.filter(
      (span) => span.evidenceSpecificity === "concrete_observation",
    );
    const conceptual = sourceSpans.filter(
      (span) => span.evidenceSpecificity === "abstract_or_conceptual",
    );
    const ordered = [
      ...concrete.slice(0, 1),
      ...conceptual.slice(0, 1),
      ...concrete.slice(1),
      ...conceptual.slice(1),
    ];
    return [
      sourceId,
      ordered.slice(0, MAX_EDITORIAL_CANONICAL_DISCOVERY_SPANS_PER_SOURCE),
    ] as const;
  }));
  const selected: EditorialGroundingCandidateSpan[] = [];
  while (selected.length < MAX_EDITORIAL_CANONICAL_DISCOVERY_SPANS) {
    let added = false;
    for (const sourceId of sourceOrder) {
      const next = queues.get(sourceId)?.shift();
      if (!next) continue;
      selected.push(next);
      added = true;
      if (selected.length === MAX_EDITORIAL_CANONICAL_DISCOVERY_SPANS) break;
    }
    if (!added) break;
  }
  return selected;
}

export function createCanonicalEditorialDiscoveryBundle(input: {
  candidateSpans: EditorialGroundingCandidateSpan[];
  graph: ResearchClaimEvidenceGraph;
}) {
  const representedSourceIds = new Set(input.graph.evidence.map((item) => item.sourceId));
  const uncovered = input.candidateSpans.filter(
    (span) => !representedSourceIds.has(span.sourceId),
  );
  const discoveryPool = uncovered.length > 0 ? uncovered : input.candidateSpans;
  return {
    spans: sourceBalancedSpans(discoveryPool),
    representedSourceIds: [...representedSourceIds],
    excludedAlreadyRepresentedSourceCount: uncovered.length > 0
      ? new Set(input.candidateSpans.filter((span) =>
          representedSourceIds.has(span.sourceId)
        ).map((span) => span.sourceId)).size
      : 0,
  };
}

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
  const basePreserved = input.before.claims.every((baseClaim) =>
    input.after.claims.some((claim) =>
      claim.claimId === baseClaim.claimId &&
      claim.claimType === baseClaim.claimType &&
      claim.text === baseClaim.text
    )
  ) && input.before.evidence.every((baseEvidence) =>
    input.after.evidence.some((evidence) =>
      evidence.evidenceId === baseEvidence.evidenceId &&
      evidence.sourceId === baseEvidence.sourceId &&
      evidence.excerpt === baseEvidence.excerpt &&
      evidence.contextNote === baseEvidence.contextNote
    )
  ) && input.before.links.every((baseLink) =>
    input.after.links.some((link) =>
      link.claimId === baseLink.claimId &&
      link.evidenceId === baseLink.evidenceId &&
      link.stance === baseLink.stance
    )
  );
  if (!basePreserved) {
    return { accepted: false, reasonCode: "repair_dropped_base" as const };
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
  requestRepair: (repairInput: {
    discoveryCandidateSpans: EditorialGroundingCandidateSpan[];
    representedSourceIds: string[];
  }) => Promise<unknown>;
  validateRepair: (proposal: unknown) => Promise<ResearchClaimEvidenceGraph>;
}) {
  const candidateSourceCount = new Set(
    input.candidateSpans.map((span) => span.sourceId),
  ).size;
  const concreteCandidateSpanCount = input.candidateSpans.filter(
    (span) => span.evidenceSpecificity === "concrete_observation",
  ).length;
  const before = graphSummary(input.graph);
  const discovery = createCanonicalEditorialDiscoveryBundle(input);
  const discoverySourceCount = new Set(discovery.spans.map((span) => span.sourceId)).size;
  const discoveryConcreteCount = discovery.spans.filter(
    (span) => span.evidenceSpecificity === "concrete_observation",
  ).length;
  const baseDiagnostic = {
    candidateSpanCount: input.candidateSpans.length,
    distinctCandidateSourceCount: candidateSourceCount,
    concreteCandidateSpanCount,
    discoveryCandidateSpanCount: discovery.spans.length,
    discoveryDistinctSourceCount: discoverySourceCount,
    discoveryConcreteCandidateCount: discoveryConcreteCount,
    excludedAlreadyRepresentedSourceCount: discovery.excludedAlreadyRepresentedSourceCount,
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
    rawRepair = await input.requestRepair({
      discoveryCandidateSpans: discovery.spans,
      representedSourceIds: discovery.representedSourceIds,
    });
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
