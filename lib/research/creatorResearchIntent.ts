import type { ResearchSource } from "./sourceContract.ts";

export const CREATOR_RESEARCH_INTENT_VERSION = "stage-5d2a-v1" as const;

const MAX_RESEARCH_BRIEF_CHARACTERS = 20_000;
const MAX_COMPARISON_QUESTIONS = 8;
const MAX_COMPARISON_QUESTION_CHARACTERS = 500;
const MAX_SOURCE_URLS_PER_AUTHORITY = 12;

export type CreatorResearchIntent = Readonly<{
  version: typeof CREATOR_RESEARCH_INTENT_VERSION;
  researchBrief: string;
  comparisonQuestions: readonly string[];
  preferredSourceUrls: readonly string[];
  requiredSourceUrls: readonly string[];
}>;

export type CreatorResearchIntentCoverage = Readonly<{
  version: "stage-5d2a-coverage-v1";
  preferredSourceCount: number;
  locatedPreferredCandidateCount: number;
  unlocatedPreferredCount: number;
  requiredSourceCount: number;
  locatedRequiredCandidateCount: number;
  missingRequiredSourceCount: number;
  status: "complete" | "preferred_coverage_warning" | "required_coverage_blocked";
}>;

const TRACKING_QUERY_KEYS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);
const REQUIRED_SOURCE_MARKER = /\b(?:(?:required|mandatory)\s+(?:original\s+)?(?:sources?|publications?)|must\s+(?:use|include|cover)\s+(?:the\s+)?(?:following\s+)?(?:sources?|publications?))\b/iu;
const PREFERRED_SOURCE_MARKER = /\b(?:prioriti[sz]e|priority|preferred|published\s+research|original\s+(?:publication|source)s?|research\s+sources?|publications?)\b/iu;
const COMPARISON_QUESTION_MARKER = /(?:compar|contrast|differ|versus|\bvs\.?\b|disagree|reconcil|alternative|karşılaştır|kıyas|fark|çeliş)/iu;
const QUESTION_SECTION_MARKER = /(?:comparison|research)\s+questions?|karşılaştırma\s+soruları?/iu;

function compactText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim().slice(0, maxLength)
    : "";
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) return true;
  const octets = normalized.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

export function canonicalCreatorResearchIntentUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim().replace(/[),.;!?]+$/gu, ""));
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      isPrivateHostname(url.hostname)
    ) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/gu, "");
    return url.toString();
  } catch {
    return null;
  }
}

function uniqueBounded(values: readonly string[], maximum: number) {
  return Object.freeze([...new Set(values)].slice(0, maximum));
}

function sourceMode(value: string) {
  if (REQUIRED_SOURCE_MARKER.test(value)) return "required" as const;
  if (PREFERRED_SOURCE_MARKER.test(value)) return "preferred" as const;
  return null;
}

