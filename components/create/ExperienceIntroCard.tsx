"use client";

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
    active: "border-indigo-300/25 bg-indigo-500/[0.08]",
    passive: "border-indigo-400/10 bg-white/[0.035]",
    button:
      "border-indigo-300/25 bg-indigo-500/15 text-indigo-50 hover:bg-indigo-500/20",
  },
  creator: {
    active: "border-pink-300/25 bg-pink-500/[0.08]",
    passive: "border-pink-400/10 bg-white/[0.035]",
    button:
      "border-pink-300/25 bg-pink-500/15 text-pink-50 hover:bg-pink-500/20",
  },
  career: {
    active: "border-cyan-300/25 bg-cyan-500/[0.08]",
    passive: "border-cyan-400/10 bg-white/[0.035]",
    button:
      "border-cyan-300/25 bg-cyan-500/15 text-cyan-50 hover:bg-cyan-500/20",
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
  const { activeWorld, setActiveWorld } =
    useWorldState();

  const isActive = activeWorld === primaryWorld;
  const styles = toneStyles[tone];

  function handlePrimaryAction() {
    setActiveWorld(primaryWorld);

    const target = document.getElementById(
      worldTargetIds[primaryWorld],
    );

    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  return (
    <section
      className={`relative overflow-hidden rounded-[36px] border p-8 transition-all duration-500 ${
        isActive
          ? `scale-[1.01] opacity-100 ${styles.active}`
          : `opacity-75 hover:opacity-95 ${styles.passive}`
      }`}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/70">
            {eyebrow}
          </div>

          <div className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/40">
            {stage}
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-4xl font-black tracking-tight text-white md:text-5xl">
            {title}
          </h2>

          <p className="max-w-2xl text-lg leading-8 text-white/65">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-white/45">
          <div>Age {ageRange}</div>
          <div>•</div>
          <div>{duration}</div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="text-xs uppercase tracking-[0.2em] text-white/35">
            Next Experience Step
          </div>

          <div className="mt-3 text-sm leading-7 text-white/70">
            {nextAction}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className={`inline-flex min-h-12 items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-all duration-300 hover:-translate-y-1 ${styles.button}`}
          >
            {primaryCta}
          </button>

          <button
            type="button"
            onClick={handlePrimaryAction}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-transparent px-6 py-3 text-sm font-medium text-white/70 transition-all duration-300 hover:border-white/20 hover:text-white"
          >
            {secondaryCta}
          </button>
        </div>
      </div>
    </section>
  );
}
