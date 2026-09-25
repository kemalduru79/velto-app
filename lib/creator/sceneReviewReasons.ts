import type { FlowContinuityRiskCode, FlowContinuitySceneAudit } from "../video/flowContinuityAudit.ts";

export type CreatorSceneReviewReasonCode =
  | "FAILED_MEDIA" | "STALE_NARRATION" | "STALE_DIALOGUE" | "STALE_VIDEO"
  | "AUDIO_DURATION_MISSING" | "SPEECH_OVERFLOW" | "VISUAL_DURATION_MISSING"
  | "VISUAL_GAP" | "FREEZE_FRAME_RISK" | "SCRIPT_TOO_LONG" | "SCRIPT_TOO_SHORT"
  | "STATIC_HOLD_UNVERIFIED" | "SPLIT_RECOMMENDED";

export type CreatorSceneReviewReason = {
  code: CreatorSceneReviewReasonCode;
  compactLabel: string;
  message: string;
  action?: string;
  severity: "error" | "warning" | "advisory";
};

const CONTINUITY_REASON_CODES: Record<FlowContinuityRiskCode, CreatorSceneReviewReasonCode> = {
  audio_duration_missing: "AUDIO_DURATION_MISSING", speech_overflow: "SPEECH_OVERFLOW",
  visual_duration_missing: "VISUAL_DURATION_MISSING", visual_gap: "VISUAL_GAP",
  freeze_frame_risk: "FREEZE_FRAME_RISK", static_hold_unverified: "STATIC_HOLD_UNVERIFIED",
};

