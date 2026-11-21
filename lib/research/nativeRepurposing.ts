import {
  normalizeCreatorSourceMediaMetadata,
  type CreatorSourceMediaMetadata,
} from "../creator/sourceMedia.ts";
import type {
  ResearchClaim,
  ResearchClaimEvidenceLink,
  ResearchEvidence,
} from "./claimEvidenceGraph.ts";
import type { ResearchEvidenceSnapshot } from "./evidenceSnapshot.ts";
import type { ResearchSource } from "./sourceContract.ts";
import type { ResearchSourceAssessment } from "./sourceAssessment.ts";

export const CREATOR_NATIVE_DERIVATIVE_VERSION = "0.10H-6" as const;

export type CreatorNativeDerivativeFormat =
  | "youtube_long_form"
  | "podcast"
  | "short_reel"
  | "carousel_text";

const NATIVE_DERIVATIVE_FORMATS = new Set<CreatorNativeDerivativeFormat>([
  "youtube_long_form",
  "podcast",
  "short_reel",
  "carousel_text",
]);

export type CreatorNativeDerivativeStructure =
  | {
      format: "youtube_long_form";
      hook: string;
      sections: string[];
      closing: string;
    }
  | {
      format: "podcast";
      opening: string;
      segments: string[];
      closing: string;
    }
  | {
      format: "short_reel";
      hook: string;
      microArgument: string;
      pacingBeats: string[];
      payoff: string;
    }
  | {
      format: "carousel_text";
      title: string;
      slides: string[];
      closingCaption: string;
    };

export type CreatorDerivativeGovernedSourceMedia = {
  sourceId: string;
  sourceMedia: CreatorSourceMediaMetadata;
};

export type CreatorNativeDerivative = {
  version: typeof CREATOR_NATIVE_DERIVATIVE_VERSION;
  derivativeId: string;
  format: CreatorNativeDerivativeFormat;
  researchPolicy: "reuse_parent_evidence";
  parentEvidence: {
    snapshotId: string;
    fingerprint: string;
    version: ResearchEvidenceSnapshot["version"];
    graphVersion: ResearchEvidenceSnapshot["graphVersion"];
  };
  structure: CreatorNativeDerivativeStructure;
  lineage: {
    claims: ResearchClaim[];
    evidence: ResearchEvidence[];
    links: ResearchClaimEvidenceLink[];
    sources: ResearchSource[];
    sourceAssessments: ResearchSourceAssessment[];
    governedSourceMedia: CreatorDerivativeGovernedSourceMedia[];
  };
};

function clean(value: unknown, maxLength = 20_000) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function required(value: unknown, code: string) {
  const normalized = clean(value);
  if (!normalized) throw new Error(code);
  return normalized;
}

function requiredList(value: unknown, code: string) {
  if (!Array.isArray(value)) throw new Error(code);
  const items = value.map((item) => clean(item)).filter(Boolean);
  if (items.length === 0 || items.length !== value.length) throw new Error(code);
  return items;
}

function normalizeStructure(
  format: CreatorNativeDerivativeFormat,
  value: CreatorNativeDerivativeStructure,
): CreatorNativeDerivativeStructure {
  if (!value || value.format !== format) {
    throw new Error("NATIVE_DERIVATIVE_STRUCTURE_FORMAT_MISMATCH");
  }

  switch (value.format) {
    case "youtube_long_form":
      return {
        format: value.format,
        hook: required(value.hook, "NATIVE_LONG_FORM_HOOK_REQUIRED"),
        sections: requiredList(value.sections, "NATIVE_LONG_FORM_SECTIONS_REQUIRED"),
        closing: required(value.closing, "NATIVE_LONG_FORM_CLOSING_REQUIRED"),
      };
    case "podcast":
      return {
        format: value.format,
        opening: required(value.opening, "NATIVE_PODCAST_OPENING_REQUIRED"),
        segments: requiredList(value.segments, "NATIVE_PODCAST_SEGMENTS_REQUIRED"),
        closing: required(value.closing, "NATIVE_PODCAST_CLOSING_REQUIRED"),
      };
    case "short_reel":
      return {
        format: value.format,
        hook: required(value.hook, "NATIVE_SHORT_HOOK_REQUIRED"),
        microArgument: required(
          value.microArgument,
          "NATIVE_SHORT_MICRO_ARGUMENT_REQUIRED",
        ),
        pacingBeats: requiredList(
          value.pacingBeats,
          "NATIVE_SHORT_PACING_REQUIRED",
        ),
        payoff: required(value.payoff, "NATIVE_SHORT_PAYOFF_REQUIRED"),
      };
    case "carousel_text":
      return {
        format: value.format,
        title: required(value.title, "NATIVE_CAROUSEL_TITLE_REQUIRED"),
        slides: requiredList(value.slides, "NATIVE_CAROUSEL_SLIDES_REQUIRED"),
        closingCaption: required(
          value.closingCaption,
          "NATIVE_CAROUSEL_CLOSING_REQUIRED",
        ),
      };
  }
}

