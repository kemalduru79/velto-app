import { OpenAIImageAdapter } from "./openAIImageAdapter";
import type { ImageProvider } from "./types";

let provider: ImageProvider | null = null;

export function getImageProvider(): ImageProvider {
  provider ||= new OpenAIImageAdapter();
  return provider;
}

export type {
  ImageProvider,
  ImageProviderCapabilities,
  ImageProviderGenerateInput,
  ImageProviderKey,
  ImageProviderReferenceInput,
  ImageProviderResult,
  ImageProviderTier,
} from "./types";
