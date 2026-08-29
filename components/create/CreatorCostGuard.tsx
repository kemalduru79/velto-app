"use client";

import { useEffect, useRef, useState } from "react";

export type CreatorCostGuardRequest = {
  operationName: string;
  estimatedCredits: number;
  qualityLabel: string;
  summary?: string;
};

type Props = {
  request: CreatorCostGuardRequest | null;
  language: "tr" | "en";
  onConfirm: () => void;
  onCancel: () => void;
};

// Standard CreatorLab actions cost 0–2 credits in the current policy. A 6-credit
// threshold keeps routine production backstage while still requiring explicit
// approval for premium video generation, larger batches and other material spend.
export const CREATOR_COST_GUARD_CONFIRMATION_THRESHOLD = 6;

export default function CreatorCostGuard({ request, language, onConfirm, onCancel }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const cancelRef = useRef(onCancel);
  const autoConfirmedRequestRef = useRef<CreatorCostGuardRequest | null>(null);
  const requiresExplicitConfirmation = Boolean(
    request && request.estimatedCredits >= CREATOR_COST_GUARD_CONFIRMATION_THRESHOLD,
  );

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!request) {
      autoConfirmedRequestRef.current = null;
      return;
    }
    if (requiresExplicitConfirmation || autoConfirmedRequestRef.current === request) return;

    autoConfirmedRequestRef.current = request;
    onConfirm();
  }, [onConfirm, request, requiresExplicitConfirmation]);

  useEffect(() => {
    if (!request || !requiresExplicitConfirmation) return;

    setSubmitting(false);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      confirmButtonRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [request, requiresExplicitConfirmation]);

  if (!request || !requiresExplicitConfirmation) return null;

  const confirm = () => {
    if (submitting) return;
    setSubmitting(true);
    onConfirm();
  };

  const description = language === "en"
    ? "This operation has a material estimated cost. Review it before starting."
    : "Bu işlemin tahmini maliyeti yüksek. Başlatmadan önce gözden geçir.";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[3px] sm:px-6">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="creator-cost-guard-title"
        aria-describedby="creator-cost-guard-description"
        tabIndex={-1}
        className="w-full max-w-[470px] overflow-hidden rounded-2xl border border-white/70 bg-[#fffdf9] text-slate-900 shadow-[0_24px_80px_-20px_rgba(15,23,42,0.55)]"
      >
        <div className="border-b border-slate-200/80 px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-sm" aria-hidden="true">✓</span>
            CreatorLab Cost Guard
          </div>
          <h2 id="creator-cost-guard-title" className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-[22px]">
            {request.operationName}
          </h2>
          <p id="creator-cost-guard-description" className="mt-1.5 text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-5 px-4 py-3.5">
              <span className="text-sm text-slate-600">{language === "en" ? "Estimated credits" : "Tahmini kredi"}</span>
              <strong className="text-lg font-semibold tabular-nums text-slate-950">{request.estimatedCredits}</strong>
            </div>
            <div className="flex items-center justify-between gap-5 border-t border-slate-100 px-4 py-3.5">
              <span className="text-sm text-slate-600">{language === "en" ? "Selected quality" : "Seçilen kalite"}</span>
              <strong className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">{request.qualityLabel}</strong>
            </div>
            {request.summary && (
              <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-sm leading-5 text-slate-600">
                {request.summary}
              </div>
            )}
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            {language === "en"
              ? "Credits are used only after you confirm and the operation starts."
              : "Krediler yalnızca onayından sonra işlem başladığında kullanılır."}
          </p>

          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {language === "en" ? "Cancel" : "İptal"}
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              disabled={submitting}
              onClick={confirm}
              className="min-h-11 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {language === "en" ? "Confirm & Start" : "Onayla ve Başlat"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
