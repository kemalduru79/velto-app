"use client";

// X11.9 ExperienceWindow Stabilization Polish: small safe shared modal wording polish.

// X11.8 ExperienceWindow Child UX Polish: localized child-friendly modal labels.

import { useLanguage } from "@/lib/useLanguage";

import type { ActiveWorld } from "@/components/create/WorldContext";

type ExperienceWindowProps = {
  world: ActiveWorld;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  onClose: () => void;
};

const worldThemes = {
  storyverse: {
    label: "Storyverse",
    atmosphere:
      "A calm, child-safe story studio for guided ideas, consistent characters, cinematic scenes and controlled export outputs.",
    tone: "border-cyan-200/14 bg-[#071421] shadow-[0_34px_120px_rgba(2,6,23,0.52)]",
    glow: "bg-cyan-300/[0.055]",
    alignment: "items-start text-left",
  },
  creatorlab: {
    label: "Creator Lab",
    atmosphere:
      "A focused creator corner for shaping short-form ideas and content.",
    tone: "border-rose-200/14 bg-[#151016]",
    glow: "bg-rose-50/[0.025]",
    alignment: "items-center text-center",
  },
} as const;

export default function ExperienceWindow({
  world,
  title,
  description,
  primaryAction,
  secondaryAction,
  onClose,
}: ExperienceWindowProps) {
  const theme = worldThemes[world];

  const { language } = useLanguage();
  const isEnglish = language === "en";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 px-4 py-6 backdrop-blur-sm">
      <div
        className={`relative w-full max-w-4xl rounded-[20px] border p-5 shadow-lg md:p-6 ${theme.tone}`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-white/8 bg-white/[0.08] px-3 py-1.5 text-sm text-white/58 transition hover:bg-white/[0.12] hover:text-white"
        >
          Close
        </button>

        <div className={`flex flex-col gap-6 pt-7 ${theme.alignment}`}>
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-[0.08em] text-white/30">
              {theme.label}
            </div>

            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {title}
            </h2>

            <p className="max-w-2xl text-base leading-8 text-white/48">
              {description}
            </p>
          </div>

          <div className={`w-full rounded-[18px] border border-white/8 p-5 ${theme.glow}`}>
            <div className="text-xs uppercase tracking-[0.08em] text-white/26">
              World feeling
            </div>

            <p className="mt-3 text-sm leading-7 text-white/56">
              {theme.atmosphere}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
            >
              {primaryAction}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/8 px-5 py-3 text-sm font-medium text-white/50 transition hover:border-white/14 hover:text-white"
            >
              {secondaryAction}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
