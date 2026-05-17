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
    title: "AI Career Lab",
    shortTitle: "Career Lab",
    subtitle: "Interactive profession simulation",
    description:
      "The child chooses Astronaut, Doctor, Pilot, AI Engineer or Cyber Detective and makes decisions inside a safe guided mission simulation.",
    ageBand: "9-15",
    durationMin: 35,
    zones: ["AI"],
    outputs: ["Experience report", "Career card", "Decision map"],
    status: "pilot",
    ctaLabel: "Open Career Lab",
    accent: "violet",
  },
  {
    key: "interactive_quest",
    title: "Interactive Quest",
    shortTitle: "Quest",
    subtitle: "Branching story and choice-based mission",
    description:
      "AI starts the story; the child makes choices, the story branches and a personal quest map is generated.",
    ageBand: "8-14",
    durationMin: 35,
    zones: ["AI", "Maker"],
    outputs: ["Personal story", "Quest map", "Hint cards"],
    status: "pilot",
    ctaLabel: "Open Pilot Flow",
    accent: "emerald",
  },
  {
    key: "ai_character",
    title: "Build Your AI Character",
    shortTitle: "AI Character",
    subtitle: "Personal AI character design",
    description:
      "The child creates a character, defines its personality, selects a voice and experiences a safe first interaction.",
    ageBand: "8-13",
    durationMin: 30,
    zones: ["AI"],
    outputs: [
      "AI character profile",
      "Avatar",
      "Voice intro",
      "Character card",
    ],
    status: "coming_soon",
    ctaLabel: "Coming Soon",
    accent: "pink",
  },
  {
    key: "thinking_lab",
    title: "AI Thinking Lab",
    shortTitle: "Thinking Lab",
    subtitle: "Problem solving and thinking skills",
    description:
      "The child solves problems, generates alternatives, receives hints and gets an output that makes the thinking process visible.",
    ageBand: "9-15",
    durationMin: 30,
    zones: ["AI"],
    outputs: ["Thinking report", "Worksheet", "Hint audio"],
    status: "coming_soon",
    ctaLabel: "Coming Soon",
    accent: "amber",
  },
  {
    key: "maker_hybrid",
    title: "AI + Maker Hybrid",
    shortTitle: "Maker Hybrid",
    subtitle: "From AI design to physical making",
    description:
      "A hybrid product flow that connects an AI-designed idea to physical output in Maker Zone and experiential presentation in VR Zone.",
    ageBand: "10-16",
    durationMin: 60,
    zones: ["AI", "Maker", "VR"],
    outputs: ["Maker plan", "Build card", "Mockup", "Demo clip"],
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
