export type VeltoJobType = "runtime_probe" | "video_reconcile";

export type VeltoJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type VeltoJobRecord = {
  id: string;
  userId: string | null;
  projectId: string | null;
  jobType: VeltoJobType;
  status: VeltoJobStatus;
  priority: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  idempotencyKey: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EnqueueVeltoJobInput = {
  userId?: string | null;
  projectId?: string | null;
  jobType: VeltoJobType;
  payload?: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  availableAt?: string;
  idempotencyKey?: string | null;
};

export interface JobQueueRepository {
  enqueue(input: EnqueueVeltoJobInput): Promise<VeltoJobRecord>;
  getForUser(jobId: string, userId: string): Promise<VeltoJobRecord | null>;
  listForUser(userId: string, limit?: number): Promise<VeltoJobRecord[]>;
}
