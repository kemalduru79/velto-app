import type { CreatorQualityMode } from "./mediaRouting";

export type CreatorEditorialConstitution = {
  mission: string;
  audiencePromise: string;
  editorialPointOfView: string;
  evidencePolicy: "evidence_first";
  uncertaintyPolicy: "label_and_scope";
  counterEvidencePolicy: "seek_material_counterevidence";
  sensationalismPolicy: "no_overclaiming";
};

export type CreatorProfile = {
  brandName: string;
  brandVoice: string;
  defaultAudience: string;
  defaultVisualStyle: string;
  defaultCountry: string;
  defaultFormat: "short_form" | "youtube_video";
  defaultQualityMode: CreatorQualityMode;
  defaultCreditPreference: "efficient" | "balanced" | "premium";
  editorialConstitution: CreatorEditorialConstitution;
};

export const CREATOR_PROFILE_STORAGE_KEY = "velto.creator-profile.v1";

export const DEFAULT_CREATOR_EDITORIAL_CONSTITUTION: CreatorEditorialConstitution = {
  mission: "",
  audiencePromise: "",
  editorialPointOfView: "",
  evidencePolicy: "evidence_first",
  uncertaintyPolicy: "label_and_scope",
  counterEvidencePolicy: "seek_material_counterevidence",
  sensationalismPolicy: "no_overclaiming",
};

export const EMPTY_CREATOR_PROFILE: CreatorProfile = {
  brandName: "",
  brandVoice: "",
  defaultAudience: "",
  defaultVisualStyle: "",
  defaultCountry: "global",
  defaultFormat: "short_form",
  defaultQualityMode: "standard",
  defaultCreditPreference: "balanced",
  editorialConstitution: { ...DEFAULT_CREATOR_EDITORIAL_CONSTITUTION },
};

const clean = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

function parseCreatorEditorialConstitution(
  value: unknown,
): CreatorEditorialConstitution {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    mission: clean(source.mission, 500),
    audiencePromise: clean(source.audiencePromise, 400),
    editorialPointOfView: clean(source.editorialPointOfView, 500),
    evidencePolicy: "evidence_first",
    uncertaintyPolicy: "label_and_scope",
    counterEvidencePolicy: "seek_material_counterevidence",
    sensationalismPolicy: "no_overclaiming",
  };
}

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
    editorialConstitution: parseCreatorEditorialConstitution(source.editorialConstitution),
  };
}

export function createCreatorEditorialContext(profile: CreatorProfile) {
  const constitution = profile.editorialConstitution;
  const lines = [
    constitution.mission ? `Editorial mission: ${constitution.mission}` : "",
    constitution.audiencePromise ? `Audience promise: ${constitution.audiencePromise}` : "",
    constitution.editorialPointOfView
      ? `Editorial point of view: ${constitution.editorialPointOfView}`
      : "",
    "Evidence policy: ground factual claims in traceable evidence.",
    "Uncertainty policy: label and scope uncertainty rather than presenting it as certainty.",
    "Counter-evidence policy: seek material counter-evidence or alternative explanations.",
    "Sensationalism policy: do not overclaim beyond the available evidence.",
  ].filter(Boolean);

  return lines.join("\n");
}

export function hasCreatorProfileContext(profile: CreatorProfile) {
  return Boolean(
    profile.brandName ||
      profile.brandVoice ||
      profile.defaultAudience ||
      profile.defaultVisualStyle ||
      profile.editorialConstitution.mission ||
      profile.editorialConstitution.audiencePromise ||
      profile.editorialConstitution.editorialPointOfView,
  );
}
