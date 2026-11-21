export type ImageProviderKey = "openai";
export type ImageProviderTier = "primary";

export type ImageProviderCapabilities = {
  generation: boolean;
  referenceImages: boolean;
  supportedAspectRatios: readonly string[];
};

export type ImageProviderReferenceInput = {
  data: Buffer;
  filename: string;
  contentType: string;
};

export type ImageProviderGenerateInput = {
  prompt: string;
  model: string;
  size: string;
  quality: "medium" | "high";
  referenceImages?: ImageProviderReferenceInput[];
  referenceFidelity?: "low" | "high";
};

export type ImageProviderResult = {
  base64: string;
  usage: unknown;
  requestId?: string;
  referenceInputApplied: boolean;
};

export interface ImageProvider {
  readonly key: ImageProviderKey;
  readonly tier: ImageProviderTier;
  readonly capabilities: ImageProviderCapabilities;
  isAvailable(): boolean;
  generate(input: ImageProviderGenerateInput): Promise<ImageProviderResult>;
}
