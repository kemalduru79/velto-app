import type { CreatorDocumentarySourceContext } from "./documentarySourceContext.ts";
import type { CreatorEvidenceVisualContext } from "./evidenceVisualContext.ts";
import type { CreatorProductionSceneInput } from "./productionIntelligence.ts";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, maxLength = 1_000) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : undefined;
}

function signal(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function count(value: unknown, max = 80) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(max, Math.max(0, Math.floor(parsed)));
}

export function normalizeCreatorDocumentarySourcePlanningContext(
  value: unknown,
): CreatorDocumentarySourceContext | undefined {
  const source = record(value);
  if (!Object.keys(source).length) return undefined;

  const sourceReferenceCount = count(source.sourceReferenceCount);
  const routingCandidateCount = Math.min(
    sourceReferenceCount,
    count(source.routingCandidateCount),
  );
  const sourceClipCandidateCount = Math.min(
    routingCandidateCount,
    count(source.sourceClipCandidateCount),
  );
  const sourceImageCandidateCount = Math.min(
    Math.max(0, routingCandidateCount - sourceClipCandidateCount),
    count(source.sourceImageCandidateCount),
  );
  const primarySourceClipCandidateCount = Math.min(
    sourceClipCandidateCount,
    count(source.primarySourceClipCandidateCount),
  );
  const primarySourceImageCandidateCount = Math.min(
    sourceImageCandidateCount,
    count(source.primarySourceImageCandidateCount),
  );
  const rightsReviewRequiredCount = Math.min(
    routingCandidateCount,
    count(source.rightsReviewRequiredCount),
  );
  const excludedCount = Math.min(
    Math.max(0, sourceReferenceCount - routingCandidateCount),
    count(source.excludedCount),
  );

  return {
    version: "0.10H-4B",
    sourceReferenceCount,
    routingCandidateCount,
    sourceClipCandidateCount,
    sourceImageCandidateCount,
    primarySourceClipCandidateCount,
    primarySourceImageCandidateCount,
    rightsReviewRequiredCount,
    excludedCount,
    candidates: [],
  };
}

export function normalizeCreatorEvidenceVisualPlanningContext(
  value: unknown,
  sceneId: number,
): CreatorEvidenceVisualContext | undefined {
  const source = record(value);
  if (!Object.keys(source).length) return undefined;

  const statementCount = count(source.statementCount, 100);
  const traceableStatementCount = Math.min(
    statementCount,
    count(source.traceableStatementCount, 100),
  );
  const supportingEvidenceCount = count(source.supportingEvidenceCount, 240);
  const supportingSourceCount = count(source.supportingSourceCount, 120);
  const factClaimCount = count(source.factClaimCount, 80);
  const researchFindingClaimCount = count(source.researchFindingClaimCount, 80);
  const primarySourceClaimCount = count(source.primarySourceClaimCount, 80);
  const expertOpinionClaimCount = count(source.expertOpinionClaimCount, 80);
  const traceable = traceableStatementCount > 0;
  const dataClaim = factClaimCount + researchFindingClaimCount > 0;
  const quoteClaim = primarySourceClaimCount + expertOpinionClaimCount > 0;
  const dataVisualCandidate =
    source.dataVisualCandidate === true &&
    traceable &&
    supportingEvidenceCount > 0 &&
    dataClaim;
  const quoteCardCandidate =
    source.quoteCardCandidate === true &&
    traceable &&
    supportingEvidenceCount > 0 &&
    quoteClaim;
  const sourceCardCandidate =
    source.sourceCardCandidate === true &&
    traceable &&
    supportingSourceCount > 0;

  return {
    version: "0.10H-4D",
    sceneId: String(sceneId),
    statementCount,
    traceableStatementCount,
    supportingEvidenceCount,
    supportingSourceCount,
    factClaimCount,
    researchFindingClaimCount,
    primarySourceClaimCount,
    expertOpinionClaimCount,
    dataVisualCandidate,
    quoteCardCandidate,
    sourceCardCandidate,
    quoteCardRequiresReview: quoteCardCandidate,
  };
}

export function normalizeCreatorProductionIntelligenceScenes(
  value: unknown,
): CreatorProductionSceneInput[] {
  const rawScenes = Array.isArray(value) ? value.slice(0, 100) : [];

  return rawScenes.flatMap((raw) => {
    const scene = record(raw);
    const id = Number(scene.id);
    if (!Number.isInteger(id) || id < 1) return [];

    return [{
      id,
      creatorSceneId: text(scene.creatorSceneId),
      text: text(scene.text),
      narration: text(scene.narration),
      dialogue: text(scene.dialogue),
      visualPrompt: text(scene.visualPrompt),
      cameraDirection: text(scene.cameraDirection),
      motionHint: text(scene.motionHint),
      sceneRole: text(scene.sceneRole) as CreatorProductionSceneInput["sceneRole"],
      contentNature: text(scene.contentNature) as CreatorProductionSceneInput["contentNature"],
      motionImportance: signal(scene.motionImportance),
      visualImportance: signal(scene.visualImportance),
      continuityImportance: signal(scene.continuityImportance),
      stockSuitability: signal(scene.stockSuitability),
      customGenerationNeed: signal(scene.customGenerationNeed),
      authenticityValue: signal(scene.authenticityValue),
      stockSearchQuery: text(scene.stockSearchQuery),
      renderMode: scene.renderMode === "image" || scene.renderMode === "video"
        ? scene.renderMode
        : undefined,
      image: text(scene.image),
      videoUrl: text(scene.videoUrl),
      videoStatus: text(scene.videoStatus),
      imageCurrent: scene.imageCurrent !== false,
      videoCurrent: scene.videoCurrent !== false,
      documentarySourceContext: normalizeCreatorDocumentarySourcePlanningContext(
        scene.documentarySourceContext,
      ),
      evidenceVisualContext: normalizeCreatorEvidenceVisualPlanningContext(
        scene.evidenceVisualContext,
        id,
      ),
    } satisfies CreatorProductionSceneInput];
  });
}
