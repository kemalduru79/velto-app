import { createStoryverseMissionScene } from "./storyverse-scene-adapter";

export function createMissionRecapPackage(consequenceFrames: any[]) {
  const scenes = consequenceFrames.map(createStoryverseMissionScene);

  const strongestMoments = [...scenes]
    .sort((a, b) => b.cinematicPriority - a.cinematicPriority)
    .slice(0, 5);

  return {
    createdAt: new Date().toISOString(),
    totalScenes: scenes.length,
    strongestMoments,
    exportReadyScenes: strongestMoments.filter(
      (scene) => scene.readyForImageGeneration
    ),
    climaxMoments: strongestMoments.filter(
      (scene) => scene.isClimaxMoment
    ),
  };
}
