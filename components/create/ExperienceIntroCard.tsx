"use client";

// X11.8 IntroCard Microcopy Polish: refines shared child-facing intro labels.

// X11.7 IntroCard Localization Consistency: internal labels follow selected TR/EN UI language.

// X11.5A World Identity Intro Polish: stronger emotional distinction for Storyverse, Creator Lab and Career Lab intros.

// X.7.25 Emotional CTA Polish: warmer, clearer premium CTA hierarchy.
// X.7.26 Mobile & Tablet Cohesion Polish: responsive card and CTA spacing refinement.
// X.7.27 Cinematic Immersion Pass: premium visual depth and cinematic CTA feel.
// X.7.28 Section Cleanup & Simplification: cleaner intro density and calmer hierarchy.
// X.7.29 Final QA & X7 Closure: final intro-card readability and consistency polish.
// X.8.1 Cognitive Load Reduction Pass: simplified onboarding copy and reduced metadata density.
// X.8.2 Single Action Focus Pass: primary action emphasized and secondary choices softened.

import { useState } from "react";

import ExperienceWindow from "@/components/create/ExperienceWindow";
import type { ActiveWorld } from "@/components/create/WorldContext";
import { useWorldState } from "@/components/create/WorldContext";
import { useLanguage } from "@/lib/useLanguage";

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
      "border-sky-300 bg-gradient-to-br from-sky-50 via-indigo-50 to-orange-50 shadow-[0_28px_90px_rgba(14,165,233,0.16)]",
    passive:
      "border-sky-100/70 bg-white/72 shadow-[0_12px_38px_rgba(14,165,233,0.07)]",
    button:
      "border-sky-500 bg-gradient-to-r from-sky-700 to-indigo-700 text-white hover:from-sky-700 hover:to-blue-700",
    softButton:
      "border-sky-200 bg-white text-sky-800 hover:border-sky-300 hover:bg-sky-50",
    label: "text-sky-800 bg-sky-50 border-sky-200",
    badge: "text-slate-700 bg-white border-slate-200",
    accent: "bg-sky-500",
  },
  creator: {
    active:
      "border-rose-300 bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 shadow-[0_28px_86px_rgba(244,63,94,0.14)]",
    passive:
      "border-rose-100/70 bg-white/72 shadow-[0_12px_38px_rgba(244,63,94,0.06)]",
    button:
      "border-rose-500 bg-gradient-to-r from-rose-600 to-pink-600 text-white hover:from-rose-700 hover:to-pink-700",
    softButton:
      "border-rose-200 bg-white text-rose-800 hover:border-rose-300 hover:bg-rose-50",
    label: "text-rose-800 bg-rose-50 border-rose-200",
    badge: "text-slate-700 bg-white border-slate-200",
    accent: "bg-rose-500",
  },
  career: {
    active:
      "border-teal-300 bg-gradient-to-br from-emerald-50 via-cyan-50 to-lime-50 shadow-[0_28px_86px_rgba(20,184,166,0.14)]",
    passive:
      "border-teal-100/70 bg-white/72 shadow-[0_12px_38px_rgba(20,184,166,0.06)]",
    button:
      "border-teal-500 bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700",
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
  const { language } = useLanguage();
  const isEnglish = language === "en";
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
        className={`relative overflow-hidden rounded-[30px] border p-4 transition-all duration-500 sm:p-5 md:rounded-[34px] md:p-6 ${
          isActive ? styles.active : `opacity-80 hover:opacity-100 ${styles.passive}`
        }`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/70 blur-3xl" />

        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] ${styles.label}`}
            >
              {eyebrow}
            </div>

            <div
              className={`rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.04em] ${styles.badge}`}
            >
              {isActive ? (isEnglish ? "Selected" : "Seçili") : (isEnglish ? "Explore" : "Keşfet")}
            </div>
          </div>

          <div className="space-y-3">
            <h2
              className={`font-extrabold tracking-tight text-slate-950 transition-all duration-500 ${
                isActive ? "text-2xl sm:text-3xl md:text-5xl" : "text-xl sm:text-2xl md:text-3xl"
              }`}
            >
              {title}
            </h2>

            <p
              className={`max-w-2xl leading-8 text-slate-700 ${
                isActive ? "text-base md:text-lg" : "line-clamp-3 text-sm md:line-clamp-2 md:text-base"
              }`}
            >
              {description}
            </p>
          </div>

          {isActive ? (
            <div className="rounded-[22px] border border-orange-200/55 bg-white/78 p-4 sm:p-5 shadow-[0_12px_35px_rgba(251,146,60,0.08)]">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
                <span>
                  {tone === "storyverse"
                    ? (isEnglish ? "Story Adventure" : "Hikâye Macerası")
                    : tone === "creator"
                      ? (isEnglish ? "Creator Path" : "Creator Yolu")
                      : (isEnglish ? "Mission Path" : "Görev Yolu")}
                </span>
              </div>

              <div className="mt-3 text-base leading-7 text-slate-700">
                {nextAction}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
            <div>{duration}</div>
            <div className="text-slate-500">•</div>
            <div>{isEnglish ? "Age" : "Yaş"} {ageRange}</div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openFocusedWindow}
              className={`inline-flex min-h-12 items-center justify-center rounded-full border px-5 py-3 sm:px-7 sm:py-3.5 text-sm font-black shadow-[0_14px_36px_rgba(15,23,42,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_20px_46px_rgba(15,23,42,0.18)] ${styles.button}`}
            >
              {primaryCta}
            </button>

            {isActive ? (
              <button
                type="button"
                onClick={focusWorld}
                className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-3 text-sm font-medium opacity-85 transition-all duration-300 hover:-translate-y-0.5 ${styles.softButton}`}
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
