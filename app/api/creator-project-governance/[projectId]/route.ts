import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import {
  CREATOR_USED_MEDIA_GOVERNANCE_VERSION,
  resolveCreatorProjectUsedMediaGovernance,
} from "@/lib/creator/usedMediaGovernance.server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
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

    const project = await getPersistenceServices().projectRepository.getForOwner(
      normalizedProjectId,
      principal.id,
    );
    if (!project) return json({ error: "CreatorLab project was not found." }, 404);
    if (project.flow_type !== "creator_lab") {
      return json({ error: "Project governance is available for CreatorLab projects." }, 409);
    }

    const result = await resolveCreatorProjectUsedMediaGovernance({
      ownerUserId: principal.id,
      project,
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
