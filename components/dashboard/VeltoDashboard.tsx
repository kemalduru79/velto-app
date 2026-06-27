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
    mark: "SV",
    eyebrow: {
      tr: "8-18 · Güvenli yaratıcı dünya",
      en: "8-18 · Safe creative world",
    },
    promise: {
      tr: "Çocuklar ve gençler için kontrollü, sakin ve güvenli hikâye üretimi.",
      en: "Controlled, calm and safe story creation for children and teenagers.",
    },
    proof: {
      tr: ["Yaşa duyarlı üretim", "Güvenli prompt sınırları", "Hikâye + sahne + ses"],
      en: ["Age-aware creation", "Safe prompt boundaries", "Story + scene + voice"],
    },
    steps: {
      tr: ["Fikir", "Karakter", "Sahne", "Güvenli export"],
      en: ["Idea", "Character", "Scene", "Safe export"],
    },
  },
  creator_lab: {
    mark: "CL",
    eyebrow: {
      tr: "18+ · Profesyonel creator studio",
      en: "18+ · Professional creator studio",
    },
    promise: {
      tr: "YouTube, Shorts/Reels ve sosyal yayınlar için uçtan uca production engine.",
      en: "End-to-end production engine for YouTube, Shorts/Reels and social publishing.",
    },
    proof: {
      tr: ["Long-form + short-form", "Thumbnail + metadata", "Voice-over + video pack"],
      en: ["Long-form + short-form", "Thumbnail + metadata", "Voice-over + video pack"],
    },
    steps: {
      tr: ["Hook", "Script", "Asset", "Publish pack"],
      en: ["Hook", "Script", "Asset", "Publish pack"],
    },
  },
} as const;

