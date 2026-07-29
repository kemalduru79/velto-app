import OpenAI, { toFile } from "openai";
import {
  ProviderError,
  classifyProviderError,
} from "@/lib/providers/core/providerError";
import type {
  ImageProvider,
  ImageProviderGenerateInput,
  ImageProviderResult,
} from "./types";

type ImageApiResponse = {
  data?: Array<{ b64_json?: string | null }>;
  usage?: unknown;
  _request_id?: string;
};

export class OpenAIImageAdapter implements ImageProvider {
  readonly key = "openai" as const;
  readonly tier = "primary" as const;
  readonly capabilities = {
    generation: true,
    referenceImages: true,
    supportedAspectRatios: ["9:16", "16:9", "1:1"] as const,
  };

  isAvailable() {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  private getClient() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new ProviderError("Image provider is not configured.", {
        code: "not_configured",
        retryable: false,
      });
    }

    return new OpenAI({ apiKey });
  }

  async generate(
    input: ImageProviderGenerateInput,
  ): Promise<ImageProviderResult> {
    try {
      const client = this.getClient();
      const referenceInputs = Array.isArray(input.referenceImages)
        ? input.referenceImages
        : [];
      const referenceFiles = await Promise.all(
        referenceInputs.map((reference) =>
          toFile(reference.data, reference.filename, {
            type: reference.contentType,
          }),
        ),
      );
      const canUseReferenceInput =
        referenceFiles.length > 0 && input.model.startsWith("gpt-image-2");

      const result = canUseReferenceInput
        ? ((await client.images.edit({
            model: input.model,
            image: referenceFiles,
            prompt: input.prompt,
            size: input.size,
            quality: input.quality,
            input_fidelity: input.referenceFidelity || "high",
            stream: false,
          } as any)) as unknown as ImageApiResponse)
        : ((await client.images.generate({
            model: input.model,
            prompt: input.prompt,
            size: input.size,
            quality: input.quality,
            stream: false,
          } as any)) as unknown as ImageApiResponse);

      const base64 = result.data?.[0]?.b64_json?.trim();

      if (!base64) {
        throw new ProviderError("Image provider returned an empty result.", {
          code: "upstream",
          retryable: true,
          requestId: result._request_id,
        });
      }

      return {
        base64,
        usage: result.usage || null,
        requestId: result._request_id,
        referenceInputApplied: canUseReferenceInput,
      };
    } catch (error) {
      throw classifyProviderError(
        error,
        "Image generation could not be completed.",
      );
    }
  }
}
