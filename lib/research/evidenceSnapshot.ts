import {
  createResearchClaimEvidenceGraph,
  type ResearchClaimEvidenceGraph,
} from "./claimEvidenceGraph.ts";
import type { ResearchSourceAssessment } from "./sourceAssessment.ts";

export type ResearchEvidenceSnapshot = {
  version: "0.10H-1C";
  snapshotId: string;
  topic: string;
  createdAt: string;
  graphVersion: ResearchClaimEvidenceGraph["version"];
  fingerprint: string;
  graph: ResearchClaimEvidenceGraph;
  sourceAssessments: ResearchSourceAssessment[];
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
}

function fnv1a64(value: string) {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ (code + index), 0x85ebca6b);
  }

  return `${(left >>> 0).toString(16).padStart(8, "0")}${(
    right >>> 0
  )
    .toString(16)
    .padStart(8, "0")}`;
}

function fingerprintEvidencePackage(value: unknown) {
  const canonical = JSON.stringify(canonicalize(value));
  return `H1C-${fnv1a64(canonical)}-${canonical.length}`;
}

/**
 * Freezes the editorial evidence package used by downstream script work.
 * The snapshot is intentionally lightweight: no vector database, no hidden
 * truth ranking and no silent repair of broken source/evidence references.
 */
export function createResearchEvidenceSnapshot(input: {
  snapshotId: string;
  topic: string;
  createdAt?: string;
  graph: ResearchClaimEvidenceGraph;
  sourceAssessments?: ResearchSourceAssessment[];
}): ResearchEvidenceSnapshot {
  const snapshotId = input.snapshotId.trim();
  const topic = input.topic.trim();
  const createdAt = input.createdAt || new Date().toISOString();

  if (!snapshotId) throw new Error("SNAPSHOT_ID_REQUIRED");
  if (!topic) throw new Error("SNAPSHOT_TOPIC_REQUIRED");
  if (!createdAt.trim()) throw new Error("SNAPSHOT_CREATED_AT_REQUIRED");

  const graph = createResearchClaimEvidenceGraph({
    sources: input.graph.sources,
    claims: input.graph.claims,
    evidence: input.graph.evidence,
    links: input.graph.links,
  });
  const sourceIds = new Set(graph.sources.map((source) => source.sourceId));
  const sourceAssessments = [...(input.sourceAssessments || [])];
  const assessmentIds = new Set<string>();

  for (const assessment of sourceAssessments) {
    if (!sourceIds.has(assessment.sourceId)) {
      throw new Error(`SNAPSHOT_ASSESSMENT_SOURCE_MISSING:${assessment.sourceId}`);
    }
    if (assessmentIds.has(assessment.sourceId)) {
      throw new Error(`SNAPSHOT_ASSESSMENT_DUPLICATE:${assessment.sourceId}`);
    }
    assessmentIds.add(assessment.sourceId);
  }

  const fingerprint = fingerprintEvidencePackage({
    graph,
    sourceAssessments,
  });

  return {
    version: "0.10H-1C",
    snapshotId,
    topic,
    createdAt,
    graphVersion: graph.version,
    fingerprint,
    graph,
    sourceAssessments,
  };
}