export default function VeltoDashboard() {
  const { language, setLanguage } = useLanguage();
  const isEnglish = language === "en";
  const t = dashboardMessages[language] ?? dashboardMessages.tr;
  const localized = flowCardMessages[language] ?? flowCardMessages.tr;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060914] px-4 py-5 text-white md:px-8 md:py-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_4%,rgba(14,165,233,0.22),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(244,63,94,0.20),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.10),transparent_34%),linear-gradient(180deg,#060914_0%,#0A1020_50%,#111827_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-20 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-white/[0.035] blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-slate-950">V</span>
            <span className="text-sm font-black tracking-[0.18em] text-white/85">VELTO</span>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] p-1 text-xs text-white/70 shadow-[0_16px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <span className="hidden px-3 font-bold sm:inline">{t.languageSwitch.label}</span>
            <button
              type="button"
              onClick={() => setLanguage("tr")}
              className={`rounded-full px-3 py-2 font-black transition ${language === "tr" ? "bg-white text-slate-950" : "hover:bg-white/10 hover:text-white"}`}
            >
              TR
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-3 py-2 font-black transition ${language === "en" ? "bg-white text-slate-950" : "hover:bg-white/10 hover:text-white"}`}
            >
              EN
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.07] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.34)] backdrop-blur-2xl md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/72">
                {isEnglish ? "Focused AI Product Platform" : "Odaklı AI Ürün Platformu"}
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.045em] text-white md:text-6xl">
                {isEnglish ? "Two products. Two distinct experiences." : "İki ürün. İki ayrı deneyim."}
              </h1>
              <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-white/68">
                {isEnglish
                  ? "Storyverse is a safe creative world for young users. CreatorLab is a professional production engine for 18+ creators. The platform is now focused, cleaner and easier to scale."
                  : "Storyverse genç kullanıcılar için güvenli bir yaratıcı dünya. CreatorLab ise 18+ creator’lar için profesyonel üretim motoru. Platform artık daha odaklı, daha temiz ve ölçeklenebilir."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                { value: "2", label: isEnglish ? "Active products" : "Aktif ürün" },
                { value: "0", label: isEnglish ? "Legacy flows" : "Eski akış" },
                { value: "1", label: isEnglish ? "Shared system" : "Ortak sistem" },
              ].map((item) => (
                <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/[0.08] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
                  <p className="text-3xl font-black tracking-tight text-white">{item.value}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-white/52">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/80">
                {isEnglish ? "Product surfaces" : "Ürün yüzeyleri"}
              </p>
              <h2 className="mt-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                {isEnglish ? "Choose your production mode" : "Üretim modunu seç"}
              </h2>
            </div>
            <p className="max-w-xl text-sm font-medium leading-6 text-white/52">
              {isEnglish
                ? "The products now share the same design foundation, but their visual language and user promise are deliberately separated."
                : "İki ürün aynı tasarım temeline sahip; ancak görsel dil ve kullanıcı vaadi bilinçli olarak ayrıştırıldı."}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            {experienceFlows.map((flow) => {
              const copy = localized.flows[flow.key] ?? flow;
              const meta = productMeta[flow.key];
              const isStoryverse = flow.key === "storyverse";

              if (isStoryverse) {
                return (
                  <Link
                    key={flow.key}
                    href={getFlowHref(flow.key)}
                    className="group relative min-h-[390px] overflow-hidden rounded-[34px] border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(8,25,43,0.94)_0%,rgba(15,23,42,0.96)_48%,rgba(30,41,59,0.78)_100%)] p-5 text-white shadow-[0_26px_90px_rgba(14,165,233,0.16)] ring-1 ring-cyan-200/10 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/30 hover:shadow-[0_34px_110px_rgba(14,165,233,0.22)] md:p-6"
                  >
                    <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/16 blur-3xl transition group-hover:bg-cyan-400/24" />
                    <div className="pointer-events-none absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-blue-500/12 blur-3xl" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400" />

                    <div className="relative z-10 flex h-full flex-col justify-between gap-5">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-cyan-100 text-sm font-black tracking-tight text-slate-950 shadow-[0_18px_45px_rgba(14,165,233,0.18)] ring-1 ring-cyan-200/40">
                            {meta.mark}
                          </div>

                          <span className="rounded-full border border-cyan-200/20 bg-white/[0.07] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-cyan-100/82">
                            {meta.eyebrow[language]}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/76">
                            {isEnglish ? "Safe story world" : "Güvenli hikâye dünyası"}
                          </p>
                          <h3 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white md:text-4xl">
                            {copy.shortTitle ?? copy.title}
                          </h3>
                          <p className="mt-3 text-sm font-black uppercase tracking-[0.08em] text-white/48">
                            {copy.subtitle}
                          </p>
                          <p className="mt-3 text-sm font-medium leading-6 text-white/68">
                            {copy.description}
                          </p>
                        </div>

                        <div className="rounded-[24px] border border-white/10 bg-white/[0.07] p-3 shadow-[0_18px_50px_rgba(14,165,233,0.10)]">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100/78">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            {isEnglish ? "Guarded creative path" : "Kontrollü yaratıcı yol"}
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {meta.steps[language].map((step, index) => (
                              <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2.5 text-sm font-black text-white/74">
                                <span className="mr-2 text-cyan-200">0{index + 1}</span>
                                {step}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-2">
                          {meta.proof[language].map((item) => (
                            <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.065] px-3 py-2.5 text-sm font-bold text-white/70">
                              <span className="h-2 w-2 rounded-full bg-cyan-300" />
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                        <div className="text-sm font-semibold text-white/50">
                          <span>{flow.ageBand}</span>
                          <span> · ~{flow.durationMin} {isEnglish ? "min" : "dk"}</span>
                        </div>

                        <span className="inline-flex rounded-full bg-cyan-100 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_12px_35px_rgba(14,165,233,0.14)] transition group-hover:scale-[1.04]">
                          {copy.ctaLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  key={flow.key}
                  href={getFlowHref(flow.key)}
                  className="group relative min-h-[390px] overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.96)_0%,rgba(17,24,39,0.94)_46%,rgba(76,29,149,0.58)_100%)] p-5 text-white shadow-[0_26px_90px_rgba(0,0,0,0.34)] ring-1 ring-rose-300/20 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_34px_110px_rgba(0,0,0,0.42)] md:p-6"
                >
                  <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-rose-500/28 blur-3xl transition group-hover:bg-rose-500/38" />
                  <div className="pointer-events-none absolute -bottom-24 left-8 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300" />

                  <div className="relative z-10 flex h-full flex-col justify-between gap-5">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-rose-500 to-amber-300 text-sm font-black tracking-tight text-slate-950 shadow-[0_18px_45px_rgba(244,63,94,0.22)]">
                          {meta.mark}
                        </div>

                        <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white/68">
                          {meta.eyebrow[language]}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-100/80">
                          {isEnglish ? "Production engine" : "Production engine"}
                        </p>
                        <h3 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white md:text-4xl">
                          {copy.shortTitle ?? copy.title}
                        </h3>
                        <p className="mt-3 text-sm font-black uppercase tracking-[0.08em] text-white/46">
                          {copy.subtitle}
                        </p>
                        <p className="mt-3 text-sm font-medium leading-6 text-white/68">
                          {copy.description}
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-black/24 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                        <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em] text-white/60">
                          <span>{isEnglish ? "Creator pipeline" : "Creator üretim hattı"}</span>
                          <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-white/52">16:9 · 9:16</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {meta.steps[language].map((step, index) => (
                            <div key={step} className="grid grid-cols-[3rem_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.065] px-3 py-2.5 text-sm font-black text-white/76">
                              <span className="rounded-full bg-rose-400/18 px-2 py-1 text-center text-rose-100">0{index + 1}</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        {meta.proof[language].map((item) => (
                          <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2.5 text-sm font-bold leading-5 text-white/70">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <div className="text-sm font-semibold text-white/50">
                        <span>{flow.ageBand}</span>
                        <span> · ~{flow.durationMin} {isEnglish ? "min" : "dk"}</span>
                      </div>

                      <span className="inline-flex rounded-full bg-white px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_12px_35px_rgba(255,255,255,0.12)] transition group-hover:scale-[1.04]">
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
