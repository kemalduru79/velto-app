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
        title: "Storyverse Lab",
        shortTitle: "Storyverse",
        subtitle: "AI çizgi film ve hikâye üretimi",
        description:
          "Çocuk kendi karakterini, dünyasını ve hikâyesini tasarlar; mevcut üretim motoru ile sahne, görsel, ses ve video çıktısına ilerler.",
        outputs: [
          "Çizgi film",
          "Karakter kartı",
          "Sahne görselleri",
          "Seslendirme",
        ],
        ctaLabel: "Storyverse ile başla",
      },
      career_lab: {
        title: "AI Career Lab",
        shortTitle: "Career Lab",
        subtitle: "Interactive profession simulation",
        description:
          "Çocuk Astronot, Doktor, Pilot, AI Engineer veya Cyber Detective rolünü seçer; güvenli ve kontrollü görev simülasyonunda kararlar verir.",
        outputs: ["Deneyim raporu", "Kariyer kartı", "Karar haritası"],
        ctaLabel: "Career Lab’i aç",
      },
      interactive_quest: {
        title: "Interactive Quest",
        shortTitle: "Quest",
        subtitle: "Dallanan hikâye ve seçimli görev",
        description:
          "AI hikâyeyi başlatır; çocuk seçim yapar, hikâye dallanır ve kişisel görev haritası oluşur.",
        outputs: ["Kişisel hikâye", "Quest haritası", "İpucu kartları"],
        ctaLabel: "Pilot akışı aç",
      },
      ai_character: {
        title: "Build Your AI Character",
        shortTitle: "AI Character",
        subtitle: "Kişisel AI karakter tasarımı",
        description:
          "Çocuk karakterini oluşturur, kişilik verir, ses seçer ve güvenli sınırlarla ilk etkileşim deneyimini yaşar.",
        outputs: [
          "AI karakter profili",
          "Avatar",
          "Sesli tanıtım",
          "Karakter kartı",
        ],
        ctaLabel: "Yakında",
      },
      thinking_lab: {
        title: "AI Thinking Lab",
        shortTitle: "Thinking Lab",
        subtitle: "Problem çözme ve düşünme becerisi",
        description:
          "Çocuk problem çözer, alternatif üretir, ipuçları alır ve düşünme sürecini görünür hale getiren çıktı alır.",
        outputs: ["Düşünme raporu", "Worksheet", "İpucu sesleri"],
        ctaLabel: "Yakında",
      },
      creator_lab: {
        title: "Content Creator Lab",
        shortTitle: "Creator Lab",
        subtitle: "YouTube / Shorts odaklı içerik üretimi",
        description:
          "Kısa video konsepti, senaryo, görsel paket, voice-over ve publish-ready çıktı üretimi için ürünleşmiş akış.",
        outputs: ["Short video", "Thumbnail", "Caption", "Script"],
        ctaLabel: "Creator Lab ile başla",
      },
      maker_hybrid: {
        title: "AI + Maker Hybrid",
        shortTitle: "Maker Hybrid",
        subtitle: "AI tasarımından fiziksel üretime",
        description:
          "AI ile tasarlanan fikri Maker Zone’da fiziksel çıktıya, VR Zone’da deneyimsel sunuma bağlayan hibrit ürün akışı.",
        outputs: ["Maker planı", "Build card", "Mockup", "Demo klip"],
        ctaLabel: "Yakında",
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
        title: "Storyverse Lab",
        shortTitle: "Storyverse",
        subtitle: "AI cartoon and story generation",
        description:
          "The child designs their own character, world, and story, then moves through the existing production engine to generate scenes, visuals, voice, and video.",
        outputs: [
          "Cartoon video",
          "Character card",
          "Scene visuals",
          "Voice-over",
        ],
        ctaLabel: "Start with Storyverse",
      },
      career_lab: {
        title: "AI Career Lab",
        shortTitle: "Career Lab",
        subtitle: "Interactive profession simulation",
        description:
          "The child chooses Astronaut, Doctor, Pilot, AI Engineer, or Cyber Detective and makes decisions inside a safe guided mission simulation.",
        outputs: ["Experience report", "Career card", "Decision map"],
        ctaLabel: "Open Career Lab",
      },
      interactive_quest: {
        title: "Interactive Quest",
        shortTitle: "Quest",
        subtitle: "Branching story and choice-based mission",
        description:
          "AI starts the story; the child makes choices, the story branches, and a personal quest map is created.",
        outputs: ["Personal story", "Quest map", "Hint cards"],
        ctaLabel: "Open pilot flow",
      },
      ai_character: {
        title: "Build Your AI Character",
        shortTitle: "AI Character",
        subtitle: "Personal AI character design",
        description:
          "The child creates a character, defines its personality, selects a voice, and experiences a first interaction within safe boundaries.",
        outputs: [
          "AI character profile",
          "Avatar",
          "Voice intro",
          "Character card",
        ],
        ctaLabel: "Coming soon",
      },
      thinking_lab: {
        title: "AI Thinking Lab",
        shortTitle: "Thinking Lab",
        subtitle: "Problem solving and thinking skills",
        description:
          "The child solves problems, generates alternatives, receives hints, and gets an output that makes the thinking process visible.",
        outputs: ["Thinking report", "Worksheet", "Hint audio"],
        ctaLabel: "Coming soon",
      },
      creator_lab: {
        title: "Content Creator Lab",
        shortTitle: "Creator Lab",
        subtitle: "YouTube / Shorts-focused content generation",
        description:
          "A productized flow for short video concepts, scripts, visual packages, voice-over, and publish-ready outputs.",
        outputs: ["Short video", "Thumbnail", "Caption", "Script"],
        ctaLabel: "Start Creator Lab",
      },
      maker_hybrid: {
        title: "AI + Maker Hybrid",
        shortTitle: "Maker Hybrid",
        subtitle: "From AI design to physical production",
        description:
          "A hybrid product flow connecting AI-generated ideas to physical outputs in the Maker Zone and experiential presentation in the VR Zone.",
        outputs: ["Maker plan", "Build card", "Mockup", "Demo clip"],
        ctaLabel: "Coming soon",
      },
    },
  },
};