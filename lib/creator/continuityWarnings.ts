import type {
  FlowContinuityRiskCode,
  FlowContinuitySceneAudit,
  FlowContinuitySeverity,
} from "@/lib/video/flowContinuityAudit";

export type CreatorContinuityWarning = {
  severity: Exclude<FlowContinuitySeverity, "safe">;
  messages: string[];
  action: "review_trim" | "refresh_video" | "generate_voice" | "review_scene";
};

const ENGLISH_MESSAGES: Record<FlowContinuityRiskCode, string> = {
  audio_duration_missing: "Voice timing could not be verified.",
  speech_overflow: "Speech is longer than this scene.",
  visual_duration_missing: "This scene does not have enough visual coverage.",
  visual_gap: "The visual may end before the scene audio.",
  freeze_frame_risk: "The end of this scene may hold on a frozen frame.",
  static_hold_unverified: "This image may remain static for too long.",
};

const TURKISH_MESSAGES: Record<FlowContinuityRiskCode, string> = {
  audio_duration_missing: "Ses zamanlaması doğrulanamadı.",
  speech_overflow: "Konuşma bu sahneden daha uzun.",
  visual_duration_missing: "Bu sahnede yeterli görsel kapsam yok.",
  visual_gap: "Görsel, sahne sesinden önce bitebilir.",
  freeze_frame_risk: "Bu sahnenin sonunda görüntü donabilir.",
  static_hold_unverified: "Bu görsel çok uzun süre hareketsiz kalabilir.",
};

function getAction(risks: FlowContinuityRiskCode[]) {
  if (risks.includes("audio_duration_missing")) return "generate_voice" as const;
  if (risks.includes("freeze_frame_risk")) return "refresh_video" as const;
  if (risks.includes("speech_overflow") || risks.includes("visual_gap")) return "review_trim" as const;
  return "review_scene" as const;
}

export function getCreatorContinuityWarning(
  audit: FlowContinuitySceneAudit | null | undefined,
  language: "en" | "tr" = "en",
): CreatorContinuityWarning | null {
  if (!audit || audit.severity === "safe" || audit.risks.length === 0) return null;
  const messages = language === "tr" ? TURKISH_MESSAGES : ENGLISH_MESSAGES;
  return {
    severity: audit.severity,
    messages: audit.risks.map((risk) => messages[risk]),
    action: getAction(audit.risks),
  };
}
