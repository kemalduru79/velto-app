export const CREATOR_SCRIPT_BUILD_CLIENT_VERSION = "0.19E5B" as const;
export const CREATOR_SCRIPT_BUILD_MAX_ADVANCES = 12;

export type CreatorScriptBuildClientState =
  | "REQUESTED"
  | "SNAPSHOTTED"
  | "RESEARCH_READY"
  | "EDITORIAL_COMPILED"
  | "AUTHORITY_RESOLVED"
  | "SCRIPT_GENERATED"
  | "REPAIRING"
  | "ACCEPTED"
  | "PERSISTED"
  | "FAILED"
  | "STALE";

const CREATOR_SCRIPT_BUILD_STATES: readonly CreatorScriptBuildClientState[] = [
  "REQUESTED",
  "SNAPSHOTTED",
  "RESEARCH_READY",
  "EDITORIAL_COMPILED",
  "AUTHORITY_RESOLVED",
  "SCRIPT_GENERATED",
  "REPAIRING",
  "ACCEPTED",
  "PERSISTED",
  "FAILED",
  "STALE",
];

export type CreatorScriptBuildClientFailure = Readonly<{
  category: string;
  code: string;
  retryability: string;
}>;

export type CreatorScriptBuildClientProjection = Readonly<{
  success: boolean;
  version: string;
  buildId: string;
  state: CreatorScriptBuildClientState;
  terminal: boolean;
  disposition: string | null;
  failure: CreatorScriptBuildClientFailure | null;
  creatorScript?: unknown;
  persistence?: Readonly<{
    installedProjectRevision: string;
  }>;
}>;

export class CreatorScriptBuildClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(input: { code: string; status?: number }) {
    super(input.code);
    this.name = "CreatorScriptBuildClientError";
    this.code = input.code;
    this.status = input.status ?? 0;
  }
}

type FetchLike = typeof fetch;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim().slice(0, maxLength)
    : "";
}

function normalizeFailure(value: unknown): CreatorScriptBuildClientFailure | null {
  const raw = record(value);
  if (!raw) return null;
  const category = text(raw.category, 80);
  const code = text(raw.code, 160);
  const retryability = text(raw.retryability, 80);
  return category && code && retryability
    ? Object.freeze({ category, code, retryability })
    : null;
}

function normalizeProjection(
  value: unknown,
): CreatorScriptBuildClientProjection | null {
  const raw = record(value);
  if (!raw) return null;

  const buildId = text(raw.buildId, 160);
  const state = text(raw.state, 80) as CreatorScriptBuildClientState;
  if (
    !buildId ||
    !CREATOR_SCRIPT_BUILD_STATES.includes(state) ||
    typeof raw.terminal !== "boolean"
  ) {
    return null;
  }

  const persistenceRecord = record(raw.persistence);
  const installedProjectRevision = text(
    persistenceRecord?.installedProjectRevision,
    120,
  );

  return Object.freeze({
    success: raw.success === true,
    version: text(raw.version, 40) || "0.19E5A",
    buildId,
    state,
    terminal: raw.terminal,
    disposition: text(raw.disposition, 120) || null,
    failure: normalizeFailure(raw.failure),
    ...(Object.hasOwn(raw, "creatorScript")
      ? { creatorScript: raw.creatorScript }
      : {}),
    ...(installedProjectRevision
      ? {
          persistence: Object.freeze({
            installedProjectRevision,
          }),
        }
      : {}),
  });
}

function responseCode(value: unknown) {
  const raw = record(value);
  return text(raw?.code, 160) || "CREATOR_SCRIPT_BUILD_INTERNAL";
}

async function parseResponse(response: Response) {
  const body = await response.json().catch(() => null);
  const projection = normalizeProjection(body);

  // Terminal build projections are durable domain results even when the API
  // communicates FAILED/STALE with a non-2xx status.
  if (projection?.terminal) return projection;

  if (!response.ok) {
    throw new CreatorScriptBuildClientError({
      code: responseCode(body),
      status: response.status,
    });
  }
  if (!projection) {
    throw new CreatorScriptBuildClientError({
      code: "CREATOR_SCRIPT_BUILD_RESPONSE_INVALID",
      status: response.status,
    });
  }
  return projection;
}

