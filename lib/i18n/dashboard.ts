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
    activeProduct: string;
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
      title: "Çocuğun için AI destekli hikaye ve deneyim üret.",
      description:
        "Storyverse ile karakter oluştur, hikaye kurgula, sahneleri üret, paylaşılabilir public episode ve QR çıktısı al. Diğer deneyim flow’ları aynı platform mimarisi üzerinde kontrollü şekilde ürünleşecek.",
      primaryCta: "Storyverse ile başla",
      secondaryCta: "Flow’ları incele",
    },
    stats: {
      totalFlows: "Toplam Flow",
      activeProduct: "Aktif Ürün",
      pilot: "Pilot",
      roadmap: "Roadmap",
    },
    primaryProduct: {
      eyebrow: "Primary Product",
      title: "Storyverse Lab",
      description:
        "Şu an aktif ana ürün akışı. Dashboard’un odağı Storyverse’tir; diğer flow’lar platform vizyonunu gösterir ancak kullanıcıyı yormayacak şekilde ikincil konumda tutulur.",
      pipeline: "Story → Scene → Image → Voice → Video → Share",
      labIntegration:
        "Public link + QR ile fiziksel Experience Lab’e bağlı demo",
      cta: "Üretim stüdyosuna git",
    },
    sections: {
      active: {
        eyebrow: "Aktif Akış",
        title: "Hemen kullanılabilir ürün",
        description:
          "Bu aşamada kullanıcıyı tek ve güçlü bir başlangıç noktasına yönlendiriyoruz.",
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
        "Bu dashboard v2 yalnızca yönlendirme ve görsel hiyerarşi katmanını sadeleştirir. Backend, Storyverse üretim motoru, public share ve QR akışı korunur.",
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
      title: "Create AI-powered stories and experiences for your child.",
      description:
        "With Storyverse, create characters, design stories, generate scenes, and produce shareable public episodes with QR outputs. Other experience flows will be productized gradually on the same platform architecture.",
      primaryCta: "Start with Storyverse",
      secondaryCta: "Explore flows",
    },
    stats: {
      totalFlows: "Total Flows",
      activeProduct: "Active Product",
      pilot: "Pilot",
      roadmap: "Roadmap",
    },
    primaryProduct: {
      eyebrow: "Primary Product",
      title: "Storyverse Lab",
      description:
        "This is the active core product flow. The dashboard focuses on Storyverse; other flows show the platform vision while remaining secondary to avoid user overload.",
      pipeline: "Story → Scene → Image → Voice → Video → Share",
      labIntegration:
        "Public link + QR output connected to the physical Experience Lab demo",
      cta: "Go to production studio",
    },
    sections: {
      active: {
        eyebrow: "Active Flow",
        title: "Ready-to-use product",
        description:
          "At this stage, we guide the user to one strong and clear starting point.",
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
        "This dashboard v2 only simplifies navigation and visual hierarchy. Backend, Storyverse generation engine, public share, and QR flow remain unchanged.",
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