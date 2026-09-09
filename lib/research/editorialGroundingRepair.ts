import {
  createValidatedEditorialAnalysis,
  type EditorialAnalysisProposal,
} from "./editorialAnalysisContract.ts";
import type { ResearchSource } from "./sourceContract.ts";

const UNGROUNDED_EXCERPT_PREFIX = "EDITORIAL_EVIDENCE_EXCERPT_NOT_GROUNDED:";
const MAX_BASE_SPANS_PER_SOURCE = 12;
export const MAX_EDITORIAL_GROUNDING_SPANS_PER_SOURCE = 24;
export const MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST = 120;

export type EditorialGroundingCandidateSpan = {
  spanId: string;
  sourceId: string;
  text: string;
};

export type EditorialGroundingRepairSelection = {
  repairs: Array<{ evidenceId: string; spanId: string }>;
};

export type EditorialGroundingRepairInput = {
  diagnosticCategory: string;
  invalidEvidence: Array<{
    evidenceId: string;
    sourceId: string;
    contextNote: string | null;
    linkedClaims: Array<{
      claimId: string;
      claimType: string;
      text: string;
      stance: string;
    }>;
  }>;
  candidateSpans: EditorialGroundingCandidateSpan[];
  failingSourceId: string;
};

type TextRange = { start: number; end: number };

function trimmedRange(text: string, start: number, end: number): TextRange | null {
  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;
  return start < end ? { start, end } : null;
}

function sentenceRanges(text: string) {
  const ranges: TextRange[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!".!?。！？".includes(text[index])) continue;
    let end = index + 1;
    while (end < text.length && ".!?。！？".includes(text[end])) end += 1;
    if (end < text.length && !/\s/u.test(text[end])) continue;
    const range = trimmedRange(text, start, end);
    if (range) ranges.push(range);
    start = end;
    index = end - 1;
  }
  const remainder = trimmedRange(text, start, text.length);
  if (remainder) ranges.push(remainder);
  return ranges;
}

function boundedPassageRanges(text: string) {
  const sentences = sentenceRanges(text);
  if (sentences.length === 0) return [];
  const groupSize = Math.max(
    1,
    Math.ceil(sentences.length / MAX_BASE_SPANS_PER_SOURCE),
  );
  const passages: TextRange[] = [];
  for (let index = 0; index < sentences.length; index += groupSize) {
    const group = sentences.slice(index, index + groupSize);
    passages.push({ start: group[0].start, end: group.at(-1)!.end });
  }
  for (let index = 0; index < passages.length; index += 1) {
    if (passages.length === 1 || passages[index].end - passages[index].start >= 24) {
      continue;
    }
    if (index + 1 < passages.length) {
      passages[index + 1] = {
        start: passages[index].start,
        end: passages[index + 1].end,
      };
      passages.splice(index, 1);
    } else {
      passages[index - 1].end = passages[index].end;
      passages.splice(index, 1);
    }
    index -= 1;
  }
  return passages;
}

export function createEditorialGroundingCandidateSpans(
  sources: ResearchSource[],
) {
  const spans: EditorialGroundingCandidateSpan[] = [];
  sources.forEach((source, sourceIndex) => {
    const summary = source.summary || "";
    const passages = boundedPassageRanges(summary);
    const ranges = [...passages];
    for (
      let index = 0;
      index + 1 < passages.length &&
      ranges.length < MAX_EDITORIAL_GROUNDING_SPANS_PER_SOURCE;
      index += 1
    ) ranges.push({ start: passages[index].start, end: passages[index + 1].end });
    ranges.forEach((range, spanIndex) => {
      spans.push({
        spanId: `span-${sourceIndex + 1}-${spanIndex + 1}`,
        sourceId: source.sourceId,
        text: summary.slice(range.start, range.end),
      });
    });
  });
  return spans;
}

function objectRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function discoverInvalidEvidence(input: {
  proposal: EditorialAnalysisProposal;
  sources: ResearchSource[];
}) {
  const sourceById = new Map(input.sources.map((source) => [source.sourceId, source]));
  const claims = Array.isArray(input.proposal.claims) ? input.proposal.claims : [];
  const links = Array.isArray(input.proposal.links) ? input.proposal.links : [];
  const evidence = Array.isArray(input.proposal.evidence) ? input.proposal.evidence : [];
  return evidence.flatMap((item) => {
    const evidenceId = text(item.evidenceId);
    const sourceId = text(item.sourceId);
    const excerpt = text(item.excerpt);
    const spanId = text(item.spanId);
    const source = sourceById.get(sourceId);
    if (!evidenceId || !source || (!spanId && excerpt && (source.summary || "").includes(excerpt))) {
      return [];
    }
    const linkedClaims = links.flatMap((link) => {
      if (text(link.evidenceId) !== evidenceId) return [];
      const claim = claims.find((candidate) =>
        text(candidate.claimId) === text(link.claimId)
      );
      return claim
        ? [{
          claimId: text(claim.claimId),
          claimType: text(claim.claimType),
          text: text(claim.text),
          stance: text(link.stance),
        }]
        : [];
    });
    return [{
      evidenceId,
      sourceId,
      contextNote: text(item.contextNote) || null,
      linkedClaims,
    }];
  });
}

export function installCanonicalEditorialEvidenceSpans(input: {
  proposal: EditorialAnalysisProposal;
  candidateSpans: EditorialGroundingCandidateSpan[];
}): EditorialAnalysisProposal {
  const spanBySourceAndId = new Map(
    input.candidateSpans.map((span) => [`${span.sourceId}\0${span.spanId}`, span]),
  );
  const spanById = new Map(input.candidateSpans.map((span) => [span.spanId, span]));
  return {
    ...input.proposal,
    evidence: (Array.isArray(input.proposal.evidence) ? input.proposal.evidence : []).map((item, index) => {
      const evidenceId = text(item.evidenceId) || `evidence-${index + 1}`;
      const sourceId = text(item.sourceId);
      const spanId = text(item.spanId);
      if (!spanId) throw new Error(`EDITORIAL_EVIDENCE_SPAN_REQUIRED:${evidenceId}`);
      const span = spanBySourceAndId.get(`${sourceId}\0${spanId}`);
      if (!span && spanById.has(spanId)) {
        throw new Error(`EDITORIAL_EVIDENCE_SPAN_SOURCE_MISMATCH:${evidenceId}`);
      }
      if (!span) throw new Error(`EDITORIAL_EVIDENCE_SPAN_INVALID:${evidenceId}`);
      return {
        evidenceId,
        sourceId,
        excerpt: span.text,
        contextNote: item.contextNote,
      };
    }),
  };
}

function parseRepairSelection(value: unknown): EditorialGroundingRepairSelection {
  const selection = objectRecord(value);
  if (!selection || Object.keys(selection).join(",") !== "repairs") {
    throw new Error("EDITORIAL_GROUNDING_REPAIR_SELECTION_INVALID");
  }
  if (!Array.isArray(selection.repairs) || selection.repairs.length === 0) {
    throw new Error("EDITORIAL_GROUNDING_REPAIR_SELECTION_EMPTY");
  }
  if (selection.repairs.length > MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST) {
    throw new Error("EDITORIAL_GROUNDING_REPAIR_SELECTION_LIMIT_EXCEEDED");
  }
  return {
    repairs: selection.repairs.map((value) => {
      const repair = objectRecord(value);
      const keys = repair ? Object.keys(repair).sort() : [];
      if (
        !repair ||
        keys.join(",") !== "evidenceId,spanId" ||
        !text(repair.evidenceId) ||
        !text(repair.spanId)
      ) throw new Error("EDITORIAL_GROUNDING_REPAIR_SELECTION_INVALID");
      return { evidenceId: text(repair.evidenceId), spanId: text(repair.spanId) };
    }),
  };
}

