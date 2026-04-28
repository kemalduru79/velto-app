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
    subtitle: "AI çizgi film ve hikâye üretimi",
    description:
      "Çocuk kendi karakterini, dünyasını ve hikâyesini tasarlar; mevcut üretim motoru ile sahne, görsel, ses ve video çıktısına ilerler.",
    ageBand: "8-14",
    durationMin: 40,
    zones: ["AI"],
    outputs: ["Çizgi film", "Karakter kartı", "Sahne görselleri", "Seslendirme"],
    status: "active",
    ctaLabel: "Storyverse ile başla",
    accent: "cyan",
  },
  {
    key: "career_lab",
    title: "AI Career Simulation",
    shortTitle: "Career Lab",
    subtitle: "Meslek deneyimi ve görev simülasyonu",
    description:
      "Çocuk bir meslek seçer, güvenli bir görev akışında kararlar verir ve AI destekli deneyim raporu oluşturur.",
    ageBand: "9-15",
    durationMin: 35,
    zones: ["AI", "VR"],
    outputs: ["Deneyim raporu", "Kariyer kartı", "Görev senaryosu"],
    status: "pilot",
    ctaLabel: "Pilot akışı aç",
    accent: "violet",
  },
  {
    key: "interactive_quest",
    title: "Interactive Quest",
    shortTitle: "Quest",
    subtitle: "Dallanan hikâye ve seçimli görev",
    description:
      "AI hikâyeyi başlatır; çocuk seçim yapar, hikâye dallanır ve kişisel görev haritası oluşur.",
    ageBand: "8-14",
    durationMin: 35,
    zones: ["AI", "Maker"],
    outputs: ["Kişisel hikâye", "Quest haritası", "İpucu kartları"],
    status: "pilot",
    ctaLabel: "Pilot akışı aç",
    accent: "emerald",
  },
  {
    key: "ai_character",
    title: "Build Your AI Character",
    shortTitle: "AI Character",
    subtitle: "Kişisel AI karakter tasarımı",
    description:
      "Çocuk karakterini oluşturur, kişilik verir, ses seçer ve güvenli sınırlarla ilk etkileşim deneyimini yaşar.",
    ageBand: "8-13",
    durationMin: 30,
    zones: ["AI"],
    outputs: ["AI karakter profili", "Avatar", "Sesli tanıtım", "Karakter kartı"],
    status: "coming_soon",
    ctaLabel: "Yakında",
    accent: "pink",
  },
  {
    key: "thinking_lab",
    title: "AI Thinking Lab",
    shortTitle: "Thinking Lab",
    subtitle: "Problem çözme ve düşünme becerisi",
    description:
      "Çocuk problem çözer, alternatif üretir, ipuçları alır ve düşünme sürecini görünür hale getiren çıktı alır.",
    ageBand: "9-15",
    durationMin: 30,
    zones: ["AI"],
    outputs: ["Düşünme raporu", "Worksheet", "İpucu sesleri"],
    status: "coming_soon",
    ctaLabel: "Yakında",
    accent: "amber",
  },
  {
    key: "creator_lab",
    title: "Content Creator Lab",
    shortTitle: "Creator Lab",
    subtitle: "YouTube / Shorts odaklı içerik üretimi",
    description:
      "Kısa video konsepti, senaryo, görsel paket, voice-over ve publish-ready çıktı üretimi için ürünleşmiş akış.",
    ageBand: "10-16",
    durationMin: 45,
    zones: ["AI"],
    outputs: ["Short video", "Thumbnail", "Caption", "Script"],
    status: "active",
    ctaLabel: "Creator Lab ile başla",
    accent: "sky",
  },
  {
    key: "maker_hybrid",
    title: "AI + Maker Hybrid",
    shortTitle: "Maker Hybrid",
    subtitle: "AI tasarımından fiziksel üretime",
    description:
      "AI ile tasarlanan fikri Maker Zone’da fiziksel çıktıya, VR Zone’da deneyimsel sunuma bağlayan hibrit ürün akışı.",
    ageBand: "10-16",
    durationMin: 60,
    zones: ["AI", "Maker", "VR"],
    outputs: ["Maker planı", "Build card", "Mockup", "Demo klip"],
    status: "coming_soon",
    ctaLabel: "Yakında",
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
