import type { CreatorScriptBuildSnapshot } from "./creatorScriptBuild.ts";
import type {
  CreatorScriptBuildRuntime,
  CreatorScriptBuildStatusProjection,
} from "./creatorScriptBuildRuntime.server.ts";

export type CreatorScriptBuildApiResult = Readonly<{
  status: number;
  body: Readonly<Record<string, unknown>>;
}>;

export type CreatorScriptBuildApiDependencies = Readonly<{
  authenticate: (request: Request) => Promise<{ ownerId: string }>;
  featureEnabled: () => boolean;
  createSnapshot: (input: {
    ownerId: string;
    projectId: string;
    expectedProjectUpdatedAt: string;
  }) => Promise<CreatorScriptBuildSnapshot>;
  createRuntime: (input: {
    ownerId: string;
    projectId?: string;
    buildId?: string;
  }) => CreatorScriptBuildRuntime | Promise<CreatorScriptBuildRuntime>;
}>;

function response(status: number, body: Record<string, unknown>): CreatorScriptBuildApiResult {
  return { status, body: Object.freeze(body) };
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim().slice(0, maxLength)
    : "";
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "CREATOR_SCRIPT_BUILD_INTERNAL";
  const value = error as Record<string, unknown>;
  return text(value.code, 160) || text(value.message, 160) ||
    "CREATOR_SCRIPT_BUILD_INTERNAL";
}

function terminalStatus(
  projection: CreatorScriptBuildStatusProjection,
): CreatorScriptBuildApiResult {
  if (projection.state === "FAILED") {
    return response(422, {
      ...projection,
      success: false,
      code: "BUILD_FAILED",
    });
  }
  if (projection.state === "STALE") {
    return response(409, {
      ...projection,
      success: false,
      code: "PROJECT_STALE",
    });
  }
  return response(200, { ...projection });
}

function mappedError(error: unknown): CreatorScriptBuildApiResult {
  const code = errorCode(error);
  if (code === "AUTH_REQUIRED" || code === "authentication_required") {
    return response(401, { success: false, code: "AUTH_REQUIRED" });
  }
  if (
    code === "PROJECT_OR_BUILD_NOT_FOUND" ||
    code === "CREATOR_SCRIPT_BUILD_NOT_FOUND"
  ) {
    return response(404, {
      success: false,
      code: "PROJECT_OR_BUILD_NOT_FOUND",
    });
  }
  if (code === "PROJECT_STALE" || code.includes("PROJECT_STALE")) {
    return response(409, { success: false, code: "PROJECT_STALE" });
  }
  if (
    code.includes("STATE_INVALID") ||
    code === "CREATOR_SCRIPT_BUILD_OPERATION_RECONCILIATION_REQUIRED" ||
    code === "CREATOR_SCRIPT_BUILD_PERSISTENCE_RECONCILIATION_REQUIRED" ||
    code === "CREATOR_SCRIPT_BUILD_REPAIR_PHASE_INCOMPLETE"
  ) {
    return response(409, {
      success: false,
      code: "BUILD_STATE_CONFLICT",
    });
  }
  if (
    error && typeof error === "object" &&
    (error as { status?: unknown }).status === 422
  ) {
    return response(422, { success: false, code });
  }
  return response(500, {
    success: false,
    code: "CREATOR_SCRIPT_BUILD_INTERNAL",
  });
}

async function authenticate(
  request: Request,
  dependencies: CreatorScriptBuildApiDependencies,
) {
  try {
    return await dependencies.authenticate(request);
  } catch {
    return null;
  }
}

export function createCreatorScriptBuildApiController(
  dependencies: CreatorScriptBuildApiDependencies,
) {
  const gate = async (request: Request) => {
    const principal = await authenticate(request, dependencies);
    if (!principal) {
      return {
        principal: null,
        rejected: response(401, { success: false, code: "AUTH_REQUIRED" }),
      };
    }
    if (!dependencies.featureEnabled()) {
      return {
        principal: null,
        rejected: response(503, {
          success: false,
          code: "CREATOR_SCRIPT_BUILD_V2_DISABLED",
        }),
      };
    }
    return { principal, rejected: null };
  };

  const get = async (request: Request): Promise<CreatorScriptBuildApiResult> => {
    const guarded = await gate(request);
    if (guarded.rejected || !guarded.principal) return guarded.rejected!;
    const buildId = text(new URL(request.url).searchParams.get("buildId"), 160);
    if (!buildId) {
      return response(400, {
        success: false,
        code: "CREATOR_SCRIPT_BUILD_ID_REQUIRED",
      });
    }
    try {
      const runtime = await dependencies.createRuntime({
        ownerId: guarded.principal.ownerId,
        buildId,
      });
      return terminalStatus(await runtime.status({
        ownerId: guarded.principal.ownerId,
        buildId,
      }));
    } catch (error) {
      return mappedError(error);
    }
  };

  const post = async (request: Request): Promise<CreatorScriptBuildApiResult> => {
    const guarded = await gate(request);
    if (guarded.rejected || !guarded.principal) return guarded.rejected!;
    let body: Record<string, unknown>;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > 16 * 1024) {
        return response(413, {
          success: false,
          code: "CREATOR_SCRIPT_BUILD_REQUEST_TOO_LARGE",
        });
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("invalid");
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return response(400, {
        success: false,
        code: "CREATOR_SCRIPT_BUILD_REQUEST_INVALID",
      });
    }

    try {
      if (body.action === "start") {
        const projectId = text(body.projectId, 120);
        const expectedProjectUpdatedAt = text(
          body.expectedProjectUpdatedAt,
          120,
        );
        if (!projectId || !expectedProjectUpdatedAt) {
          return response(400, {
            success: false,
            code: "CREATOR_SCRIPT_BUILD_START_INPUT_INVALID",
          });
        }
        const snapshot = await dependencies.createSnapshot({
          ownerId: guarded.principal.ownerId,
          projectId,
          expectedProjectUpdatedAt,
        });
        const runtime = await dependencies.createRuntime({
          ownerId: guarded.principal.ownerId,
          projectId,
        });
        const requested = await runtime.request({
          ownerId: guarded.principal.ownerId,
          snapshot,
        });
        const projection = await runtime.status({
          ownerId: guarded.principal.ownerId,
          buildId: requested.build.buildId,
          disposition: requested.created ? "CREATED" : requested.resolution,
        });
        return terminalStatus(projection);
      }
      if (body.action === "advance") {
        const buildId = text(body.buildId, 160);
        if (!buildId) {
          return response(400, {
            success: false,
            code: "CREATOR_SCRIPT_BUILD_ID_REQUIRED",
          });
        }
        const runtime = await dependencies.createRuntime({
          ownerId: guarded.principal.ownerId,
          buildId,
        });
        return terminalStatus(await runtime.advance({
          ownerId: guarded.principal.ownerId,
          buildId,
        }));
      }
      return response(400, {
        success: false,
        code: "CREATOR_SCRIPT_BUILD_ACTION_INVALID",
      });
    } catch (error) {
      return mappedError(error);
    }
  };

  return Object.freeze({ get, post });
}

export function creatorScriptBuildV2Enabled(value = process.env.NEXT_PUBLIC_CREATOR_SCRIPT_BUILD_V2_ENABLED) {
  return value?.trim().toLowerCase() === "true";
}
