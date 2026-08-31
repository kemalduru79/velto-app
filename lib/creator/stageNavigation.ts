export type CreatorProductionStage = 1 | 2 | 3 | 4;
export type CreatorStageSuccessEvent = "brief_completed" | "strategy_approved" | "production_setup_continued";

export function creatorStageAfterSuccess(current: CreatorProductionStage, event: CreatorStageSuccessEvent): CreatorProductionStage {
  const target = event === "brief_completed" ? 2 : event === "strategy_approved" ? 3 : 4;
  return Math.max(current, target) as CreatorProductionStage;
}
