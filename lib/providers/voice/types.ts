import type {
  CreatorVoiceLibrarySource,
  CreatorVoiceLibraryVoice,
} from "@/lib/creator/voiceLibrary";

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

export type VoiceLibraryQuery = {
  source: CreatorVoiceLibrarySource;
  search?: string;
  language?: string;
  gender?: string;
  age?: string;
  accent?: string;
  useCase?: string;
  pageSize?: number;
  pageToken?: string;
};

export type VoiceLibraryResult = {
  voices: CreatorVoiceLibraryVoice[];
  hasMore: boolean;
  nextPageToken?: string;
};

export type AddSharedVoiceInput = {
  publicOwnerId: string;
  voiceId: string;
  name: string;
};

export interface VoiceProvider {
  readonly key: VoiceProviderKey;
  readonly tier: VoiceProviderTier;
  isAvailable(): boolean;
  getDefaultModelId(): string;
  getDefaultVoiceId(language: VoiceLanguage, role: VoiceRole): string | null;
  listVoices(input: VoiceLibraryQuery): Promise<VoiceLibraryResult>;
  addSharedVoice(input: AddSharedVoiceInput): Promise<{ voiceId: string }>;
  synthesize(input: VoiceProviderSynthesisInput): Promise<VoiceProviderResult>;
}
