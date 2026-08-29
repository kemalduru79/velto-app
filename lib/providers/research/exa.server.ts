import "server-only";

import { adaptExaSearchResponse, type ExaSearchResponse } from "./exaAdapter.ts";
import { buildExaSearchRequest } from "./exaRequest.ts";
import {
  ResearchProviderError,
  type ResearchSearchInput,
  type ResearchSearchProvider,
} from "./types.ts";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const DEFAULT_TIMEOUT_MS = 20_000;

type FetchLike = typeof fetch;

function providerMessage(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.error === "string") return record.error.trim().slice(0, 500);
  if (typeof record.message === "string") return record.message.trim().slice(0, 500);
  return "";
}

export class ExaResearchSearchProvider implements ResearchSearchProvider {
  constructor(
    private readonly apiKey = process.env.EXA_API_KEY || "",
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async search(input: ResearchSearchInput) {
    const apiKey = this.apiKey.trim();
    if (!apiKey) {
      throw new ResearchProviderError(
        "RESEARCH_PROVIDER_KEY_MISSING",
        503,
        "Grounded research search is not configured.",
      );
    }

    let body: ReturnType<typeof buildExaSearchRequest>;
    try {
      body = buildExaSearchRequest(input);
    } catch (error) {
      throw new ResearchProviderError(
        "RESEARCH_SEARCH_INVALID",
        400,
        error instanceof Error ? error.message : "Research search input is invalid.",
      );
    }

    let response: Response;
    try {
      response = await this.fetchImpl(EXA_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ResearchProviderError(
        "RESEARCH_PROVIDER_UNREACHABLE",
        502,
        error instanceof Error && error.name === "TimeoutError"
          ? "Grounded research search timed out."
          : "Grounded research search could not be reached.",
      );
    }

    const payload = await response.json().catch(() => null) as ExaSearchResponse | null;
    if (!response.ok || !payload) {
      const detail = providerMessage(payload);
      throw new ResearchProviderError(
        "RESEARCH_PROVIDER_FAILED",
        response.status >= 400 && response.status < 600 ? response.status : 502,
        detail || "Grounded research search failed.",
      );
    }

    return adaptExaSearchResponse(payload, input.category);
  }
}
