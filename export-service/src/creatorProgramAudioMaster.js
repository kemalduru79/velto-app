import { CREATOR_AUDIO_MIX_POLICY } from "./creatorAudioPolicy.js";

const REQUIRED_MEASUREMENTS = Object.freeze({
  input_i: Object.freeze({ filterKey: "measured_I", minimum: -99, maximum: 0 }),
  input_tp: Object.freeze({ filterKey: "measured_TP", minimum: -99, maximum: 99 }),
  input_lra: Object.freeze({ filterKey: "measured_LRA", minimum: 0, maximum: 99 }),
  input_thresh: Object.freeze({ filterKey: "measured_thresh", minimum: -99, maximum: 0 }),
  target_offset: Object.freeze({ filterKey: "offset", minimum: -99, maximum: 99 }),
});

export class CreatorProgramAudioMasterError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "CreatorProgramAudioMasterError";
  }
}

const targetFilter = () => [
  `I=${CREATOR_AUDIO_MIX_POLICY.programIntegratedLufs.toFixed(1)}`,
  `TP=${CREATOR_AUDIO_MIX_POLICY.programTruePeakDb.toFixed(1)}`,
  `LRA=${CREATOR_AUDIO_MIX_POLICY.programLraLu.toFixed(1)}`,
];

export function buildCreatorProgramLoudnessAnalysisFilter() {
  return `loudnorm=${[...targetFilter(), "print_format=json"].join(":")}`;
}

export function parseCreatorProgramLoudnessMeasurements(stderr) {
  const candidates = String(stderr || "").match(/\{[^{}]*\}/g) || [];
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    let parsed;
    try {
      parsed = JSON.parse(candidates[index]);
    } catch {
      continue;
    }
    if (!Object.keys(REQUIRED_MEASUREMENTS).every((key) => key in parsed)) continue;

    const measurements = {};
    for (const [sourceKey, contract] of Object.entries(REQUIRED_MEASUREMENTS)) {
      const value = Number(parsed[sourceKey]);
      if (!Number.isFinite(value) || value < contract.minimum || value > contract.maximum) {
        throw new CreatorProgramAudioMasterError(
          `CreatorLab program loudness measurement ${sourceKey} is invalid.`
        );
      }
      measurements[contract.filterKey] = value;
    }
    return Object.freeze(measurements);
  }

  throw new CreatorProgramAudioMasterError(
    "CreatorLab program loudness analysis did not return valid measurements."
  );
}

export function buildCreatorProgramLoudnessMasterFilter(measurements) {
  const measured = Object.values(REQUIRED_MEASUREMENTS).map(({ filterKey: key, minimum, maximum }) => {
    const value = Number(measurements?.[key]);
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new CreatorProgramAudioMasterError(
        `CreatorLab program loudness measurement ${key} is invalid.`
      );
    }
    return `${key}=${value.toFixed(6)}`;
  });

  return `loudnorm=${[
    ...targetFilter(),
    ...measured,
    "linear=true",
    "print_format=summary",
  ].join(":")}`;
}
