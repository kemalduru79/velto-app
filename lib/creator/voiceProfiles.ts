// VELTO_VOICE_P1_3M
export type CreatorVoiceSelectionId =
  | "velto_balanced"
  | "velto_warm"
  | "velto_clear"
  | "velto_energetic"
  | "velto_authoritative";

export type CreatorVoiceSelection = {
  id: CreatorVoiceSelectionId;
  labelEn: string;
  labelTr: string;
  descriptionEn: string;
  descriptionTr: string;
  settings: {
    stability: number;
    similarityBoost: number;
    style: number;
    speed: number;
  };
};

export const CREATOR_VOICE_SELECTIONS: readonly CreatorVoiceSelection[] = [
  {
    id: "velto_balanced",
    labelEn: "Balanced",
    labelTr: "Dengeli",
    descriptionEn: "Natural, neutral delivery for most formats.",
    descriptionTr: "Çoğu format için doğal ve dengeli anlatım.",
    settings: { stability: 0.54, similarityBoost: 0.84, style: 0.28, speed: 0.98 },
  },
  {
    id: "velto_warm",
    labelEn: "Warm",
    labelTr: "Sıcak",
    descriptionEn: "Friendly and reassuring for stories, brands and explainers.",
    descriptionTr: "Hikâye, marka ve açıklayıcı içerikler için samimi ton.",
    settings: { stability: 0.58, similarityBoost: 0.86, style: 0.36, speed: 0.95 },
  },
  {
    id: "velto_clear",
    labelEn: "Clear",
    labelTr: "Net",
    descriptionEn: "Crisp articulation for education, reviews and tutorials.",
    descriptionTr: "Eğitim, inceleme ve rehber içerikleri için net artikülasyon.",
    settings: { stability: 0.62, similarityBoost: 0.88, style: 0.2, speed: 1 },
  },
  {
    id: "velto_energetic",
    labelEn: "Energetic",
    labelTr: "Enerjik",
    descriptionEn: "Faster, expressive delivery for hooks and short-form content.",
    descriptionTr: "Hook ve kısa format içerikleri için hızlı ve canlı anlatım.",
    settings: { stability: 0.4, similarityBoost: 0.84, style: 0.52, speed: 1.07 },
  },
  {
    id: "velto_authoritative",
    labelEn: "Authoritative",
    labelTr: "Otoriter",
    descriptionEn: "Controlled, confident delivery for business and documentary work.",
    descriptionTr: "İş ve belgesel içerikleri için kontrollü ve güven veren ton.",
    settings: { stability: 0.68, similarityBoost: 0.9, style: 0.22, speed: 0.93 },
  },
] as const;

const CREATOR_VOICE_SELECTION_ID_SET = new Set<CreatorVoiceSelectionId>(
  CREATOR_VOICE_SELECTIONS.map((profile) => profile.id),
);

export function normalizeCreatorVoiceSelectionId(
  value: unknown,
  fallback: CreatorVoiceSelectionId = "velto_balanced",
): CreatorVoiceSelectionId {
  return typeof value === "string" &&
    CREATOR_VOICE_SELECTION_ID_SET.has(value as CreatorVoiceSelectionId)
    ? (value as CreatorVoiceSelectionId)
    : fallback;
}

export function getCreatorVoiceSelection(value: unknown) {
  const id = normalizeCreatorVoiceSelectionId(value);
  return (
    CREATOR_VOICE_SELECTIONS.find((profile) => profile.id === id) ||
    CREATOR_VOICE_SELECTIONS[0]
  );
}

export function getCreatorVoiceSelectionLabel(
  value: unknown,
  language: "tr" | "en",
) {
  const profile = getCreatorVoiceSelection(value);
  return language === "en" ? profile.labelEn : profile.labelTr;
}
