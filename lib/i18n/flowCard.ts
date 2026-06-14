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
        subtitle: "Çocuk güvenli AI hikâye ve içerik üretimi",
        description:
          "8-18 yaş aralığı için güvenli, kontrollü ve export edilebilir AI hikâye üretim ortamı. Karakter, sahne, görsel, seslendirme ve video çıktısına ilerler.",
        outputs: ["Hikâye", "Sahne görselleri", "Seslendirme", "Export edilebilir video"],
        ctaLabel: "Storyverse ile başla",
      },
      creator_lab: {
        title: "CreatorLab",
        shortTitle: "CreatorLab",
        subtitle: "Profesyonel AI içerik motoru",
        description:
          "18+ içerik üreticileri için sosyal medya konsepti, script, thumbnail, voice-over, imaj/video üretimi ve publish-ready paket hazırlayan ürünleşmiş AI studio.",
        outputs: ["Short video", "Thumbnail", "Caption", "Script"],
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
        subtitle: "Child-safe AI story and content creation",
        description:
          "A safe, controlled and exportable AI storytelling environment for ages 8-18. It supports characters, scenes, visuals, voice-over and video outputs.",
        outputs: ["Story", "Scene visuals", "Voice-over", "Exportable video"],
        ctaLabel: "Start Storyverse",
      },
      creator_lab: {
        title: "CreatorLab",
        shortTitle: "CreatorLab",
        subtitle: "Professional AI content engine",
        description:
          "A productized AI studio for 18+ creators, built for social media concepts, scripts, thumbnails, voice-over, image/video generation and publish-ready packages.",
        outputs: ["Short video", "Thumbnail", "Caption", "Script"],
        ctaLabel: "Open CreatorLab",
      },
    },
  },
};
