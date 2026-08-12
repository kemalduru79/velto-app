const PROJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const CREATOR_SCENE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CREATOR_VIDEO_RESERVED_CLIENT_FIELDS = [
  "taskId",
  "nativeTaskId",
  "provider",
  "providerKey",
  "providerRequestId",
  "queueJobId",
  "creditReservationId",
  "reservedCredits",
  "creditSettlementMode",
  "userId",
  "user_id",
  "ownerUserId",
  "owner_user_id",
] as const;

export type CreatorVideoProjectBinding =
  | { mode: "saved_project"; requestedProjectId: string }
  | { mode: "authenticated_draft"; requestedProjectId: null };

export type CreatorVideoRequestBoundaryResult =
  | { ok: true; body: Record<string, unknown>; projectBinding: CreatorVideoProjectBinding }
  | { ok: false; status: 400; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeCreatorVideoProjectBinding(
  value: unknown,
  supplied: boolean,
): CreatorVideoProjectBinding | null {
  if (!supplied || value === null) {
    return { mode: "authenticated_draft", requestedProjectId: null };
  }
  if (typeof value !== "string") return null;
  const projectId = value.trim();
  if (!projectId) {
    return { mode: "authenticated_draft", requestedProjectId: null };
  }
  if (!PROJECT_ID_PATTERN.test(projectId)) return null;
  return { mode: "saved_project", requestedProjectId: projectId };
}

export function validateCreatorVideoRequestBoundary(
  value: unknown,
): CreatorVideoRequestBoundaryResult {
  if (!isRecord(value)) {
    return { ok: false, status: 400, message: "Invalid JSON request body." };
  }
  const nestedPayload = isRecord(value.payload) ? value.payload : null;
  const reserved = CREATOR_VIDEO_RESERVED_CLIENT_FIELDS.find(
    (field) =>
      Object.prototype.hasOwnProperty.call(value, field) ||
      (nestedPayload !== null && Object.prototype.hasOwnProperty.call(nestedPayload, field)),
  );
  if (reserved) {
    return { ok: false, status: 400, message: "Client-supplied task binding is not allowed." };
  }
  const projectBinding = normalizeCreatorVideoProjectBinding(
    value.projectId,
    Object.prototype.hasOwnProperty.call(value, "projectId"),
  );
  if (!projectBinding) {
    return { ok: false, status: 400, message: "projectId is invalid." };
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "creatorSceneId") &&
    (typeof value.creatorSceneId !== "string" ||
      !CREATOR_SCENE_ID_PATTERN.test(value.creatorSceneId))
  ) {
    return { ok: false, status: 400, message: "creatorSceneId is invalid." };
  }
  return { ok: true, body: value, projectBinding };
}

type CanonicalCreatorVideoQueueInput = {
  userId: string;
  canonicalProjectId: string | null;
  publicTaskId: string;
  nativeTaskId: string;
  provider: "runway" | "veo";
  sceneId: unknown;
  creatorSceneId?: string | null;
  qualityMode: unknown;
  creditReservationId: string | null;
  reservedCredits: number;
  traceId: string | null;
};

export function buildCanonicalCreatorVideoQueueInput(
  input: CanonicalCreatorVideoQueueInput,
) {
  return {
    userId: input.userId,
    projectId: input.canonicalProjectId,
    payload: {
      taskId: input.publicTaskId,
      nativeTaskId: input.nativeTaskId,
      sceneId: input.sceneId,
      creatorSceneId: input.creatorSceneId || null,
      qualityMode: input.qualityMode,
      provider: input.provider,
      creditReservationId: input.creditReservationId,
      reservedCredits: input.reservedCredits,
      creditSettlementMode: "provider_dispatch",
      traceId: input.traceId,
    },
  } as const;
}
