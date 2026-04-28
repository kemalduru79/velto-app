"use client";

import Link from "next/link";
import FlowCard from "@/components/FlowCard";
import { experienceFlows } from "@/lib/flows";
import { useLanguage } from "@/lib/useLanguage";
import { dashboardMessages } from "@/lib/i18n/dashboard";

export default function DashboardPage() {
  const { language, setLanguage } = useLanguage();
  const t = dashboardMessages[language] ?? dashboardMessages.tr;

  const activeFlows = experienceFlows.filter(
    (flow) => flow.status === "active"
  );
  const storyverseFlow = activeFlows.find((flow) => flow.key === "storyverse");
  const creatorLabFlow = activeFlows.find((flow) => flow.key === "creator_lab");
  const otherActiveFlows = activeFlows.filter(
    (flow) => flow.key !== "storyverse" && flow.key !== "creator_lab"
  );
  const pilotFlows = experienceFlows.filter((flow) => flow.status === "pilot");
  const roadmapFlows = experienceFlows.filter(
    (flow) => flow.status === "coming_soon"
  );

  const totalFlows = experienceFlows.length;
  const activeCount = experienceFlows.filter(
    (flow) => flow.status === "active"
  ).length;
  const pilotCount = pilotFlows.length;
  const roadmapCount = roadmapFlows.length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.12),_transparent_30%),linear-gradient(180deg,_#050816_0%,_#020617_48%,_#000000_100%)] px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-1 text-xs text-slate-300">
            <span className="px-3">{t.languageSwitch.label}</span>

            <button
              type="button"
              onClick={() => setLanguage("tr")}
              className={`rounded-xl px-3 py-2 font-semibold transition ${
                language === "tr"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {t.languageSwitch.tr}
            </button>

            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-xl px-3 py-2 font-semibold transition ${
                language === "en"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {t.languageSwitch.en}
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6 p-6 md:p-8 lg:p-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-100">
                  {t.badges.platform}
                </span>
                <span className="inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-purple-100">
                  {t.badges.experienceLab}
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
                  {t.hero.title}
                </h1>
                <p className="max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
                  {t.hero.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/create?flow=storyverse"
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  {t.hero.primaryCta}
                </Link>
                <a
                  href="#flows"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  {t.hero.secondaryCta}
                </a>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs text-slate-400">
                    {t.stats.totalFlows}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{totalFlows}</p>
                </div>
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                  <p className="text-xs text-emerald-200">
                    {t.stats.activeProduct}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
                </div>
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                  <p className="text-xs text-cyan-200">{t.stats.pilot}</p>
                  <p className="mt-2 text-2xl font-semibold">{pilotCount}</p>
                </div>
                <div className="rounded-2xl border border-slate-300/20 bg-slate-500/10 p-4">
                  <p className="text-xs text-slate-300">{t.stats.roadmap}</p>
                  <p className="mt-2 text-2xl font-semibold">{roadmapCount}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/20 p-6 md:p-8 lg:border-l lg:border-t-0 lg:p-10">
              <div className="flex h-full flex-col justify-between gap-6 rounded-[28px] border border-cyan-300/20 bg-cyan-400/10 p-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200">
                    {t.primaryProduct.eyebrow}
                  </p>
                  <h2 className="mt-3 text-3xl font-bold">
                    {t.primaryProduct.title}
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-cyan-50/85">
                    {t.primaryProduct.description}
                  </p>
                </div>

                <div className="space-y-3 text-sm text-cyan-50/90">
                  <div className="rounded-2xl border border-cyan-300/20 bg-black/20 p-4">
                    {t.primaryProduct.pipeline}
                  </div>
                  <div className="rounded-2xl border border-cyan-300/20 bg-black/20 p-4">
                    {t.primaryProduct.labIntegration}
                  </div>
                </div>

                <Link
                  href="/create?flow=storyverse"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01]"
                >
                  {t.primaryProduct.cta}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {activeFlows.length > 0 && (
          <section id="flows" className="space-y-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">
                  {t.sections.active.eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {t.sections.active.title}
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                {t.sections.active.description}
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {storyverseFlow && (
                <div className="rounded-[34px] border border-cyan-300/20 bg-cyan-400/[0.055] p-1 shadow-[0_20px_70px_rgba(34,211,238,0.08)]">
                  <FlowCard flow={storyverseFlow} language={language} />
                </div>
              )}

              {creatorLabFlow && (
                <div className="rounded-[34px] border border-sky-300/25 bg-sky-400/[0.065] p-1 shadow-[0_20px_70px_rgba(14,165,233,0.10)]">
                  <FlowCard flow={creatorLabFlow} language={language} />
                </div>
              )}
            </div>

            {otherActiveFlows.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {otherActiveFlows.map((flow) => (
                  <FlowCard key={flow.key} flow={flow} language={language} />
                ))}
              </div>
            )}
          </section>
        )}

        {pilotFlows.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">
                  {t.sections.pilot.eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {t.sections.pilot.title}
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                {t.sections.pilot.description}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {pilotFlows.map((flow) => (
                <div key={flow.key} className="opacity-85 transition hover:opacity-100">
                  <FlowCard flow={flow} language={language} />
                </div>
              ))}
            </div>
          </section>
        )}

        {roadmapFlows.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-300">
                  {t.sections.roadmap.eyebrow}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {t.sections.roadmap.title}
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-400">
                {t.sections.roadmap.description}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {roadmapFlows.map((flow) => (
                <div
                  key={flow.key}
                  className="opacity-55 grayscale-[0.15] transition hover:opacity-75 hover:grayscale-0"
                >
                  <FlowCard flow={flow} language={language} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-slate-300">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-white">
                {t.platformNote.title}
              </p>
              <p className="mt-1">{t.platformNote.description}</p>
            </div>
            <Link
              href="/create?flow=storyverse"
              className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 font-semibold text-cyan-100 hover:bg-cyan-400/20"
            >
              {t.platformNote.cta}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}