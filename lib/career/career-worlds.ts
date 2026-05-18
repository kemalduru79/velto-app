export type CareerWorldId =
  | "astronaut"
  | "doctor"
  | "cyber_detective";

export interface CareerWorldAtmosphere {
  id: CareerWorldId;
  title: string;
  missionTone: string;
  ambience: string[];
  cinematicStyle: string;
  mentorStyle: string;
  tensionProfile: string;
  uiTheme: {
    primary: string;
    accent: string;
    glow: string;
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
      "deep space silence"
    ],
    cinematicStyle: "cold blue sci-fi control room",
    mentorStyle: "calm strategic commander",
    tensionProfile: "slow pressure escalation",
    uiTheme: {
      primary: "#7DD3FC",
      accent: "#38BDF8",
      glow: "shadow-cyan-500/30"
    }
  },
  {
    id: "doctor",
    title: "Emergency Doctor",
    missionTone: "empathetic medical urgency",
    ambience: [
      "heartbeat monitor",
      "hospital hallway ambience",
      "soft emergency alarms",
      "medical scanner hum"
    ],
    cinematicStyle: "clean futuristic medical center",
    mentorStyle: "supportive senior physician",
    tensionProfile: "emotional patient-driven intensity",
    uiTheme: {
      primary: "#FCA5A5",
      accent: "#FB7185",
      glow: "shadow-rose-500/30"
    }
  },
  {
    id: "cyber_detective",
    title: "Cyber Detective",
    missionTone: "mystery and digital tension",
    ambience: [
      "terminal clicks",
      "network distortion",
      "encrypted transmission noise",
      "dark city ambience"
    ],
    cinematicStyle: "neon cyber investigation room",
    mentorStyle: "intelligent tactical investigator",
    tensionProfile: "rapid anomaly escalation",
    uiTheme: {
      primary: "#C084FC",
      accent: "#8B5CF6",
      glow: "shadow-violet-500/30"
    }
  }
];
