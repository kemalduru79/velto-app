import { createHash } from "node:crypto";
import {
  createEditorialGroundingPassages,
  type EditorialGroundingCandidateSpan,
} from "./editorialGroundingRepair.ts";
import { canonicalResearchUrl } from "./orchestratedResearch.ts";
import type { ResearchSource } from "./sourceContract.ts";

export const EDITORIAL_EVIDENCE_SPAN_CATALOG_VERSION = "0.19B" as const;
export const EDITORIAL_EVIDENCE_SPAN_IDENTITY_VERSION =
  "editorial-evidence-span-v2" as const;
export const EDITORIAL_EVIDENCE_SEGMENTATION_VERSION =
  "editorial-grounding-segmentation-v1" as const;

export type EditorialEvidenceSpanRange = {
  start: number;
  end: number;
  unit: "utf16_code_unit";
};

export type EditorialEvidenceSpanV2 = EditorialGroundingCandidateSpan & {
  identityVersion: typeof EDITORIAL_EVIDENCE_SPAN_IDENTITY_VERSION;
  segmentationVersion: typeof EDITORIAL_EVIDENCE_SEGMENTATION_VERSION;
  canonicalSourceIdentity: string;
  sourceContentDigest: string;
  passageDigest: string;
  range: EditorialEvidenceSpanRange;
};

export type EditorialEvidenceSpanCatalog = {
  version: typeof EDITORIAL_EVIDENCE_SPAN_CATALOG_VERSION;
  segmentationVersion: typeof EDITORIAL_EVIDENCE_SEGMENTATION_VERSION;
  spans: EditorialEvidenceSpanV2[];
};

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

