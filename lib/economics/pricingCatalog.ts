export const CREATOR_ECONOMICS_PRICING_VERSION = "creator-economics-2026-08-22";
export const CREATOR_ECONOMICS_PRICING_AS_OF = "2026-08-22";

export const CREATOR_PROVIDER_PRICING = {
  openaiText: {
    "gpt-4.1-mini": { inputPer1M: 0.4, cachedInputPer1M: 0.1, outputPer1M: 1.6 },
    "gpt-5-mini": { inputPer1M: 0.25, cachedInputPer1M: 0.025, outputPer1M: 2 },
  },
  openaiImage: {
    "gpt-image-2": { textInputPer1M: 5, cachedTextInputPer1M: 1.25, imageInputPer1M: 8, cachedImageInputPer1M: 2, imageOutputPer1M: 30 },
    "gpt-image-2-2026-04-21": { textInputPer1M: 5, cachedTextInputPer1M: 1.25, imageInputPer1M: 8, cachedImageInputPer1M: 2, imageOutputPer1M: 30 },
  },
  elevenLabs: {
    eleven_multilingual_v2: { per1KCharacters: 0.1 },
    eleven_multilingual_v3: { per1KCharacters: 0.1 },
    eleven_flash_v2: { per1KCharacters: 0.05 },
    eleven_flash_v2_5: { per1KCharacters: 0.05 },
    eleven_turbo_v2: { per1KCharacters: 0.05 },
    eleven_turbo_v2_5: { per1KCharacters: 0.05 },
  },
  runway: {
    gen4_turbo: { perGeneratedSecond: 0.05 },
    "gen4.5": { perGeneratedSecond: 0.12 },
  },
} as const;
