export type FlowZone = "AI" | "Maker" | "VR";
export type FlowStatus = "active" | "pilot" | "coming_soon";

export type ExperienceFlow = {
  key: "storyverse" | "creator_lab";
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
    title: "Storyverse",
    shortTitle: "Storyverse",
    subtitle: "Safe AI storytelling for ages 8-18",
    description:
      "A premium, child-safe creation space where young users build characters, scenes, voice and exportable story outputs under strict content controls.",
    ageBand: "8-18",
    durationMin: 40,
    zones: ["AI"],
    outputs: ["Story", "Scene visuals", "Voice-over", "Safe export"],
    status: "active",
    ctaLabel: "Start Storyverse",
    accent: "sky",
  },
  {
    key: "creator_lab",
    title: "CreatorLab",
    shortTitle: "CreatorLab",
    subtitle: "AI-powered social content operating system",
    description:
      "A professional production engine for 18+ creators that turns an idea into scripts, hooks, thumbnails, voice-over, image/video scenes and publish-ready packages.",
    ageBand: "18+",
    durationMin: 45,
    zones: ["AI"],
    outputs: ["Long-form", "Shorts/Reels", "Thumbnail", "Metadata"],
    status: "active",
    ctaLabel: "Open CreatorLab",
    accent: "rose",
  },
];

export const storyverseFlow = experienceFlows[0];
export const creatorLabFlow = experienceFlows[1];

export function getFlowByKey(flowKey?: string | null) {
  if (flowKey === "creator_lab" || flowKey === "creatorlab") {
    return creatorLabFlow;
  }

  return storyverseFlow;
}
