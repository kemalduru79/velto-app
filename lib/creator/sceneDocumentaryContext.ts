import type { ResearchClaimEvidenceGraph } from "../research/claimEvidenceGraph.ts";
import type { ResearchSourceAssessment } from "../research/sourceAssessment.ts";
import type { ResearchSourceMediaReference } from "../research/sourceMediaReference.ts";
import type { ScriptEvidenceBindingMap } from "../research/scriptEvidenceBinding.ts";
import {
  createCreatorDocumentarySourceContext,
  type CreatorDocumentarySourceContext,
} from "./documentarySourceContext.ts";
import {
  createCreatorEvidenceVisualContext,
  type CreatorEvidenceVisualContext,
} from "./evidenceVisualContext.ts";

export const CREATOR_SCENE_DOCUMENTARY_CONTEXT_VERSION = "0.10H-4G" as const;

export type CreatorSceneDocumentaryContext = {
  version: typeof CREATOR_SCENE_DOCUMENTARY_CONTEXT_VERSION;
  sceneId: string;
  documentarySourceContext: CreatorDocumentarySourceContext;
  evidenceVisualContext: CreatorEvidenceVisualContext;
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Assembles documentary Production Intelligence context for one scene only.
 * Source availability is constrained to supporting sources from traceable
 * script/evidence bindings for that scene; the global research pool is never
 * copied wholesale into scene routing context.
 */
export function createCreatorSceneDocumentaryContext(input: {
  sceneId: string | number;
  bindings: ScriptEvidenceBindingMap;
  graph: ResearchClaimEvidenceGraph;
  sourceReferences: readonly ResearchSourceMediaReference[];
  sourceAssessments?: readonly ResearchSourceAssessment[];
}): CreatorSceneDocumentaryContext {
  const sceneId = String(input.sceneId);
  const traceableStatements = input.bindings.statements.filter(
    (statement) =>
      String(statement.sceneId) === sceneId &&
      statement.traceabilityStatus === "traceable",
  );
  const supportingSourceIds = new Set(
    unique(
      traceableStatements.flatMap((statement) => statement.supportingSourceIds),
    ),
  );

  const sceneReferences = input.sourceReferences.filter((reference) =>
    supportingSourceIds.has(reference.researchSourceId),
  );
  const sceneAssessments = (input.sourceAssessments || []).filter((assessment) =>
    supportingSourceIds.has(assessment.sourceId),
  );

  return {
    version: CREATOR_SCENE_DOCUMENTARY_CONTEXT_VERSION,
    sceneId,
    documentarySourceContext: createCreatorDocumentarySourceContext({
      references: sceneReferences,
      assessments: sceneAssessments,
    }),
    evidenceVisualContext: createCreatorEvidenceVisualContext({
      sceneId,
      bindings: input.bindings,
      graph: input.graph,
    }),
  };
}
