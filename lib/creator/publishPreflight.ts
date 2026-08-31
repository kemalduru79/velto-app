export type CreatorPublishPreflightStatus =
  | "ready"
  | "review"
  | "action_required"
  | "blocked";

export type CreatorPublishPreflightCategory =
  | "content"
  | "visuals"
  | "voice"
  | "evidence"
  | "rights"
  | "output";

export type CreatorPublishPreflightItem = {
  category: CreatorPublishPreflightCategory;
  status: CreatorPublishPreflightStatus;
};

export function createCreatorPublishPreflight(input: {
  contentReady: boolean;
  visualsReady: boolean;
  voiceReady: boolean;
  evidenceVerified: boolean;
  rightsConfirmed: boolean;
  outputReady: boolean;
}): CreatorPublishPreflightItem[] {
  return [
    { category: "content", status: input.contentReady ? "ready" : "blocked" },
    { category: "visuals", status: input.visualsReady ? "ready" : "action_required" },
    { category: "voice", status: input.voiceReady ? "ready" : "action_required" },
    { category: "evidence", status: input.evidenceVerified ? "ready" : "review" },
    { category: "rights", status: input.rightsConfirmed ? "ready" : "review" },
    { category: "output", status: input.outputReady ? "ready" : "blocked" },
  ];
}
