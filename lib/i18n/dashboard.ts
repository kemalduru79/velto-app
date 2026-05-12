import type { FlowStatus } from "@/lib/flows";

export type DashboardMessages = {
  badges: {
    platform: string;
    experienceLab: string;
  };
  hero: {
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  };
  stats: {
    totalFlows: string;
    activeProducts: string;
    pilot: string;
    roadmap: string;
  };
  primaryProduct: {
    eyebrow: string;
    title: string;
    description: string;
    pipeline: string;
    labIntegration: string;
    cta: string;
  };
  sections: {
    active: {
      eyebrow: string;
      title: string;
      description: string;
    };
    pilot: {
      eyebrow: string;
      title: string;
      description: string;
    };
    roadmap: {
      eyebrow: string;
      title: string;
      description: string;
    };
  };
  platformNote: {
    title: string;
    description: string;
    cta: string;
  };
  languageSwitch: {
    label: string;
    tr: string;
    en: string;
  };
};

export const dashboardMessages: Record<"tr" | "en", DashboardMessages> = {
  tr: {
    badges: {
      platform: "VELTO Platform",
      experienceLab: "AI Experience Lab",
    },
    hero: {
      title: "AI destekli hikaye, video ve deneyim üretim platformu.",
      description:
        "Storyverse ile çocuk odaklı hikaye ve çizgi film üret; Creator Lab ile YouTube / Shorts odaklı yayın paketleri hazırla. Pilot ve roadmap flow’ları aynı platform mimarisi üzerinde kontrollü şekilde ürünleşecek.",
      primaryCta: "Storyverse ile başla",
      secondaryCta: "Creator Lab’i aç",
    },
    stats: {
      totalFlows: "Toplam Flow",
      activeProducts: "Aktif Ürün Akışı",
      pilot: "Pilot",
      roadmap: "Roadmap",
    },
    primaryProduct: {
      eyebrow: "Active Product Layer",
      title: "Storyverse + Creator Lab",
      description:
        "VELTO’nun bugün kullanılabilir iki aktif ürün akışı vardır: Storyverse çocuk deneyimi ve hikaye üretimi için ana deneyim motorudur; Creator Lab ise YouTube / Shorts odaklı içerik ve yayın paketi üretim motorudur.",
      pipeline: "Storyverse: Story → Scene → Image → Voice → Video → Share",
      labIntegration:
        "Creator Lab: Idea → Script → Visuals → Voice-over → Thumbnail → Publish Package",
      cta: "Storyverse üretimine git",
    },
    sections: {
      active: {
        eyebrow: "Aktif Akış",
        title: "Hemen kullanılabilir ürün",
        description:
          "Bu aşamada kullanıcıya iki net başlangıç sunuyoruz: çocuk deneyimi için Storyverse, yayın odaklı içerik üretimi için Creator Lab.",
      },
      pilot: {
        eyebrow: "Pilot Deneyimler",
        title: "Sıradaki ürünleşme adayları",
        description:
          "Bu flow’lar görünür kalır; fakat ana aksiyon Storyverse olduğu için daha sakin sunulur.",
      },
      roadmap: {
        eyebrow: "Roadmap",
        title: "Yakında açılacak alanlar",
        description:
          "Platform vizyonunu gösterir; kullanıcı karar yükünü artırmamak için düşük görsel ağırlıkta tutulur.",
      },
    },
    platformNote: {
      title: "Platform notu",
      description:
        "Bu dashboard v3 yalnızca 7 flow ürün hiyerarşisini netleştirir. Backend, Storyverse üretim motoru, Creator Lab üretim akışı, public share ve QR akışı korunur.",
      cta: "Storyverse’e devam et",
    },
    languageSwitch: {
      label: "Arayüz dili",
      tr: "TR",
      en: "EN",
    },
  },
  en: {
    badges: {
      platform: "VELTO Platform",
      experienceLab: "AI Experience Lab",
    },
    hero: {
      title: "Create AI-powered stories, videos, and child-safe experiences.",
      description:
        "Use Storyverse for child-focused cinematic storytelling and Creator Lab for YouTube / Shorts-ready content packages. Pilot and roadmap flows will be productized gradually on the same platform architecture.",
      primaryCta: "Start with Storyverse",
      secondaryCta: "Open Creator Lab",
    },
    stats: {
      totalFlows: "Total Flows",
      activeProducts: "Active Product Flows",
      pilot: "Pilot",
      roadmap: "Roadmap",
    },
    primaryProduct: {
      eyebrow: "Active Product Layer",
      title: "Storyverse + Creator Lab",
      description:
        "VELTO currently has two ready-to-use active product flows: Storyverse is the core child-focused storytelling experience, while Creator Lab is the YouTube / Shorts-focused content and publish package engine.",
      pipeline: "Storyverse: Story → Scene → Image → Voice → Video → Share",
      labIntegration:
        "Creator Lab: Idea → Script → Visuals → Voice-over → Thumbnail → Publish Package",
      cta: "Go to Storyverse studio",
    },
    sections: {
      active: {
        eyebrow: "Active Flow",
        title: "Ready-to-use product",
        description:
          "At this stage, we offer two clear starting points: Storyverse for child-focused experience creation and Creator Lab for publish-ready content production.",
      },
      pilot: {
        eyebrow: "Pilot Experiences",
        title: "Next productization candidates",
        description:
          "These flows remain visible, but Storyverse stays the main action and they are presented more calmly.",
      },
      roadmap: {
        eyebrow: "Roadmap",
        title: "Coming soon areas",
        description:
          "These flows communicate the platform vision while keeping visual weight low to avoid decision overload.",
      },
    },
    platformNote: {
      title: "Platform note",
      description:
        "This dashboard v3 only clarifies the 7-flow product hierarchy. Backend, Storyverse generation engine, Creator Lab production flow, public share, and QR output remain unchanged.",
      cta: "Continue to Storyverse",
    },
    languageSwitch: {
      label: "UI language",
      tr: "TR",
      en: "EN",
    },
  },
};

export const dashboardStatusOrder: FlowStatus[] = [
  "active",
  "pilot",
  "coming_soon",
];