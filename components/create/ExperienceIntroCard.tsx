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
    active: "border-sky-200/12 bg-sky-50/[0.024]",
    passive: "border-white/8 bg-white/[0.012]",
    button:
      "border-sky-200/18 bg-sky-100/[0.06] text-sky-50 hover:bg-sky-100/[0.1]",
    label: "text-sky-100",
    align: "items-start text-left",
  },
  creator: {
    active: "border-rose-200/12 bg-rose-50/[0.024]",
    passive: "border-white/8 bg-white/[0.012]",
    button:
      "border-rose-200/18 bg-rose-100/[0.06] text-rose-50 hover:bg-rose-100/[0.1]",
    label: "text-rose-100",
    align: "items-center text-center",
  },
  career: {
    active: "border-teal-200/12 bg-teal-50/[0.024]",
    passive: "border-white/8 bg-white/[0.012]",
    button:
      "border-teal-200/18 bg-teal-100/[0.06] text-teal-50 hover:bg-teal-100/[0.1]",
    label: "text-teal-100",
    align: "items-end text-right",
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

  return (
    <>
      <section
        className={`relative rounded-[18px] border p-4 transition-all duration-500 md:p-5 ${
          isActive
            ? `opacity-100 ${styles.active}`
            : `opacity-52 hover:opacity-82 ${styles.passive}`
        }`}
      >
        <div className={`flex flex-col gap-4 ${styles.align}`}>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`rounded-full border border-white/8 bg-white/[0.012] px-4 py-2 text-xs uppercase tracking-[0.08em] ${styles.label}`}
            >
              {eyebrow}
            </div>

            <div className="rounded-full border border-white/8 bg-white/[0.01] px-4 py-2 text-xs uppercase tracking-[0.06em] text-white/28">
              {isActive ? "Selected" : stage}
            </div>
          </div>

          <div className="space-y-3">
            <h2
              className={`font-semibold tracking-tight text-white transition-all duration-500 ${
                isActive
                  ? "text-2xl md:text-4xl"
                  : "text-xl md:text-2xl"
              }`}
            >
              {title}
            </h2>

            <p
              className={`max-w-2xl leading-7 text-white/46 ${
                isActive ? "text-base" : "line-clamp-2 text-sm"
              }`}
            >
              {description}
            </p>
          </div>

          {isActive ? (
            <div className="w-full rounded-[16px] border border-white/8 bg-black/[0.06] p-4">
              <div className="text-xs uppercase tracking-[0.06em] text-white/24">
                Next
              </div>

              <div className="mt-3 text-sm leading-7 text-white/50">
                {nextAction}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 text-sm text-white/26">
            <div>Age {ageRange}</div>
            <div>•</div>
            <div>{duration}</div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setIsWindowOpen(true)}
              className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold transition-all duration-500 hover:-translate-y-0.5 ${styles.button}`}
            >
              {primaryCta}
            </button>

            {isActive ? (
              <button
                type="button"
                onClick={focusWorld}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/8 bg-transparent px-5 py-3 text-sm font-medium text-white/48 transition-all duration-500 hover:border-white/14 hover:text-white"
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
