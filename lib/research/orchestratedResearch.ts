import type { ResearchSearchProvider } from "../providers/research/types.ts";
import type { ResearchSource } from "./sourceContract.ts";
import { classifyResearchSourceDirectness } from "./sourceAssessment.ts";
import type {
  ResearchOrchestrationPlan,
  ResearchSearchLane,
} from "./researchOrchestration.ts";

export type ResearchLaneExecution = {
  laneId: string;
  purpose: ResearchSearchLane["purpose"];
  required: boolean;
  status: "ready" | "failed";
  sourceIds: string[];
  providerRequestId: string | null;
  providerCostUsd: number | null;
  errorMessage: string | null;
};

export type OrchestratedResearchResult = {
  version: "0.10H-1G";
  plan: ResearchOrchestrationPlan;
  sources: ResearchSource[];
  lanes: ResearchLaneExecution[];
  economics: {
    providerRequestCount: number;
    knownProviderCostUsd: number;
    costComplete: boolean;
  };
};

export class ResearchOrchestrationError extends Error {
  readonly laneId: string;

  constructor(laneId: string, message: string) {
    super(message);
    this.name = "ResearchOrchestrationError";
    this.laneId = laneId;
  }
}

const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

const MEDIUM_HOST_PATTERN = /^(?:[a-z0-9-]+\.)*medium\.com$/iu;
const MEDIUM_POST_ID_PATTERN = /-([0-9a-f]{12})\/?$/iu;
const RESEARCH_SOURCE_REFERENCE_PATTERN =
  /^([a-z][a-z0-9_-]*):(https?:\/\/.*)$/iu;

export function canonicalResearchUrl(rawUrl: string) {
  const value = rawUrl.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    const mediumPostId = MEDIUM_HOST_PATTERN.test(url.hostname)
      ? url.pathname.match(MEDIUM_POST_ID_PATTERN)?.[1]?.toLowerCase()
      : null;
    if (mediumPostId) {
      url.pathname = `/p/${mediumPostId}`;
      url.search = "";
    }
    return url.toString();
  } catch {
    return value.replace(/#.*$/, "").replace(/\/+$/, "");
  }
}

/**
 * Canonicalizes URL-bearing source references without weakening equality for
 * provider adapters or human-readable work names. Medium article slugs are
 * presentation metadata; the stable post id is the source identity.
 */
export function canonicalResearchReference(rawReference: string) {
  const value = rawReference.trim();
  if (!value) return "";

  const sourceReference = value.match(RESEARCH_SOURCE_REFERENCE_PATTERN);
  if (sourceReference) {
    return `${sourceReference[1].toLowerCase()}:${canonicalResearchUrl(sourceReference[2])}`;
  }
  if (/^https?:\/\//iu.test(value)) return canonicalResearchUrl(value);
  return value;
}

function roundedUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function hasVerifiedFirstPartyProvenance(source: ResearchSource) {
  return classifyResearchSourceDirectness(source).reason ===
    "verified_first_party_provenance";
}

/**
 * Executes a pre-built research plan sequentially through the existing provider
 * contract. It deduplicates overlapping sources across lanes and preserves lane
 * provenance without introducing a second research engine.
 */
export async function executeResearchOrchestration(input: {
  plan: ResearchOrchestrationPlan;
  provider: ResearchSearchProvider;
}): Promise<OrchestratedResearchResult> {
  const canonicalSources = new Map<string, ResearchSource>();
  const canonicalSourceIds = new Map<string, string>();
  const laneExecutions: ResearchLaneExecution[] = [];
  let knownProviderCostUsd = 0;
  let costComplete = true;
  let providerRequestCount = 0;

  for (const lane of input.plan.lanes) {
    try {
      providerRequestCount += 1;
      const result = await input.provider.search(lane.input);
      const sourceIds: string[] = [];

      if (result.providerCostUsd === null) {
        costComplete = false;
      } else {
        knownProviderCostUsd += result.providerCostUsd;
      }

      for (const source of result.sources) {
        const canonicalUrl = canonicalResearchUrl(source.url);
        const key = canonicalUrl || source.sourceId;
        let canonicalSourceId = canonicalSourceIds.get(key);

        if (!canonicalSourceId) {
          canonicalSourceId = source.sourceId;
          canonicalSourceIds.set(key, canonicalSourceId);
          canonicalSources.set(canonicalSourceId, source);
        } else {
          const retained = canonicalSources.get(canonicalSourceId);
          if (
            retained &&
            !hasVerifiedFirstPartyProvenance(retained) &&
            hasVerifiedFirstPartyProvenance(source)
          ) {
            canonicalSources.set(canonicalSourceId, {
              ...source,
              sourceId: canonicalSourceId,
            });
          }
        }

        if (!sourceIds.includes(canonicalSourceId)) {
          sourceIds.push(canonicalSourceId);
        }
      }

      laneExecutions.push({
        laneId: lane.laneId,
        purpose: lane.purpose,
        required: lane.required,
        status: "ready",
        sourceIds,
        providerRequestId: result.providerRequestId,
        providerCostUsd: result.providerCostUsd,
        errorMessage: null,
      });
    } catch (error) {
      costComplete = false;
      const message = error instanceof Error ? error.message : "Research lane failed.";

      if (lane.required) {
        throw new ResearchOrchestrationError(
          lane.laneId,
          `RESEARCH_REQUIRED_LANE_FAILED:${lane.laneId}:${message}`,
        );
      }

      laneExecutions.push({
        laneId: lane.laneId,
        purpose: lane.purpose,
        required: lane.required,
        status: "failed",
        sourceIds: [],
        providerRequestId: null,
        providerCostUsd: null,
        errorMessage: message,
      });
    }
  }

  return {
    version: "0.10H-1G",
    plan: input.plan,
    sources: [...canonicalSources.values()],
    lanes: laneExecutions,
    economics: {
      providerRequestCount,
      knownProviderCostUsd: roundedUsd(knownProviderCostUsd),
      costComplete,
    },
  };
}
