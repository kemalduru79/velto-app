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
const MAX_PROMPT_PACK_UNITS = 5;
const MAX_PROMPT_BINDINGS_PER_STANCE = 1;
export const CREATOR_EVIDENCE_PROMPT_PACK_MAX_CHARACTERS = 12_000;

function compactText(value: string | null, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) || null
    : null;
}

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

/**
 * Creates a bounded prompt projection without adding facts or detaching any
 * evidence from its canonical claim/source identity.
 */
export function buildCreatorEvidencePromptPack(input: {
  context: ScriptPlannerEditorialContext;
  maxUnits?: number;
}) {
  const requestedLimit = input.maxUnits ?? MAX_PROMPT_PACK_UNITS;
  const maxUnits = Math.min(requestedLimit, MAX_PROMPT_PACK_UNITS);
  const units = buildCreatorEvidencePack({ context: input.context, maxUnits });
  const projected = units.map((unit) => {
    const compactBindings = (bindings: CreatorEvidenceBinding[]) => bindings
      .slice(0, MAX_PROMPT_BINDINGS_PER_STANCE)
      .map((binding) => ({
        evidenceId: binding.evidenceId,
        sourceId: binding.sourceId,
        excerpt: compactText(binding.excerpt, 420),
        contextNote: compactText(binding.contextNote, 180),
        locator: binding.locator,
      }));
    const supportingEvidence = compactBindings(unit.supportingEvidence);
    const counterEvidence = compactBindings(unit.counterEvidence);
    const contextualEvidence = compactBindings(unit.contextualEvidence);
    const includedSourceIds = new Set([
      ...supportingEvidence,
      ...counterEvidence,
      ...contextualEvidence,
    ].map((binding) => binding.sourceId));
    return {
      claimId: unit.claimId,
      finding: compactText(unit.finding, 600) || "",
      epistemicStatus: unit.epistemicStatus,
      supportingEvidence,
      counterEvidence,
      contextualEvidence,
      sourceRefs: unit.sourceRefs
        .filter((source) => includedSourceIds.has(source.sourceId))
        .map((source) => ({
          sourceId: source.sourceId,
          title: compactText(source.title, 240) || "",
          publisher: compactText(source.publisher, 160) || "",
          author: compactText(source.author, 160),
          publishedAt: compactText(source.publishedAt, 80),
          directness: source.directness,
          reviewStatus: source.reviewStatus,
        })),
    };
  });
  const bounded = [] as typeof projected;
  for (const unit of projected) {
    if (JSON.stringify([...bounded, unit]).length > CREATOR_EVIDENCE_PROMPT_PACK_MAX_CHARACTERS) break;
    bounded.push(unit);
  }
  return bounded;
}

export function selectCreatorEvidencePromptPackForClaims<T extends { claimId: string }>(input: {
  pack: T[];
  claimIds: string[];
}) {
  const allowedClaimIds = new Set(input.claimIds);
  return input.pack.filter((unit) => allowedClaimIds.has(unit.claimId));
}
