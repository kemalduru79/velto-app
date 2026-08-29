import {
  createValidatedEditorialAnalysis,
  type EditorialAnalysisProposal,
} from "./editorialAnalysisContract.ts";
import type { ResearchSource } from "./sourceContract.ts";

const UNGROUNDED_EXCERPT_PREFIX = "EDITORIAL_EVIDENCE_EXCERPT_NOT_GROUNDED:";

export type EditorialGroundingRepairInput = {
  proposal: EditorialAnalysisProposal;
  sources: ResearchSource[];
  failingSourceId: string;
};

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function stableEvidenceFields(value: {
  evidenceId?: unknown;
  contextNote?: unknown;
}) {
  return {
    evidenceId: value.evidenceId,
    contextNote: value.contextNote,
  };
}

function canonicalizeRepairedProposal(input: {
  original: EditorialAnalysisProposal;
  repaired: EditorialAnalysisProposal;
  sources: ResearchSource[];
}): EditorialAnalysisProposal {
  if (
    !sameJson(input.repaired.claims, input.original.claims) ||
    !sameJson(input.repaired.links, input.original.links)
  ) throw new Error("EDITORIAL_GROUNDING_REPAIR_RELATIONSHIP_CHANGED");

  const originalEvidence = Array.isArray(input.original.evidence)
    ? input.original.evidence
    : [];
  const repairedEvidence = Array.isArray(input.repaired.evidence)
    ? input.repaired.evidence
    : [];
  if (
    repairedEvidence.length !== originalEvidence.length ||
    repairedEvidence.some((item, index) => {
      const original = originalEvidence[index] || {};
      return !sameJson(
        stableEvidenceFields(item),
        stableEvidenceFields(original),
      );
    })
  ) throw new Error("EDITORIAL_GROUNDING_REPAIR_EVIDENCE_CHANGED");

  const sourceById = new Map(
    input.sources.map((source) => [source.sourceId, source]),
  );
  return {
    ...input.repaired,
    evidence: repairedEvidence.map((item) => {
      if (typeof item.excerpt !== "string" || !item.excerpt) return item;
      const summary = typeof item.sourceId === "string"
        ? sourceById.get(item.sourceId)?.summary || ""
        : "";
      const start = summary.indexOf(item.excerpt);
      if (start < 0) {
        throw new Error("EDITORIAL_GROUNDING_REPAIR_EXCERPT_NOT_EXACT");
      }
      return {
        ...item,
        excerpt: summary.slice(start, start + item.excerpt.length),
      };
    }),
  };
}

/**
 * Validates once, then permits exactly one narrowly scoped repair only when an
 * excerpt is not grounded. Both initial and repaired proposals pass through the
 * same canonical validator; research is deliberately outside this contract.
 */
export async function createValidatedEditorialAnalysisWithOneRepair(input: {
  sources: ResearchSource[];
  proposal: EditorialAnalysisProposal;
  repair: (
    repairInput: EditorialGroundingRepairInput,
  ) => Promise<EditorialAnalysisProposal>;
}) {
  try {
    return createValidatedEditorialAnalysis({
      sources: input.sources,
      proposal: input.proposal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.startsWith(UNGROUNDED_EXCERPT_PREFIX)) throw error;

    const repairedProposal = await input.repair({
      proposal: input.proposal,
      sources: input.sources,
      failingSourceId: message.slice(UNGROUNDED_EXCERPT_PREFIX.length),
    });
    return createValidatedEditorialAnalysis({
      sources: input.sources,
      proposal: canonicalizeRepairedProposal({
        original: input.proposal,
        repaired: repairedProposal,
        sources: input.sources,
      }),
    });
  }
}
