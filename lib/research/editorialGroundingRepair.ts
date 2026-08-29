import {
  createValidatedEditorialAnalysis,
  type EditorialAnalysisProposal,
} from "./editorialAnalysisContract.ts";
import type { ResearchSource } from "./sourceContract.ts";

const UNGROUNDED_EXCERPT_PREFIX = "EDITORIAL_EVIDENCE_EXCERPT_NOT_GROUNDED:";

export type EditorialGroundingRepairPatch = {
  repairs: Array<{
    evidenceId: string;
    sourceId: string;
    excerpt: string;
  }>;
};

export type EditorialGroundingRepairInput = {
  proposal: EditorialAnalysisProposal;
  sources: ResearchSource[];
  failingSourceId: string;
};

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseRepairPatch(value: unknown): EditorialGroundingRepairPatch {
  const patch = objectRecord(value);
  if (!patch || Object.keys(patch).length !== 1 || !("repairs" in patch)) {
    throw new Error("EDITORIAL_GROUNDING_REPAIR_PATCH_INVALID");
  }
  if (!Array.isArray(patch.repairs) || patch.repairs.length === 0) {
    throw new Error("EDITORIAL_GROUNDING_REPAIR_PATCH_EMPTY");
  }

  return {
    repairs: patch.repairs.map((value) => {
      const repair = objectRecord(value);
      const keys = repair ? Object.keys(repair).sort() : [];
      if (
        !repair ||
        keys.join(",") !== "evidenceId,excerpt,sourceId" ||
        typeof repair.evidenceId !== "string" ||
        !repair.evidenceId ||
        typeof repair.sourceId !== "string" ||
        !repair.sourceId ||
        typeof repair.excerpt !== "string" ||
        !repair.excerpt
      ) {
        throw new Error("EDITORIAL_GROUNDING_REPAIR_PATCH_INVALID");
      }
      return {
        evidenceId: repair.evidenceId,
        sourceId: repair.sourceId,
        excerpt: repair.excerpt,
      };
    }),
  };
}

function applyRepairPatch(input: {
  original: EditorialAnalysisProposal;
  patch: unknown;
  sources: ResearchSource[];
}): EditorialAnalysisProposal {
  const patch = parseRepairPatch(input.patch);
  const originalEvidence = Array.isArray(input.original.evidence)
    ? input.original.evidence
    : [];
  const originalEvidenceIds = new Set(
    originalEvidence.map((item) =>
      typeof item.evidenceId === "string" ? item.evidenceId : ""
    ),
  );
  const sourceById = new Map(
    input.sources.map((source) => [source.sourceId, source]),
  );
  const repairsByEvidenceId = new Map<string, {
    sourceId: string;
    excerpt: string;
  }>();

  for (const repair of patch.repairs) {
    if (repairsByEvidenceId.has(repair.evidenceId)) {
      throw new Error(`EDITORIAL_GROUNDING_REPAIR_DUPLICATE_EVIDENCE:${repair.evidenceId}`);
    }
    if (!originalEvidenceIds.has(repair.evidenceId)) {
      throw new Error(`EDITORIAL_GROUNDING_REPAIR_EVIDENCE_MISSING:${repair.evidenceId}`);
    }
    const source = sourceById.get(repair.sourceId);
    if (!source) {
      throw new Error(`EDITORIAL_GROUNDING_REPAIR_SOURCE_MISSING:${repair.evidenceId}`);
    }
    const summary = source.summary || "";
    const start = summary.indexOf(repair.excerpt);
    if (start < 0) {
      throw new Error(`EDITORIAL_GROUNDING_REPAIR_EXCERPT_NOT_EXACT:${repair.evidenceId}`);
    }
    repairsByEvidenceId.set(repair.evidenceId, {
      sourceId: repair.sourceId,
      excerpt: summary.slice(start, start + repair.excerpt.length),
    });
  }

  return {
    ...input.original,
    evidence: originalEvidence.map((item) => {
      const evidenceId = typeof item.evidenceId === "string"
        ? item.evidenceId
        : "";
      const repair = repairsByEvidenceId.get(evidenceId);
      return repair ? { ...item, ...repair } : item;
    }),
  };
}

/**
 * Validates once, then permits exactly one narrowly scoped patch operation only
 * when an excerpt is not grounded. Research remains outside this contract.
 */
export async function createValidatedEditorialAnalysisWithOneRepair(input: {
  sources: ResearchSource[];
  proposal: EditorialAnalysisProposal;
  repair: (
    repairInput: EditorialGroundingRepairInput,
  ) => Promise<unknown>;
}) {
  try {
    return createValidatedEditorialAnalysis({
      sources: input.sources,
      proposal: input.proposal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.startsWith(UNGROUNDED_EXCERPT_PREFIX)) throw error;

    const patch = await input.repair({
      proposal: input.proposal,
      sources: input.sources,
      failingSourceId: message.slice(UNGROUNDED_EXCERPT_PREFIX.length),
    });
    return createValidatedEditorialAnalysis({
      sources: input.sources,
      proposal: applyRepairPatch({
        original: input.proposal,
        patch,
        sources: input.sources,
      }),
    });
  }
}
