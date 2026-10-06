import { CREATOR_AUDIO_MIX_POLICY } from "./creatorAudioPolicy.js";

const formatGain = (value) => Number(value).toFixed(6);

export function buildCreatorSceneAudioMixFilter({
  durationSeconds,
  hasSpeech,
  hasAmbient,
  hasSfx,
}) {
  const duration = Math.max(0.2, Number(durationSeconds) || 0.2).toFixed(3);
  const layers = [
    hasSpeech && { name: "speech", gain: CREATOR_AUDIO_MIX_POLICY.sceneSpeechGain },
    hasAmbient && { name: "ambient", gain: CREATOR_AUDIO_MIX_POLICY.sceneAmbientGain },
    hasSfx && { name: "sfx", gain: CREATOR_AUDIO_MIX_POLICY.sceneSfxGain },
  ].filter(Boolean);

  if (layers.length < 2) {
    throw new Error("Creator scene audio mixing requires at least two layers.");
  }

  const filters = layers.map((layer, index) =>
    `[${index}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,` +
    `aresample=44100:async=1:first_pts=0,apad,atrim=start=0:duration=${duration},` +
    `asetpts=PTS-STARTPTS,volume=${formatGain(layer.gain)}[creator_scene_${layer.name}]`
  );
  const inputs = layers.map((layer) => `[creator_scene_${layer.name}]`).join("");
  filters.push(
    `${inputs}amix=inputs=${layers.length}:duration=first:dropout_transition=0:normalize=0,` +
    `alimiter=limit=${Number(CREATOR_AUDIO_MIX_POLICY.sceneLimiterCeiling).toFixed(3)}` +
    `[creator_scene_audio]`
  );

  return filters.join(";");
}