function clean(value: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Canonical source identity precedence:
 * 1. repository-authoritative canonical URL;
 * 2. adapter plus provider external ID;
 * 3. canonical sourceId fallback.
 */
export function createCanonicalEditorialSourceIdentity(source: ResearchSource) {
  const canonicalUrl = canonicalResearchUrl(source.url);
  if (canonicalUrl) {
    return `url:${canonicalUrl}`;
  }
  const externalId = clean(source.externalId);
  if (externalId) {
    return `adapter-external:${canonicalJson({
      adapterId: source.adapterId,
      externalId,
    })}`;
  }
  const sourceId = source.sourceId.trim();
  if (!sourceId) {
    throw new Error("EDITORIAL_EVIDENCE_CATALOG_SOURCE_ID_REQUIRED");
  }
  return `source-id:${sourceId}`;
}

function createSourceContentDigest(source: ResearchSource) {
  return digest(canonicalJson({
    version: "editorial-evidence-source-content-v1",
    evidenceBearingText: source.summary || "",
  }));
}

function createSourceAuthoritySemantics(
  source: ResearchSource,
  canonicalSourceIdentity: string,
) {
  return canonicalJson({
    canonicalSourceIdentity,
    sourceId: source.sourceId,
    adapterId: source.adapterId,
    mediaKind: source.mediaKind,
    externalId: clean(source.externalId) || null,
  });
}

function createPassageDigest(text: string) {
  return digest(text.replace(/\s+/gu, " ").trim());
}

function createSpanIdentity(input: {
  canonicalSourceIdentity: string;
  sourceContentDigest: string;
  passageDigest: string;
  range: EditorialEvidenceSpanRange;
}) {
  return canonicalJson({
    identityVersion: EDITORIAL_EVIDENCE_SPAN_IDENTITY_VERSION,
    segmentationVersion: EDITORIAL_EVIDENCE_SEGMENTATION_VERSION,
    canonicalSourceIdentity: input.canonicalSourceIdentity,
    sourceContentDigest: input.sourceContentDigest,
    range: input.range,
    passageDigest: input.passageDigest,
  });
}

/**
 * Builds a serializable, order-independent catalog for a frozen research
 * snapshot. Source metrics and presentation metadata never affect identity.
 */
export function createEditorialEvidenceSpanCatalog(
  sources: readonly ResearchSource[],
): EditorialEvidenceSpanCatalog {
  const sourceIdentityBySourceId = new Map<string, string>();
  const sourceAuthorityByCanonicalIdentity = new Map<string, {
    contentDigest: string;
    authoritySemantics: string;
  }>();
  const spanSemanticsById = new Map<string, string>();
  const spans: EditorialEvidenceSpanV2[] = [];

  for (const source of sources) {
    if (!source.sourceId.trim()) {
      throw new Error("EDITORIAL_EVIDENCE_CATALOG_SOURCE_ID_REQUIRED");
    }
    const canonicalSourceIdentity =
      createCanonicalEditorialSourceIdentity(source);
    const sourceContentDigest = createSourceContentDigest(source);
    const authoritySemantics = createSourceAuthoritySemantics(
      source,
      canonicalSourceIdentity,
    );

    const existingIdentity = sourceIdentityBySourceId.get(source.sourceId);
    if (existingIdentity !== undefined) {
      throw new Error(
        existingIdentity === canonicalSourceIdentity
          ? `EDITORIAL_EVIDENCE_CATALOG_SOURCE_DUPLICATE:${source.sourceId}`
          : `EDITORIAL_EVIDENCE_CATALOG_SOURCE_ID_COLLISION:${source.sourceId}`,
      );
    }
    sourceIdentityBySourceId.set(source.sourceId, canonicalSourceIdentity);

    const existingAuthority = sourceAuthorityByCanonicalIdentity.get(
      canonicalSourceIdentity,
    );
    if (existingAuthority) {
      if (existingAuthority.contentDigest !== sourceContentDigest) {
        throw new Error(
          "EDITORIAL_EVIDENCE_CATALOG_SOURCE_CONTENT_CONFLICT",
        );
      }
      if (existingAuthority.authoritySemantics !== authoritySemantics) {
        throw new Error(
          "EDITORIAL_EVIDENCE_CATALOG_SOURCE_IDENTITY_COLLISION",
        );
      }
      throw new Error("EDITORIAL_EVIDENCE_CATALOG_SOURCE_DUPLICATE");
    }
    sourceAuthorityByCanonicalIdentity.set(canonicalSourceIdentity, {
      contentDigest: sourceContentDigest,
      authoritySemantics,
    });

    const content = source.summary || "";
    for (const passage of createEditorialGroundingPassages(content)) {
      const range: EditorialEvidenceSpanRange = {
        start: passage.start,
        end: passage.end,
        unit: "utf16_code_unit",
      };
      const passageDigest = createPassageDigest(passage.text);
      const identity = createSpanIdentity({
        canonicalSourceIdentity,
        sourceContentDigest,
        passageDigest,
        range,
      });
      const spanId = `span:v2:${digest(identity)}`;
      const spanSemantics = canonicalJson({
        identity,
        sourceId: source.sourceId,
        text: passage.text,
        evidenceSpecificity: passage.evidenceSpecificity,
      });
      const existingSpanSemantics = spanSemanticsById.get(spanId);
      if (
        existingSpanSemantics !== undefined &&
        existingSpanSemantics !== spanSemantics
      ) {
        throw new Error(
          `EDITORIAL_EVIDENCE_CATALOG_SPAN_IDENTITY_COLLISION:${spanId}`,
        );
      }
      if (existingSpanSemantics !== undefined) {
        throw new Error(`EDITORIAL_EVIDENCE_CATALOG_SPAN_DUPLICATE:${spanId}`);
      }
      spanSemanticsById.set(spanId, spanSemantics);
      spans.push({
        spanId,
        sourceId: source.sourceId,
        text: passage.text,
        evidenceSpecificity: passage.evidenceSpecificity,
        identityVersion: EDITORIAL_EVIDENCE_SPAN_IDENTITY_VERSION,
        segmentationVersion: EDITORIAL_EVIDENCE_SEGMENTATION_VERSION,
        canonicalSourceIdentity,
        sourceContentDigest,
        passageDigest,
        range,
      });
    }
  }

  return {
    version: EDITORIAL_EVIDENCE_SPAN_CATALOG_VERSION,
    segmentationVersion: EDITORIAL_EVIDENCE_SEGMENTATION_VERSION,
    spans: spans.toSorted((left, right) => left.spanId.localeCompare(right.spanId)),
  };
}

export function getEditorialEvidenceSpanById(
  catalog: EditorialEvidenceSpanCatalog,
  spanId: string,
) {
  return catalog.spans.find((span) => span.spanId === spanId) || null;
}

export function assertEditorialEvidenceSpanOwnership(input: {
  catalog: EditorialEvidenceSpanCatalog;
  spanId: string;
  sourceId: string;
}) {
  const span = getEditorialEvidenceSpanById(input.catalog, input.spanId);
  if (!span) {
    throw new Error(`EDITORIAL_EVIDENCE_CATALOG_SPAN_NOT_FOUND:${input.spanId}`);
  }
  if (span.sourceId !== input.sourceId) {
    throw new Error(
      `EDITORIAL_EVIDENCE_CATALOG_SPAN_SOURCE_MISMATCH:${input.spanId}`,
    );
  }
  return span;
}