export function deriveCreatorSceneReviewReasons(input: {
  failed: boolean;
  narrationState: "current" | "stale" | "missing" | "not_required";
  dialogueState: "current" | "stale" | "missing" | "not_required";
  videoState: "current" | "stale" | "missing" | "processing" | "delayed" | "error";
  continuityAudit?: FlowContinuitySceneAudit | null;
  scriptHealthStatus: "ready" | "too_short" | "too_long";
  splitRecommended?: boolean;
  recommendedSplitCount?: number;
  language: "en" | "tr";
}) {
  const english = input.language === "en";
  const reasons: CreatorSceneReviewReason[] = [];
  const add = (reason: CreatorSceneReviewReason) => reasons.push(reason);
  if (input.failed) add({ code: "FAILED_MEDIA", compactLabel: english ? "Media failed" : "Medya başarısız", message: english ? "Video generation failed for this scene." : "Bu sahne için video üretimi başarısız oldu.", action: english ? "Retry the scene video when ready." : "Hazır olduğunuzda sahne videosunu yeniden deneyin.", severity: "error" });
  if (input.narrationState === "stale") add({ code: "STALE_NARRATION", compactLabel: english ? "Voice out of date" : "Ses güncel değil", message: english ? "Voice-over is out of date because the narration changed." : "Anlatım değiştiği için anlatıcı sesi güncel değil.", action: english ? "Refresh the narration voice." : "Anlatıcı sesini yenileyin.", severity: "warning" });
  if (input.dialogueState === "stale") add({ code: "STALE_DIALOGUE", compactLabel: english ? "Dialogue out of date" : "Diyalog güncel değil", message: english ? "Dialogue audio is out of date because the dialogue changed." : "Diyalog değiştiği için diyalog sesi güncel değil.", action: english ? "Refresh the dialogue voice." : "Diyalog sesini yenileyin.", severity: "warning" });
  if (input.videoState === "stale") add({ code: "STALE_VIDEO", compactLabel: english ? "Video out of date" : "Video güncel değil", message: english ? "The generated video no longer matches the current scene settings." : "Üretilen video artık güncel sahne ayarlarıyla eşleşmiyor.", action: english ? "Regenerate the scene video." : "Sahne videosunu yeniden üretin.", severity: "warning" });

  const audit = input.continuityAudit;
  const continuityOrder: FlowContinuityRiskCode[] = ["audio_duration_missing", "speech_overflow", "visual_duration_missing", "visual_gap", "freeze_frame_risk"];
  for (const risk of continuityOrder.filter((code) => audit?.risks.includes(code))) {
    const common = { code: CONTINUITY_REASON_CODES[risk], severity: risk === "static_hold_unverified" ? "advisory" as const : "warning" as const };
    if (risk === "audio_duration_missing") add({ ...common, compactLabel: english ? "Timing unverified" : "Süre doğrulanmadı", message: english ? "Voice timing could not be verified." : "Ses zamanlaması doğrulanamadı.", action: english ? "Generate or refresh the missing voice track." : "Eksik ses kaydını üretin veya yenileyin." });
    if (risk === "speech_overflow") add({ ...common, compactLabel: english ? "Speech overflow" : "Konuşma taşıyor", message: english ? "Speech is longer than the available scene duration." : "Konuşma mevcut sahne süresinden daha uzun.", action: english ? "Review the scene timing or script." : "Sahne süresini veya metni gözden geçirin." });
    if (risk === "visual_duration_missing") add({ ...common, compactLabel: english ? "Visual coverage missing" : "Görsel kapsam eksik", message: english ? "This scene does not have enough visual coverage." : "Bu sahnede yeterli görsel kapsam yok.", action: english ? "Add a scene visual." : "Sahneye bir görsel ekleyin." });
    if (risk === "visual_gap") add({ ...common, compactLabel: english ? "Visual ends early" : "Görsel erken bitiyor", message: english ? "The visual may end before the scene audio." : "Görsel sahne sesinden önce bitebilir.", action: english ? "Review the visual duration or add another visual beat." : "Görsel süresini gözden geçirin veya başka bir görsel ritim ekleyin." });
    if (risk === "freeze_frame_risk") add({ ...common, compactLabel: english ? "Freeze-frame risk" : "Donma riski", message: english ? "The end of this scene may hold on a frozen frame." : "Bu sahnenin sonunda görüntü donabilir.", action: english ? "Refresh the video or adjust visual coverage." : "Videoyu yenileyin veya görsel kapsamı ayarlayın." });
  }

  if (input.scriptHealthStatus === "too_long") add({ code: "SCRIPT_TOO_LONG", compactLabel: english ? "Script timing" : "Metin süresi", message: english ? "The current script is too long for its planned scene window." : "Mevcut metin planlanan sahne aralığı için fazla uzun.", action: english ? "Review the script timing." : "Metin süresini gözden geçirin.", severity: "warning" });
  if (input.scriptHealthStatus === "too_short") add({ code: "SCRIPT_TOO_SHORT", compactLabel: english ? "Script timing" : "Metin süresi", message: english ? "The current script is too short for its planned scene window." : "Mevcut metin planlanan sahne aralığı için fazla kısa.", action: english ? "Review the script timing." : "Metin süresini gözden geçirin.", severity: "warning" });

  if (audit?.risks.includes("static_hold_unverified")) add({ code: "STATIC_HOLD_UNVERIFIED", compactLabel: english ? "Long static visual" : "Uzun sabit görsel", message: english ? `This image is planned to remain on screen for ${Number(audit.staticHoldSec || 0).toFixed(1)}s.` : `Bu görselin ${Number(audit.staticHoldSec || 0).toFixed(1)} sn ekranda kalması planlanıyor.`, action: english ? "Consider another visual beat, motion, or splitting the scene." : "Başka bir görsel ritim, hareket veya sahneyi bölmeyi değerlendirin.", severity: "advisory" });

  const advisories: CreatorSceneReviewReason[] = input.splitRecommended ? [{ code: "SPLIT_RECOMMENDED", compactLabel: english ? "Shorter scenes suggested" : "Daha kısa sahneler öneriliyor", message: english ? `Measured narration suggests ${input.recommendedSplitCount || 2} shorter scenes.` : `Ölçülen anlatım ${input.recommendedSplitCount || 2} daha kısa sahne öneriyor.`, action: english ? "Splitting is recommended, not automatic." : "Bölme önerilir; otomatik değildir.", severity: "advisory" }] : [];
  return { reasons, advisories };
}
