import type {
  ResearchSearchCategory,
  ResearchSearchInput,
} from "../providers/research/types.ts";

const RESEARCH_SEARCH_CATEGORIES = new Set<ResearchSearchCategory>([
  "web",
  "primary",
  "academic",
  "news",
]);

function clean(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function cleanStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => clean(item, 240).toLowerCase())
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function cleanOptionalDate(value: unknown) {
  const normalized = clean(value, 100);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeCreatorResearchSearchRequest(
  value: unknown,
): ResearchSearchInput {
  const body = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const query = clean(body.query, 800);
  if (!query) throw new Error("RESEARCH_QUERY_REQUIRED");

  const requestedCategory = clean(body.category, 40);
  if (
    requestedCategory &&
    !RESEARCH_SEARCH_CATEGORIES.has(requestedCategory as ResearchSearchCategory)
  ) {
    throw new Error("RESEARCH_CATEGORY_INVALID");
  }
  const category = requestedCategory
    ? requestedCategory as ResearchSearchCategory
    : "web";
  const requestedMax = Number(body.maxResults);
  const maxResults = Number.isFinite(requestedMax)
    ? Math.min(10, Math.max(1, Math.trunc(requestedMax)))
    : 8;

  return {
    query,
    category,
    maxResults,
    includeDomains: cleanStringArray(body.includeDomains, 100),
    excludeDomains: cleanStringArray(body.excludeDomains, 100),
    startPublishedDate: cleanOptionalDate(body.startPublishedDate),
    endPublishedDate: cleanOptionalDate(body.endPublishedDate),
  };
}
