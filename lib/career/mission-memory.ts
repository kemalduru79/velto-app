export type CareerMissionMemoryLanguage = "en" | "tr";

export type CareerMissionMemorySignal =
  | "safety"
  | "team"
  | "evidence"
  | "courage"
  | "creativity"
  | "reflection";

export interface CareerMissionMemoryInput {
  language: CareerMissionMemoryLanguage;
  professionTitle: string;
  missionTitle: string;
  mentorName: string;
  childMessages: string[];
}

export interface CareerMissionMemorySeed {
  id: string;
  label: string;
  title: string;
  description: string;
  signal: CareerMissionMemorySignal;
}

function detectSignal(message: string): CareerMissionMemorySignal {
  const normalized = message.toLowerCase();

  if (/team|crew|patient|people|together|ekip|mürettebat|hasta|insan|birlikte/.test(normalized)) {
    return "team";
  }

  if (/check|verify|data|sensor|test|evidence|kontrol|doğrula|veri|sensör|kanıt/.test(normalized)) {
    return "evidence";
  }

  if (/risk|emergency|danger|manual|return|acil|tehlike|risk|dön/.test(normalized)) {
    return "safety";
  }

  if (/new|different|creative|alternate|idea|yeni|farklı|yaratıcı|alternatif|fikir/.test(normalized)) {
    return "creativity";
  }

  if (/decide|lead|protect|brave|karar|lider|koru|cesur/.test(normalized)) {
    return "courage";
  }

  return "reflection";
}

function getSignalLabel(signal: CareerMissionMemorySignal, language: CareerMissionMemoryLanguage): string {
  const labels: Record<CareerMissionMemorySignal, { en: string; tr: string }> = {
    safety: { en: "Safety instinct", tr: "Güvenlik içgüdüsü" },
    team: { en: "Team protection", tr: "Ekip koruma" },
    evidence: { en: "Evidence thinking", tr: "Kanıt odaklı düşünme" },
    courage: { en: "Courage under pressure", tr: "Baskı altında cesaret" },
    creativity: { en: "Creative path", tr: "Yaratıcı yol" },
    reflection: { en: "Identity signal", tr: "Kimlik sinyali" },
  };

  return labels[signal][language];
}

export function createCareerMissionMemorySeeds(input: CareerMissionMemoryInput): CareerMissionMemorySeed[] {
  const { childMessages, language, mentorName, missionTitle, professionTitle } = input;

  return childMessages.slice(0, 4).map((message, index) => {
    const signal = detectSignal(message);
    const stepNumber = index + 1;

    return {
      id: `memory-seed-${stepNumber}-${signal}`,
      label:
        language === "en"
          ? `Mission memory ${stepNumber}`
          : `Görev anısı ${stepNumber}`,
      title: getSignalLabel(signal, language),
      description:
        language === "en"
          ? `${mentorName} noticed this ${professionTitle} signal during ${missionTitle}: “${message.slice(0, 110)}${message.length > 110 ? "..." : ""}”`
          : `${mentorName}, ${missionTitle} sırasında bu ${professionTitle} sinyalini fark etti: “${message.slice(0, 110)}${message.length > 110 ? "..." : ""}”`,
      signal,
    };
  });
}
