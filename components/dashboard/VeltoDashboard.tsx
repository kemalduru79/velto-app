"use client";

// X11.9 Dashboard Stabilization Polish: final dashboard microcopy stabilization before Career Lab expansion.

// X11.3 Dashboard Macro Component Refresh
// Component-level dashboard refresh matching the route-level dashboard.

import Link from "next/link";
import { experienceFlows } from "@/lib/flows";
import { useLanguage } from "@/lib/useLanguage";
import { dashboardMessages } from "@/lib/i18n/dashboard";
import { flowCardMessages } from "@/lib/i18n/flowCard";

type Status = "active" | "pilot" | "coming_soon" | string;

const getFlowHref = (flowKey: string) => {
  if (flowKey === "storyverse") return "/create?flow=storyverse";
  if (flowKey === "creator_lab" || flowKey === "creatorlab") return "/create?flow=creator_lab";
  if (flowKey === "career_lab" || flowKey === "careerlab" || flowKey === "career") return "/create?flow=career_lab";
  return `/create?flow=${flowKey}`;
};

const getIcon = (flowKey: string) => {
  if (flowKey === "storyverse") return "🎬";
  if (flowKey === "creator_lab" || flowKey === "creatorlab") return "⚡";
  if (flowKey === "career_lab" || flowKey === "careerlab" || flowKey === "career") return "🚀";
  if (flowKey.includes("quest")) return "🧭";
  if (flowKey.includes("character")) return "🎭";
  if (flowKey.includes("thinking")) return "🧠";
  if (flowKey.includes("maker")) return "🛠️";
  return "✨";
};

const getGradient = (flowKey: string) => {
  if (flowKey === "storyverse") return "from-sky-500 via-indigo-500 to-violet-500";
  if (flowKey === "creator_lab" || flowKey === "creatorlab") return "from-rose-500 via-orange-500 to-amber-400";
  if (flowKey === "career_lab" || flowKey === "careerlab" || flowKey === "career") return "from-emerald-500 via-teal-500 to-cyan-500";
  if (flowKey.includes("quest")) return "from-purple-500 via-fuchsia-500 to-pink-500";
  if (flowKey.includes("character")) return "from-cyan-500 via-sky-500 to-blue-500";
  if (flowKey.includes("thinking")) return "from-amber-400 via-orange-500 to-rose-500";
  if (flowKey.includes("maker")) return "from-lime-500 via-emerald-500 to-teal-500";
  return "from-slate-500 via-slate-600 to-slate-700";
};

const getStatusText = (status: Status, isEnglish: boolean) => {
  if (status === "active") return isEnglish ? "Ready" : "Hazır";
  if (status === "pilot") return isEnglish ? "Explore" : "Keşfet";
  return isEnglish ? "Later" : "Sonra";
};

const getStatusStyle = (status: Status) => {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "pilot") return "border-sky-200 bg-sky-50 text-sky-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

const safeOutputs = (outputs: unknown) => {
  if (!Array.isArray(outputs)) return [];
  return outputs.filter(Boolean).slice(0, 3).map(String);
};

