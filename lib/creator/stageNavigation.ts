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

export const CREATOR_VISIBLE_WORKFLOW_STAGES = [
  { id: 1, key: "brief", title: "Brief" },
  { id: 2, key: "strategy", title: "Strategy" },
  { id: 3, key: "production_setup", title: "Production Setup" },
  { id: 4, key: "create_review", title: "Create & Review" },
  { id: 5, key: "publish", title: "Publish" },
] as const;

export type CreatorVisibleWorkflowStep = typeof CREATOR_VISIBLE_WORKFLOW_STAGES[number]["id"];

export function resolveCreatorVisibleWorkflowStep(input: {
  workspaceStep: CreatorProductionStage;
  productionSubstep: "setup" | "create_review";
}): CreatorVisibleWorkflowStep {
  if (input.workspaceStep === 3) return input.productionSubstep === "setup" ? 3 : 4;
  return input.workspaceStep === 4 ? 5 : input.workspaceStep;
}

export function resolveCreatorWorkspaceTarget(step: CreatorVisibleWorkflowStep): {
  workspaceStep: CreatorProductionStage;
  productionSubstep?: "setup" | "create_review";
} {
  if (step === 3 || step === 4) {
    return { workspaceStep: 3, productionSubstep: step === 3 ? "setup" : "create_review" };
  }
  return { workspaceStep: step === 5 ? 4 : step };
}

export function resolveCreatorVisibleWorkflowProgress(
  step: CreatorVisibleWorkflowStep,
  lifecycleProgress: number,
) {
  const floor = (step - 1) * 20;
  const ceiling = step * 20;
  const progress = Number.isFinite(lifecycleProgress) ? lifecycleProgress : 0;
  return Math.max(floor, Math.min(ceiling, Math.round(progress)));
}

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
