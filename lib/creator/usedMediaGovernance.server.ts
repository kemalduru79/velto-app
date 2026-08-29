import "server-only";

import type { CreatorEvidenceGovernanceReport } from "./evidenceGovernance";
import {
  CREATOR_USED_MEDIA_GOVERNANCE_VERSION,
  createCreatorUsedMediaGovernanceResult,
  type CreatorUsedMediaGovernanceResult,
  type CreatorUsedMediaReferenceType,
} from "./usedMediaGovernance";
import {
  getPersistenceServices,
  inspectProjectMediaReferences,
} from "@/lib/persistence";
import type { VeltoProjectApiRecord } from "@/lib/persistence/projects/types";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function creatorProjectProductionPackage(project: VeltoProjectApiRecord) {
  return project.creator_production_package ?? project.creatorProductionPackage ?? null;
}

export function creatorSyntheticDisclosurePresent(productionPackage: unknown) {
  const packageRecord = record(productionPackage);
  const publishGovernance = record(
    packageRecord.publishGovernance ?? packageRecord.publish_governance,
  );
  return publishGovernance.syntheticDisclosurePresent === true ||
    publishGovernance.synthetic_disclosure_present === true;
}

/**
 * Resolves only media that is actively referenced by current CreatorLab scenes.
 * Raw asset metadata remains server-side; callers receive the provider-neutral
 * governance report and compact counts only.
 */
export async function resolveCreatorProjectUsedMediaGovernance(input: {
  ownerUserId: string;
  project: VeltoProjectApiRecord;
}): Promise<CreatorUsedMediaGovernanceResult> {
  const services = getPersistenceServices();
  const references = inspectProjectMediaReferences(input.project).references.filter(
    (reference) =>
      reference.referenceType === "scene_image" ||
      reference.referenceType === "scene_video",
  );
  const assetByUrl = new Map<string, ReturnType<typeof services.mediaAssetRepository.findByPublicUrl>>();
  const resolveAsset = (url: string) => {
    const existing = assetByUrl.get(url);
    if (existing) return existing;
    const request = services.mediaAssetRepository.findByPublicUrl(input.ownerUserId, url);
    assetByUrl.set(url, request);
    return request;
  };
  const media = await Promise.all(
    references.map(async (reference) => ({
      referenceType: reference.referenceType as CreatorUsedMediaReferenceType,
      referenceKey: reference.referenceKey,
      asset: await resolveAsset(reference.url),
    })),
  );
  const productionPackage = creatorProjectProductionPackage(input.project);

  return createCreatorUsedMediaGovernanceResult({
    productionPackage,
    media,
    syntheticDisclosurePresent: creatorSyntheticDisclosurePresent(productionPackage),
  });
}

export function creatorGovernanceExportBlockResponse(report: CreatorEvidenceGovernanceReport) {
  return {
    ok: false,
    code: "creator_export_governance_blocked",
    error: "Final production is blocked until evidence or media governance issues are resolved.",
    creditReserved: false,
    finalProductionGate: {
      version: "3Q" as const,
      status: "blocked" as const,
      evidenceGovernanceStatus: report.status,
    },
    governance: {
      version: report.version,
      status: report.status,
      requiresManualReview: report.requiresManualReview,
      blockedIssueCount: report.blockedIssueCount,
      reviewIssueCount: report.reviewIssueCount,
      issues: report.issues,
    },
  };
}

export { CREATOR_USED_MEDIA_GOVERNANCE_VERSION };
