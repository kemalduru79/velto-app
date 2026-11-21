import { CREATOR_ECONOMICS_PRICING_AS_OF, CREATOR_ECONOMICS_PRICING_VERSION, CREATOR_PROVIDER_PRICING } from "./pricingCatalog.ts";
import type { EconomicCostResult } from "./types";

const base = { pricingVersion: CREATOR_ECONOMICS_PRICING_VERSION, pricingAsOf: CREATOR_ECONOMICS_PRICING_AS_OF, currency: "USD" as const };
const units = (value: unknown) => Math.max(0, Number(value) || 0);
const exact = (components: Record<string, number>): EconomicCostResult => ({ ...base, costStatus: "exact", providerCostUsd: Math.round(Object.values(components).reduce((sum, value) => sum + value, 0) * 1_000_000) / 1_000_000, components });
export const unknownCost = (reason: string): EconomicCostResult => ({ ...base, costStatus: "unknown", providerCostUsd: null, reason, components: {} });

export function calculateOpenAITextCost(model: string, usage: { inputTokens?: number; cachedInputTokens?: number; outputTokens?: number }): EconomicCostResult {
  const rate = CREATOR_PROVIDER_PRICING.openaiText[model as keyof typeof CREATOR_PROVIDER_PRICING.openaiText];
  if (!rate) return unknownCost(`No verified OpenAI text pricing for ${model}.`);
  const cached = Math.min(units(usage.cachedInputTokens), units(usage.inputTokens));
  const uncached = Math.max(0, units(usage.inputTokens) - cached);
  return exact({ input: uncached * rate.inputPer1M / 1_000_000, cachedInput: cached * rate.cachedInputPer1M / 1_000_000, output: units(usage.outputTokens) * rate.outputPer1M / 1_000_000 });
}

export type OpenAIImageUsage = { textInputTokens?: number; cachedTextInputTokens?: number; imageInputTokens?: number; cachedImageInputTokens?: number; imageOutputTokens?: number };
export function calculateOpenAIImageCost(model: string, usage: OpenAIImageUsage): EconomicCostResult {
  const rate = CREATOR_PROVIDER_PRICING.openaiImage[model as keyof typeof CREATOR_PROVIDER_PRICING.openaiImage];
  if (!rate) return unknownCost(`No verified OpenAI image pricing for ${model}.`);
  const cachedText = Math.min(units(usage.cachedTextInputTokens), units(usage.textInputTokens));
  const cachedImage = Math.min(units(usage.cachedImageInputTokens), units(usage.imageInputTokens));
  return exact({
    textInput: Math.max(0, units(usage.textInputTokens) - cachedText) * rate.textInputPer1M / 1_000_000,
    cachedTextInput: cachedText * rate.cachedTextInputPer1M / 1_000_000,
    imageInput: Math.max(0, units(usage.imageInputTokens) - cachedImage) * rate.imageInputPer1M / 1_000_000,
    cachedImageInput: cachedImage * rate.cachedImageInputPer1M / 1_000_000,
    imageOutput: units(usage.imageOutputTokens) * rate.imageOutputPer1M / 1_000_000,
  });
}

export function calculateElevenLabsCost(model: string, characterCount: number): EconomicCostResult {
  const rate = CREATOR_PROVIDER_PRICING.elevenLabs[model as keyof typeof CREATOR_PROVIDER_PRICING.elevenLabs];
  return rate ? exact({ characters: units(characterCount) * rate.per1KCharacters / 1000 }) : unknownCost(`No verified ElevenLabs pricing for ${model}.`);
}

export function calculateRunwayCost(model: string, generatedSeconds: number, resolution = "720p"): EconomicCostResult {
  const rate = CREATOR_PROVIDER_PRICING.runway[model as keyof typeof CREATOR_PROVIDER_PRICING.runway];
  if (!rate) return unknownCost(`No verified Runway pricing for ${model}.`);
  const perSecond = "perGeneratedSecond" in rate ? rate.perGeneratedSecond : rate[resolution as keyof typeof rate];
  return typeof perSecond === "number" ? exact({ generatedSeconds: units(generatedSeconds) * perSecond }) : unknownCost(`No verified Runway pricing for ${model} at ${resolution}.`);
}

export function calculateVeoCost(model: string, resolution = "1080p", generatedSeconds = 8): EconomicCostResult {
  const rates = CREATOR_PROVIDER_PRICING.veo[model as keyof typeof CREATOR_PROVIDER_PRICING.veo];
  const perSecond = rates?.[resolution as keyof typeof rates];
  return typeof perSecond === "number" ? exact({ generatedSeconds: units(generatedSeconds) * perSecond }) : unknownCost(`No verified Google Veo pricing for ${model} at ${resolution}.`);
}

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
export function normalizeOpenAITextUsage(usage: unknown) {
  const root = record(usage); const inputDetails = record(root.input_tokens_details ?? root.prompt_tokens_details); const outputDetails = record(root.output_tokens_details ?? root.completion_tokens_details);
  return {
    inputTokens: units(root.input_tokens ?? root.prompt_tokens), cachedInputTokens: units(inputDetails.cached_tokens),
    outputTokens: units(root.output_tokens ?? root.completion_tokens), reasoningTokens: units(outputDetails.reasoning_tokens),
  };
}

export function normalizeOpenAIImageUsage(usage: unknown): OpenAIImageUsage {
  const root = record(usage); const details = record(root.input_tokens_details);
  return {
    textInputTokens: units(details.text_tokens ?? root.text_input_tokens), cachedTextInputTokens: units(details.cached_text_tokens ?? root.cached_text_input_tokens),
    imageInputTokens: units(details.image_tokens ?? root.image_input_tokens), cachedImageInputTokens: units(details.cached_image_tokens ?? root.cached_image_input_tokens),
    imageOutputTokens: units(root.output_tokens ?? root.image_output_tokens),
  };
}
