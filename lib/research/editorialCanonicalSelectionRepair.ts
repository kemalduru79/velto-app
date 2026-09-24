import type { ResearchClaimEvidenceGraph } from "./claimEvidenceGraph.ts";
import {
  classifyEditorialGroundingSpanSpecificity,
  type EditorialGroundingCandidateSpan,
} from "./editorialGroundingRepair.ts";

export type EditorialCanonicalCapability = "demonstration" | "uncertainty";
export type EditorialCanonicalRepairTriggerReason =
  | "canonical_collapse"
  | "missing_demonstration"
  | "missing_uncertainty";

export type EditorialCanonicalSelectionRepairReason =
  | "not_pathologically_collapsed"
  | "repair_accepted"
  | "repair_still_collapsed"
  | "repair_dropped_base"
  | "repair_target_capability_unsatisfied"
  | "repair_not_materially_distinct"
  | "no_qualifying_addition"
  | "declared_additions_but_no_material_change"
  | "repair_invalid"
  | "repair_provider_failed";

export type EditorialCanonicalRepairOutcome =
  | "additions_found"
  | "no_qualifying_addition";

type EditorialCanonicalAuthorityDiagnostic = {
  claimId: string;
  claimType: string;
  evidenceId: string;
  selectedSpanId: string | null;
  sourceId: string;
  stance: string;
};

type EditorialCanonicalValidatedAuthorityDiagnostic =
  EditorialCanonicalAuthorityDiagnostic & {
    hasUncertaintyCapability: boolean;
  };

export type EditorialCanonicalSelectionRepairDiagnostic = {
  repairTriggered: boolean;
  repairTriggerReasons: EditorialCanonicalRepairTriggerReason[];
  candidateSpanCount: number;
  distinctCandidateSourceCount: number;
  concreteCandidateSpanCount: number;
  candidateCounterPurposeCount: number;
  discoveryCandidateSpanCount: number;
  discoveryDistinctSourceCount: number;
  discoveryConcreteCandidateCount: number;
  discoveryCounterPurposeCount: number;
  counterPurposeDiscoveryCandidates: Array<{
    spanId: string;
    sourceId: string;
  }>;
  excludedAlreadyRepresentedSourceCount: number;
  beforeClaimCount: number;
  beforeEvidenceCount: number;
  beforeDistinctSourceCount: number;
  beforeHasDemonstrationCapability: boolean;
  beforeHasUncertaintyCapability: boolean;
  repairProviderDispatched: boolean;
  providerParsedClaimCount: number | null;
  providerParsedEvidenceCount: number | null;
  providerParsedLinkCount: number | null;
  postValidationClaimCount: number | null;
  postValidationEvidenceCount: number | null;
  postValidationLinkCount: number | null;
  returnedAuthorities: EditorialCanonicalAuthorityDiagnostic[];
  validatedAuthorities: EditorialCanonicalValidatedAuthorityDiagnostic[];
  finalRepairClaimCount: number;
  finalRepairEvidenceCount: number;
  finalRepairDistinctSourceCount: number;
  afterClaimCount: number;
  afterEvidenceCount: number;
  afterDistinctSourceCount: number;
  afterHasDemonstrationCapability: boolean;
  afterHasUncertaintyCapability: boolean;
  finalDemonstrationEvidenceId: string | null;
  finalUncertaintyEvidenceId: string | null;
  repairAccepted: boolean;
  reasonCode: EditorialCanonicalSelectionRepairReason;
};

export const MAX_EDITORIAL_CANONICAL_DISCOVERY_SPANS = 24;
const MAX_EDITORIAL_CANONICAL_DISCOVERY_SPANS_PER_SOURCE = 3;

const EMPIRICAL_CLAIM_TYPES = new Set([
  "FACT",
  "PRIMARY_SOURCE_CLAIM",
  "RESEARCH_FINDING",
]);
const UNCERTAINTY_BEARING_CLAIM_TYPES = new Set([
  "THEORY",
  "FORECAST",
  "HYPOTHESIS",
  "METAPHYSICAL_CLAIM",
  "EDITORIAL_INFERENCE",
]);

