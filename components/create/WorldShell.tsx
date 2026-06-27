"use client";

import type { ActiveWorld } from "@/components/create/WorldContext";
import { useLanguage } from "@/lib/useLanguage";

type WorldShellProps = {
  world: ActiveWorld;
  title: string;
  description: string;
  children: React.ReactNode;
};

const worldThemes = {
  storyverse: {
    shell:
      "border-cyan-100/12 bg-[linear-gradient(180deg,rgba(8,23,39,0.88),rgba(7,19,33,0.92))] text-white shadow-[0_34px_120px_rgba(2,6,23,0.40)]",
    accent: "text-cyan-100",
    glow: "bg-cyan-300/12",
    inner: "border-white/10 bg-white/[0.055] backdrop-blur-2xl",
    emoji: "SV",
    label: "Storyverse",
    ribbon: "Safe story production",
    ribbonStyle: "bg-cyan-300/10 text-cyan-100/72 border border-cyan-100/12",
    title: "text-white",
    description: "text-slate-200/68",
    badge: "bg-white/[0.07] text-cyan-50 border border-white/10",
  },
  creatorlab: {
    shell:
      "border-orange-200/14 bg-[linear-gradient(180deg,rgba(20,12,24,0.92),rgba(9,10,20,0.94))] text-white shadow-[0_34px_120px_rgba(0,0,0,0.46)]",
    accent: "text-orange-100",
    glow: "bg-rose-400/14",
    inner: "border-white/10 bg-white/[0.055] backdrop-blur-2xl",
    emoji: "CL",
    label: "CreatorLab",
    ribbon: "Production engine",
    ribbonStyle: "bg-orange-400/10 text-orange-100/74 border border-orange-200/14",
    title: "text-white",
    description: "text-orange-50/66",
    badge: "bg-white/[0.07] text-orange-50 border border-white/10",
  },
} as const;

export default function WorldShell({
  world,
  title,
  description,
  children,
}: WorldShellProps) {
  const theme = worldThemes[world];
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const localizedRibbon = world === "storyverse"
    ? (isEnglish ? "Safe story production" : "Güvenli hikâye üretimi")
    : (isEnglish ? "Production engine" : "Üretim motoru");

  return (
    <section
      className={`relative overflow-hidden rounded-[40px] border p-5 md:rounded-[48px] md:p-8 lg:p-10 ${theme.shell}`}
    >
      <div
        className={`pointer-events-none absolute -right-16 top-0 h-80 w-80 rounded-full blur-3xl ${theme.glow}`}
      />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />
      <div className="pointer-events-none absolute left-8 top-8 hidden h-4 w-4 rounded-full bg-white/18 shadow-sm md:block" />
      <div className="pointer-events-none absolute bottom-12 right-20 hidden h-3 w-3 rounded-full bg-white/14 shadow-sm md:block" />

      <div className="relative z-10 space-y-8">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.10em] shadow-sm transition-transform duration-300 hover:scale-105 ${theme.badge}`}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[10px] font-black">
                {theme.emoji}
              </span>
              <span>{theme.label}</span>
            </div>

            <div className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.10em] ${theme.ribbonStyle}`}>
              {localizedRibbon}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-4">
              <h1 className={`max-w-4xl text-4xl font-black tracking-[-0.045em] md:text-6xl ${theme.title}`}>
                {title}
              </h1>

              <p className={`max-w-2xl text-base font-medium leading-8 md:text-lg ${theme.description}`}>
                {description}
              </p>
            </div>

            {world === "storyverse" ? (
              <div className="rounded-[26px] border border-cyan-100/12 bg-white/[0.045] p-4 text-sm leading-7 text-slate-200/68">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100/58">
                  {isEnglish ? "Safety layer" : "Güvenlik katmanı"}
                </div>
                <div className="mt-2">
                  {isEnglish
                    ? "Premium look, age-aware flow and controlled creative boundaries remain visible throughout the experience."
                    : "Premium görünüm, yaşa duyarlı akış ve kontrollü yaratıcı sınırlar deneyim boyunca görünür kalır."}
                </div>
              </div>
            ) : (
              <div className="rounded-[26px] border border-orange-200/14 bg-white/[0.045] p-4 text-sm leading-7 text-orange-50/68">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-100/60">
                  {isEnglish ? "Production layer" : "Üretim katmanı"}
                </div>
                <div className="mt-2">
                  {isEnglish
                    ? "CreatorLab keeps the flow focused on angle, hook, script, thumbnail, metadata and platform-ready packaging."
                    : "CreatorLab akışı açı, hook, script, thumbnail, metadata ve platforma hazır paketleme üzerinde tutar."}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-[32px] border p-4 shadow-sm md:rounded-[42px] md:p-6 lg:p-8 ${theme.inner}`}>
          {children}
        </div>
      </div>
    </section>
  );
}
