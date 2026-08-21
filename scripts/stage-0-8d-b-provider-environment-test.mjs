import assert from "node:assert/strict";
import fs from "node:fs";

import {
  PROVIDER_ENVIRONMENT,
  isProviderConfigured,
  resolveProviderEnvironmentValue,
} from "../lib/runtime/providerEnvironment.mjs";

const read = (file) => fs.readFileSync(file, "utf8");
const sentinel = (label) => `stage-08d-b-${label}`;
const isAcquisitionEnabled = (environment) =>
  resolveProviderEnvironmentValue(
    "epidemic",
    "acquisitionEnabled",
    environment,
  ) === "true";

assert.deepEqual(PROVIDER_ENVIRONMENT.runway.apiKey, [
  "RUNWAY_API_KEY",
  "RUNWAYML_API_SECRET",
  "RUNWAYML_API_KEY",
]);
assert.deepEqual(PROVIDER_ENVIRONMENT.veo.apiKey, [
  "VEO_API_KEY",
  "GEMINI_API_KEY",
]);

for (const [name, environment] of [
  ["canonical", { RUNWAY_API_KEY: sentinel("runway-canonical") }],
  ["secret alias", { RUNWAYML_API_SECRET: sentinel("runway-secret") }],
  ["key alias", { RUNWAYML_API_KEY: sentinel("runway-key") }],
]) {
  assert.equal(isProviderConfigured("runway", environment), true, name);
}
assert.equal(isProviderConfigured("runway", {}), false);
assert.equal(
  resolveProviderEnvironmentValue("runway", "apiKey", {
    RUNWAY_API_KEY: sentinel("runway-canonical"),
    RUNWAYML_API_SECRET: sentinel("runway-secret"),
    RUNWAYML_API_KEY: sentinel("runway-key"),
  }),
  sentinel("runway-canonical"),
);

assert.equal(
  resolveProviderEnvironmentValue("veo", "apiKey", {
    VEO_API_KEY: sentinel("veo-canonical"),
    GEMINI_API_KEY: sentinel("veo-alias"),
  }),
  sentinel("veo-canonical"),
);
assert.equal(
  resolveProviderEnvironmentValue("veo", "apiKey", {
    GEMINI_API_KEY: sentinel("veo-alias"),
  }),
  sentinel("veo-alias"),
);
assert.equal(isProviderConfigured("veo", {}), false);

assert.equal(
  isProviderConfigured("elevenlabs", {
    ELEVENLABS_API_KEY: sentinel("voice-key"),
  }),
  true,
);
assert.equal(
  isProviderConfigured("elevenlabs", {
    ELEVENLABS_VOICE_ID: sentinel("voice-id-only"),
  }),
  false,
);
assert.equal(
  resolveProviderEnvironmentValue("elevenlabs", "enNarratorVoiceId", {
    ELEVENLABS_EN_NARRATOR_VOICE_ID: sentinel("narrator"),
    ELEVENLABS_VOICE_ID: sentinel("generic"),
  }),
  sentinel("narrator"),
);
assert.equal(
  resolveProviderEnvironmentValue("elevenlabs", "enNarratorVoiceId", {
    ELEVENLABS_VOICE_ID: sentinel("generic"),
  }),
  "",
);
assert.equal(
  resolveProviderEnvironmentValue("elevenlabs", "trCharacterVoiceId", {
    ELEVENLABS_TR_CHARACTER_VOICE_ID: sentinel("character"),
    ELEVENLABS_VOICE_ID: sentinel("generic"),
  }),
  sentinel("character"),
);
assert.equal(
  resolveProviderEnvironmentValue("elevenlabs", "trCharacterVoiceId", {
    ELEVENLABS_VOICE_ID: sentinel("generic"),
  }),
  sentinel("generic"),
);

assert.equal(
  isProviderConfigured("epidemic", {
    EPIDEMIC_SOUND_API_KEY: sentinel("music-key"),
  }),
  true,
);
assert.equal(isProviderConfigured("epidemic", {}), false);
assert.equal(isAcquisitionEnabled({}), false);
assert.equal(
  isAcquisitionEnabled({
    CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED: "TRUE",
  }),
  false,
);
assert.equal(
  isAcquisitionEnabled({
    CREATOR_PREMIUM_MUSIC_ACQUISITION_ENABLED: "true",
  }),
  true,
);

const openAiEnvironment = {
  OPENAI_API_KEY: sentinel("openai-key"),
  OPENAI_MODEL: "existing-general-model",
  OPENAI_CREATOR_DIRECTOR_MODEL: "existing-director-model",
};
assert.equal(isProviderConfigured("openai", openAiEnvironment), true);
assert.equal(
  resolveProviderEnvironmentValue("openai", "model", openAiEnvironment),
  "existing-general-model",
);
assert.equal(
  resolveProviderEnvironmentValue(
    "openai",
    "creatorDirectorModel",
    openAiEnvironment,
  ),
  "existing-director-model",
);

const runway = read("lib/video/providers/runwayAdapter.ts");
const veo = read("lib/video/providers/veoAdapter.ts");
const voice = read("lib/providers/voice/elevenLabsVoiceAdapter.ts");
const image = read("lib/providers/image/openAIImageAdapter.ts");
const music = read("lib/providers/music/epidemic.ts");
const musicDownloadSecurity = read("lib/providers/music/downloadSecurity.ts");
const health = read("app/api/creator-health/route.ts");
for (const [source, provider] of [
  [runway, "runway"],
  [veo, "veo"],
  [voice, "elevenlabs"],
  [image, "openai"],
  [music, "epidemic"],
]) {
  assert.match(source, new RegExp(`isProviderConfigured\\("${provider}"\\)`));
}
for (const provider of ["openai", "elevenlabs", "runway"]) {
  assert.match(health, new RegExp(`isProviderConfigured\\("${provider}"\\)`));
}
assert.doesNotMatch(health, /RUNWAY(?:ML)?_API|VEO_API|GEMINI_API|ELEVENLABS_API|OPENAI_API/);
assert.match(
  musicDownloadSecurity,
  /resolveProviderEnvironmentValue\([\s\S]*"epidemic"[\s\S]*"acquisitionEnabled"[\s\S]*\) === "true"/,
);
assert.doesNotMatch(
  read("compose.yaml").slice(read("compose.yaml").indexOf("  worker:")),
  /OPENAI_API_KEY|RUNWAY_API_KEY|RUNWAYML_API|VEO_API_KEY|GEMINI_API_KEY|ELEVENLABS_API_KEY|EPIDEMIC_SOUND_API_KEY/,
);

console.log("Stage 0.8D-B provider environment regression passed.");
