export type CareerMissionLanguage = "en" | "tr";

export type CareerProfessionKey =
  | "astronaut"
  | "doctor"
  | "pilot"
  | "ai_engineer"
  | "cyber_detective"
  | string;

export type MentorTraitSignal =
  | "logic"
  | "empathy"
  | "courage"
  | "teamwork"
  | "creativity"
  | "focus";

export interface CareerMentorProfile {
  mentorName: string;
  missionAddress: string;
  identityLine: string;
  observationStyle: string;
  coreQuestion: string;
  pressurePrompt: string;
  reflectionSignals: MentorTraitSignal[];
}

export interface MentorReplyInput {
  language: CareerMissionLanguage;
  professionKey: CareerProfessionKey;
  mentorName: string;
  professionTitle: string;
  missionTitle: string;
  childMessage: string;
  turnIndex: number;
}

const mentorProfiles: Record<string, Record<CareerMissionLanguage, CareerMentorProfile>> = {
  astronaut: {
    en: {
      mentorName: "Commander Orion",
      missionAddress: "Commander",
      identityLine: "You are responsible for the crew before the mission objective.",
      observationStyle: "calm pressure reading, team safety, risk sequencing",
      coreQuestion: "What do you verify before making the next irreversible move?",
      pressurePrompt: "The station is waiting, but rushing can create a second emergency.",
      reflectionSignals: ["focus", "teamwork", "logic"],
    },
    tr: {
      mentorName: "Commander Orion",
      missionAddress: "Komutan",
      identityLine: "Görev hedefinden önce ekibin güvenliğinden sorumlusun.",
      observationStyle: "sakin baskı yönetimi, ekip güvenliği, risk sıralaması",
      coreQuestion: "Bir sonraki geri dönüşü zor hamleden önce neyi doğrularsın?",
      pressurePrompt: "İstasyon bekliyor, ama acele etmek ikinci bir acil durum yaratabilir.",
      reflectionSignals: ["focus", "teamwork", "logic"],
    },
  },
  doctor: {
    en: {
      mentorName: "Dr. Lyra",
      missionAddress: "Doctor",
      identityLine: "You protect the patient by staying calm, precise, and humane.",
      observationStyle: "empathy, prioritization, safe medical reasoning",
      coreQuestion: "Which sign do you check first, and how do you keep the patient calm?",
      pressurePrompt: "The room is tense, but your voice can stabilize the people around you.",
      reflectionSignals: ["empathy", "focus", "logic"],
    },
    tr: {
      mentorName: "Dr. Lyra",
      missionAddress: "Doktor",
      identityLine: "Hastayı sakin, dikkatli ve insani kalarak korursun.",
      observationStyle: "empati, önceliklendirme, güvenli tıbbi akıl yürütme",
      coreQuestion: "İlk hangi belirtiyi kontrol edersin ve hastayı nasıl sakin tutarsın?",
      pressurePrompt: "Oda gergin, ama ses tonun çevrendekileri dengeleyebilir.",
      reflectionSignals: ["empathy", "focus", "logic"],
    },
  },
  pilot: {
    en: {
      mentorName: "Captain Nova",
      missionAddress: "Pilot",
      identityLine: "You keep people safe by controlling speed, altitude, and communication.",
      observationStyle: "situational awareness, sequence discipline, calm command",
      coreQuestion: "What do you stabilize first: the aircraft, the route, or the cabin?",
      pressurePrompt: "A good pilot slows the problem down before the problem speeds everyone up.",
      reflectionSignals: ["focus", "courage", "logic"],
    },
    tr: {
      mentorName: "Captain Nova",
      missionAddress: "Pilot",
      identityLine: "Hızı, irtifayı ve iletişimi yöneterek insanları güvende tutarsın.",
      observationStyle: "durumsal farkındalık, sıra disiplini, sakin komuta",
      coreQuestion: "Önce neyi dengelersin: uçağı, rotayı mı, kabini mi?",
      pressurePrompt: "İyi bir pilot, problem herkesi hızlandırmadan önce problemi yavaşlatır.",
      reflectionSignals: ["focus", "courage", "logic"],
    },
  },
  ai_engineer: {
    en: {
      mentorName: "Mentor Ada",
      missionAddress: "Engineer",
      identityLine: "You build safe intelligence by asking what the system should never do.",
      observationStyle: "ethical reasoning, data caution, creative problem solving",
      coreQuestion: "Which risk would you test before trusting the model output?",
      pressurePrompt: "A smart model can still be unsafe if the human does not guide it well.",
      reflectionSignals: ["logic", "creativity", "focus"],
    },
    tr: {
      mentorName: "Mentor Ada",
      missionAddress: "Mühendis",
      identityLine: "Güvenli zekâyı, sistemin asla ne yapmaması gerektiğini sorarak kurarsın.",
      observationStyle: "etik akıl yürütme, veri dikkati, yaratıcı problem çözme",
      coreQuestion: "Model çıktısına güvenmeden önce hangi riski test edersin?",
      pressurePrompt: "Akıllı bir model, insan doğru yönlendirmezse hâlâ güvensiz olabilir.",
      reflectionSignals: ["logic", "creativity", "focus"],
    },
  },
  cyber_detective: {
    en: {
      mentorName: "Detective Nyx",
      missionAddress: "Detective",
      identityLine: "You follow evidence without frightening the people you are protecting.",
      observationStyle: "pattern recognition, cautious investigation, digital safety",
      coreQuestion: "Which clue do you verify before accusing the wrong signal?",
      pressurePrompt: "The trace is fading, but a rushed conclusion can hide the real intruder.",
      reflectionSignals: ["logic", "creativity", "focus"],
    },
    tr: {
      mentorName: "Detective Nyx",
      missionAddress: "Dedektif",
      identityLine: "Koruduğun insanları korkutmadan kanıtın izini sürersin.",
      observationStyle: "örüntü tanıma, dikkatli araştırma, dijital güvenlik",
      coreQuestion: "Yanlış sinyali suçlamadan önce hangi ipucunu doğrularsın?",
      pressurePrompt: "İz kayboluyor, ama acele bir sonuç gerçek saldırganı gizleyebilir.",
      reflectionSignals: ["logic", "creativity", "focus"],
    },
  },
};

