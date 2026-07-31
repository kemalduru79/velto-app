import { observeProviderCall } from "@/lib/observability";
import { ElevenLabsVoiceAdapter } from "./elevenLabsVoiceAdapter";
import type { VoiceProvider } from "./types";

let provider: VoiceProvider | null = null;

function createObservedVoiceProvider(raw: VoiceProvider): VoiceProvider {
  return {
    key: raw.key,
    tier: raw.tier,
    isAvailable: () => raw.isAvailable(),
    getDefaultModelId: () => raw.getDefaultModelId(),
    getDefaultVoiceId: (language, role) =>
      raw.getDefaultVoiceId(language, role),
    listVoices: (input) =>
      observeProviderCall(
        {
          mediaType: "voice",
          providerTier: raw.tier,
          operation: "list_voices",
          metadata: {
            source: input.source,
            pageSize: input.pageSize || 24,
            hasSearch: Boolean(input.search),
          },
        },
        () => raw.listVoices(input),
      ),
    addSharedVoice: (input) =>
      observeProviderCall(
        {
          mediaType: "voice",
          providerTier: raw.tier,
          operation: "add_shared_voice",
          metadata: { voiceId: input.voiceId },
        },
        () => raw.addSharedVoice(input),
      ),
    synthesize: (input) =>
      observeProviderCall(
        {
          mediaType: "voice",
          providerTier: raw.tier,
          operation: "synthesize",
          metadata: {
            textLength: input.text.length,
            outputFormat: input.outputFormat || "mp3_44100_128",
          },
        },
        () => raw.synthesize(input),
      ),
  };
}

export function getVoiceProvider(): VoiceProvider {
  provider ||= createObservedVoiceProvider(new ElevenLabsVoiceAdapter());
  return provider;
}

export type {
  AddSharedVoiceInput,
  VoiceLanguage,
  VoiceLibraryQuery,
  VoiceLibraryResult,
  VoiceProvider,
  VoiceProviderKey,
  VoiceProviderResult,
  VoiceProviderSettings,
  VoiceProviderSynthesisInput,
  VoiceProviderTier,
  VoiceRole,
} from "./types";
