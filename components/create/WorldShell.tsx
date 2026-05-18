"use client";

// X.7.27 Cinematic Immersion Pass: premium cinematic shell depth for creative worlds.

import type { ActiveWorld } from "@/components/create/WorldContext";

type WorldShellProps = {
  world: ActiveWorld;
  title: string;
  description: string;
  children: React.ReactNode;
};

const worldThemes = {
  storyverse: {
    background:
      "from-[#dff7ff] via-[#f7fcff] to-[#ffffff]",
    accent: "text-sky-700",
    border: "border-sky-200/80",
    glow: "bg-sky-100/60",
    button: "bg-sky-500 text-white hover:bg-sky-600",
    emoji: "🎬",
    label: "Storyverse",
    ribbon: "Flagship creative world",
  },
  creatorlab: {
    background:
      "from-[#ffe9f4] via-[#fff8fb] to-[#ffffff]",
    accent: "text-rose-700",
    border: "border-rose-200/80",
    glow: "bg-rose-100/50",
    button: "bg-rose-500 text-white hover:bg-rose-600",
    emoji: "✨",
    label: "Creator Lab",
    ribbon: "Creator playground",
  },
  careerlab: {
    background:
      "from-[#e5fff8] via-[#f7fffc] to-[#ffffff]",
    accent: "text-teal-700",
    border: "border-teal-200/80",
    glow: "bg-teal-100/50",
    button: "bg-teal-500 text-white hover:bg-teal-600",
    emoji: "🚀",
    label: "Career Lab",
    ribbon: "Mission discovery",
  },
} as const;

export default function WorldShell({
  world,
  title,
  description,
  children,
}: WorldShellProps) {
  const theme = worldThemes[world];

  return (
    <section
      className={`relative overflow-hidden rounded-[48px] border bg-gradient-to-b p-6 shadow-[0_28px_110px_rgba(14,165,233,0.12)] md:p-10 ${theme.background} ${theme.border}`}
    >
      <div
        className={`absolute -right-12 top-0 h-72 w-72 rounded-full blur-3xl ${theme.glow}`}
      />
      <div className="absolute left-8 top-8 hidden h-4 w-4 rounded-full bg-white/80 shadow-sm md:block" />
      <div className="absolute bottom-12 right-20 hidden h-3 w-3 rounded-full bg-white/70 shadow-sm md:block" />
      <div className="absolute bottom-10 left-12 hidden h-2 w-2 rounded-full bg-white/70 shadow-sm md:block" />

      <div className="relative z-10 space-y-9">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 rounded-full bg-white/86 px-5 py-2 text-xs font-black uppercase tracking-[0.08em] shadow-sm transition-transform duration-300 hover:scale-105 ${theme.accent}`}
            >
              <span className="text-sm">{theme.emoji}</span>
              <span>{theme.label}</span>
            </div>

            <div className="rounded-full bg-slate-900/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
              {theme.ribbon}
            </div>
          </div>

          <div className="space-y-5">
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-slate-900 md:text-7xl">
              {title}
            </h1>

            <p className="max-w-2xl text-lg leading-9 text-slate-600">
              {description}
            </p>
          </div>
        </div>

        <div className="rounded-[42px] border border-white/80 bg-white/86 p-6 shadow-sm backdrop-blur-sm md:p-8">
          {children}
        </div>
      </div>
    </section>
  );
}
