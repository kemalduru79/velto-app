export type CareerMissionLanguage = "en" | "tr";

export type CareerMissionConsequenceState = {
  crewTrust: number;
  oxygenStability: number;
  missionPressure: number;
  mentorConfidence: number;
  riskLevel: number;
};

export type CareerMissionConsequenceFrame = {
  id: string;
  turnIndex: number;
  eventTitle: string;
  worldEvent: string;
  cinematicCaption: string;
  visualTone: string;
  visualAccent: string;
  imageStatus: "ready_for_generation";
  imagePromptSlot: string;
  state: CareerMissionConsequenceState;
};

export const initialCareerMissionConsequenceState: CareerMissionConsequenceState = {
  crewTrust: 42,
  oxygenStability: 58,
  missionPressure: 32,
  mentorConfidence: 46,
  riskLevel: 28,
};

type ConsequenceInput = {
  language: CareerMissionLanguage;
  professionTitle: string;
  missionTitle: string;
  childMessage: string;
  turnIndex: number;
  previousState: CareerMissionConsequenceState;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function createImagePrompt({
  professionTitle,
  missionTitle,
  cinematicCaption,
  visualTone,
}: {
  professionTitle: string;
  missionTitle: string;
  cinematicCaption: string;
  visualTone: string;
}) {
  return [
    `Premium cinematic AI mission frame for a child-safe future role experience.`,
    `Profession: ${professionTitle}.`,
    `Mission: ${missionTitle}.`,
    `Moment: ${cinematicCaption}.`,
    `Visual tone: ${visualTone}.`,
    `No text overlays, no logos, emotionally warm, high-quality cinematic lighting.`,
  ].join(" ");
}

function getVisualAccent(visualTone: string) {
  const normalized = visualTone.toLowerCase();

  if (normalized.includes("red") || normalized.includes("alarm") || normalized.includes("acil")) {
    return "from-rose-500/30 via-orange-400/20 to-slate-950";
  }

  if (normalized.includes("warm") || normalized.includes("leadership") || normalized.includes("sıcak")) {
    return "from-amber-400/30 via-emerald-300/20 to-slate-950";
  }

  if (normalized.includes("analytical") || normalized.includes("analitik")) {
    return "from-sky-400/30 via-cyan-300/20 to-slate-950";
  }

  if (normalized.includes("calm") || normalized.includes("stabilizasyon") || normalized.includes("sakin")) {
    return "from-emerald-400/30 via-cyan-300/20 to-slate-950";
  }

  return "from-violet-400/30 via-cyan-300/20 to-slate-950";
}

export function createCareerMissionConsequence({
  language,
  professionTitle,
  missionTitle,
  childMessage,
  turnIndex,
  previousState,
}: ConsequenceInput): CareerMissionConsequenceFrame {
  const normalized = childMessage.toLowerCase();

  const protectsPeople = hasAny(normalized, [
    "crew",
    "team",
    "patient",
    "people",
    "child",
    "safe",
    "protect",
    "ekip",
    "mürettebat",
    "hasta",
    "insan",
    "güven",
    "koru",
  ]);

  const checksData = hasAny(normalized, [
    "check",
    "verify",
    "confirm",
    "sensor",
    "data",
    "oxygen",
    "scan",
    "kontrol",
    "doğrula",
    "sensör",
    "veri",
    "oksijen",
    "tara",
  ]);

  const rushesAction = hasAny(normalized, [
    "immediately",
    "quick",
    "now",
    "activate",
    "manual",
    "hızlı",
    "hemen",
    "derhal",
    "aktif",
    "manuel",
  ]);

  const communicates = hasAny(normalized, [
    "tell",
    "ask",
    "communicate",
    "explain",
    "call",
    "söyle",
    "sor",
    "iletişim",
    "açıkla",
    "ara",
  ]);

  const nextState: CareerMissionConsequenceState = {
    crewTrust: clamp(previousState.crewTrust + (protectsPeople ? 12 : 2) + (communicates ? 6 : 0)),
    oxygenStability: clamp(previousState.oxygenStability + (checksData ? 10 : -3) + (rushesAction ? -6 : 0)),
    missionPressure: clamp(previousState.missionPressure + (rushesAction ? 10 : -4) - (checksData ? 3 : 0)),
    mentorConfidence: clamp(previousState.mentorConfidence + (checksData ? 8 : 2) + (protectsPeople ? 5 : 0)),
    riskLevel: clamp(previousState.riskLevel + (rushesAction ? 10 : 1) - (checksData ? 5 : 0) - (protectsPeople ? 2 : 0)),
  };

  const profession = professionTitle.toLowerCase();
  const isDoctor = profession.includes("doctor") || profession.includes("doktor");
  const isPilot = profession.includes("pilot");
  const isCyber = profession.includes("cyber") || profession.includes("detective") || profession.includes("dedektif");
  const isEngineer = profession.includes("engineer") || profession.includes("mühendis");

  let eventTitle = language === "en" ? "Mission state changed" : "Görev durumu değişti";
  let worldEvent = language === "en"
    ? "The mission world reacts to the child’s command."
    : "Görev dünyası çocuğun komutuna tepki verdi.";
  let cinematicCaption = language === "en"
    ? "The command channel brightens as the team waits for the next safe move."
    : "Ekip bir sonraki güvenli hamleyi beklerken komut kanalı aydınlanır.";
  let visualTone = language === "en" ? "focused command center tension" : "odaklı komuta merkezi gerilimi";

  if (protectsPeople && checksData) {
    eventTitle = language === "en" ? "Team confidence increased" : "Ekip güveni yükseldi";
    worldEvent = language === "en"
      ? "The crew hears a calm plan: protect people first, then verify the data."
      : "Ekip sakin bir plan duydu: önce insanları koru, sonra veriyi doğrula.";
    cinematicCaption = isDoctor
      ? language === "en"
        ? "Inside the medical bay, the patient team steadies as the first checks begin."
        : "Medikal alanda ilk kontroller başlarken ekip sakinleşir."
      : isPilot
        ? language === "en"
          ? "The cockpit steadies as the young pilot checks the instruments before acting."
          : "Genç pilot harekete geçmeden önce göstergeleri kontrol ederken kokpit dengelenir."
        : isCyber
          ? language === "en"
            ? "The threat grid slows as the detective verifies the signal before accusing it."
            : "Dedektif sinyali suçlamadan önce doğrularken tehdit ağı yavaşlar."
          : isEngineer
            ? language === "en"
              ? "The model console pauses as the engineer checks safety before trusting the output."
              : "Mühendis çıktıya güvenmeden önce güvenliği kontrol ederken model konsolu duraksar."
            : language === "en"
              ? "Inside Lunar Station Helios, the crew regains focus as oxygen data is checked."
              : "Lunar Station Helios içinde oksijen verisi kontrol edilirken ekip yeniden odaklanır.";
    visualTone = language === "en" ? "calm heroic stabilization" : "sakin kahramanca stabilizasyon";
  } else if (protectsPeople) {
    eventTitle = language === "en" ? "Crew morale improved" : "Ekip morali yükseldi";
    worldEvent = language === "en"
      ? "The team feels protected because the first command puts people before the objective."
      : "İlk komut hedeflerden önce insanları koyduğu için ekip kendini güvende hisseder.";
    cinematicCaption = language === "en"
      ? "Faces around the mission room soften as the young leader protects the team first."
      : "Genç lider önce ekibi korurken görev odasındaki yüzler sakinleşir.";
    visualTone = language === "en" ? "warm leadership under pressure" : "baskı altında sıcak liderlik";
  } else if (checksData) {
    eventTitle = language === "en" ? "System clarity improved" : "Sistem netliği arttı";
    worldEvent = language === "en"
      ? "The mission slows down as the child chooses to verify the signal before acting."
      : "Çocuk harekete geçmeden önce sinyali doğrulamayı seçtiği için görev yavaşlar.";
    cinematicCaption = language === "en"
      ? "A glowing data panel becomes clearer as the first safe check is completed."
      : "İlk güvenli kontrol tamamlanırken parlak veri paneli netleşir.";
    visualTone = language === "en" ? "precise analytical focus" : "net analitik odak";
  } else if (rushesAction) {
    eventTitle = language === "en" ? "Risk level increased" : "Risk seviyesi yükseldi";
    worldEvent = language === "en"
      ? "The fast command creates urgency. The world responds with a sharper warning signal."
      : "Hızlı komut aciliyet yarattı. Dünya daha keskin bir uyarı sinyaliyle tepki verdi.";
    cinematicCaption = language === "en"
      ? "Warning lights pulse across the console as the mission accelerates too quickly."
      : "Görev fazla hızlanırken konsolda uyarı ışıkları yanıp söner.";
    visualTone = language === "en" ? "urgent red alert tension" : "acil kırmızı alarm gerilimi";
  } else if (communicates) {
    eventTitle = language === "en" ? "Communication channel opened" : "İletişim kanalı açıldı";
    worldEvent = language === "en"
      ? "The team receives direction. The mission becomes easier to coordinate."
      : "Ekip yönlendirme aldı. Görevi koordine etmek kolaylaştı.";
    cinematicCaption = language === "en"
      ? "A clear voice moves through the command channel as the team prepares to act together."
      : "Ekip birlikte hareket etmeye hazırlanırken komut kanalından net bir ses yayılır.";
    visualTone = language === "en" ? "clear coordinated teamwork" : "net koordineli ekip çalışması";
  }

  return {
    id: `consequence-${Date.now()}-${turnIndex}`,
    turnIndex,
    eventTitle,
    worldEvent,
    cinematicCaption,
    visualTone,
    visualAccent: getVisualAccent(visualTone),
    imageStatus: "ready_for_generation",
    imagePromptSlot: createImagePrompt({
      professionTitle,
      missionTitle,
      cinematicCaption,
      visualTone,
    }),
    state: nextState,
  };
}
