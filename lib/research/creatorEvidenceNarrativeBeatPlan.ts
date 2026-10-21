import type { CreatorScriptSectionBudget } from "../creator/creatorScript.ts";
import { classifyEditorialGroundingSpanSpecificity } from "./editorialGroundingRepair.ts";
import type { CreatorSectionEvidencePromptSelection } from "./creatorEvidencePack.ts";

type PromptUnit = CreatorSectionEvidencePromptSelection["units"][number];
type PromptBinding = PromptUnit["supportingEvidence"][number];

export type CreatorEvidenceNarrativeBeatRole =
  | "grounded_human_tension"
  | "mechanism"
  | "concrete_observed_finding"
  | "legitimate_limitation_or_alternate_explanation"
  | "earned_implication"
  | "distinct_supported_step";

export type CreatorEvidenceNarrativeBeat = {
  beatId: string;
  sectionId: string;
  beatRole: CreatorEvidenceNarrativeBeatRole;
  claimId: string;
  evidenceId: string;
  sourceId: string;
  stance: "supports" | "contextualizes" | "contradicts";
  epistemicStatus: PromptUnit["epistemicStatus"];
  specificity: "concrete_observation" | "abstract_or_conceptual";
  supportStatus: "canonical_context_eligible" | "qualified_uncertainty" | "source_blocked" | "unsupported";
  provenanceVerification: "not_assessed" | "source_blocked";
  narrativeUse: "primary" | "supporting" | "thematic_reference" | "blocked";
};

export type CreatorEvidenceNarrativeGap =
  | "missing_counterview"
  | "missing_concrete_observation"
  | "generic_support_only"
  | "source_provenance_blocked"
  | "unsupported_narrative_opportunity"
  | "repeated_primary_candidate"
  | "evidence_omitted_by_budget";

export type CreatorEvidenceNarrativeSectionPlan = {
  sectionId: string;
  sectionKind: CreatorScriptSectionBudget["kind"];
  beatRole: CreatorEvidenceNarrativeBeatRole;
  primaryBeat: CreatorEvidenceNarrativeBeat | null;
  supportingBeats: CreatorEvidenceNarrativeBeat[];
  gaps: CreatorEvidenceNarrativeGap[];
  omittedByBudgetCount: number;
};

export type CreatorEvidenceNarrativeBeatPlan = {
  sections: CreatorEvidenceNarrativeSectionPlan[];
  progression: Array<{
    sectionId: string;
    beatRole: CreatorEvidenceNarrativeBeatRole;
    primaryClaimId: string | null;
    primaryEvidenceId: string | null;
    distinctFromPrevious: boolean;
  }>;
  metrics: {
    sectionCount: number;
    candidatePrimaryBeatCount: number;
    canonicalContextEligiblePrimaryBeatCount: number;
    candidateConcretePrimaryBeatCount: number;
    independentlyProvenanceVerifiedPrimaryBeatCount: 0;
    independentlyProvenanceVerifiedConcretePrimaryBeatCount: 0;
    duplicatePrimaryBeatCount: number;
    repeatedNarrativeBeatCount: number;
    missingCounterviewCount: number;
    missingConcreteObservationCount: number;
    genericSupportOnlyCount: number;
    sourceBlockedBeatCount: number;
    unsupportedNarrativeOpportunityCount: number;
    omittedByBudgetCount: number;
  };
  advisoryOnly: true;
  independentProvenanceVerification: "not_assessed";
  semanticAcceptanceClaimed: false;
};

export type CreatorEvidenceNarrativeSectionInput = {
  section: Pick<CreatorScriptSectionBudget, "id" | "kind" | "ownershipBoundary">;
  evidenceSelection: CreatorSectionEvidencePromptSelection;
};

const UNCERTAIN_CLAIM_TYPES = new Set([
  "THEORY",
  "FORECAST",
  "HYPOTHESIS",
  "METAPHYSICAL_CLAIM",
  "EDITORIAL_INFERENCE",
]);

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function roleFor(section: CreatorEvidenceNarrativeSectionInput["section"]): CreatorEvidenceNarrativeBeatRole {
  const owns = new Set(section.ownershipBoundary.owns);
  if (owns.has("grounded_demonstration") || owns.has("concrete_case")) {
    return "concrete_observed_finding";
  }
  if (
    owns.has("counterview") || owns.has("thesis_stress_test") || owns.has("limits") ||
    owns.has("uncertainty") || owns.has("scope_conditions") || owns.has("evidence_boundary")
  ) return "legitimate_limitation_or_alternate_explanation";
  if (owns.has("mechanism") || owns.has("causal_process")) return "mechanism";
  if (
    owns.has("highest_order_implication") || owns.has("synthesis_for_master_question") ||
    owns.has("human_implication") || owns.has("unresolved_question") ||
    section.kind === "conclusion"
  ) return "earned_implication";
  if (
    owns.has("human_stakes") || owns.has("master_tension") || owns.has("master_question") ||
    section.kind === "opening"
  ) return "grounded_human_tension";
  return "distinct_supported_step";
}

