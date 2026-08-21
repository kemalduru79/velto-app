const freezeNames = (...names) => Object.freeze(names);

export const PROVIDER_ENVIRONMENT = Object.freeze({
  openai: Object.freeze({
    apiKey: freezeNames("OPENAI_API_KEY"),
    model: freezeNames("OPENAI_MODEL"),
    creatorDirectorModel: freezeNames("OPENAI_CREATOR_DIRECTOR_MODEL"),
  }),
  runway: Object.freeze({
    apiKey: freezeNames(
      "RUNWAY_API_KEY",
      "RUNWAYML_API_SECRET",
      "RUNWAYML_API_KEY",
    ),
    videoModel: freezeNames("RUNWAY_VIDEO_MODEL"),
  }),
  veo: Object.freeze({
    apiKey: freezeNames("VEO_API_KEY", "GEMINI_API_KEY"),
    videoModel: freezeNames("VEO_VIDEO_MODEL"),
    videoResolution: freezeNames("VEO_VIDEO_RESOLUTION"),
  }),
  elevenlabs: Object.freeze({
    apiKey: freezeNames("ELEVENLABS_API_KEY"),
    trNarratorVoiceId: freezeNames("ELEVENLABS_TR_NARRATOR_VOICE_ID"),
    enNarratorVoiceId: freezeNames("ELEVENLABS_EN_NARRATOR_VOICE_ID"),
    trCharacterVoiceId: freezeNames(
      "ELEVENLABS_TR_CHARACTER_VOICE_ID",
      "ELEVENLABS_VOICE_ID",
    ),
    enCharacterVoiceId: freezeNames(
      "ELEVENLABS_EN_CHARACTER_VOICE_ID",
      "ELEVENLABS_VOICE_ID",
    ),
  }),
  epidemic: Object.freeze({
    apiKey: freezeNames("EPIDEMIC_SOUND_API_KEY"),
    acquisitionEnabled: freezeNames(
      "CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED",
    ),
  }),
});

export function resolveProviderEnvironmentValue(
  provider,
  key,
  environment = process.env,
) {
  const names = PROVIDER_ENVIRONMENT[provider]?.[key] || [];

  for (const name of names) {
    const value = environment[name]?.trim();
    if (value) return value;
  }

  return "";
}

export function isProviderConfigured(provider, environment = process.env) {
  return Boolean(
    resolveProviderEnvironmentValue(provider, "apiKey", environment),
  );
}
