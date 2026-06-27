"use client";

// X12.1 Premium UI Foundation: shared intro cards now separate Storyverse calm safety from CreatorLab studio positioning.

import { useState } from "react";

import ExperienceWindow from "@/components/create/ExperienceWindow";
import type { ActiveWorld } from "@/components/create/WorldContext";
import { useWorldState } from "@/components/create/WorldContext";
import { useLanguage } from "@/lib/useLanguage";

type ExperienceIntroCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  tone: "storyverse" | "creator";
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
};

const toneStyles = {
  storyverse: {
    active:
      "border-cyan-200/18 bg-[#0a1727]/[0.88] shadow-[0_32px_110px_rgba(8,47,73,0.42)] backdrop-blur-2xl",
    passive:
      "border-cyan-200/14 bg-[#0a1727]/[0.70] shadow-[0_16px_52px_rgba(8,47,73,0.22)] backdrop-blur-2xl",
    glow: "bg-cyan-300/16",
    title: "text-white",
    description: "text-slate-200/72",
    meta: "text-slate-300/68",
    panel: "border-cyan-100/12 bg-white/[0.055] text-slate-100/78",
    button:
      "border-cyan-300/30 bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-indigo-500",
    softButton:
      "border-cyan-100/14 bg-white/[0.06] text-cyan-50/78 hover:border-cyan-100/24 hover:bg-white/[0.10] hover:text-white",
    label: "text-cyan-50 bg-cyan-400/12 border-cyan-200/18",
    badge: "text-slate-200/68 bg-white/[0.06] border-white/10",
    accent: "bg-cyan-300",
  },
  creator: {
    active:
      "border-white/12 bg-slate-950/[0.88] shadow-[0_30px_105px_rgba(0,0,0,0.32)]",
    passive:
      "border-white/10 bg-slate-950/[0.70] shadow-[0_16px_52px_rgba(0,0,0,0.24)]",
    glow: "bg-rose-400/25",
    title: "text-white",
    description: "text-white/68",
    meta: "text-white/56",
    panel: "border-white/10 bg-white/[0.07] text-white/72",
    button:
      "border-rose-400 bg-gradient-to-r from-rose-500 to-orange-400 text-white hover:from-rose-600 hover:to-orange-500",
    softButton:
      "border-white/10 bg-white/[0.08] text-white/72 hover:border-white/20 hover:bg-white/[0.12] hover:text-white",
    label: "text-rose-100 bg-rose-500/15 border-rose-300/25",
    badge: "text-white/68 bg-white/[0.07] border-white/10",
    accent: "bg-rose-400",
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
        className={`relative overflow-hidden rounded-[32px] border p-5 transition-all duration-500 md:rounded-[38px] md:p-7 ${
          isActive ? styles.active : `opacity-[0.88] hover:opacity-100 ${styles.passive}`
        }`}
      >
        <div className={`pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl ${styles.glow}`} />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="relative z-10 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.10em] ${styles.label}`}
            >
              {eyebrow}
            </div>

            <div
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] ${styles.badge}`}
            >
              {stage}
            </div>

            <div
              className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] ${styles.badge}`}
            >
              {isActive ? (isEnglish ? "Selected" : "Seçili") : (isEnglish ? "Explore" : "Keşfet")}
            </div>
          </div>

          <div className="space-y-3">
            <h2
              className={`font-black tracking-[-0.04em] transition-all duration-500 ${styles.title} ${
                isActive ? "text-3xl sm:text-4xl md:text-6xl" : "text-2xl sm:text-3xl md:text-4xl"
              }`}
            >
              {title}
            </h2>

            <p
              className={`max-w-3xl font-medium leading-8 ${styles.description} ${
                isActive ? "text-base md:text-lg" : "line-clamp-3 text-sm md:line-clamp-2 md:text-base"
              }`}
            >
              {description}
            </p>
          </div>

          {isActive ? (
            <div className={`rounded-[24px] border p-4 shadow-[0_16px_42px_rgba(15,23,42,0.08)] sm:p-5 ${styles.panel}`}>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] opacity-75">
                <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
                <span>
                  {tone === "storyverse"
                    ? (isEnglish ? "Safe story path" : "Güvenli hikâye yolu")
                    : (isEnglish ? "Creator production path" : "Creator üretim yolu")}
                </span>
              </div>

              <div className="mt-3 text-base font-medium leading-7">
                {nextAction}
              </div>
            </div>
          ) : null}

          <div className={`flex flex-wrap items-center gap-3 text-sm font-semibold ${styles.meta}`}>
            <div>{duration}</div>
            <div className="opacity-60">•</div>
            <div>{isEnglish ? "Age" : "Yaş"} {ageRange}</div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openFocusedWindow}
              className={`inline-flex min-h-12 items-center justify-center rounded-full border px-5 py-3 text-sm font-black shadow-[0_16px_38px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_22px_52px_rgba(15,23,42,0.22)] sm:px-7 sm:py-3.5 ${styles.button}`}
            >
              {primaryCta}
            </button>

            {isActive ? (
              <button
                type="button"
                onClick={focusWorld}
                className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-3 text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 ${styles.softButton}`}
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
