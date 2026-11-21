export const CREATOR_COST_CONFIG = {
  pricingAsOf: "2026-07-27",
  currency: "USD",
  runway: {
    creditUsd: 0.01,
    defaultModel: "gen4_turbo",
    gen4TurboCreditsPerSecond: 5,
    gen4TurboUsdPerSecond: 0.05,
    defaultSceneVideoSeconds: 7,
    defaultRunwaySceneVideoCostUsd: 0.35,
    gen45CreditsPerSecond: 12,
    gen45UsdPerSecond: 0.12,
    veo31FastNoAudioCreditsPerSecond: 10,
    veo31FastNoAudioUsdPerSecond: 0.1,
  },
  openaiImage: {
    // Backward-compatible default fields for existing cost consumers.
    model: "gpt-image-2",
    imageInputUsdPer1MTokens: 8,
    imageCachedInputUsdPer1MTokens: 2,
    imageOutputUsdPer1MTokens: 30,
    textInputUsdPer1MTokens: 5,
    textCachedInputUsdPer1MTokens: 1.25,
    creatorLab: {
      model: "gpt-image-2",
      snapshot: "gpt-image-2-2026-04-21",
      textInputUsdPer1MTokens: 5,
      textCachedInputUsdPer1MTokens: 1.25,
      imageInputUsdPer1MTokens: 8,
      imageCachedInputUsdPer1MTokens: 2,
      imageOutputUsdPer1MTokens: 30,
      mediumSquareOutputUsd: 0.053,
      mediumPortraitLandscapeOutputUsd: 0.041,
      highSquareOutputUsd: 0.211,
      highPortraitLandscapeOutputUsd: 0.165,
      cinematicRoutingNote:
        "Cinematic uses high quality, stronger continuity and up to two reference images. Settle from actual API usage.",
    },
    storyverseLegacy: {
      model: "gpt-image-1",
      note:
        "Storyverse routing remains unchanged in this sprint and must be migrated separately.",
    },
    note:
      "Output references exclude prompt and reference-image input. Actual cost must be settled from returned API usage.",
  },
  elevenLabs: {
    activeModel: "eleven_multilingual_v2",
    multilingualV2V3UsdPer1KCharacters: 0.1,
    flashTurboUsdPer1KCharacters: 0.05,
    musicUsdPerMinute: 0.3,
    soundEffectsUsdPerGeneration: 0.12,
  },
} as const;

export const CREATOR_DEFAULT_VIDEO_SCENE_COST_USD =
  CREATOR_COST_CONFIG.runway.defaultRunwaySceneVideoCostUsd;

export const CREATOR_COST_BASIS_LABEL =
  `Runway ${CREATOR_COST_CONFIG.runway.defaultModel}: $${CREATOR_COST_CONFIG.runway.gen4TurboUsdPerSecond.toFixed(2)}/sec; ` +
  `${CREATOR_COST_CONFIG.runway.defaultSceneVideoSeconds}s scene ≈ $${CREATOR_COST_CONFIG.runway.defaultRunwaySceneVideoCostUsd.toFixed(2)}. ` +
  `CreatorLab images use ${CREATOR_COST_CONFIG.openaiImage.creatorLab.snapshot}; image cost is token-based. ` +
  `ElevenLabs ${CREATOR_COST_CONFIG.elevenLabs.activeModel}: $${CREATOR_COST_CONFIG.elevenLabs.multilingualV2V3UsdPer1KCharacters.toFixed(2)}/1K chars.`;
