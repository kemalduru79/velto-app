export type StoryverseMissionScene = {
  sceneId: string;
  sceneTitle: string;
  narration: string;
  cinematicCaption: string;
  emotionalBeat: string;
  visualTone: string;
  imagePrompt: string;
  missionImpact: string;
  emotionalScore: number;
  dangerScore: number;
  leadershipScore: number;
  cinematicPriority: number;
  readyForImageGeneration: boolean;
  isClimaxMoment: boolean;
  visualGenerationCandidate: boolean;
};

export function createStoryverseMissionScene(frame: any): StoryverseMissionScene {
  const emotionalScore = Math.min(100, frame.state?.crewTrust ?? 50);
  const dangerScore = Math.min(100, frame.state?.riskLevel ?? 30);
  const leadershipScore = Math.min(100, frame.state?.mentorConfidence ?? 50);

  const cinematicPriority = Math.round(
    emotionalScore * 0.35 +
    dangerScore * 0.25 +
    leadershipScore * 0.4
  );

  return {
    sceneId: frame.id,
    sceneTitle: frame.eventTitle,
    narration: frame.worldEvent,
    cinematicCaption: frame.cinematicCaption,
    emotionalBeat: frame.visualTone,
    visualTone: frame.visualTone,
    imagePrompt: frame.imagePromptSlot,
    missionImpact: frame.worldEvent,
    emotionalScore,
    dangerScore,
    leadershipScore,
    cinematicPriority,
    readyForImageGeneration: cinematicPriority >= 55,
    isClimaxMoment: cinematicPriority >= 78,
    visualGenerationCandidate: cinematicPriority >= 60,
  };
}