function extractSourceUrls(brief: string) {
  const preferred: string[] = [];
  const required: string[] = [];
  let activeMode: "preferred" | "required" | null = null;
  for (const line of brief.split(/\r?\n/gu)) {
    const explicitMode = sourceMode(line);
    if (explicitMode) activeMode = explicitMode;
    if (QUESTION_SECTION_MARKER.test(line)) activeMode = null;
    const matches = line.match(/https?:\/\/[^\s<>"']+/giu) || [];
    for (const match of matches) {
      const url = canonicalCreatorResearchIntentUrl(match);
      const mode = explicitMode || activeMode;
      if (!url || !mode) continue;
      (mode === "required" ? required : preferred).push(url);
    }
  }
  const requiredUrls = uniqueBounded(required, MAX_SOURCE_URLS_PER_AUTHORITY);
  const requiredSet = new Set(requiredUrls);
  return {
    preferredSourceUrls: uniqueBounded(
      preferred.filter((url) => !requiredSet.has(url)),
      MAX_SOURCE_URLS_PER_AUTHORITY,
    ),
    requiredSourceUrls: requiredUrls,
  };
}

function extractComparisonQuestions(brief: string) {
  const questions: string[] = [];
  let questionSectionActive = false;
  for (const line of brief.split(/\r?\n/gu)) {
    if (QUESTION_SECTION_MARKER.test(line)) questionSectionActive = true;
    if (!line.trim()) questionSectionActive = false;
    for (const match of line.match(/[^?]{1,1000}\?/gu) || []) {
      const question = compactText(match, MAX_COMPARISON_QUESTION_CHARACTERS);
      if (question && (questionSectionActive || COMPARISON_QUESTION_MARKER.test(question))) {
        questions.push(question);
      }
    }
  }
  return uniqueBounded(questions, MAX_COMPARISON_QUESTIONS);
}

export function createCreatorResearchIntentFromBrief(value: unknown): CreatorResearchIntent {
  const originalBrief = typeof value === "string"
    ? value.slice(0, MAX_RESEARCH_BRIEF_CHARACTERS)
    : "";
  const researchBrief = compactText(originalBrief, MAX_RESEARCH_BRIEF_CHARACTERS);
  if (!researchBrief) throw new Error("CREATOR_RESEARCH_INTENT_BRIEF_REQUIRED");
  const sourceUrls = extractSourceUrls(originalBrief);
  return Object.freeze({
    version: CREATOR_RESEARCH_INTENT_VERSION,
    researchBrief,
    comparisonQuestions: extractComparisonQuestions(originalBrief),
    ...sourceUrls,
  });
}

export function normalizeCreatorResearchIntent(value: unknown): CreatorResearchIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CREATOR_RESEARCH_INTENT_INVALID");
  }
  const raw = value as Record<string, unknown>;
  if (raw.version !== CREATOR_RESEARCH_INTENT_VERSION) {
    throw new Error("CREATOR_RESEARCH_INTENT_VERSION_INVALID");
  }
  const researchBrief = compactText(raw.researchBrief, MAX_RESEARCH_BRIEF_CHARACTERS);
  if (!researchBrief) throw new Error("CREATOR_RESEARCH_INTENT_BRIEF_REQUIRED");
  if (
    !Array.isArray(raw.comparisonQuestions) ||
    !Array.isArray(raw.preferredSourceUrls) ||
    !Array.isArray(raw.requiredSourceUrls)
  ) throw new Error("CREATOR_RESEARCH_INTENT_FIELDS_INVALID");
  const normalizeQuestions = raw.comparisonQuestions
    .map((question) => compactText(question, MAX_COMPARISON_QUESTION_CHARACTERS))
    .filter(Boolean);
  const normalizeUrls = (input: unknown) => Array.isArray(input)
    ? input.flatMap((item) => {
        const url = canonicalCreatorResearchIntentUrl(item);
        return url ? [url] : [];
      })
    : [];
  const requiredSourceUrls = uniqueBounded(normalizeUrls(raw.requiredSourceUrls), MAX_SOURCE_URLS_PER_AUTHORITY);
  const requiredSet = new Set(requiredSourceUrls);
  const preferredSourceUrls = uniqueBounded(
    normalizeUrls(raw.preferredSourceUrls).filter((url) => !requiredSet.has(url)),
    MAX_SOURCE_URLS_PER_AUTHORITY,
  );
  return Object.freeze({
    version: CREATOR_RESEARCH_INTENT_VERSION,
    researchBrief,
    comparisonQuestions: uniqueBounded(normalizeQuestions, MAX_COMPARISON_QUESTIONS),
    preferredSourceUrls,
    requiredSourceUrls,
  });
}

export function createCreatorResearchIntentCoverage(input: {
  intent: CreatorResearchIntent;
  sources: readonly Pick<ResearchSource, "url">[];
}): CreatorResearchIntentCoverage {
  const locatedUrls = new Set(input.sources.flatMap((source) => {
    const url = canonicalCreatorResearchIntentUrl(source.url);
    return url ? [url] : [];
  }));
  const locatedPreferredCandidateCount = input.intent.preferredSourceUrls
    .filter((url) => locatedUrls.has(url)).length;
  const locatedRequiredCandidateCount = input.intent.requiredSourceUrls
    .filter((url) => locatedUrls.has(url)).length;
  const unlocatedPreferredCount = input.intent.preferredSourceUrls.length - locatedPreferredCandidateCount;
  const missingRequiredSourceCount = input.intent.requiredSourceUrls.length - locatedRequiredCandidateCount;
  return Object.freeze({
    version: "stage-5d2a-coverage-v1" as const,
    preferredSourceCount: input.intent.preferredSourceUrls.length,
    locatedPreferredCandidateCount,
    unlocatedPreferredCount,
    requiredSourceCount: input.intent.requiredSourceUrls.length,
    locatedRequiredCandidateCount,
    missingRequiredSourceCount,
    status: missingRequiredSourceCount > 0
      ? "required_coverage_blocked"
      : unlocatedPreferredCount > 0
        ? "preferred_coverage_warning"
        : "complete",
  });
}
