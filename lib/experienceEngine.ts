export type ExperienceEngineStage =
  | "entry"
  | "activation"
  | "guide_arrival"
  | "discovery"
  | "interaction"
  | "tension"
  | "resolution"
  | "memory";

export type ExperienceIntensity = "low" | "medium" | "high";

export type ExperienceEnginePrimitive = {
  key: string;
  label: string;
  description: string;
  reusable: boolean;
};

export type ExperienceRuntimeMoment = {
  stage: ExperienceEngineStage;
  title: string;
  childExperience: string;
  systemRole: string;
  intensity: ExperienceIntensity;
};

export type ExperienceRuntimeGrammar = {
  openingRitual: string;
  guideArrival: string;
  focusInteraction: string;
  emotionalTurn: string;
  memoryArtifact: string;
};

export type ExperienceWorldRuntimePack = {
  worldKey: string;
  runtimeName: string;
  atmosphere: string;
  guideRole: string;
  childRole: string;
  primaryEmotion: string;
  secondaryEmotion: string;
  visualLanguage: string[];
  soundLanguage: string[];
  interactionPattern: string[];
  grammar: ExperienceRuntimeGrammar;
  moments: ExperienceRuntimeMoment[];
};

export const experienceEngine = {
  mode: "immersive-worlds",
  runtime: "cinematic-guided-runtime",
  version: "2.1.1",
} as const;

export const experienceEnginePrimitives: ExperienceEnginePrimitive[] = [
  {
    key: "scene_engine",
    label: "Scene Engine",
    description:
      "Turns the experience into cinematic beats instead of static screens or educational cards.",
    reusable: true,
  },
  {
    key: "guide_engine",
    label: "Guide Engine",
    description:
      "Defines the AI guide identity, tone, pacing and child-safe response style for each world.",
    reusable: true,
  },
  {
    key: "atmosphere_engine",
    label: "Atmosphere Engine",
    description:
      "Controls world-specific ambience, overlays, transitions and visual mood without creating a separate product.",
    reusable: true,
  },
  {
    key: "interaction_engine",
    label: "Interaction Engine",
    description:
      "Keeps child choices focused, meaningful and safe while allowing each world to feel alive.",
    reusable: true,
  },
  {
    key: "memory_engine",
    label: "Memory Engine",
    description:
      "Packages the ending as a collectible experience artifact instead of a plain completion screen.",
    reusable: true,
  },
];

export const standardExperienceRuntimeMoments: ExperienceRuntimeMoment[] = [
  {
    stage: "entry",
    title: "World Entry",
    childExperience: "The child feels they are crossing into a new place, not opening another app screen.",
    systemRole: "Establish atmosphere, reduce UI noise and focus attention.",
    intensity: "low",
  },
  {
    stage: "activation",
    title: "World Activation",
    childExperience: "The world starts responding through signals, motion, voice or environmental cues.",
    systemRole: "Start the cinematic runtime and introduce the first mystery or goal.",
    intensity: "medium",
  },
  {
    stage: "guide_arrival",
    title: "Guide Arrival",
    childExperience: "The AI guide appears as part of the world, not as a generic chatbot.",
    systemRole: "Create trust, explain the role and invite the first action.",
    intensity: "medium",
  },
  {
    stage: "discovery",
    title: "Discovery Beat",
    childExperience: "The child notices something meaningful and wants to know what happens next.",
    systemRole: "Generate curiosity through a scene, clue or emotional signal.",
    intensity: "medium",
  },
  {
    stage: "interaction",
    title: "Focused Interaction",
    childExperience: "The child makes one clear decision that affects the next beat.",
    systemRole: "Keep choices simple, safe and consequential without turning into a quiz.",
    intensity: "medium",
  },
  {
    stage: "tension",
    title: "Emotional Turn",
    childExperience: "Something changes in the world and the child feels responsible in a safe way.",
    systemRole: "Increase engagement while staying age-appropriate and calm enough for children.",
    intensity: "high",
  },
  {
    stage: "resolution",
    title: "Resolution Beat",
    childExperience: "The child sees the result of their decisions and receives narrative closure.",
    systemRole: "Connect decisions to outcome, learning and emotional reward.",
    intensity: "medium",
  },
  {
    stage: "memory",
    title: "Memory Artifact",
    childExperience: "The experience ends with something the child can keep, show or continue later.",
    systemRole: "Produce a collectible artifact such as a log, card, recap, scene or short export.",
    intensity: "low",
  },
];

export const referenceRuntimePacks: ExperienceWorldRuntimePack[] = [
  {
    worldKey: "lost_space_signal",
    runtimeName: "Signal Runtime",
    atmosphere: "abandoned orbital station, soft alarms, signal distortion, distant stars",
    guideRole: "A calm mission AI trying to reconnect safely through a broken channel.",
    childRole: "Young explorer who listens, restores systems and decides how to respond to the signal.",
    primaryEmotion: "wonder",
    secondaryEmotion: "safe tension",
    visualLanguage: ["dark space gradient", "cyan signal lines", "soft HUD arcs", "low-noise telemetry"],
    soundLanguage: ["distant signal", "soft system hum", "gentle alert tone", "radio texture"],
    interactionPattern: ["listen", "choose", "restore", "reveal"],
    grammar: {
      openingRitual: "A dark screen wakes up with a distant repeating signal.",
      guideArrival: "The AI guide arrives through broken transmission fragments.",
      focusInteraction: "The child selects what to restore or investigate next.",
      emotionalTurn: "The signal reveals there may be a memory stored inside the station.",
      memoryArtifact: "The child receives a signal archive and cinematic scene memory.",
    },
    moments: standardExperienceRuntimeMoments,
  },
  {
    worldKey: "deep_ocean_discovery",
    runtimeName: "Expedition Runtime",
    atmosphere: "deep ocean descent, sonar pulse, bioluminescent mystery, calm discovery",
    guideRole: "A marine expedition AI that helps the child observe carefully and protect unknown life.",
    childRole: "Young ocean explorer who scans, observes and makes safe discovery choices.",
    primaryEmotion: "wonder",
    secondaryEmotion: "calm mystery",
    visualLanguage: ["deep blue layers", "sonar rings", "soft particles", "bioluminescent highlights"],
    soundLanguage: ["sonar pulse", "low water movement", "calm guide voice", "soft discovery cue"],
    interactionPattern: ["scan", "observe", "protect", "document"],
    grammar: {
      openingRitual: "The world opens with a slow descent below the light zone.",
      guideArrival: "The marine AI guide speaks through expedition audio.",
      focusInteraction: "The child chooses what to scan, protect or follow.",
      emotionalTurn: "A mysterious lifeform responds to the child's careful choices.",
      memoryArtifact: "The child receives a discovery archive and creature memory card.",
    },
    moments: standardExperienceRuntimeMoments,
  },
];

export function getRuntimePack(worldKey: string): ExperienceWorldRuntimePack {
  return referenceRuntimePacks.find((pack) => pack.worldKey === worldKey) || referenceRuntimePacks[0];
}

export function getExperienceEngineSummary() {
  return {
    positioning: "Reusable cinematic runtime for immersive AI experience worlds.",
    target: "New worlds should be built as runtime packs, not separate hardcoded flows.",
    primitives: experienceEnginePrimitives,
    standardMoments: standardExperienceRuntimeMoments,
  };
}