import type { CreatorPlatformId } from "./platformPresets";

export type CreatorOutcome =
  | "short"
  | "long_form"
  | "explainer"
  | "promotion";

export type CreatorOutcomeLanguage = "tr" | "en";

export type CreatorOutcomeDefinition = {
  value: CreatorOutcome;
  label: Record<CreatorOutcomeLanguage, string>;
  description: Record<CreatorOutcomeLanguage, string>;
  defaults: {
    format: "short_form" | "youtube_video";
    durationPreset: "short_30" | "short_60" | "video_180" | "video_300";
    durationSeconds: 30 | 60 | 180 | 300;
    targetPlatforms: CreatorPlatformId[];
    contentType?: "educational_explainer" | "social_campaign";
  };
};

const SHORT_FORM_PLATFORMS: CreatorOutcomeDefinition["defaults"]["targetPlatforms"] = [
  "youtube_shorts",
  "instagram_reels",
  "tiktok",
];

export const CREATOR_OUTCOME_DEFINITIONS: readonly CreatorOutcomeDefinition[] = [
  {
    value: "short",
    label: { tr: "Kısa Video", en: "Short Video" },
    description: {
      tr: "Hızlı, dikey ve sosyal akışlara uygun içerik.",
      en: "Fast, vertical content made for social feeds.",
    },
    defaults: {
      format: "short_form",
      durationPreset: "short_60",
      durationSeconds: 60,
      targetPlatforms: [...SHORT_FORM_PLATFORMS],
    },
  },
  {
    value: "long_form",
    label: { tr: "Uzun Video", en: "Long-form Video" },
    description: {
      tr: "Derinlikli ve yapılandırılmış uzun anlatım.",
      en: "A structured, longer story with room for depth.",
    },
    defaults: {
      // Compatibility value only; the outcome remains platform-neutral.
      format: "youtube_video",
      durationPreset: "video_300",
      durationSeconds: 300,
      targetPlatforms: ["youtube", "linkedin"],
    },
  },
  {
    value: "explainer",
    label: { tr: "Açıklayıcı Video", en: "Explainer" },
    description: {
      tr: "Bir konuyu anlaşılır adımlarla öğret veya açıkla.",
      en: "Teach or clarify a topic in easy-to-follow steps.",
    },
    defaults: {
      contentType: "educational_explainer",
      format: "youtube_video",
      durationPreset: "video_180",
      durationSeconds: 180,
      targetPlatforms: ["youtube", "linkedin"],
    },
  },
  {
    value: "promotion",
    label: { tr: "Tanıtım / Promosyon", en: "Promotion" },
    description: {
      tr: "Bir ürün, marka veya kampanya için kısa tanıtım.",
      en: "A concise launch, brand, or campaign promotion.",
    },
    defaults: {
      contentType: "social_campaign",
      format: "short_form",
      durationPreset: "short_30",
      durationSeconds: 30,
      targetPlatforms: [...SHORT_FORM_PLATFORMS],
    },
  },
] as const;

export function getCreatorOutcomeDefinition(outcome: CreatorOutcome) {
  return CREATOR_OUTCOME_DEFINITIONS.find((definition) => definition.value === outcome)!;
}

export function normalizeCreatorOutcome(value: unknown): CreatorOutcome | undefined {
  return CREATOR_OUTCOME_DEFINITIONS.some((definition) => definition.value === value)
    ? (value as CreatorOutcome)
    : undefined;
}
