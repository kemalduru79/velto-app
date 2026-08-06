import type { VeltoJobRecord } from "@/lib/persistence/jobs";
import {
  parseVideoJobToken,
  type VideoProviderKey,
} from "@/lib/video/providers";

const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_NATIVE_TASK_ID_LENGTH = 512;
const MAX_RESERVATION_ID_LENGTH = 512;
const ALLOWED_PROVIDERS = new Set<VideoProviderKey>(["runway", "veo"]);

export function isValidQueueJobId(value: unknown): value is string {
  return typeof value === "string" && JOB_ID_PATTERN.test(value);
}

export type PersistedVideoJobBinding = {
  queueJobId: string;
  userId: string;
  provider: VideoProviderKey;
  nativeTaskId: string;
  taskId: string;
  creditReservationId: string | null;
  reservedCredits: number;
  creditSettlementMode: "provider_dispatch";
};

export function validatePersistedVideoJobBinding(
  job: VeltoJobRecord,
): PersistedVideoJobBinding | null {
  if (!isValidQueueJobId(job.id) || job.jobType !== "video_reconcile") return null;
  const userId = typeof job.userId === "string" ? job.userId.trim() : "";
  const providerValue = job.payload.provider;
  const provider =
    typeof providerValue === "string" &&
    ALLOWED_PROVIDERS.has(providerValue as VideoProviderKey)
      ? (providerValue as VideoProviderKey)
      : null;
  const nativeTaskId =
    typeof job.payload.nativeTaskId === "string"
      ? job.payload.nativeTaskId.trim()
      : "";
  const taskId =
    typeof job.payload.taskId === "string" ? job.payload.taskId.trim() : "";
  const parsedTask = taskId ? parseVideoJobToken(taskId) : null;
  const reservationValue = job.payload.creditReservationId;
  const creditReservationId =
    reservationValue === null
      ? null
      : typeof reservationValue === "string" &&
          reservationValue.trim().length > 0 &&
          reservationValue.trim().length <= MAX_RESERVATION_ID_LENGTH
        ? reservationValue.trim()
        : undefined;
  const reservedCredits = job.payload.reservedCredits;

  if (
    !userId ||
    !provider ||
    !nativeTaskId ||
    nativeTaskId.length > MAX_NATIVE_TASK_ID_LENGTH ||
    !parsedTask ||
    parsedTask.providerKey !== provider ||
    parsedTask.nativeTaskId !== nativeTaskId ||
    creditReservationId === undefined ||
    typeof reservedCredits !== "number" ||
    !Number.isSafeInteger(reservedCredits) ||
    reservedCredits < 0 ||
    job.payload.creditSettlementMode !== "provider_dispatch"
  ) {
    return null;
  }

  return {
    queueJobId: job.id,
    userId,
    provider,
    nativeTaskId,
    taskId,
    creditReservationId,
    reservedCredits,
    creditSettlementMode: "provider_dispatch",
  };
}