export function getCareerMentorProfile(
  professionKey: CareerProfessionKey,
  language: CareerMissionLanguage,
  fallbackMentorName: string,
): CareerMentorProfile {
  const profile = mentorProfiles[professionKey]?.[language] ?? mentorProfiles.astronaut[language];

  return {
    ...profile,
    mentorName: fallbackMentorName || profile.mentorName,
  };
}

function detectDecisionSignal(message: string): MentorTraitSignal {
  const normalized = message.toLowerCase();

  if (/team|crew|patient|people|ekip|mürettebat|hasta|insan/.test(normalized)) {
    return "teamwork";
  }

  if (/calm|safe|protect|sakin|güven|koru/.test(normalized)) {
    return "empathy";
  }

  if (/check|verify|data|sensor|test|kontrol|doğrula|veri|sensör/.test(normalized)) {
    return "logic";
  }

  if (/risk|emergency|danger|manual|acil|tehlike|risk/.test(normalized)) {
    return "courage";
  }

  if (/new|different|creative|alternate|yeni|farklı|yaratıcı|alternatif/.test(normalized)) {
    return "creativity";
  }

  return "focus";
}

export function createCareerMentorReply(input: MentorReplyInput): string {
  const profile = getCareerMentorProfile(
    input.professionKey,
    input.language,
    input.mentorName,
  );
  const signal = detectDecisionSignal(input.childMessage);
  const signalLabel =
    input.language === "en"
      ? signal
      : ({
          logic: "mantık",
          empathy: "empati",
          courage: "cesaret",
          teamwork: "ekip bilinci",
          creativity: "yaratıcılık",
          focus: "odak",
        } satisfies Record<MentorTraitSignal, string>)[signal];

  if (input.language === "en") {
    if (input.turnIndex <= 1) {
      return `${profile.missionAddress}, I can see a ${signalLabel} signal in your answer. ${profile.pressurePrompt} ${profile.coreQuestion}`;
    }

    if (input.turnIndex === 2) {
      return `Good. Now I am watching how you connect your decision to people, risk and timing. Your ${professionTitleOrRole(input.professionTitle)} thinking is becoming more visible: ${profile.identityLine}`;
    }

    return `Mission log updated. I am not scoring a quiz answer; I am reading your judgment pattern. Keep going: name the risk, protect the right people, and explain the next move.`;
  }

  if (input.turnIndex <= 1) {
    return `${profile.missionAddress}, cevabında güçlü bir ${signalLabel} sinyali görüyorum. ${profile.pressurePrompt} ${profile.coreQuestion}`;
  }

  if (input.turnIndex === 2) {
    return `Güzel. Şimdi kararını insanlara, riske ve zamana nasıl bağladığını izliyorum. ${profile.identityLine}`;
  }

  return `Görev günlüğü güncellendi. Bir test cevabını puanlamıyorum; karar verme örüntünü okuyorum. Devam et: riski adlandır, doğru kişileri koru ve sonraki hamleyi açıkla.`;
}

function professionTitleOrRole(professionTitle: string): string {
  return professionTitle.trim() || "mission";
}
