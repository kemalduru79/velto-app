import type {
  ScriptPlannerEditorialContext,
} from "./scriptPlannerEditorialContext.ts";

export type CreatorEvidenceBinding = {
  evidenceId: string;
  sourceId: string;
  excerpt: string | null;
  contextNote: string | null;
  locator: ScriptPlannerEditorialContext["evidence"][number]["locator"];
};

export type CreatorEvidenceSourceRef = Pick<
  ScriptPlannerEditorialContext["sources"][number],
  | "sourceId"
  | "title"
  | "url"
  | "publisher"
  | "author"
  | "publishedAt"
  | "directness"
  | "reviewStatus"
>;

export type CreatorEvidenceUnit = {
  version: "0.15B";
  id: string;
  claimId: string;
  finding: string;
  epistemicStatus: ScriptPlannerEditorialContext["claims"][number]["claimType"];
  supportingEvidence: CreatorEvidenceBinding[];
  counterEvidence: CreatorEvidenceBinding[];
  contextualEvidence: CreatorEvidenceBinding[];
  sourceRefs: CreatorEvidenceSourceRef[];
};

const MAX_PACK_UNITS = 40;

function uniqueStable(values: string[]) {
  return [...new Set(values)];
}

/**
 * Projects the canonical editorial claim/evidence graph into compact,
 * source-bound units. It deliberately does not infer narrative relevance,
 * limitations, rankings, or missing evidence.
 */
export function createCreatorEvidenceUnits(
  context: ScriptPlannerEditorialContext,
): CreatorEvidenceUnit[] {
  const evidenceById = new Map(
    context.evidence.map((evidence) => [evidence.evidenceId, evidence]),
  );
  const sourceById = new Map(
    context.sources.map((source) => [source.sourceId, source]),
  );

  const bindingsFor = (evidenceIds: string[]) => uniqueStable(evidenceIds)
    .flatMap((evidenceId): CreatorEvidenceBinding[] => {
      const evidence = evidenceById.get(evidenceId);
      if (!evidence || !sourceById.has(evidence.sourceId)) return [];
      return [{
        evidenceId: evidence.evidenceId,
        sourceId: evidence.sourceId,
        excerpt: evidence.excerpt,
        contextNote: evidence.contextNote,
        locator: { ...evidence.locator },
      }];
    });

  return context.claims.flatMap((claim): CreatorEvidenceUnit[] => {
    const supportingEvidence = bindingsFor(claim.supportingEvidenceIds);
    const counterEvidence = bindingsFor(claim.counterEvidenceIds);
    const contextualEvidence = bindingsFor(claim.contextualEvidenceIds);
    const bindings = [
      ...supportingEvidence,
      ...counterEvidence,
      ...contextualEvidence,
    ];
    if (bindings.length === 0) return [];

    const sourceIds = uniqueStable(bindings.map((binding) => binding.sourceId));
    const sourceRefs = sourceIds.flatMap((sourceId): CreatorEvidenceSourceRef[] => {
      const source = sourceById.get(sourceId);
      if (!source) return [];
      return [{
        sourceId: source.sourceId,
        title: source.title,
        url: source.url,
        publisher: source.publisher,
        author: source.author,
        publishedAt: source.publishedAt,
        directness: source.directness,
        reviewStatus: source.reviewStatus,
      }];
    });

    return [{
      version: "0.15B",
      id: claim.claimId,
      claimId: claim.claimId,
      finding: claim.text,
      epistemicStatus: claim.claimType,
      supportingEvidence,
      counterEvidence,
      contextualEvidence,
      sourceRefs,
    }];
  });
}

/** Stable input-order packing. It never fills a requested maximum. */
export function buildCreatorEvidencePack(input: {
  context: ScriptPlannerEditorialContext;
  maxUnits: number;
}): CreatorEvidenceUnit[] {
  if (!Number.isInteger(input.maxUnits) || input.maxUnits < 0) {
    throw new Error("CREATOR_EVIDENCE_PACK_LIMIT_INVALID");
  }
  const limit = Math.min(input.maxUnits, MAX_PACK_UNITS);
  return createCreatorEvidenceUnits(input.context).slice(0, limit);
}
