export type CreatorProductionSetupPresentationInput = {
  language: "en" | "tr";
  presentation: string;
  narrator: string;
  music: string;
  continuity: string;
  visualStyle?: string;
  musicConfirmationRequired: boolean;
};

export function createCreatorProductionSetupPresentation({
  language,
  presentation,
  narrator,
  music,
  continuity,
  visualStyle,
  musicConfirmationRequired,
}: CreatorProductionSetupPresentationInput) {
  const normalizedVisualStyle = visualStyle?.trim() || "";
  const visualStyleSummary = normalizedVisualStyle
    ? normalizedVisualStyle.length > 54
      ? `${normalizedVisualStyle.slice(0, 51)}…`
      : normalizedVisualStyle
    : language === "en"
      ? "Velto recommended"
      : "Velto önerisi";

  return {
    headline: `${presentation} · ${narrator} · ${language === "en" ? "Music" : "Müzik"} ${music} · ${continuity}`,
    visualStyleSummary,
    actionRequired: musicConfirmationRequired,
    customizeInitiallyOpen: musicConfirmationRequired,
    customizeStatus: musicConfirmationRequired
      ? language === "en" ? "Action required" : "Aksiyon gerekli"
      : language === "en" ? "Optional" : "İsteğe bağlı",
  } as const;
}