async function requestJson(input: {
  fetchImpl: FetchLike;
  accessToken: string;
  method: "GET" | "POST";
  url: string;
  body?: Record<string, unknown>;
}) {
  try {
    const response = await input.fetchImpl(input.url, {
      method: input.method,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        ...(input.method === "POST"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
    });
    return await parseResponse(response);
  } catch (error) {
    if (error instanceof CreatorScriptBuildClientError) throw error;
    throw new CreatorScriptBuildClientError({
      code: "CREATOR_SCRIPT_BUILD_NETWORK_ERROR",
      status: 0,
    });
  }
}

async function startWithOneTransportRetry(input: {
  fetchImpl: FetchLike;
  accessToken: string;
  projectId: string;
  expectedProjectUpdatedAt: string;
}) {
  const body = {
    action: "start",
    projectId: input.projectId,
    expectedProjectUpdatedAt: input.expectedProjectUpdatedAt,
  };
  try {
    return await requestJson({
      ...input,
      method: "POST",
      url: "/api/creator-script-build",
      body,
    });
  } catch (error) {
    if (
      !(error instanceof CreatorScriptBuildClientError) ||
      error.code !== "CREATOR_SCRIPT_BUILD_NETWORK_ERROR"
    ) {
      throw error;
    }
    return await requestJson({
      ...input,
      method: "POST",
      url: "/api/creator-script-build",
      body,
    });
  }
}

async function getStatus(input: {
  fetchImpl: FetchLike;
  accessToken: string;
  buildId: string;
}) {
  return await requestJson({
    ...input,
    method: "GET",
    url: `/api/creator-script-build?buildId=${encodeURIComponent(input.buildId)}`,
  });
}

async function advanceWithTransportReconciliation(input: {
  fetchImpl: FetchLike;
  accessToken: string;
  buildId: string;
}) {
  const body = {
    action: "advance",
    buildId: input.buildId,
  };
  try {
    return await requestJson({
      ...input,
      method: "POST",
      url: "/api/creator-script-build",
      body,
    });
  } catch (error) {
    if (
      !(error instanceof CreatorScriptBuildClientError) ||
      error.code !== "CREATOR_SCRIPT_BUILD_NETWORK_ERROR"
    ) {
      throw error;
    }

    // A lost advance response is reconciled through durable server state
    // before the same semantic advance is retried. No client retry identity
    // or stage selection is introduced.
    const observed = await getStatus(input);
    if (observed.terminal) return observed;

    return await requestJson({
      ...input,
      method: "POST",
      url: "/api/creator-script-build",
      body,
    });
  }
}

export function creatorScriptBuildV2ClientEnabled(
  value = process.env.NEXT_PUBLIC_CREATOR_SCRIPT_BUILD_V2_ENABLED,
) {
  return value?.trim().toLowerCase() === "true";
}

export function creatorScriptBuildProgressMessage(input: {
  state: CreatorScriptBuildClientState;
  language: "tr" | "en";
}) {
  const english: Record<CreatorScriptBuildClientState, string> = {
    REQUESTED: "Preparing research…",
    SNAPSHOTTED: "Preparing research…",
    RESEARCH_READY: "Researching…",
    EDITORIAL_COMPILED: "Structuring evidence…",
    AUTHORITY_RESOLVED: "Writing script…",
    SCRIPT_GENERATED: "Refining script…",
    REPAIRING: "Refining script…",
    ACCEPTED: "Saving script…",
    PERSISTED: "Full script ready for review.",
    FAILED: "Script build could not be completed.",
    STALE: "Project changed while the script was being built.",
  };
  const turkish: Record<CreatorScriptBuildClientState, string> = {
    REQUESTED: "Araştırma hazırlanıyor…",
    SNAPSHOTTED: "Araştırma hazırlanıyor…",
    RESEARCH_READY: "Araştırılıyor…",
    EDITORIAL_COMPILED: "Kanıt yapısı hazırlanıyor…",
    AUTHORITY_RESOLVED: "Metin yazılıyor…",
    SCRIPT_GENERATED: "Metin iyileştiriliyor…",
    REPAIRING: "Metin iyileştiriliyor…",
    ACCEPTED: "Metin kaydediliyor…",
    PERSISTED: "Tam metin incelemeye hazır.",
    FAILED: "Metin oluşturma tamamlanamadı.",
    STALE: "Metin oluşturulurken proje değişti.",
  };
  return (input.language === "en" ? english : turkish)[input.state];
}

export function creatorScriptBuildV2RecoveryMessage(input: {
  code: string;
  language: "tr" | "en";
}) {
  const en = input.language === "en";
  switch (input.code) {
    case "AUTH_REQUIRED":
      return en
        ? "Your session has expired. Sign in again before rebuilding the script."
        : "Oturumun sona erdi. Metni yeniden oluşturmadan önce tekrar giriş yap.";
    case "PROJECT_OR_BUILD_NOT_FOUND":
      return en
        ? "This project or script build is no longer available. Reload the project before retrying."
        : "Bu proje veya metin oluşturma kaydı artık erişilebilir değil. Tekrar denemeden önce projeyi yeniden yükle.";
    case "PROJECT_STALE":
      return en
        ? "This project changed while the script was being built. Reload the latest project before retrying."
        : "Metin oluşturulurken proje değişti. Tekrar denemeden önce projenin güncel halini yeniden yükle.";
    case "BUILD_STATE_CONFLICT":
      return en
        ? "The script build is reconciling its saved state. Retry from the current project without switching to the legacy flow."
        : "Metin oluşturma işlemi kayıtlı durumunu uzlaştırıyor. Eski akışa geçmeden mevcut projeden tekrar dene.";
    case "BUILD_FAILED":
      return en
        ? "The full script could not be completed safely. Your project remains protected; review the current project and retry."
        : "Tam metin güvenli biçimde tamamlanamadı. Projen korunuyor; mevcut projeyi kontrol edip tekrar dene.";
    case "CREATOR_SCRIPT_BUILD_V2_DISABLED":
      return en
        ? "Build Script V2 is not enabled for this environment."
        : "Build Script V2 bu ortam için etkin değil.";
    case "CREATOR_SCRIPT_BUILD_NETWORK_ERROR":
      return en
        ? "The script build connection was interrupted. Retry from the current project; completed work will be reused."
        : "Metin oluşturma bağlantısı kesildi. Mevcut projeden tekrar dene; tamamlanan işler yeniden kullanılacak.";
    case "CREATOR_SCRIPT_BUILD_ADVANCE_LIMIT_EXCEEDED":
      return en
        ? "The script build did not reach a terminal state within its safe request limit. Reload the project before retrying."
        : "Metin oluşturma güvenli istek sınırı içinde tamamlanamadı. Tekrar denemeden önce projeyi yeniden yükle.";
    default:
      return en
        ? "The full script could not be completed safely. Your existing project state is unchanged."
        : "Tam metin güvenli biçimde tamamlanamadı. Mevcut proje durumun değiştirilmedi.";
  }
}

export async function runCreatorScriptBuildV2(input: {
  accessToken: string;
  projectId: string;
  expectedProjectUpdatedAt: string;
  fetchImpl?: FetchLike;
  maxAdvances?: number;
  onProgress?: (projection: CreatorScriptBuildClientProjection) => void;
}) {
  const accessToken = text(input.accessToken, 8_000);
  const projectId = text(input.projectId, 120);
  const expectedProjectUpdatedAt = text(input.expectedProjectUpdatedAt, 120);
  if (!accessToken || !projectId || !expectedProjectUpdatedAt) {
    throw new CreatorScriptBuildClientError({
      code: "CREATOR_SCRIPT_BUILD_START_INPUT_INVALID",
      status: 400,
    });
  }

  const fetchImpl: FetchLike =
    input.fetchImpl ||
    ((...args) => fetch(...args));
  const maxAdvances = Number.isInteger(input.maxAdvances)
    ? Math.max(1, Math.min(50, Number(input.maxAdvances)))
    : CREATOR_SCRIPT_BUILD_MAX_ADVANCES;

  let current = await startWithOneTransportRetry({
    fetchImpl,
    accessToken,
    projectId,
    expectedProjectUpdatedAt,
  });
  input.onProgress?.(current);
  if (current.terminal) return current;

  const buildId = current.buildId;
  for (let attempt = 0; attempt < maxAdvances; attempt += 1) {
    current = await advanceWithTransportReconciliation({
      fetchImpl,
      accessToken,
      buildId,
    });
    input.onProgress?.(current);
    if (current.terminal) return current;
  }

  throw new CreatorScriptBuildClientError({
    code: "CREATOR_SCRIPT_BUILD_ADVANCE_LIMIT_EXCEEDED",
    status: 409,
  });
}
