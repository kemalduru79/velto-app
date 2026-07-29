export type VoiceProviderKey = "elevenlabs";
export type VoiceProviderTier = "primary";
export type VoiceLanguage = "tr" | "en";
export type VoiceRole = "narrator" | "character";

export type VoiceProviderSettings = {
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
};

export type VoiceProviderSynthesisInput = {
  text: string;
  voiceId: string;
  modelId: string;
  settings: VoiceProviderSettings;
  outputFormat?: "mp3_44100_128";
  timeoutMs?: number;
};

export type VoiceProviderResult = {
  audio: Buffer;
  contentType: string;
  requestId?: string;
};

export interface VoiceProvider {
  readonly key: VoiceProviderKey;
  readonly tier: VoiceProviderTier;
  isAvailable(): boolean;
  getDefaultModelId(): string;
  getDefaultVoiceId(language: VoiceLanguage, role: VoiceRole): string | null;
  synthesize(input: VoiceProviderSynthesisInput): Promise<VoiceProviderResult>;
}