function preferredStances(role: CreatorEvidenceNarrativeBeatRole) {
  if (role === "legitimate_limitation_or_alternate_explanation") {
    return ["contradicts", "contextualizes", "supports"] as const;
  }
  return ["supports", "contextualizes", "contradicts"] as const;
}

function candidatesFor(input: {
  sectionId: string;
  role: CreatorEvidenceNarrativeBeatRole;
  unit: PromptUnit;
  blockedSourceIds: Set<string>;
}) {
  const refs = new Map(input.unit.sourceRefs.map((source) => [source.sourceId, source]));
  const byStance: Record<"supports" | "contextualizes" | "contradicts", PromptBinding[]> = {
    supports: input.unit.supportingEvidence,
    contextualizes: input.unit.contextualEvidence,
    contradicts: input.unit.counterEvidence,
  };
  return preferredStances(input.role).flatMap((stance, stanceIndex) =>
    byStance[stance].map((binding, bindingIndex) => {
      const source = refs.get(binding.sourceId);
      const specificity = classifyEditorialGroundingSpanSpecificity(binding.excerpt || "");
      const sourceBlocked = input.blockedSourceIds.has(binding.sourceId) || source?.reviewStatus !== "usable";
      const unsupported = !binding.excerpt || !source;
      const supportStatus = sourceBlocked
        ? "source_blocked" as const
        : unsupported
          ? "unsupported" as const
          : UNCERTAIN_CLAIM_TYPES.has(input.unit.epistemicStatus)
            ? "qualified_uncertainty" as const
            : "canonical_context_eligible" as const;
      const concretePriority = input.role === "concrete_observed_finding" &&
        stance === "supports" && specificity === "concrete_observation" ? 0 : 1;
      return {
        beat: {
          beatId: `${input.sectionId}:${input.unit.claimId}:${binding.evidenceId}:${stance}`,
          sectionId: input.sectionId,
          beatRole: input.role,
          claimId: input.unit.claimId,
          evidenceId: binding.evidenceId,
          sourceId: binding.sourceId,
          stance,
          epistemicStatus: input.unit.epistemicStatus,
          specificity,
          supportStatus,
          provenanceVerification: sourceBlocked ? "source_blocked" as const : "not_assessed" as const,
          narrativeUse: "supporting" as const,
        },
        priority: concretePriority * 100 + stanceIndex * 10 + bindingIndex,
      };
    })
  ).toSorted((left, right) => left.priority - right.priority);
}

/**
 * Creates an advisory evidence-to-narrative beat map from already-authorized,
 * Stage 5A-budgeted section evidence. It never generates narration, changes
 * eligibility, promotes blocked provenance, or asserts semantic acceptance.
 */
