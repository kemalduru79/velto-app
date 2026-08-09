export const CREATOR_PLATFORM_IDS = [
  "youtube",
  "youtube_shorts",
  "instagram_reels",
  "tiktok",
  "linkedin",
] as const;

export type CreatorPlatformId = (typeof CREATOR_PLATFORM_IDS)[number];
export type CreatorPrimaryFormat = "short_form" | "youtube_video";
export type CreatorAspectRatio = "9:16" | "16:9";
export type CreatorPlatformLanguage = "tr" | "en";
export type CreatorLocalizedPlatformCopy = Record<CreatorPlatformLanguage, string>;

export type CreatorPlatformPreset = {
  platform: CreatorPlatformId;
  label: CreatorLocalizedPlatformCopy;
  guidance: CreatorLocalizedPlatformCopy;
  recommendedAspectRatio: CreatorAspectRatio;
  preferredFormat: CreatorPrimaryFormat;
  captionPreset: CreatorLocalizedPlatformCopy;
  metadataPreset: CreatorLocalizedPlatformCopy;
};

export const CREATOR_PLATFORM_PRESETS: Record<CreatorPlatformId, CreatorPlatformPreset> = {
  youtube: {
    platform: "youtube",
    label: { tr: "YouTube", en: "YouTube" },
    guidance: {
      tr: "Uzun format yayın paketi.",
      en: "Long-form publishing package.",
    },
    recommendedAspectRatio: "16:9",
    preferredFormat: "youtube_video",
    captionPreset: {
      tr: "Açıklama / uzun format yayın metni",
      en: "Description / long-form publishing copy",
    },
    metadataPreset: {
      tr: "Başlık + açıklama + thumbnail + bölümler",
      en: "Title + description + thumbnail + chapters",
    },
  },
  youtube_shorts: {
    platform: "youtube_shorts",
    label: { tr: "YouTube Shorts", en: "YouTube Shorts" },
    guidance: { tr: "Dikey kısa video paketi.", en: "Vertical short-form package." },
    recommendedAspectRatio: "9:16",
    preferredFormat: "short_form",
    captionPreset: { tr: "Kısa metin + hashtag'ler", en: "Short caption + hashtags" },
    metadataPreset: {
      tr: "Kısa format yayın metadatası",
      en: "Short-form publishing metadata",
    },
  },
  instagram_reels: {
    platform: "instagram_reels",
    label: { tr: "Instagram Reels", en: "Instagram Reels" },
    guidance: { tr: "Mobil öncelikli Reels paketi.", en: "Mobile-first Reels package." },
    recommendedAspectRatio: "9:16",
    preferredFormat: "short_form",
    captionPreset: { tr: "Kısa metin + hashtag'ler", en: "Short caption + hashtags" },
    metadataPreset: { tr: "Reels yayın metni", en: "Reels publishing copy" },
  },
  tiktok: {
    platform: "tiktok",
    label: { tr: "TikTok", en: "TikTok" },
    guidance: { tr: "Hızlı, dikey yayın paketi.", en: "Fast, vertical publishing package." },
    recommendedAspectRatio: "9:16",
    preferredFormat: "short_form",
    captionPreset: { tr: "Kısa metin + hashtag'ler", en: "Short caption + hashtags" },
    metadataPreset: { tr: "TikTok yayın metni", en: "TikTok publishing copy" },
  },
  linkedin: {
    platform: "linkedin",
    label: { tr: "LinkedIn", en: "LinkedIn" },
    guidance: { tr: "Profesyonel yayın paketi.", en: "Professional publishing package." },
    recommendedAspectRatio: "16:9",
    preferredFormat: "youtube_video",
    captionPreset: { tr: "Profesyonel gönderi metni", en: "Professional post copy" },
    metadataPreset: { tr: "Profesyonel yayın metni", en: "Professional publishing copy" },
  },
};

export type CreatorPlatformOutputPlanItem = {
  platform: CreatorPlatformId;
  recommendedAspectRatio: CreatorAspectRatio;
  primaryAspectRatio: CreatorAspectRatio;
  needsAdaptation: boolean;
  durationSec: number;
  captionPreset: CreatorLocalizedPlatformCopy;
  metadataPreset: CreatorLocalizedPlatformCopy;
};

export type CreatorPlatformOutputPlan = CreatorPlatformOutputPlanItem[];

export function createCreatorPlatformOutputPlan({
  targetPlatforms,
  primaryFormat,
  durationSec,
}: {
  targetPlatforms: CreatorPlatformId[];
  primaryFormat: CreatorPrimaryFormat;
  durationSec: number;
}): CreatorPlatformOutputPlan {
  const primaryAspectRatio: CreatorAspectRatio =
    primaryFormat === "short_form" ? "9:16" : "16:9";

  return targetPlatforms.map((platform) => {
    const preset = CREATOR_PLATFORM_PRESETS[platform];
    return {
      platform,
      recommendedAspectRatio: preset.recommendedAspectRatio,
      primaryAspectRatio,
      needsAdaptation: preset.recommendedAspectRatio !== primaryAspectRatio,
      durationSec,
      captionPreset: preset.captionPreset,
      metadataPreset: preset.metadataPreset,
    };
  });
}
