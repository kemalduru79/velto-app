import "server-only";

import {
  getCreatorVoiceSelection,
  normalizeCreatorVoiceSelectionId,
  type CreatorVoiceSelectionId,
} from "@/lib/creator/voiceProfiles";
import type { VoiceLanguage, VoiceRole } from "./types";

function toEnvToken(value: string) {
  return value.replace(/^velto_/, "").replace(/[^a-z0-9]+/gi, "_").toUpperCase();
}

export function resolveCreatorVoiceProfileVoiceId({
  profileId,
  language,
  role,
}: {
  profileId: unknown;
  language: VoiceLanguage;
  role: VoiceRole;
}) {
  const normalizedProfileId = normalizeCreatorVoiceSelectionId(profileId);
  const profileToken = toEnvToken(normalizedProfileId);
  const languageToken = language.toUpperCase();
  const roleToken = role === "narrator" ? "NARRATOR" : "CHARACTER";

  const exactKey = `VELTO_VOICE_${profileToken}_${languageToken}_${roleToken}_ID`;
  const languageKey = `VELTO_VOICE_${profileToken}_${languageToken}_ID`;
  const genericKey = `VELTO_VOICE_${profileToken}_ID`;

  return (
    process.env[exactKey]?.trim() ||
    process.env[languageKey]?.trim() ||
    process.env[genericKey]?.trim() ||
    null
  );
}

export function getCreatorVoiceProfileServerSelection(profileId: unknown): {
  id: CreatorVoiceSelectionId;
  settings: {
    stability: number;
    similarityBoost: number;
    style: number;
    speed: number;
  };
} {
  const profile = getCreatorVoiceSelection(profileId);
  return { id: profile.id, settings: profile.settings };
}
