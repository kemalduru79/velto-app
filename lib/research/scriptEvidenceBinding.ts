import type {
  ClaimEvidenceStance,
  ResearchClaim,
  ResearchClaimEvidenceLink,
  ResearchClaimType,
  ResearchEvidence,
} from "./claimEvidenceGraph.ts";

export type ScriptStatementEvidenceMode = "required" | "not_required";
export type ScriptStatementTraceabilityStatus =
  | "traceable"
  | "partial"
  | "untraceable"
  | "not_required";

export type ScriptEvidenceGraph = {
  claims: ResearchClaim[];
  evidence: ResearchEvidence[];
  links: ResearchClaimEvidenceLink[];
};

export type ScriptEvidenceStatementInput = {
  statementId: string;
  sceneId: string | number;
  text: string;
  evidenceMode: ScriptStatementEvidenceMode;
  claimIds: string[];
};

export type ScriptClaimReference = {
  claimId: string;
  claimType: ResearchClaimType;
};

export type ScriptStatementEvidenceBinding = {
  statementId: string;
  sceneId: string | number;
  text: string;
  evidenceMode: ScriptStatementEvidenceMode;
  claimReferences: ScriptClaimReference[];
  supportingEvidenceIds: string[];
  supportingSourceIds: string[];
  counterEvidenceIds: string[];
  counterSourceIds: string[];
  contextualEvidenceIds: string[];
  contextualSourceIds: string[];
  traceabilityStatus: ScriptStatementTraceabilityStatus;
};

export type ScriptEvidenceBindingMap = {
  version: "0.10H-2C";
  statements: ScriptStatementEvidenceBinding[];
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function evidenceForClaims(
  graph: ScriptEvidenceGraph,
  claimIds: Set<string>,
  stance: ClaimEvidenceStance,
) {
  const evidenceIds = graph.links
    .filter((link) => claimIds.has(link.claimId) && link.stance === stance)
    .map((link) => link.evidenceId);
  return unique(evidenceIds);
}

function sourceIdsForEvidence(
  graph: ScriptEvidenceGraph,
  evidenceIds: string[],
) {
  const evidenceById = new Map(
    graph.evidence.map((evidence) => [evidence.evidenceId, evidence]),
  );
  return unique(
    evidenceIds
      .map((evidenceId) => evidenceById.get(evidenceId)?.sourceId || "")
      .filter(Boolean),
  );
}

/**
 * Creates backstage script-to-evidence bindings without inserting citations into
 * narration or visible script text. The binding proves traceability to the
 * editorial research graph; it does not claim that a linked statement is true.
 */
export function createScriptEvidenceBindingMap(input: {
  graph: ScriptEvidenceGraph;
  statements: ScriptEvidenceStatementInput[];
}): ScriptEvidenceBindingMap {
  const claimById = new Map(
    input.graph.claims.map((claim) => [claim.claimId, claim]),
  );
  const statementIds = new Set<string>();
  const statements = input.statements.map((statement) => {
    const statementId = statement.statementId.trim();
    const text = cleanText(statement.text);
    if (!statementId) throw new Error("SCRIPT_STATEMENT_ID_REQUIRED");
    if (statementIds.has(statementId)) {
      throw new Error(`SCRIPT_STATEMENT_ID_DUPLICATE:${statementId}`);
    }
    statementIds.add(statementId);
    if (!text) throw new Error(`SCRIPT_STATEMENT_TEXT_REQUIRED:${statementId}`);

    const claimIds = unique(
      statement.claimIds.map((claimId) => claimId.trim()).filter(Boolean),
    );
    if (statement.evidenceMode === "required" && claimIds.length === 0) {
      throw new Error(`SCRIPT_STATEMENT_CLAIM_REQUIRED:${statementId}`);
    }

    const claimReferences = claimIds.map((claimId) => {
      const claim = claimById.get(claimId);
      if (!claim) {
        throw new Error(`SCRIPT_STATEMENT_CLAIM_MISSING:${statementId}:${claimId}`);
      }
      return { claimId, claimType: claim.claimType };
    });

    const claimIdSet = new Set(claimIds);
    const supportingEvidenceIds = evidenceForClaims(
      input.graph,
      claimIdSet,
      "supports",
    );
    const counterEvidenceIds = evidenceForClaims(
      input.graph,
      claimIdSet,
      "contradicts",
    );
    const contextualEvidenceIds = evidenceForClaims(
      input.graph,
      claimIdSet,
      "contextualizes",
    );

    const supportedClaimIds = new Set(
      input.graph.links
        .filter(
          (link) => claimIdSet.has(link.claimId) && link.stance === "supports",
        )
        .map((link) => link.claimId),
    );
    const traceabilityStatus: ScriptStatementTraceabilityStatus =
      statement.evidenceMode === "not_required"
        ? "not_required"
        : supportedClaimIds.size === claimIds.length
          ? "traceable"
          : supportedClaimIds.size > 0
            ? "partial"
            : "untraceable";

    return {
      statementId,
      sceneId: statement.sceneId,
      text,
      evidenceMode: statement.evidenceMode,
      claimReferences,
      supportingEvidenceIds,
      supportingSourceIds: sourceIdsForEvidence(
        input.graph,
        supportingEvidenceIds,
      ),
      counterEvidenceIds,
      counterSourceIds: sourceIdsForEvidence(input.graph, counterEvidenceIds),
      contextualEvidenceIds,
      contextualSourceIds: sourceIdsForEvidence(
        input.graph,
        contextualEvidenceIds,
      ),
      traceabilityStatus,
    };
  });

  return {
    version: "0.10H-2C",
    statements,
  };
}
