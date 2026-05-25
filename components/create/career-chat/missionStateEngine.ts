export type MissionBranchState = "SAFE" | "UNCERTAIN" | "RISKY";

export type MentorMood =
  | "calm"
  | "focused"
  | "concerned"
  | "urgent"
  | "respectful";

export type MissionPhase =
  | "arrival"
  | "assessment"
  | "pressure-rise"
  | "critical-window"
  | "stabilizing"
  | "archive-ready";

export type MissionRuntimeState = {
  missionPressure: number;
  crewTrust: number;
  missionStability: number;
  mentorMood: MentorMood;
  missionPhase: MissionPhase;
  signalStability: number;
  lastRuntimeNote: string;
};

type RuntimeInput = {
  userInput: string;
  branchState: MissionBranchState;
  turnCount: number;
  currentRuntime: MissionRuntimeState;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export function buildInitialMissionRuntimeState(): MissionRuntimeState {
  return {
    missionPressure: 32,
    crewTrust: 44,
    missionStability: 38,
    mentorMood: "focused",
    missionPhase: "arrival",
    signalStability: 62,
    lastRuntimeNote: "Mission channel opened.",
  };
}

export function evaluateMissionRuntime({
  userInput,
  branchState,
  turnCount,
  currentRuntime,
}: RuntimeInput): MissionRuntimeState {
  const normalized = userInput.toLowerCase();

  const protectsPeople =
    normalized.includes("crew") ||
    normalized.includes("team") ||
    normalized.includes("people") ||
    normalized.includes("calm") ||
    normalized.includes("safe") ||
    normalized.includes("ekip") ||
    normalized.includes("mürettebat") ||
    normalized.includes("insan") ||
    normalized.includes("sakin") ||
    normalized.includes("güven");

  const verifiesEvidence =
    normalized.includes("check") ||
    normalized.includes("verify") ||
    normalized.includes("confirm") ||
    normalized.includes("compare") ||
    normalized.includes("sensor") ||
    normalized.includes("data") ||
    normalized.includes("kontrol") ||
    normalized.includes("doğrula") ||
    normalized.includes("karşılaştır") ||
    normalized.includes("sensör") ||
    normalized.includes("veri");

  const rushes =
    normalized.includes("immediately") ||
    normalized.includes("quick") ||
    normalized.includes("now") ||
    normalized.includes("hemen") ||
    normalized.includes("hızlı") ||
    normalized.includes("derhal");

  const branchPressureDelta =
    branchState === "RISKY" ? 13 : branchState === "SAFE" ? -8 : 4;
  const branchTrustDelta =
    branchState === "SAFE" ? 10 : branchState === "RISKY" ? -6 : 2;
  const branchStabilityDelta =
    branchState === "SAFE" ? 11 : branchState === "RISKY" ? -9 : 3;
  const branchSignalDelta =
    branchState === "SAFE" ? 8 : branchState === "RISKY" ? -12 : -2;

  const missionPressure = clamp(
    currentRuntime.missionPressure +
      branchPressureDelta +
      (rushes ? 8 : 0) -
      (protectsPeople ? 4 : 0) -
      (verifiesEvidence ? 3 : 0),
  );

  const crewTrust = clamp(
    currentRuntime.crewTrust +
      branchTrustDelta +
      (protectsPeople ? 8 : 0) +
      (verifiesEvidence ? 3 : 0) -
      (rushes ? 5 : 0),
  );

  const missionStability = clamp(
    currentRuntime.missionStability +
      branchStabilityDelta +
      (verifiesEvidence ? 8 : 0) +
      (protectsPeople ? 3 : 0) -
      (rushes ? 6 : 0),
  );

  const signalStability = clamp(
    currentRuntime.signalStability + branchSignalDelta + (verifiesEvidence ? 4 : 0),
  );

  const mentorMood = resolveMentorMood({
    missionPressure,
    crewTrust,
    missionStability,
    branchState,
  });

  const missionPhase = resolveMissionPhase({
    turnCount,
    branchState,
    missionPressure,
    missionStability,
  });

  return {
    missionPressure,
    crewTrust,
    missionStability,
    mentorMood,
    missionPhase,
    signalStability,
    lastRuntimeNote: buildRuntimeNote({
      branchState,
      mentorMood,
      missionPhase,
      protectsPeople,
      verifiesEvidence,
      rushes,
    }),
  };
}

function resolveMentorMood({
  missionPressure,
  crewTrust,
  missionStability,
  branchState,
}: {
  missionPressure: number;
  crewTrust: number;
  missionStability: number;
  branchState: MissionBranchState;
}): MentorMood {
  if (branchState === "RISKY" || missionPressure >= 70) return "urgent";
  if (missionStability <= 32 || crewTrust <= 35) return "concerned";
  if (branchState === "SAFE" && crewTrust >= 62) return "respectful";
  if (missionPressure <= 38 && missionStability >= 55) return "calm";
  return "focused";
}

function resolveMissionPhase({
  turnCount,
  branchState,
  missionPressure,
  missionStability,
}: {
  turnCount: number;
  branchState: MissionBranchState;
  missionPressure: number;
  missionStability: number;
}): MissionPhase {
  if (turnCount >= 4) return "archive-ready";
  if (turnCount >= 3) return "critical-window";
  if (branchState === "RISKY" || missionPressure >= 62) return "pressure-rise";
  if (branchState === "SAFE" && missionStability >= 54) return "stabilizing";
  if (turnCount >= 1) return "assessment";
  return "arrival";
}

function buildRuntimeNote({
  branchState,
  mentorMood,
  missionPhase,
  protectsPeople,
  verifiesEvidence,
  rushes,
}: {
  branchState: MissionBranchState;
  mentorMood: MentorMood;
  missionPhase: MissionPhase;
  protectsPeople: boolean;
  verifiesEvidence: boolean;
  rushes: boolean;
}) {
  if (rushes || branchState === "RISKY") return "Pressure rose after a fast command.";
  if (protectsPeople && verifiesEvidence) return "The command protected people and requested evidence.";
  if (protectsPeople) return "The crew reacted to a people-first command.";
  if (verifiesEvidence) return "The channel stabilized around a verification request.";
  return `Runtime shifted to ${missionPhase} with ${mentorMood} mentor tone.`;
}

export function getMentorPresenceDelayFromRuntime(runtime: MissionRuntimeState) {
  if (runtime.mentorMood === "urgent") return 620;
  if (runtime.mentorMood === "concerned") return 820;
  if (runtime.mentorMood === "respectful") return 1280;
  if (runtime.mentorMood === "calm") return 1180;
  return 980;
}

export function getCrewRelayDelayFromRuntime(runtime: MissionRuntimeState) {
  if (runtime.signalStability <= 38) return 360;
  if (runtime.mentorMood === "urgent") return 420;
  if (runtime.mentorMood === "respectful") return 780;
  return 560;
}

export function getMissionRuntimeLabel(runtime: MissionRuntimeState, isTurkish: boolean) {
  if (runtime.mentorMood === "urgent") {
    return isTurkish ? "Hat sıkıştı." : "Line tightened.";
  }

  if (runtime.mentorMood === "concerned") {
    return isTurkish ? "Orion sessizleşti." : "Orion went quiet.";
  }

  if (runtime.mentorMood === "respectful") {
    return isTurkish ? "Orion tonu fark etti." : "Orion caught the tone.";
  }

  if (runtime.mentorMood === "calm") {
    return isTurkish ? "Kanal sakin." : "Channel steady.";
  }

  return isTurkish ? "Komut Merkezi dinliyor." : "Mission Control is listening.";
}


export function getRuntimeSignalPrelude(runtime: MissionRuntimeState, isTurkish: boolean) {
  if (runtime.signalStability <= 34) {
    return isTurkish ? "Sinyal kesiliyor." : "Signal breaking.";
  }

  if (runtime.missionPhase === "pressure-rise") {
    return isTurkish ? "Baskı artıyor." : "Pressure rising.";
  }

  if (runtime.missionPhase === "stabilizing") {
    return isTurkish ? "Kanal toparlanıyor." : "Channel settling.";
  }

  if (runtime.mentorMood === "respectful") {
    return isTurkish ? "İyi ton." : "Good tone.";
  }

  if (runtime.mentorMood === "concerned") {
    return isTurkish ? "Güven kırılgan." : "Trust is fragile.";
  }

  return isTurkish ? "Kanal açık." : "Channel open.";
}

export function getCrewRuntimePrefix(runtime: MissionRuntimeState, isTurkish: boolean) {
  if (runtime.signalStability <= 34) {
    return isTurkish ? "[Kesik sinyal] Sesim geliyor mu?" : "[Broken signal] Do you copy?";
  }

  if (runtime.crewTrust >= 66) {
    return isTurkish ? "[Daha sakin kanal] Rapor netleşti." : "[Steadier channel] Report is clearer.";
  }

  if (runtime.missionPressure >= 68) {
    return isTurkish ? "[Hızlı aktarım] Kısa geçiyorum." : "[Fast relay] Keeping it short.";
  }

  if (runtime.missionStability >= 58) {
    return isTurkish ? "[Sistem toparlanıyor] Yeni okuma geldi." : "[Recovering line] New reading in.";
  }

  return isTurkish ? "[Açık kanal] Rapor geliyor." : "[Open channel] Report coming through.";
}

export function getMentorRuntimeDirective(runtime: MissionRuntimeState, isTurkish: boolean) {
  if (runtime.mentorMood === "urgent") {
    return isTurkish ? "Riski daralt. Sonra karar ver." : "Narrow the risk. Then decide.";
  }

  if (runtime.mentorMood === "concerned") {
    return isTurkish ? "Ekip netlik bekliyor." : "The crew needs clarity.";
  }

  if (runtime.mentorMood === "respectful") {
    return isTurkish ? "Bunu koru." : "Hold that.";
  }

  if (runtime.mentorMood === "calm") {
    return isTurkish ? "Sakinliği net kontrole çevir." : "Turn calm into one clear check.";
  }

  return isTurkish ? "Ritmi koru." : "Hold the rhythm.";
}
