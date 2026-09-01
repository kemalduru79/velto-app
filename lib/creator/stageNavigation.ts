export type CreatorProductionStage = 1 | 2 | 3 | 4;
export type CreatorStageSuccessEvent = "brief_completed" | "strategy_approved" | "production_setup_continued";

export function creatorStageAfterSuccess(current: CreatorProductionStage, event: CreatorStageSuccessEvent): CreatorProductionStage {
  const target = event === "brief_completed" ? 2 : event === "strategy_approved" ? 3 : 4;
  return Math.max(current, target) as CreatorProductionStage;
}

export type CreatorVisibleStage =
  | "brief"
  | "strategy"
  | "production_setup"
  | "create_review"
  | "publish";

export function resolveCreatorStageVisibility(input: {
  workspaceStep: CreatorProductionStage;
  productionSubstep: "setup" | "create_review";
}): Record<CreatorVisibleStage, boolean> {
  const visibleStage: CreatorVisibleStage = input.workspaceStep === 1
    ? "brief"
    : input.workspaceStep === 2
      ? "strategy"
      : input.workspaceStep === 4
        ? "publish"
        : input.productionSubstep === "setup"
          ? "production_setup"
          : "create_review";

  return {
    brief: visibleStage === "brief",
    strategy: visibleStage === "strategy",
    production_setup: visibleStage === "production_setup",
    create_review: visibleStage === "create_review",
    publish: visibleStage === "publish",
  };
}