export function createCanonicalEditorialCapabilitySnapshot(
  graph: ResearchClaimEvidenceGraph,
) {
  const claimById = new Map(graph.claims.map((claim) => [claim.claimId, claim]));
  const evidenceById = new Map(graph.evidence.map((evidence) => [evidence.evidenceId, evidence]));
  const demonstration = graph.links.find((link) => {
    const claim = claimById.get(link.claimId);
    const evidence = evidenceById.get(link.evidenceId);
    return link.stance === "supports" &&
      Boolean(claim && EMPIRICAL_CLAIM_TYPES.has(claim.claimType)) &&
      Boolean(evidence?.excerpt) &&
      classifyEditorialGroundingSpanSpecificity(evidence?.excerpt || "") === "concrete_observation";
  });
  const uncertainty = graph.links.find((link) => {
    const claim = claimById.get(link.claimId);
    return link.stance === "contextualizes" ||
      (link.stance === "supports" && Boolean(
        claim && UNCERTAINTY_BEARING_CLAIM_TYPES.has(claim.claimType)
      ));
  });
  return {
    hasDemonstrationCapability: Boolean(demonstration),
    hasUncertaintyCapability: Boolean(uncertainty),
    demonstrationClaimId: demonstration?.claimId || null,
    demonstrationEvidenceId: demonstration?.evidenceId || null,
    uncertaintyClaimId: uncertainty?.claimId || null,
    uncertaintyEvidenceId: uncertainty?.evidenceId || null,
  };
}

