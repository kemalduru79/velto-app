import type { ExperienceFlow, FlowStatus } from "@/lib/flows";

type LocalizedFlowContent = Pick<
  ExperienceFlow,
  "title" | "shortTitle" | "subtitle" | "description" | "outputs" | "ctaLabel"
>;

export type FlowCardMessages = {
  statusLabels: Record<FlowStatus, string>;
  labels: {
    age: string;
    duration: string;
    durationSuffix: string;
    outputs: string;
  };
  flows: Record<string, LocalizedFlowContent>;
};

export const flowCardMessages: Record<"tr" | "en", FlowCardMessages> = {
  tr: {
    statusLabels: {
      active: "Aktif",
      pilot: "Pilot",
      coming_soon: "Yakında",
    },
    labels: {
      age: "Yaş",
      duration: "Süre",
      durationSuffix: "dk",
      outputs: "Çıktılar",
    },
    flows: {
      storyverse: {
        title: "Storyverse",
        shortTitle: "Storyverse",
        subtitle: "8-18 yaş için güvenli AI hikâye üretimi",
        description:
          "Çocuklar ve gençler için güvenli, kontrollü ve premium bir üretim alanı. Karakter, sahne, görsel, seslendirme ve güvenli export çıktısına ilerler.",
        outputs: ["Hikâye", "Sahne görselleri", "Seslendirme", "Güvenli export"],
        ctaLabel: "Storyverse ile başla",
      },
      creator_lab: {
        title: "CreatorLab",
        shortTitle: "CreatorLab",
        subtitle: "AI destekli sosyal içerik işletim sistemi",
        description:
          "18+ creator’lar için fikirden yayına uzanan profesyonel üretim motoru. Script, hook, thumbnail, voice-over, imaj/video sahneleri ve publish-ready paket üretir.",
        outputs: ["Long-form", "Shorts/Reels", "Thumbnail", "Metadata"],
        ctaLabel: "CreatorLab’i aç",
      },
    },
  },
  en: {
    statusLabels: {
      active: "Active",
      pilot: "Pilot",
      coming_soon: "Coming Soon",
    },
    labels: {
      age: "Age",
      duration: "Duration",
      durationSuffix: "min",
      outputs: "Outputs",
    },
    flows: {
      storyverse: {
        title: "Storyverse",
        shortTitle: "Storyverse",
        subtitle: "Safe AI storytelling for ages 8-18",
        description:
          "A premium, controlled creation space for children and teenagers. It supports characters, scenes, visuals, voice-over and safe export outputs.",
        outputs: ["Story", "Scene visuals", "Voice-over", "Safe export"],
        ctaLabel: "Start Storyverse",
      },
      creator_lab: {
        title: "CreatorLab",
        shortTitle: "CreatorLab",
        subtitle: "AI-powered social content operating system",
        description:
          "A professional production engine for 18+ creators, built for scripts, hooks, thumbnails, voice-over, image/video scenes and publish-ready packages.",
        outputs: ["Long-form", "Shorts/Reels", "Thumbnail", "Metadata"],
        ctaLabel: "Open CreatorLab",
      },
    },
  },
};
