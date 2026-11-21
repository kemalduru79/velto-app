// Shared structural types moved unchanged from app/create/page.tsx. No runtime values.
import type { CreatorDurationPreset } from "@/components/create/createWorkspacePanelTypes";

export type BulkIdeaResult = {
  topic: string;
  title: string;
  hook: string;
  score: number;
  angle: string;
  reason: string;
};

export type CreatorDurationOption = {
  preset: CreatorDurationPreset;
  seconds: number;
  label: string;
};
