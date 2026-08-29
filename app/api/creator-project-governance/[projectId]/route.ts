import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import {
  CREATOR_USED_MEDIA_GOVERNANCE_VERSION,
  createCreatorUsedMediaGovernanceResult,
  type CreatorUsedMediaReferenceType,
} from "@/lib/creator/usedMediaGovernance";
import {
  getPersistenceServices,
  inspectProjectMediaReferences,
} from "@/lib/persistence";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function productionPackageForProject(project: Record<string, unknown>) {
  return project.creator_production_package ?? project.creatorProductionPackage ?? null;
}

function syntheticDisclosurePresent(productionPackage: unknown) {
  const packageRecord = record(productionPackage);
  const publishGovernance = record(
    packageRecord.publishGovernance ?? packageRecord.publish_governance,
  );
  return publishGovernance.syntheticDisclosurePresent === true ||
    publishGovernance.synthetic_disclosure_present === true;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const principal = await authenticateRequest(req);
    const { projectId } = await context.params;
    const normalizedProjectId = String(projectId || "").trim();
    if (!normalizedProjectId) return json({ error: "projectId is required." }, 400);

    const services = getPersistenceServices();
    const project = await services.projectRepository.getForOwner(
      normalizedProjectId,
      principal.id,
    );
    if (!project) return json({ error: "CreatorLab project was not found." }, 404);
    if (project.flow_type !== "creator_lab") {
      return json({ error: "Project governance is available for CreatorLab projects." }, 409);
    }

    const references = inspectProjectMediaReferences(project).references.filter(
      (reference) =>
        reference.referenceType === "scene_image" ||
        reference.referenceType === "scene_video",
    );
    const assetByUrl = new Map<string, ReturnType<typeof services.mediaAssetRepository.findByPublicUrl>>();
    const resolveAsset = (url: string) => {
      const existing = assetByUrl.get(url);
      if (existing) return existing;
      const request = services.mediaAssetRepository.findByPublicUrl(principal.id, url);
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
    const productionPackage = productionPackageForProject(project);
    const result = createCreatorUsedMediaGovernanceResult({
      productionPackage,
      media,
      syntheticDisclosurePresent: syntheticDisclosurePresent(productionPackage),
    });

    return json({
      ok: true,
      version: CREATOR_USED_MEDIA_GOVERNANCE_VERSION,
      governance: result.governance,
      summary: result.summary,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return json({ error: "A valid session is required." }, 401);
    }
    console.error("creator-project-governance error:", error);
    return json({ error: "Project governance is temporarily unavailable." }, 503);
  }
}
