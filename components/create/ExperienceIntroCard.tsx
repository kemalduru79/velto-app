"use client";

import { useState } from "react";

import ExperienceWindow from "@/components/create/ExperienceWindow";
import type { ActiveWorld } from "@/components/create/WorldContext";
import { useWorldState } from "@/components/create/WorldContext";

type ExperienceIntroCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  tone: "storyverse" | "creator" | "career";
  stage: "Active Product" | "Pilot Experience";
  duration: string;
  ageRange: string;
  nextAction: string;
  primaryCta: string;
  secondaryCta: string;
  primaryWorld: ActiveWorld;
};

const worldTargetIds: Record<ActiveWorld, string> = {
  storyverse: "storyverse-workspace",
  creatorlab: "creatorlab-workspace",
  careerlab: "careerlab-workspace",
};

const toneStyles = {
  storyverse: {
    active:
      "border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-orange-50/60 shadow-[0_22px_70px_rgba(14,165,233,0.12)]",
    passive:
      "border-sky-100/70 bg-white/72 shadow-[0_12px_38px_rgba(14,165,233,0.07)]",
    button:
      "border-sky-500 bg-sky-600 text-white hover:bg-sky-700",
    softButton:
      "border-sky-200 bg-white text-sky-800 hover:border-sky-300 hover:bg-sky-50",
    label: "text-sky-800 bg-sky-50 border-sky-200",
    badge: "text-slate-700 bg-white border-slate-200",
    accent: "bg-sky-500",
  },
  creator: {
    active:
      "border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-orange-50/60 shadow-[0_22px_70px_rgba(244,63,94,0.10)]",
    passive:
      "border-rose-100/70 bg-white/72 shadow-[0_12px_38px_rgba(244,63,94,0.06)]",
    button:
      "border-rose-500 bg-rose-600 text-white hover:bg-rose-700",
    softButton:
      "border-rose-200 bg-white text-rose-800 hover:border-rose-300 hover:bg-rose-50",
    label: "text-rose-800 bg-rose-50 border-rose-200",
    badge: "text-slate-700 bg-white border-slate-200",
    accent: "bg-rose-500",
  },
  career: {
    active:
      "border-teal-200/70 bg-gradient-to-br from-teal-50 via-white to-orange-50/60 shadow-[0_22px_70px_rgba(20,184,166,0.10)]",
    passive:
      "border-teal-100/70 bg-white/72 shadow-[0_12px_38px_rgba(20,184,166,0.06)]",
    button:
      "border-teal-500 bg-teal-600 text-white hover:bg-teal-700",
    softButton:
      "border-teal-200 bg-white text-teal-800 hover:border-teal-300 hover:bg-teal-50",
    label: "text-teal-800 bg-teal-50 border-teal-200",
    badge: "text-slate-700 bg-white border-slate-200",
    accent: "bg-teal-500",
  },
} as const;

export default function ExperienceIntroCard({
  eyebrow,
  title,
  description,
  tone,
  stage,
  duration,
  ageRange,
  nextAction,
  primaryCta,
  secondaryCta,
  primaryWorld,
}: ExperienceIntroCardProps) {
  const { activeWorld, setActiveWorld } = useWorldState();
  const [isWindowOpen, setIsWindowOpen] = useState(false);

  const isActive = activeWorld === primaryWorld;
  const styles = toneStyles[tone];

  function focusWorld() {
    setActiveWorld(primaryWorld);

    window.requestAnimationFrame(() => {
      const target = document.getElementById(worldTargetIds[primaryWorld]);

      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  }

  function openFocusedWindow() {
    focusWorld();
    setIsWindowOpen(true);
  }

  return (
    <>
      <section
        className={`relative overflow-hidden rounded-[34px] border p-5 transition-all duration-500 md:p-6 ${
          isActive ? styles.active : `opacity-80 hover:opacity-100 ${styles.passive}`
        }`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/70 blur-3xl" />

        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] ${styles.label}`}
            >
              {eyebrow}
            </div>

            <div
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] ${styles.badge}`}
            >
              {isActive ? "Selected" : stage}
            </div>
          </div>

          <div className="space-y-4">
            <h2
              className={`font-black tracking-tight text-slate-950 transition-all duration-500 ${
                isActive ? "text-3xl md:text-5xl" : "text-2xl md:text-3xl"
              }`}
            >
              {title}
            </h2>

            <p
              className={`max-w-2xl leading-8 text-slate-700 ${
                isActive ? "text-base md:text-lg" : "line-clamp-2 text-sm md:text-base"
              }`}
            >
              {description}
            </p>
          </div>

          {isActive ? (
            <div className="rounded-[24px] border border-orange-200/70 bg-white/82 p-5 shadow-[0_12px_35px_rgba(251,146,60,0.08)]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
                <span>Next</span>
              </div>

              <div className="mt-3 text-base font-semibold leading-7 text-slate-800">
                {nextAction}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
            <div>Age {ageRange}</div>
            <div className="text-slate-300">•</div>
            <div>{duration}</div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openFocusedWindow}
              className={`inline-flex min-h-12 items-center justify-center rounded-full border px-6 py-3 text-sm font-black shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${styles.button}`}
            >
              {primaryCta}
            </button>

            {isActive ? (
              <button
                type="button"
                onClick={focusWorld}
                className={`inline-flex min-h-12 items-center justify-center rounded-full border px-6 py-3 text-sm font-bold transition-all duration-300 hover:-translate-y-1 ${styles.softButton}`}
              >
                {secondaryCta}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {isWindowOpen ? (
        <ExperienceWindow
          world={primaryWorld}
          title={title}
          description={description}
          primaryAction={primaryCta}
          secondaryAction={secondaryCta}
          onClose={() => setIsWindowOpen(false)}
        />
      ) : null}
    </>
  );
}