function applyRepairSelection(input: {
  original: EditorialAnalysisProposal;
  selection: unknown;
  candidateSpans: EditorialGroundingCandidateSpan[];
}): EditorialAnalysisProposal {
  const selection = parseRepairSelection(input.selection);
  const originalEvidence = Array.isArray(input.original.evidence)
    ? input.original.evidence
    : [];
  const evidenceById = new Map(
    originalEvidence.map((item) => [text(item.evidenceId), item]),
  );
  const spanBySourceAndId = new Map(
    input.candidateSpans.map((span) => [`${span.sourceId}\0${span.spanId}`, span]),
  );
  const selectedSpanByEvidenceId = new Map<string, string>();
  const excerptsByEvidenceId = new Map<string, string>();
  for (const repair of selection.repairs) {
    const previousSpanId = selectedSpanByEvidenceId.get(repair.evidenceId);
    if (previousSpanId === repair.spanId) {
      continue;
    }
    if (previousSpanId) {
      throw new Error(`EDITORIAL_GROUNDING_REPAIR_CONFLICTING_SPANS:${repair.evidenceId}`);
    }
    const original = evidenceById.get(repair.evidenceId);
    if (!original) {
      throw new Error(`EDITORIAL_GROUNDING_REPAIR_EVIDENCE_MISSING:${repair.evidenceId}`);
    }
    const span = spanBySourceAndId.get(
      `${text(original.sourceId)}\0${repair.spanId}`,
    );
    if (!span) {
      throw new Error(`EDITORIAL_GROUNDING_REPAIR_SPAN_MISSING:${repair.evidenceId}`);
    }
    selectedSpanByEvidenceId.set(repair.evidenceId, repair.spanId);
    excerptsByEvidenceId.set(repair.evidenceId, span.text);
  }
  return {
    ...input.original,
    evidence: originalEvidence.map((item) => {
      const excerpt = excerptsByEvidenceId.get(text(item.evidenceId));
      return excerpt === undefined ? item : { ...item, excerpt };
    }),
  };
}

export async function createValidatedEditorialAnalysisWithOneRepair(input: {
  sources: ResearchSource[];
  proposal: EditorialAnalysisProposal;
  repair: (repairInput: EditorialGroundingRepairInput) => Promise<unknown>;
}) {
  const proposalUsesSpanSelections = (Array.isArray(input.proposal.evidence)
    ? input.proposal.evidence
    : []).some((item) => text(item.spanId));
  const initialCandidateSpans = proposalUsesSpanSelections
    ? createEditorialGroundingCandidateSpans(input.sources)
    : [];
  try {
    if (proposalUsesSpanSelections) {
      const knownSourceIds = new Set(input.sources.map((source) => source.sourceId));
      const unknownEvidence = (input.proposal.evidence || []).find((item) =>
        !knownSourceIds.has(text(item.sourceId))
      );
      if (unknownEvidence) {
        throw new Error(`EDITORIAL_EVIDENCE_SOURCE_MISSING:${text(unknownEvidence.evidenceId)}`);
      }
    }
    return createValidatedEditorialAnalysis({
      sources: input.sources,
      proposal: proposalUsesSpanSelections
        ? installCanonicalEditorialEvidenceSpans({
            proposal: input.proposal,
            candidateSpans: initialCandidateSpans,
          })
        : input.proposal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const recoverable = message.startsWith(UNGROUNDED_EXCERPT_PREFIX)
      || message.startsWith("EDITORIAL_EVIDENCE_SPAN_REQUIRED:")
      || message.startsWith("EDITORIAL_EVIDENCE_SPAN_INVALID:");
    if (!recoverable) throw error;

    const invalidEvidence = discoverInvalidEvidence(input);
    const invalidSourceIds = new Set(invalidEvidence.map((item) => item.sourceId));
    const invalidSources = input.sources.filter((source) =>
      invalidSourceIds.has(source.sourceId)
    );
    const candidateSpans = createEditorialGroundingCandidateSpans(invalidSources);
    if (candidateSpans.length > MAX_EDITORIAL_GROUNDING_SPANS_PER_REQUEST) {
      throw new Error("EDITORIAL_GROUNDING_REPAIR_CANDIDATE_LIMIT_EXCEEDED");
    }
    const selection = await input.repair({
      diagnosticCategory: message.split(":", 1)[0],
      invalidEvidence,
      candidateSpans,
      failingSourceId: message.slice(UNGROUNDED_EXCERPT_PREFIX.length),
    });
    return createValidatedEditorialAnalysis({
      sources: input.sources,
      proposal: applyRepairSelection({
        original: input.proposal,
        selection,
        candidateSpans,
      }),
    });
  }
}