export function createCreatorEvidenceNarrativeBeatPlan(input: {
  sections: CreatorEvidenceNarrativeSectionInput[];
  blockedSourceIds?: string[];
}): CreatorEvidenceNarrativeBeatPlan {
  const blockedSourceIds = new Set(input.blockedSourceIds || []);
  const usedPrimaryClaims = new Set<string>();
  const usedPrimaryEvidence = new Set<string>();
  const sections = input.sections.map(({ section, evidenceSelection }) => {
    const beatRole = roleFor(section);
    const allCandidates = evidenceSelection.units.flatMap((unit) =>
      candidatesFor({ sectionId: section.id, role: beatRole, unit, blockedSourceIds })
    );
    const narratable = allCandidates.filter(({ beat }) =>
      beat.supportStatus === "canonical_context_eligible" || beat.supportStatus === "qualified_uncertainty"
    );
    const freshPrimary = narratable.find(({ beat }) =>
      !usedPrimaryClaims.has(beat.claimId) && !usedPrimaryEvidence.has(beat.evidenceId)
    );
    const repeatedPrimaryCandidate = !freshPrimary && narratable.length > 0;
    const primaryBeat = freshPrimary
      ? { ...freshPrimary.beat, narrativeUse: "primary" as const }
      : null;
    if (primaryBeat) {
      usedPrimaryClaims.add(primaryBeat.claimId);
      usedPrimaryEvidence.add(primaryBeat.evidenceId);
    }
    const supportingBeats = allCandidates
      .filter(({ beat }) => beat.beatId !== primaryBeat?.beatId)
      .map(({ beat }) => ({
        ...beat,
        narrativeUse: beat.supportStatus === "source_blocked" || beat.supportStatus === "unsupported"
          ? "blocked" as const
          : usedPrimaryClaims.has(beat.claimId) || usedPrimaryEvidence.has(beat.evidenceId)
            ? "thematic_reference" as const
            : "supporting" as const,
      }));
    const hasCounterview = allCandidates.some(({ beat }) =>
      beat.stance === "contradicts" &&
      (beat.supportStatus === "canonical_context_eligible" || beat.supportStatus === "qualified_uncertainty")
    );
    const hasConcrete = allCandidates.some(({ beat }) =>
      beat.stance === "supports" && beat.specificity === "concrete_observation" &&
      beat.supportStatus === "canonical_context_eligible"
    );
    const hasBlocked = allCandidates.some(({ beat }) => beat.supportStatus === "source_blocked");
    const hasNarratable = narratable.length > 0;
    const genericOnly = hasNarratable && narratable.every(({ beat }) =>
      beat.specificity === "abstract_or_conceptual"
    );
    const omittedByBudgetCount =
      evidenceSelection.metrics.omissionReasonCounts.unit_budget +
      evidenceSelection.metrics.omissionReasonCounts.character_budget;
    const gaps = unique<CreatorEvidenceNarrativeGap>([
      ...(beatRole === "legitimate_limitation_or_alternate_explanation" && !hasCounterview
        ? ["missing_counterview" as const]
        : []),
      ...(beatRole === "concrete_observed_finding" && !hasConcrete
        ? ["missing_concrete_observation" as const]
        : []),
      ...(genericOnly ? ["generic_support_only" as const] : []),
      ...(hasBlocked ? ["source_provenance_blocked" as const] : []),
      ...(!hasNarratable ? ["unsupported_narrative_opportunity" as const] : []),
      ...(repeatedPrimaryCandidate ? ["repeated_primary_candidate" as const] : []),
      ...(omittedByBudgetCount > 0 ? ["evidence_omitted_by_budget" as const] : []),
    ]);
    return {
      sectionId: section.id,
      sectionKind: section.kind,
      beatRole,
      primaryBeat,
      supportingBeats,
      gaps,
      omittedByBudgetCount,
    };
  });
  const progression = sections.map((section, index) => {
    const previous = sections[index - 1];
    return {
      sectionId: section.sectionId,
      beatRole: section.beatRole,
      primaryClaimId: section.primaryBeat?.claimId || null,
      primaryEvidenceId: section.primaryBeat?.evidenceId || null,
      distinctFromPrevious: !previous || (
        section.beatRole !== previous.beatRole &&
        section.primaryBeat?.claimId !== previous.primaryBeat?.claimId &&
        section.primaryBeat?.evidenceId !== previous.primaryBeat?.evidenceId
      ),
    };
  });
  const allBeats = sections.flatMap((section) => [
    ...(section.primaryBeat ? [section.primaryBeat] : []),
    ...section.supportingBeats,
  ]);
  return {
    sections,
    progression,
    metrics: {
      sectionCount: sections.length,
      candidatePrimaryBeatCount: sections.filter((section) => section.primaryBeat).length,
      canonicalContextEligiblePrimaryBeatCount: sections.filter((section) =>
        section.primaryBeat?.supportStatus === "canonical_context_eligible" ||
        section.primaryBeat?.supportStatus === "qualified_uncertainty"
      ).length,
      candidateConcretePrimaryBeatCount: sections.filter((section) =>
        section.primaryBeat?.specificity === "concrete_observation" &&
        section.primaryBeat.supportStatus === "canonical_context_eligible"
      ).length,
      independentlyProvenanceVerifiedPrimaryBeatCount: 0,
      independentlyProvenanceVerifiedConcretePrimaryBeatCount: 0,
      duplicatePrimaryBeatCount: sections.filter((section) => section.primaryBeat).length - new Set(
        sections.flatMap((section) => section.primaryBeat
          ? [`${section.primaryBeat.claimId}:${section.primaryBeat.evidenceId}`]
          : []),
      ).size,
      repeatedNarrativeBeatCount: allBeats.filter((beat) => beat.narrativeUse === "thematic_reference").length,
      missingCounterviewCount: sections.filter((section) => section.gaps.includes("missing_counterview")).length,
      missingConcreteObservationCount: sections.filter((section) => section.gaps.includes("missing_concrete_observation")).length,
      genericSupportOnlyCount: sections.filter((section) => section.gaps.includes("generic_support_only")).length,
      sourceBlockedBeatCount: allBeats.filter((beat) => beat.supportStatus === "source_blocked").length,
      unsupportedNarrativeOpportunityCount: sections.filter((section) => section.gaps.includes("unsupported_narrative_opportunity")).length,
      omittedByBudgetCount: sections.reduce((sum, section) => sum + section.omittedByBudgetCount, 0),
    },
    advisoryOnly: true,
    independentProvenanceVerification: "not_assessed",
    semanticAcceptanceClaimed: false,
  };
}
