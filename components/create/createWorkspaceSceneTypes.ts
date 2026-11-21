// Shared structural types moved unchanged from app/create/page.tsx. No runtime values.


export type BatchRenderItem = {
  sceneId: number;
  status: BatchSceneStatus;
  step:
    | "waiting"
    | "route"
    | "image"
    | "audio"
    | "video"
    | "save"
    | "complete"
    | "cancelled"
    | "error";
  message?: string;
  updatedAt: string;
};

export type BatchSceneStatus = "pending" | "processing" | "done" | "failed" | "skipped";

export type CreatorOpsServiceKey = "database" | "ai" | "voice" | "video" | "export";

export type CreatorOpsStatus = {
  status: "idle" | "checking" | "ready" | "degraded" | "blocked" | "error";
  checkedAt: string;
  release: string;
  requestId: string;
  services: Record<CreatorOpsServiceKey, boolean>;
  message: string;
};
