import type { ResearchSearchInput } from "./types.ts";

export type ExaSearchRequestBody = {
  query: string;
  type: "auto";
  numResults: number;
  contents: {
    highlights: true;
  };
  category?: "publication" | "news";
  includeDomains?: string[];
  excludeDomains?: string[];
  startPublishedDate?: string;
  endPublishedDate?: string;
};

function cleanQuery(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 800);
}

function cleanDomains(values?: string[]) {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, 100);
}

function cleanIsoDate(value?: string | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildExaSearchRequest(input: ResearchSearchInput): ExaSearchRequestBody {
  const query = cleanQuery(input.query);
  if (!query) throw new Error("RESEARCH_QUERY_REQUIRED");

  const maxResults = Number(input.maxResults);
  const numResults = Number.isFinite(maxResults)
    ? Math.min(10, Math.max(1, Math.trunc(maxResults)))
    : 8;
  const includeDomains = cleanDomains(input.includeDomains);
  const excludeDomains = cleanDomains(input.excludeDomains)
    .filter((domain) => !includeDomains.includes(domain));
  const startPublishedDate = cleanIsoDate(input.startPublishedDate);
  const endPublishedDate = cleanIsoDate(input.endPublishedDate);

  const body: ExaSearchRequestBody = {
    query,
    type: "auto",
    numResults,
    contents: {
      highlights: true,
    },
  };

  if (input.category === "academic") body.category = "publication";
  if (input.category === "news") body.category = "news";
  if (includeDomains.length) body.includeDomains = includeDomains;
  if (excludeDomains.length) body.excludeDomains = excludeDomains;
  if (startPublishedDate) body.startPublishedDate = startPublishedDate;
  if (endPublishedDate) body.endPublishedDate = endPublishedDate;

  return body;
}
