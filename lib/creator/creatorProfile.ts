import type { CreatorQualityMode } from "./mediaRouting";

export type CreatorProfile = {
  brandName: string;
  brandVoice: string;
  defaultAudience: string;
  defaultVisualStyle: string;
  defaultCountry: string;
  defaultFormat: "short_form" | "youtube_video";
  defaultQualityMode: CreatorQualityMode;
  defaultCreditPreference: "efficient" | "balanced" | "premium";
};

export const CREATOR_PROFILE_STORAGE_KEY = "velto.creator-profile.v1";

export const EMPTY_CREATOR_PROFILE: CreatorProfile = {
  brandName: "",
  brandVoice: "",
  defaultAudience: "",
  defaultVisualStyle: "",
  defaultCountry: "global",
  defaultFormat: "short_form",
  defaultQualityMode: "standard",
  defaultCreditPreference: "balanced",
};

const clean = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export function parseCreatorProfile(value: unknown): CreatorProfile {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const format = source.defaultFormat === "youtube_video" ? "youtube_video" : "short_form";
  const qualityModes: CreatorQualityMode[] = ["draft", "standard", "pro", "cinematic"];
  const qualityMode = qualityModes.includes(source.defaultQualityMode as CreatorQualityMode)
    ? source.defaultQualityMode as CreatorQualityMode
    : "standard";
  const creditPreference = ["efficient", "balanced", "premium"].includes(source.defaultCreditPreference as string)
    ? source.defaultCreditPreference as CreatorProfile["defaultCreditPreference"]
    : "balanced";

  return {
    brandName: clean(source.brandName, 80),
    brandVoice: clean(source.brandVoice, 240),
    defaultAudience: clean(source.defaultAudience, 180),
    defaultVisualStyle: clean(source.defaultVisualStyle, 240),
    defaultCountry: clean(source.defaultCountry, 80) || "global",
    defaultFormat: format,
    defaultQualityMode: qualityMode,
    defaultCreditPreference: creditPreference,
  };
}

export function hasCreatorProfileContext(profile: CreatorProfile) {
  return Boolean(
    profile.brandName || profile.brandVoice || profile.defaultAudience || profile.defaultVisualStyle,
  );
}
