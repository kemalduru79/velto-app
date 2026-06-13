export type FlowZone = "AI" | "Maker" | "VR";
export type FlowStatus = "active" | "pilot" | "coming_soon";

export type ExperienceFlow = {
  key: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  ageBand: string;
  durationMin: number;
  zones: FlowZone[];
  outputs: string[];
  status: FlowStatus;
  ctaLabel: string;
  accent: string;
};

export const experienceFlows: ExperienceFlow[] = [
  {
    key: "storyverse",
    title: "Storyverse Lab",
    shortTitle: "Storyverse",
    subtitle: "AI cartoon and story generation",
    description:
      "The child designs their own character, world and story, then moves through the production engine to generate scenes, visuals, voice and video outputs.",
    ageBand: "8-14",
    durationMin: 40,
    zones: ["AI"],
    outputs: [
      "Cartoon video",
      "Character card",
      "Scene visuals",
      "Voice-over",
    ],
    status: "active",
    ctaLabel: "Start Storyverse",
    accent: "cyan",
  },
  {
    key: "creator_lab",
    title: "Content Creator Lab",
    shortTitle: "Creator Lab",
    subtitle: "YouTube / Shorts-focused content generation",
    description:
      "A productized flow for short video concepts, scripts, visual packages, voice-over and publish-ready creative outputs.",
    ageBand: "10-16",
    durationMin: 45,
    zones: ["AI"],
    outputs: ["Short video", "Thumbnail", "Caption", "Script"],
    status: "active",
    ctaLabel: "Start Creator Lab",
    accent: "sky",
  },
  {
    key: "career_lab",
    title: "Experience Worlds",
    shortTitle: "Worlds",
    subtitle: "Immersive AI experience engine",
    description:
      "A cinematic runtime layer for guided AI worlds such as Lost Space Signal and Deep Ocean Discovery. This replaces profession-first Career Lab scaling with reusable world packs.",
    ageBand: "8-14",
    durationMin: 35,
    zones: ["AI"],
    outputs: ["Experience memory", "World log", "Cinematic artifact"],
    status: "pilot",
    ctaLabel: "Open Experience Worlds",
    accent: "violet",
  },
  {
    key: "interactive_quest",
    title: "Lost Space Signal",
    shortTitle: "Space Signal",
    subtitle: "Reference immersive world",
    description:
      "A cinematic signal-based discovery experience where the child enters an abandoned orbital station and restores contact with an AI guide.",
    ageBand: "8-14",
    durationMin: 35,
    zones: ["AI"],
    outputs: ["Mission memory", "Signal log", "Cinematic scene card"],
    status: "pilot",
    ctaLabel: "Open Reference World",
    accent: "emerald",
  },
  {
    key: "ai_character",
    title: "Deep Ocean Discovery",
    shortTitle: "Ocean Discovery",
    subtitle: "Calm mystery discovery world",
    description:
      "A radically different underwater world designed to prove that the same experience engine can create wonder, calm tension and discovery.",
    ageBand: "8-14",
    durationMin: 35,
    zones: ["AI"],
    outputs: [
      "Discovery log",
      "Creature card",
      "Ocean scene memory",
    ],
    status: "coming_soon",
    ctaLabel: "Coming Soon",
    accent: "pink",
  },
  {
    key: "thinking_lab",
    title: "Dream Explorer",
    shortTitle: "Dream Explorer",
    subtitle: "Imagination and emotional discovery world",
    description:
      "A future world where the child explores symbolic dream spaces, creates visual memories and learns through reflection rather than quizzes.",
    ageBand: "8-14",
    durationMin: 30,
    zones: ["AI"],
    outputs: ["Dream map", "Memory card", "Reflection artifact"],
    status: "coming_soon",
    ctaLabel: "Coming Soon",
    accent: "amber",
  },
  {
    key: "maker_hybrid",
    title: "AI + Maker World",
    shortTitle: "Maker World",
    subtitle: "Physical + digital experience bridge",
    description:
      "A later physical lab extension where AI-generated world artifacts can become maker tasks, exhibit cards or VR-supported experiences.",
    ageBand: "10-16",
    durationMin: 60,
    zones: ["AI", "Maker", "VR"],
    outputs: ["Build plan", "Exhibit card", "Demo clip"],
    status: "coming_soon",
    ctaLabel: "Coming Soon",
    accent: "orange",
  },
];

export const storyverseFlow = experienceFlows[0];

export function getFlowByKey(flowKey?: string | null) {
  if (!flowKey) {
    return storyverseFlow;
  }

  return experienceFlows.find((flow) => flow.key === flowKey) || storyverseFlow;
}
