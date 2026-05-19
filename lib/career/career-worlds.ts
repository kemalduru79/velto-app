export type CareerWorldId =
  | "astronaut"
  | "doctor"
  | "pilot"
  | "ai_engineer"
  | "cyber_detective";

export interface CareerWorldAtmosphere {
  id: CareerWorldId;
  title: string;
  missionTone: string;
  ambience: string[];
  cinematicStyle: string;
  mentorStyle: string;
  tensionProfile: string;
  briefingFrame: string;
  openingLine: {
    en: string;
    tr: string;
  };
  uiTheme: {
    primary: string;
    accent: string;
    glow: string;
    surface: string;
  };
}

export const CAREER_WORLD_ATMOSPHERES: CareerWorldAtmosphere[] = [
  {
    id: "astronaut",
    title: "Space Commander",
    missionTone: "high-stakes cinematic survival",
    ambience: [
      "low station hum",
      "distant radar pulse",
      "oxygen warning beeps",
      "deep space silence",
    ],
    cinematicStyle: "cold blue sci-fi control room",
    mentorStyle: "calm strategic commander",
    tensionProfile: "slow pressure escalation",
    briefingFrame: "Lunar Station Helios · Mission Control Channel Open",
    openingLine: {
      en: "Commander, the station is waiting for your first decision.",
      tr: "Komutan, istasyon ilk kararını bekliyor.",
    },
    uiTheme: {
      primary: "#7DD3FC",
      accent: "#38BDF8",
      glow: "rgba(56, 189, 248, 0.28)",
      surface: "rgba(14, 165, 233, 0.10)",
    },
  },
  {
    id: "doctor",
    title: "Emergency Doctor",
    missionTone: "empathetic medical urgency",
    ambience: [
      "heartbeat monitor",
      "hospital hallway ambience",
      "soft emergency alarms",
      "medical scanner hum",
    ],
    cinematicStyle: "clean futuristic medical center",
    mentorStyle: "supportive senior physician",
    tensionProfile: "emotional patient-driven intensity",
    briefingFrame: "Future Care Unit · Emergency Team Standing By",
    openingLine: {
      en: "Doctor, your calm voice may be the first thing that gives everyone hope.",
      tr: "Doktor, sakin sesin herkese umut veren ilk şey olabilir.",
    },
    uiTheme: {
      primary: "#FCA5A5",
      accent: "#FB7185",
      glow: "rgba(251, 113, 133, 0.26)",
      surface: "rgba(251, 113, 133, 0.10)",
    },
  },
  {
    id: "pilot",
    title: "Future Pilot",
    missionTone: "precision, confidence and calm navigation",
    ambience: [
      "cockpit altitude tone",
      "soft engine vibration",
      "navigation radar sweep",
      "tower communication static",
    ],
    cinematicStyle: "sunlit advanced cockpit above the clouds",
    mentorStyle: "focused flight captain",
    tensionProfile: "controlled pressure with fast situational awareness",
    briefingFrame: "Sky Route 27 · Control Tower Signal Locked",
    openingLine: {
      en: "Pilot, the route is changing fast. Keep your eyes on the mission.",
      tr: "Pilot, rota hızla değişiyor. Gözlerin görevde kalsın.",
    },
    uiTheme: {
      primary: "#93C5FD",
      accent: "#3B82F6",
      glow: "rgba(59, 130, 246, 0.24)",
      surface: "rgba(59, 130, 246, 0.09)",
    },
  },
  {
    id: "ai_engineer",
    title: "AI Engineer",
    missionTone: "inventive, ethical and systems-driven",
    ambience: [
      "soft lab processors",
      "prototype activation chime",
      "data stream shimmer",
      "collaboration room ambience",
    ],
    cinematicStyle: "bright future innovation lab",
    mentorStyle: "curious ethical AI architect",
    tensionProfile: "creative problem-solving with responsibility signals",
    briefingFrame: "Future Systems Lab · Prototype Review Starting",
    openingLine: {
      en: "Engineer, this prototype needs more than code. It needs judgment.",
      tr: "Mühendis, bu prototipin koddan fazlasına ihtiyacı var. Sağduyuya ihtiyacı var.",
    },
    uiTheme: {
      primary: "#86EFAC",
      accent: "#22C55E",
      glow: "rgba(34, 197, 94, 0.22)",
      surface: "rgba(34, 197, 94, 0.09)",
    },
  },
  {
    id: "cyber_detective",
    title: "Cyber Detective",
    missionTone: "mystery and digital tension",
    ambience: [
      "terminal clicks",
      "network distortion",
      "encrypted transmission noise",
      "dark city ambience",
    ],
    cinematicStyle: "neon cyber investigation room",
    mentorStyle: "intelligent tactical investigator",
    tensionProfile: "rapid anomaly escalation",
    briefingFrame: "Night Grid Bureau · Encrypted Case File Open",
    openingLine: {
      en: "Detective, something in the signal does not want to be found.",
      tr: "Dedektif, sinyalin içinde bulunmak istemeyen bir şey var.",
    },
    uiTheme: {
      primary: "#C084FC",
      accent: "#8B5CF6",
      glow: "rgba(139, 92, 246, 0.28)",
      surface: "rgba(139, 92, 246, 0.10)",
    },
  },
];

export function getCareerWorldAtmosphere(worldId: string): CareerWorldAtmosphere {
  return (
    CAREER_WORLD_ATMOSPHERES.find((world) => world.id === worldId) ??
    CAREER_WORLD_ATMOSPHERES[0]
  );
}
