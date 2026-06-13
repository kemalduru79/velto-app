export type ExperienceWorldStatus = "active" | "reference" | "concept";
export type ExperienceWorldTone = "wonder" | "tension" | "calm" | "creative" | "mystery";

import { getRuntimePack, type ExperienceWorldRuntimePack } from "@/lib/experienceEngine";

export type ExperienceWorldPack = {
  key: string;
  title: string;
  shortTitle: string;
  status: ExperienceWorldStatus;
  tone: ExperienceWorldTone[];
  ageBand: string;
  durationMin: number;
  promise: string;
  childRole: string;
  outputs: string[];
  cinematicGrammar: {
    openingRitual: string;
    guideArrival: string;
    interactionMoment: string;
    memoryArtifact: string;
  };
  runtimePackKey: string;
  runtimePack: ExperienceWorldRuntimePack;
  engineReuse: {
    sceneEngine: boolean;
    guideEngine: boolean;
    atmosphereEngine: boolean;
    interactionEngine: boolean;
    memoryEngine: boolean;
    exportEngine: boolean;
  };
};

export const experienceWorldPacks: ExperienceWorldPack[] = [
  {
    key: "lost_space_signal",
    title: "Lost Space Signal",
    shortTitle: "Space Signal",
    status: "reference",
    tone: ["wonder", "tension", "mystery"],
    ageBand: "8-14",
    durationMin: 35,
    promise:
      "A cinematic signal-based discovery experience where the child enters an abandoned orbital station and restores contact with an AI guide.",
    childRole:
      "The child becomes the explorer who listens, decides, repairs and reveals the story behind the signal.",
    outputs: ["Mission memory", "Signal log", "Cinematic scene card"],
    cinematicGrammar: {
      openingRitual: "Dark screen, distant signal, world boot sequence.",
      guideArrival: "AI guide arrives through a broken transmission rather than a normal chat panel.",
      interactionMoment: "The child makes focused choices that change the next scene beat.",
      memoryArtifact: "The final output is a collectible signal archive and short cinematic recap.",
    },
    runtimePackKey: "lost_space_signal",
    runtimePack: getRuntimePack("lost_space_signal"),
    engineReuse: {
      sceneEngine: true,
      guideEngine: true,
      atmosphereEngine: true,
      interactionEngine: true,
      memoryEngine: true,
      exportEngine: true,
    },
  },
  {
    key: "deep_ocean_discovery",
    title: "Deep Ocean Discovery",
    shortTitle: "Ocean Discovery",
    status: "concept",
    tone: ["wonder", "calm", "mystery"],
    ageBand: "8-14",
    durationMin: 35,
    promise:
      "A calm but mysterious underwater discovery world that validates the same engine with a radically different emotional tone.",
    childRole:
      "The child becomes the young explorer who follows sonar clues, observes unknown life and makes safe discovery decisions.",
    outputs: ["Discovery log", "Creature card", "Ocean scene memory"],
    cinematicGrammar: {
      openingRitual: "Soft ocean ambience, sonar pulse, slow descent into the unknown.",
      guideArrival: "Marine AI guide speaks calmly through expedition audio.",
      interactionMoment: "The child chooses what to scan, protect or investigate next.",
      memoryArtifact: "The final output is a discovery archive and new creature profile.",
    },
    runtimePackKey: "deep_ocean_discovery",
    runtimePack: getRuntimePack("deep_ocean_discovery"),
    engineReuse: {
      sceneEngine: true,
      guideEngine: true,
      atmosphereEngine: true,
      interactionEngine: true,
      memoryEngine: true,
      exportEngine: true,
    },
  },
];

export const experienceWorldPlatformPrinciples = [
  "Experience-first, not flow-first.",
  "Cinematic guided interaction, not dashboard-heavy education software.",
  "AI acts as runtime director behind the scenes.",
  "New worlds should be created through world packs, not separate hardcoded products.",
  "Storyverse and Creator Lab remain protected core engines.",
] as const;

export function getReferenceExperienceWorld() {
  return experienceWorldPacks.find((world) => world.status === "reference") || experienceWorldPacks[0];
}


export function getExperienceWorldByKey(worldKey?: string | null) {
  if (!worldKey) {
    return getReferenceExperienceWorld();
  }

  return experienceWorldPacks.find((world) => world.key === worldKey) || getReferenceExperienceWorld();
}

export function getExperienceWorldRuntime(worldKey?: string | null) {
  return getExperienceWorldByKey(worldKey).runtimePack;
}