function WorldCard({
  flow,
  title,
  description,
  isEnglish,
}: {
  flow: any;
  title: string;
  description: string;
  isEnglish: boolean;
}) {
  const flowKey = flow.key || flow.id || "storyverse";
  const outputs = safeOutputs(flow.outputs);
  const gradient = getGradient(flowKey);
  const isAvailable = flow.status === "active" || flow.status === "pilot";

  return (
    <Link
      href={isAvailable ? getFlowHref(flowKey) : "#"}
      aria-disabled={!isAvailable}
      className={`group relative min-h-[310px] overflow-hidden rounded-[34px] border border-white/80 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.12)] transition duration-300 ${
        isAvailable ? "hover:-translate-y-1 hover:shadow-[0_30px_90px_rgba(15,23,42,0.16)]" : "cursor-not-allowed opacity-70"
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-2 bg-gradient-to-r ${gradient}`} />
      <div className={`absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br ${gradient} opacity-16 blur-3xl transition group-hover:opacity-28`} />

      <div className="relative z-10 flex h-full flex-col justify-between gap-8">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${gradient} text-4xl shadow-lg`}>
              {getIcon(flowKey)}
            </div>

            <span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${getStatusStyle(flow.status)}`}>
              {getStatusText(flow.status, isEnglish)}
            </span>
          </div>

          <div>
            <h3 className="text-3xl font-black tracking-tight text-slate-950">
              {title}
            </h3>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-700">
              {description}
            </p>
          </div>

          {outputs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {outputs.map((output) => (
                <span key={output} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-slate-700">
                  {output}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-slate-500">
            {flow.ageBand ? <span>{flow.ageBand}</span> : null}
            {flow.durationMin ? <span> · ~{flow.durationMin} min</span> : null}
          </div>

          <span className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition group-hover:scale-[1.04]">
            {isAvailable ? (isEnglish ? "Start" : "Başla") : (isEnglish ? "Later" : "Sonra")}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function VeltoDashboard() {
  const { language, setLanguage } = useLanguage();
  const isEnglish = language === "en";

  const t = dashboardMessages[language] ?? dashboardMessages.tr;
  const localized = flowCardMessages[language] ?? flowCardMessages.tr;
  const localizedFlows = localized.flows ?? {};

  const activeFlows = experienceFlows.filter((flow) => flow.status === "active");
  const pilotFlows = experienceFlows.filter((flow) => flow.status === "pilot");
  const laterFlows = experienceFlows.filter((flow) => flow.status === "coming_soon");

  const renderCard = (flow: any) => {
    const copy = localizedFlows[flow.key] ?? flow;

    return (
      <WorldCard
        key={flow.key}
        flow={flow}
        isEnglish={isEnglish}
        title={copy.shortTitle ?? copy.title ?? flow.title}
        description={copy.description ?? flow.description}
      />
    );
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_8%,#fbcfe8_0%,transparent_28%),radial-gradient(circle_at_90%_8%,#bae6fd_0%,transparent_32%),radial-gradient(circle_at_48%_92%,#fde68a_0%,transparent_36%),linear-gradient(180deg,#fff7ed_0%,#f8fbff_48%,#ecfdf5_100%)] px-4 py-6 text-slate-950 md:px-8 md:py-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-white/80 to-transparent" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8">
        <div className="flex justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/88 p-1 text-xs text-slate-600 shadow-sm backdrop-blur-xl">
            <span className="px-3 font-bold">{t.languageSwitch?.label ?? "Language"}</span>
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
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-orange-800">
                VELTO Experience Worlds
              </div>
              <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
                {isEnglish ? "Choose your AI world." : "AI dünyanı seç."}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-700">
                {isEnglish
                  ? "Storyverse, Creator Lab, Career Lab and future worlds are clearly separated so children know where to begin."
                  : "Storyverse, Creator Lab, Career Lab ve gelecek dünyalar net şekilde ayrıldı; çocuk nereden başlayacağını kolayca görür."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-[32px] border border-sky-100 bg-sky-50/80 p-5">
              <div className="rounded-3xl bg-white p-4 text-center shadow-sm">
                <p className="text-3xl font-black text-slate-950">{activeFlows.length}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">{isEnglish ? "Ready" : "Hazır"}</p>
              </div>
              <div className="rounded-3xl bg-white p-4 text-center shadow-sm">
                <p className="text-3xl font-black text-slate-950">{pilotFlows.length}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-sky-700">{isEnglish ? "Explore" : "Keşif"}</p>
              </div>
              <div className="rounded-3xl bg-white p-4 text-center shadow-sm">
                <p className="text-3xl font-black text-slate-950">{laterFlows.length}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{isEnglish ? "Later" : "Sonra"}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">{isEnglish ? "Ready worlds" : "Hazır dünyalar"}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{isEnglish ? "Start here" : "Buradan başla"}</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {activeFlows.map(renderCard)}
          </div>
        </section>

        {pilotFlows.length > 0 ? (
          <section className="space-y-5 rounded-[36px] border border-white/80 bg-white/70 p-5 shadow-[0_16px_55px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-700">{isEnglish ? "Explore next" : "Sıradaki keşifler"}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{isEnglish ? "Pilot worlds" : "Pilot dünyalar"}</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {pilotFlows.map(renderCard)}
            </div>
          </section>
        ) : null}

        {laterFlows.length > 0 ? (
          <section className="space-y-5 rounded-[36px] border border-white/80 bg-white/58 p-5 shadow-[0_16px_55px_rgba(15,23,42,0.05)] backdrop-blur-xl md:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{isEnglish ? "Coming later" : "Daha sonra"}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{isEnglish ? "Future worlds" : "Gelecek dünyalar"}</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {laterFlows.map(renderCard)}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
