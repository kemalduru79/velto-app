import { NextResponse } from "next/server";

import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import {
  createCreatorScriptBuildApiController,
  creatorScriptBuildV2Enabled,
} from "@/lib/creator/creatorScriptBuildApi.server";
import { createCreatorScriptBuildProviderExecutors } from "@/lib/creator/creatorScriptBuildProviders.server";
import { createCreatorScriptBuildRuntime } from "@/lib/creator/creatorScriptBuildRuntime.server";
import { createCreatorScriptBuildSnapshotFromProject } from "@/lib/creator/creatorScriptBuildSnapshot.server";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";
export const maxDuration = 300;

const controller = createCreatorScriptBuildApiController({
  authenticate: async (request) => {
    try {
      const principal = await authenticateRequest(request);
      return { ownerId: principal.id };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new Error("AUTH_REQUIRED");
      }
      throw error;
    }
  },
  featureEnabled: creatorScriptBuildV2Enabled,
  createSnapshot: async (input) => {
    const services = getPersistenceServices();
    const result = await createCreatorScriptBuildSnapshotFromProject({
      ...input,
      projectRepository: services.projectRepository,
    });
    return result.snapshot;
  },
  createRuntime: async ({ ownerId, projectId, buildId }) => {
    const services = getPersistenceServices();
    let authoritativeProjectId = projectId || "";
    if (!authoritativeProjectId && buildId) {
      const build = await services.creatorScriptBuildRepository.getForOwner(
        buildId,
        ownerId,
      );
      authoritativeProjectId = build?.projectId || "";
    }
    return createCreatorScriptBuildRuntime({
      buildRepository: services.creatorScriptBuildRepository,
      projectRepository: services.projectRepository,
      providers: createCreatorScriptBuildProviderExecutors({
        ownerId,
        projectId: authoritativeProjectId,
      }),
    });
  },
});

function next(result: Awaited<ReturnType<typeof controller.get>>) {
  return NextResponse.json(result.body, { status: result.status });
}

export async function GET(request: Request) {
  return next(await controller.get(request));
}

export async function POST(request: Request) {
  return next(await controller.post(request));
}
