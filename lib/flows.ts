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
    subtitle: "Child-safe AI story and content creation",
    description:
      "A safe AI storytelling environment where children and teenagers create characters, scenes, visuals, voice and exportable story outputs.",
    ageBand: "8-18",
    durationMin: 40,
    zones: ["AI"],
    outputs: ["Story", "Scene visuals", "Voice-over", "Exportable video"],
    status: "active",
    ctaLabel: "Start Storyverse",
    accent: "cyan",
  },
  {
    key: "creator_lab",
    title: "CreatorLab",
    shortTitle: "CreatorLab",
    subtitle: "Professional AI content engine",
    description:
      "A productized AI content creation studio for 18+ creators, designed for social media concepts, scripts, thumbnails, voice-over, image/video generation and publish-ready packages.",
    ageBand: "18+",
    durationMin: 45,
    zones: ["AI"],
    outputs: ["Short video", "Thumbnail", "Caption", "Script"],
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
