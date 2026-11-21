import { observeProviderCall } from "@/lib/observability";
import { OpenAIImageAdapter } from "./openAIImageAdapter";
import type { ImageProvider } from "./types";

let provider: ImageProvider | null = null;

function createObservedImageProvider(raw: ImageProvider): ImageProvider {
  return {
    key: raw.key,
    tier: raw.tier,
    capabilities: raw.capabilities,
    isAvailable: () => raw.isAvailable(),
    generate: (input) =>
      observeProviderCall(
        {
          mediaType: "image",
          providerTier: raw.tier,
          operation: "generate",
          metadata: {
            modelFamily: input.model.startsWith("gpt-image")
              ? "gpt-image"
              : "other",
            referenceInputCount: input.referenceImages?.length || 0,
          },
        },
        () => raw.generate(input),
      ),
  };
}

export function getImageProvider(): ImageProvider {
  provider ||= createObservedImageProvider(new OpenAIImageAdapter());
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