function sourceBalancedSpans(
  spans: EditorialGroundingCandidateSpan[],
  missingCapabilities: EditorialCanonicalCapability[],
) {
  const originalSourceOrder = [...new Set(spans.map((span) => span.sourceId))];
  const counterSourceIds = new Set(spans.filter((span) =>
    span.researchPurposes?.includes("counter_evidence")
  ).map((span) => span.sourceId));
  const sourceOrder = [
    ...originalSourceOrder.filter((sourceId) => counterSourceIds.has(sourceId)),
    ...originalSourceOrder.filter((sourceId) => !counterSourceIds.has(sourceId)),
  ];
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
  const selectSeed = (candidate: EditorialGroundingCandidateSpan | undefined) => {
    if (!candidate || selected.some((span) => span.spanId === candidate.spanId)) return;
    const queue = queues.get(candidate.sourceId);
    const queueIndex = queue?.findIndex((span) => span.spanId === candidate.spanId) ?? -1;
    if (queue && queueIndex >= 0) queue.splice(queueIndex, 1);
    selected.push(candidate);
  };
  if (missingCapabilities.includes("demonstration")) {
    selectSeed(spans.find((span) => span.evidenceSpecificity === "concrete_observation"));
  }
  if (missingCapabilities.includes("uncertainty")) {
    selectSeed(spans.find((span) => span.researchPurposes?.includes("counter_evidence")));
  }
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
  missingCapabilities?: EditorialCanonicalCapability[];
}) {
  const representedSourceIds = new Set(input.graph.evidence.map((item) => item.sourceId));
  const uncovered = input.candidateSpans.filter(
    (span) => !representedSourceIds.has(span.sourceId),
  );
  const discoveryPool = uncovered.length > 0 ? uncovered : input.candidateSpans;
  return {
    spans: sourceBalancedSpans(discoveryPool, input.missingCapabilities || []),
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

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function arrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : null;
}

function parseRepairResponse(value: unknown) {
  const response = record(value);
  const graph = record(response?.canonicalGraph);
  const repairOutcome = response?.repairOutcome;
  if (
    !response ||
    Object.keys(response).sort().join(",") !== "canonicalGraph,repairOutcome" ||
    (repairOutcome !== "additions_found" && repairOutcome !== "no_qualifying_addition") ||
    !graph
  ) {
    throw new Error("EDITORIAL_CANONICAL_REPAIR_RESPONSE_INVALID");
  }
  return {
    repairOutcome: repairOutcome as EditorialCanonicalRepairOutcome,
    canonicalGraph: graph,
    counts: {
      claims: arrayCount(graph.claims),
      evidence: arrayCount(graph.evidence),
      links: arrayCount(graph.links),
    },
  };
}

function cleanDiagnosticId(value: unknown) {
  return typeof value === "string" ? value.slice(0, 300) : "";
}

function parsedAuthorityDiagnostics(graph: Record<string, unknown>) {
  const claims = Array.isArray(graph.claims) ? graph.claims : [];
  const evidence = Array.isArray(graph.evidence) ? graph.evidence : [];
  const links = Array.isArray(graph.links) ? graph.links : [];
  const claimById = new Map(claims.flatMap((value) => {
    const item = record(value);
    const claimId = cleanDiagnosticId(item?.claimId);
    return claimId ? [[claimId, item]] : [];
  }));
  const evidenceById = new Map(evidence.flatMap((value) => {
    const item = record(value);
    const evidenceId = cleanDiagnosticId(item?.evidenceId);
    return evidenceId ? [[evidenceId, item]] : [];
  }));
  return links.slice(0, 180).flatMap((value) => {
    const link = record(value);
    const claimId = cleanDiagnosticId(link?.claimId);
    const evidenceId = cleanDiagnosticId(link?.evidenceId);
    const claim = claimById.get(claimId);
    const item = evidenceById.get(evidenceId);
    return claim && item ? [{
      claimId,
      claimType: cleanDiagnosticId(claim.claimType),
      evidenceId,
      selectedSpanId: cleanDiagnosticId(item.spanId) || null,
      sourceId: cleanDiagnosticId(item.sourceId),
      stance: cleanDiagnosticId(link?.stance),
    }] : [];
  });
}

function validatedAuthorityDiagnostics(input: {
  graph: ResearchClaimEvidenceGraph;
  candidateSpans: EditorialGroundingCandidateSpan[];
  returnedAuthorities: EditorialCanonicalAuthorityDiagnostic[];
}) {
  const claimById = new Map(input.graph.claims.map((claim) => [claim.claimId, claim]));
  const evidenceById = new Map(input.graph.evidence.map((evidence) => [evidence.evidenceId, evidence]));
  const returnedByEvidenceId = new Map(input.returnedAuthorities.map((item) => [item.evidenceId, item]));
  return input.graph.links.slice(0, 180).flatMap((link) => {
    const claim = claimById.get(link.claimId);
    const evidence = evidenceById.get(link.evidenceId);
    if (!claim || !evidence) return [];
    const returnedSpanId = returnedByEvidenceId.get(evidence.evidenceId)?.selectedSpanId;
    const returnedSpan = input.candidateSpans.find((span) =>
      span.spanId === returnedSpanId &&
      span.sourceId === evidence.sourceId &&
      span.text === evidence.excerpt
    );
    const selectedSpanId = returnedSpan?.spanId || input.candidateSpans.find((span) =>
      span.sourceId === evidence.sourceId && span.text === evidence.excerpt
    )?.spanId || null;
    return [{
      claimId: claim.claimId,
      claimType: claim.claimType,
      evidenceId: evidence.evidenceId,
      selectedSpanId,
      sourceId: evidence.sourceId,
      stance: link.stance,
      hasUncertaintyCapability: link.stance === "contextualizes" || (
        link.stance === "supports" && UNCERTAINTY_BEARING_CLAIM_TYPES.has(claim.claimType)
      ),
    }];
  });
}

function sameCanonicalAuthority(
  left: ResearchClaimEvidenceGraph,
  right: ResearchClaimEvidenceGraph,
) {
  return JSON.stringify(left.claims) === JSON.stringify(right.claims) &&
    JSON.stringify(left.evidence) === JSON.stringify(right.evidence) &&
    JSON.stringify(left.links) === JSON.stringify(right.links);
}

export function shouldRepairCanonicalEditorialSelection(input: {
  candidateSpans: EditorialGroundingCandidateSpan[];
  graph: ResearchClaimEvidenceGraph;
}) {
  return createCanonicalEditorialRepairTriggerReasons(input).length > 0;
}

export function createCanonicalEditorialRepairTriggerReasons(input: {
  candidateSpans: EditorialGroundingCandidateSpan[];
  graph: ResearchClaimEvidenceGraph;
}): EditorialCanonicalRepairTriggerReason[] {
  const candidateSourceCount = new Set(
    input.candidateSpans.map((span) => span.sourceId),
  ).size;
  const summary = graphSummary(input.graph);
  const capabilities = createCanonicalEditorialCapabilitySnapshot(input.graph);
  const reasons: EditorialCanonicalRepairTriggerReason[] = [];
  if (input.candidateSpans.length > 1 &&
    candidateSourceCount > 1 &&
    summary.claimCount === 1 &&
    summary.evidenceCount === 1 &&
    summary.distinctSourceCount === 1) {
    reasons.push("canonical_collapse");
  }
  if (!capabilities.hasDemonstrationCapability && input.candidateSpans.some(
    (span) => span.evidenceSpecificity === "concrete_observation"
  )) reasons.push("missing_demonstration");
  if (!capabilities.hasUncertaintyCapability && input.candidateSpans.some(
    (span) => span.researchPurposes?.includes("counter_evidence")
  )) reasons.push("missing_uncertainty");
  return reasons;
}

function repairImprovesCanonicalAuthority(input: {
  before: ResearchClaimEvidenceGraph;
  after: ResearchClaimEvidenceGraph;
  triggerReasons: EditorialCanonicalRepairTriggerReason[];
}) {
  const before = graphSummary(input.before);
  const after = graphSummary(input.after);
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
  const withoutDuplicates = !after.hasDuplicateClaimAuthority &&
    !after.hasDuplicateEvidenceAuthority;
  if (!withoutDuplicates) {
    return { accepted: false, reasonCode: "repair_not_materially_distinct" as const };
  }
  if (input.triggerReasons.includes("canonical_collapse") && (
    after.claimCount <= 1 || after.evidenceCount <= 1 || after.distinctSourceCount <= 1 ||
    after.linkedClaimCount <= 1 || after.linkedEvidenceCount <= 1 || after.linkedSourceCount <= 1
  )) {
    return { accepted: false, reasonCode: "repair_still_collapsed" as const };
  }
  const afterCapabilities = createCanonicalEditorialCapabilitySnapshot(input.after);
  const targetsSatisfied = !input.triggerReasons.includes("missing_demonstration") ||
      afterCapabilities.hasDemonstrationCapability;
  const uncertaintySatisfied = !input.triggerReasons.includes("missing_uncertainty") ||
      afterCapabilities.hasUncertaintyCapability;
  if (!targetsSatisfied || !uncertaintySatisfied) {
    return { accepted: false, reasonCode: "repair_target_capability_unsatisfied" as const };
  }
  const materiallyDistinct =
    !after.hasDuplicateEvidenceAuthority &&
    after.distinctEvidenceCount > before.distinctEvidenceCount &&
    after.linkedEvidenceCount > before.linkedEvidenceCount &&
    (!input.triggerReasons.includes("canonical_collapse") || (
      after.distinctClaimCount > before.distinctClaimCount &&
      after.distinctSourceCount > before.distinctSourceCount
    ));
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
    missingCapabilities: EditorialCanonicalCapability[];
    repairTriggerReasons: EditorialCanonicalRepairTriggerReason[];
  }) => Promise<unknown>;
  validateRepair: (proposal: unknown) => Promise<ResearchClaimEvidenceGraph>;
}) {
  const candidateSourceCount = new Set(
    input.candidateSpans.map((span) => span.sourceId),
  ).size;
  const concreteCandidateSpanCount = input.candidateSpans.filter(
    (span) => span.evidenceSpecificity === "concrete_observation",
  ).length;
  const candidateCounterPurposeCount = input.candidateSpans.filter((span) =>
    span.researchPurposes?.includes("counter_evidence")
  ).length;
  const before = graphSummary(input.graph);
  const beforeCapabilities = createCanonicalEditorialCapabilitySnapshot(input.graph);
  const repairTriggerReasons = createCanonicalEditorialRepairTriggerReasons(input);
  const missingCapabilities: EditorialCanonicalCapability[] = [
    ...(repairTriggerReasons.includes("missing_demonstration") ? ["demonstration" as const] : []),
    ...(repairTriggerReasons.includes("missing_uncertainty") ? ["uncertainty" as const] : []),
  ];
  const discovery = createCanonicalEditorialDiscoveryBundle({
    ...input,
    missingCapabilities,
  });
  const discoverySourceCount = new Set(discovery.spans.map((span) => span.sourceId)).size;
  const discoveryConcreteCount = discovery.spans.filter(
    (span) => span.evidenceSpecificity === "concrete_observation",
  ).length;
  const discoveryCounterPurposeCount = discovery.spans.filter((span) =>
    span.researchPurposes?.includes("counter_evidence")
  ).length;
  const baseDiagnostic = {
    candidateSpanCount: input.candidateSpans.length,
    distinctCandidateSourceCount: candidateSourceCount,
    concreteCandidateSpanCount,
    candidateCounterPurposeCount,
    discoveryCandidateSpanCount: discovery.spans.length,
    discoveryDistinctSourceCount: discoverySourceCount,
    discoveryConcreteCandidateCount: discoveryConcreteCount,
    discoveryCounterPurposeCount,
    counterPurposeDiscoveryCandidates: discovery.spans.filter((span) =>
      span.researchPurposes?.includes("counter_evidence")
    ).map((span) => ({ spanId: span.spanId, sourceId: span.sourceId })),
    excludedAlreadyRepresentedSourceCount: discovery.excludedAlreadyRepresentedSourceCount,
    beforeClaimCount: before.claimCount,
    beforeEvidenceCount: before.evidenceCount,
    beforeDistinctSourceCount: before.distinctSourceCount,
    beforeHasDemonstrationCapability: beforeCapabilities.hasDemonstrationCapability,
    beforeHasUncertaintyCapability: beforeCapabilities.hasUncertaintyCapability,
  };
  const noProviderCounts = {
    providerParsedClaimCount: null,
    providerParsedEvidenceCount: null,
    providerParsedLinkCount: null,
    postValidationClaimCount: null,
    postValidationEvidenceCount: null,
    postValidationLinkCount: null,
    returnedAuthorities: [],
    validatedAuthorities: [],
    finalRepairClaimCount: before.claimCount,
    finalRepairEvidenceCount: before.evidenceCount,
    finalRepairDistinctSourceCount: before.distinctSourceCount,
  };

  if (!shouldRepairCanonicalEditorialSelection(input)) {
    return {
      graph: input.graph,
      diagnostic: {
        ...baseDiagnostic,
        repairTriggered: false,
        repairTriggerReasons,
        repairProviderDispatched: false,
        ...noProviderCounts,
        afterClaimCount: before.claimCount,
        afterEvidenceCount: before.evidenceCount,
        afterDistinctSourceCount: before.distinctSourceCount,
        afterHasDemonstrationCapability: beforeCapabilities.hasDemonstrationCapability,
        afterHasUncertaintyCapability: beforeCapabilities.hasUncertaintyCapability,
        finalDemonstrationEvidenceId: beforeCapabilities.demonstrationEvidenceId,
        finalUncertaintyEvidenceId: beforeCapabilities.uncertaintyEvidenceId,
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
      missingCapabilities,
      repairTriggerReasons,
    });
  } catch {
    return {
      graph: input.graph,
      diagnostic: {
        ...baseDiagnostic,
        repairTriggered: true,
        repairTriggerReasons,
        repairProviderDispatched: true,
        ...noProviderCounts,
        afterClaimCount: before.claimCount,
        afterEvidenceCount: before.evidenceCount,
        afterDistinctSourceCount: before.distinctSourceCount,
        afterHasDemonstrationCapability: beforeCapabilities.hasDemonstrationCapability,
        afterHasUncertaintyCapability: beforeCapabilities.hasUncertaintyCapability,
        finalDemonstrationEvidenceId: beforeCapabilities.demonstrationEvidenceId,
        finalUncertaintyEvidenceId: beforeCapabilities.uncertaintyEvidenceId,
        repairAccepted: false,
        reasonCode: "repair_provider_failed",
      } satisfies EditorialCanonicalSelectionRepairDiagnostic,
    };
  }

  let parsedRepair: ReturnType<typeof parseRepairResponse>;
  try {
    parsedRepair = parseRepairResponse(rawRepair);
  } catch {
    return {
      graph: input.graph,
      diagnostic: {
        ...baseDiagnostic,
        repairTriggered: true,
        repairTriggerReasons,
        repairProviderDispatched: true,
        ...noProviderCounts,
        afterClaimCount: before.claimCount,
        afterEvidenceCount: before.evidenceCount,
        afterDistinctSourceCount: before.distinctSourceCount,
        afterHasDemonstrationCapability: beforeCapabilities.hasDemonstrationCapability,
        afterHasUncertaintyCapability: beforeCapabilities.hasUncertaintyCapability,
        finalDemonstrationEvidenceId: beforeCapabilities.demonstrationEvidenceId,
        finalUncertaintyEvidenceId: beforeCapabilities.uncertaintyEvidenceId,
        repairAccepted: false,
        reasonCode: "repair_invalid",
      } satisfies EditorialCanonicalSelectionRepairDiagnostic,
    };
  }

  const providerCounts = {
    providerParsedClaimCount: parsedRepair.counts.claims,
    providerParsedEvidenceCount: parsedRepair.counts.evidence,
    providerParsedLinkCount: parsedRepair.counts.links,
    returnedAuthorities: parsedAuthorityDiagnostics(parsedRepair.canonicalGraph),
  };
  let repairedGraph: ResearchClaimEvidenceGraph;
  try {
    repairedGraph = await input.validateRepair(parsedRepair.canonicalGraph);
  } catch {
    return {
      graph: input.graph,
      diagnostic: {
        ...baseDiagnostic,
        repairTriggered: true,
        repairTriggerReasons,
        repairProviderDispatched: true,
        ...providerCounts,
        postValidationClaimCount: null,
        postValidationEvidenceCount: null,
        postValidationLinkCount: null,
        validatedAuthorities: [],
        finalRepairClaimCount: before.claimCount,
        finalRepairEvidenceCount: before.evidenceCount,
        finalRepairDistinctSourceCount: before.distinctSourceCount,
        afterClaimCount: before.claimCount,
        afterEvidenceCount: before.evidenceCount,
        afterDistinctSourceCount: before.distinctSourceCount,
        afterHasDemonstrationCapability: beforeCapabilities.hasDemonstrationCapability,
        afterHasUncertaintyCapability: beforeCapabilities.hasUncertaintyCapability,
        finalDemonstrationEvidenceId: beforeCapabilities.demonstrationEvidenceId,
        finalUncertaintyEvidenceId: beforeCapabilities.uncertaintyEvidenceId,
        repairAccepted: false,
        reasonCode: "repair_invalid",
      } satisfies EditorialCanonicalSelectionRepairDiagnostic,
    };
  }

  const after = graphSummary(repairedGraph);
  const afterCapabilities = createCanonicalEditorialCapabilitySnapshot(repairedGraph);
  const postValidationCounts = {
    postValidationClaimCount: after.claimCount,
    postValidationEvidenceCount: after.evidenceCount,
    postValidationLinkCount: repairedGraph.links.length,
    validatedAuthorities: validatedAuthorityDiagnostics({
      graph: repairedGraph,
      candidateSpans: input.candidateSpans,
      returnedAuthorities: providerCounts.returnedAuthorities,
    }),
  };
  const unchanged = sameCanonicalAuthority(input.graph, repairedGraph);
  const selection = parsedRepair.repairOutcome === "no_qualifying_addition"
    ? {
        accepted: false,
        reasonCode: unchanged
          ? "no_qualifying_addition" as const
          : "repair_invalid" as const,
      }
    : unchanged
      ? {
          accepted: false,
          reasonCode: "declared_additions_but_no_material_change" as const,
        }
      : repairImprovesCanonicalAuthority({
          before: input.graph,
          after: repairedGraph,
          triggerReasons: repairTriggerReasons,
        });
  const finalGraph = selection.accepted ? repairedGraph : input.graph;
  const final = graphSummary(finalGraph);
  return {
    graph: finalGraph,
    diagnostic: {
      ...baseDiagnostic,
      repairTriggered: true,
      repairTriggerReasons,
      repairProviderDispatched: true,
      ...providerCounts,
      ...postValidationCounts,
      finalRepairClaimCount: final.claimCount,
      finalRepairEvidenceCount: final.evidenceCount,
      finalRepairDistinctSourceCount: final.distinctSourceCount,
      afterClaimCount: after.claimCount,
      afterEvidenceCount: after.evidenceCount,
      afterDistinctSourceCount: after.distinctSourceCount,
      afterHasDemonstrationCapability: afterCapabilities.hasDemonstrationCapability,
      afterHasUncertaintyCapability: afterCapabilities.hasUncertaintyCapability,
      finalDemonstrationEvidenceId: selection.accepted
        ? afterCapabilities.demonstrationEvidenceId
        : beforeCapabilities.demonstrationEvidenceId,
      finalUncertaintyEvidenceId: selection.accepted
        ? afterCapabilities.uncertaintyEvidenceId
        : beforeCapabilities.uncertaintyEvidenceId,
      repairAccepted: selection.accepted,
      reasonCode: selection.reasonCode,
    } satisfies EditorialCanonicalSelectionRepairDiagnostic,
  };
}
