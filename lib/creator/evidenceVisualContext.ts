import type {
  ResearchClaimEvidenceGraph,
  ResearchClaimType,
} from "../research/claimEvidenceGraph.ts";
import type { ScriptEvidenceBindingMap } from "../research/scriptEvidenceBinding.ts";

export const CREATOR_EVIDENCE_VISUAL_CONTEXT_VERSION = "0.10H-4D" as const;

export type CreatorEvidenceVisualContext = {
  version: typeof CREATOR_EVIDENCE_VISUAL_CONTEXT_VERSION;
  sceneId: string;
  statementCount: number;
  traceableStatementCount: number;
  supportingEvidenceCount: number;
  supportingSourceCount: number;
  factClaimCount: number;
  researchFindingClaimCount: number;
  primarySourceClaimCount: number;
  expertOpinionClaimCount: number;
  dataVisualCandidate: boolean;
  quoteCardCandidate: boolean;
  sourceCardCandidate: boolean;
  quoteCardRequiresReview: boolean;
};

const dataVisualClaimTypes = new Set<ResearchClaimType>([
  "FACT",
  "RESEARCH_FINDING",
]);
const quoteCardClaimTypes = new Set<ResearchClaimType>([
  "PRIMARY_SOURCE_CLAIM",
  "EXPERT_OPINION",
]);

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Converts existing backstage script/evidence bindings into evidence-visual
 * availability signals. It does not render charts/cards, expose citations, or
 * assert that an evidence excerpt is a verbatim/legal-cleared quote.
 */
export function createCreatorEvidenceVisualContext(input: {
  sceneId: string | number;
  bindings: ScriptEvidenceBindingMap;
  graph: ResearchClaimEvidenceGraph;
}): CreatorEvidenceVisualContext {
  const sceneId = String(input.sceneId);
  const statements = input.bindings.statements.filter(
    (statement) => String(statement.sceneId) === sceneId,
  );
  const traceableStatements = statements.filter(
    (statement) => statement.traceabilityStatus === "traceable",
  );
  const supportingEvidenceIds = unique(
    traceableStatements.flatMap((statement) => statement.supportingEvidenceIds),
  );
  const supportingSourceIds = unique(
    traceableStatements.flatMap((statement) => statement.supportingSourceIds),
  );
  const claimTypes = traceableStatements.flatMap((statement) =>
    statement.claimReferences.map((claim) => claim.claimType),
  );

  const factClaimCount = claimTypes.filter((type) => type === "FACT").length;
  const researchFindingClaimCount = claimTypes.filter(
    (type) => type === "RESEARCH_FINDING",
  ).length;
  const primarySourceClaimCount = claimTypes.filter(
    (type) => type === "PRIMARY_SOURCE_CLAIM",
  ).length;
  const expertOpinionClaimCount = claimTypes.filter(
    (type) => type === "EXPERT_OPINION",
  ).length;

  const supportingEvidenceById = new Map(
    input.graph.evidence.map((evidence) => [evidence.evidenceId, evidence]),
  );
  const hasGroundedExcerpt = supportingEvidenceIds.some((evidenceId) =>
    Boolean(supportingEvidenceById.get(evidenceId)?.excerpt?.trim()),
  );
  const hasDataClaim = claimTypes.some((type) => dataVisualClaimTypes.has(type));
  const hasQuoteClaim = claimTypes.some((type) => quoteCardClaimTypes.has(type));

  return {
    version: CREATOR_EVIDENCE_VISUAL_CONTEXT_VERSION,
    sceneId,
    statementCount: statements.length,
    traceableStatementCount: traceableStatements.length,
    supportingEvidenceCount: supportingEvidenceIds.length,
    supportingSourceCount: supportingSourceIds.length,
    factClaimCount,
    researchFindingClaimCount,
    primarySourceClaimCount,
    expertOpinionClaimCount,
    dataVisualCandidate: hasDataClaim && supportingEvidenceIds.length > 0,
    quoteCardCandidate: hasQuoteClaim && hasGroundedExcerpt,
    sourceCardCandidate: supportingSourceIds.length > 0,
    quoteCardRequiresReview: hasQuoteClaim && hasGroundedExcerpt,
  };
}
