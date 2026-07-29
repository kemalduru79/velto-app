import { ElevenLabsVoiceAdapter } from "./elevenLabsVoiceAdapter";
import type { VoiceProvider } from "./types";

let provider: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  provider ||= new ElevenLabsVoiceAdapter();
  return provider;
}

export type {
  VoiceLanguage,
  VoiceProvider,
  VoiceProviderKey,
  VoiceProviderResult,
  VoiceProviderSettings,
  VoiceProviderSynthesisInput,
  VoiceProviderTier,
  VoiceRole,
} from "./types";