/**
 * Creates a platform-native derivative from one already-frozen evidence package.
 * This domain operation has no research/provider dependency: callers must reuse
 * the supplied snapshot and explicitly choose the claims relevant to the output.
 */
export function createCreatorNativeDerivative(input: {
  derivativeId: string;
  format: CreatorNativeDerivativeFormat;
  evidenceSnapshot: ResearchEvidenceSnapshot;
  claimIds: string[];
  structure: CreatorNativeDerivativeStructure;
  governedSourceMedia?: Array<{
    sourceId: string;
    sourceMedia: unknown;
  }>;
}): CreatorNativeDerivative {
  if (!NATIVE_DERIVATIVE_FORMATS.has(input.format)) {
    throw new Error("NATIVE_DERIVATIVE_FORMAT_UNSUPPORTED");
  }
  const derivativeId = required(
    input.derivativeId,
    "NATIVE_DERIVATIVE_ID_REQUIRED",
  );
  const snapshot = input.evidenceSnapshot;
  if (!snapshot?.snapshotId || !snapshot.fingerprint || !snapshot.graph) {
    throw new Error("NATIVE_DERIVATIVE_EVIDENCE_SNAPSHOT_REQUIRED");
  }

  const requestedClaimIds = [...new Set(
    input.claimIds.map((claimId) => clean(claimId, 240)).filter(Boolean),
  )];
  if (requestedClaimIds.length === 0) {
    throw new Error("NATIVE_DERIVATIVE_CLAIMS_REQUIRED");
  }
  const claimById = new Map(
    snapshot.graph.claims.map((claim) => [claim.claimId, claim]),
  );
  for (const claimId of requestedClaimIds) {
    if (!claimById.has(claimId)) {
      throw new Error(`NATIVE_DERIVATIVE_CLAIM_MISSING:${claimId}`);
    }
  }

  const claimIdSet = new Set(requestedClaimIds);
  const links = snapshot.graph.links.filter((link) => claimIdSet.has(link.claimId));
  const evidenceIdSet = new Set(links.map((link) => link.evidenceId));
  const evidence = snapshot.graph.evidence.filter((item) =>
    evidenceIdSet.has(item.evidenceId)
  );
  const sourceIdSet = new Set(evidence.map((item) => item.sourceId));
  const sourceById = new Map(
    snapshot.graph.sources.map((source) => [source.sourceId, source]),
  );
  const governedSourceMedia = (input.governedSourceMedia || []).map((item) => {
    const sourceId = clean(item.sourceId, 240);
    if (!sourceIdSet.has(sourceId) || !sourceById.has(sourceId)) {
      throw new Error(`NATIVE_DERIVATIVE_MEDIA_SOURCE_MISSING:${sourceId}`);
    }
    return {
      sourceId,
      sourceMedia: normalizeCreatorSourceMediaMetadata(item.sourceMedia),
    };
  });

  return {
    version: CREATOR_NATIVE_DERIVATIVE_VERSION,
    derivativeId,
    format: input.format,
    researchPolicy: "reuse_parent_evidence",
    parentEvidence: {
      snapshotId: snapshot.snapshotId,
      fingerprint: snapshot.fingerprint,
      version: snapshot.version,
      graphVersion: snapshot.graphVersion,
    },
    structure: normalizeStructure(input.format, input.structure),
    lineage: {
      claims: snapshot.graph.claims.filter((claim) =>
        claimIdSet.has(claim.claimId)
      ).map((claim) => ({ ...claim })),
      evidence: evidence.map((item) => ({
        ...item,
        locator: { ...item.locator },
      })),
      links: links.map((link) => ({ ...link })),
      sources: snapshot.graph.sources.filter((source) =>
        sourceIdSet.has(source.sourceId)
      ).map((source) => ({
        ...source,
        metrics: { ...source.metrics },
        sourceMetadata: { ...source.sourceMetadata },
      })),
      sourceAssessments: snapshot.sourceAssessments.filter((assessment) =>
        sourceIdSet.has(assessment.sourceId)
      ).map((assessment) => ({
        ...assessment,
        reviewReasons: [...assessment.reviewReasons],
      })),
      governedSourceMedia,
    },
  };
}
