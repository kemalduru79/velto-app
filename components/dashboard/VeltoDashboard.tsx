"use client";

import Link from "next/link";
import { experienceFlows } from "@/lib/flows";
import { useLanguage } from "@/lib/useLanguage";
import { dashboardMessages } from "@/lib/i18n/dashboard";
import { flowCardMessages } from "@/lib/i18n/flowCard";

const getFlowHref = (flowKey: string) => {
  if (flowKey === "creator_lab" || flowKey === "creatorlab") return "/create?flow=creator_lab";
  return "/create?flow=storyverse";
};

const productMeta = {
  storyverse: {
    icon: "🎬",
    gradient: "from-sky-500 via-indigo-500 to-violet-500",
    pill: "Child-safe",
  },
  creator_lab: {
    icon: "⚡",
    gradient: "from-rose-500 via-orange-500 to-amber-400",
    pill: "18+ Creator Studio",
  },
} as const;

export default function VeltoDashboard() {
  const { language, setLanguage } = useLanguage();
  const isEnglish = language === "en";
  const t = dashboardMessages[language] ?? dashboardMessages.tr;
  const localized = flowCardMessages[language] ?? flowCardMessages.tr;

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_8%,#fbcfe8_0%,transparent_28%),radial-gradient(circle_at_90%_8%,#bae6fd_0%,transparent_32%),radial-gradient(circle_at_48%_92%,#fde68a_0%,transparent_36%),linear-gradient(180deg,#fff7ed_0%,#f8fbff_48%,#ecfdf5_100%)] px-4 py-6 text-slate-950 md:px-8 md:py-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-white/80 to-transparent" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/88 p-1 text-xs text-slate-600 shadow-sm backdrop-blur-xl">
            <span className="px-3 font-bold">{t.languageSwitch.label}</span>
            <button
              type="button"
              onClick={() => setLanguage("tr")}
              className={`rounded-full px-3 py-2 font-black transition ${language === "tr" ? "bg-slate-950 text-white" : "hover:bg-orange-50"}`}
            >
              TR
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-3 py-2 font-black transition ${language === "en" ? "bg-slate-950 text-white" : "hover:bg-orange-50"}`}
            >
              EN
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[42px] border border-white/80 bg-white/86 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.10)] backdrop-blur-xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-orange-800">
                VELTO Focused Product Layer
              </div>
              <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
                {isEnglish ? "Two products. One focused AI platform." : "İki ürün. Tek odaklı AI platformu."}
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-medium leading-8 text-slate-700">
                {isEnglish
                  ? "VELTO now focuses only on Storyverse and CreatorLab. The product surface has been simplified into two active creation paths."
                  : "VELTO artık yalnızca Storyverse ve CreatorLab üzerine odaklanır. Ürün yüzeyi iki aktif üretim yoluna sadeleştirilmiştir."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-[32px] border border-sky-100 bg-sky-50/80 p-5">
              <div className="rounded-3xl bg-white p-4 text-center shadow-sm">
                <p className="text-3xl font-black text-slate-950">2</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
                  {isEnglish ? "Active Products" : "Aktif Ürün"}
                </p>
              </div>
              <div className="rounded-3xl bg-white p-4 text-center shadow-sm">
                <p className="text-3xl font-black text-slate-950">0</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                  {isEnglish ? "Extra Flows" : "Ekstra Akış"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
              {isEnglish ? "Active product paths" : "Aktif ürün yolları"}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {isEnglish ? "Choose the product surface" : "Ürün yüzeyini seç"}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {experienceFlows.map((flow) => {
              const copy = localized.flows[flow.key] ?? flow;
              const meta = productMeta[flow.key];

              return (
                <Link
                  key={flow.key}
                  href={getFlowHref(flow.key)}
                  className="group relative min-h-[340px] overflow-hidden rounded-[34px] border border-white/80 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(15,23,42,0.16)]"
                >
                  <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${meta.gradient}`} />
                  <div className={`absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br ${meta.gradient} opacity-16 blur-3xl transition group-hover:opacity-28`} />

                  <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                    <div className="space-y-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${meta.gradient} text-4xl shadow-lg`}>
                          {meta.icon}
                        </div>

                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-emerald-800">
                          {meta.pill}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-3xl font-black tracking-tight text-slate-950">
                          {copy.shortTitle ?? copy.title}
                        </h3>
                        <p className="mt-3 text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                          {copy.subtitle}
                        </p>
                        <p className="mt-3 text-sm font-medium leading-6 text-slate-700">
                          {copy.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(copy.outputs ?? []).slice(0, 4).map((output) => (
                          <span key={output} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-slate-700">
                            {output}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm font-semibold text-slate-500">
                        <span>{flow.ageBand}</span>
                        <span> · ~{flow.durationMin} {isEnglish ? "min" : "dk"}</span>
                      </div>

                      <span className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition group-hover:scale-[1.04]">
                        {copy.ctaLabel}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
