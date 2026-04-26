import Link from "next/link";
import type { ExperienceFlow, FlowZone } from "../lib/flows";

type FlowCardProps = {
  flow: ExperienceFlow;
};

const statusLabelMap: Record<ExperienceFlow["status"], string> = {
  active: "Aktif",
  pilot: "Pilot",
  coming_soon: "Yakında",
};

const statusClassMap: Record<ExperienceFlow["status"], string> = {
  active: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  pilot: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  coming_soon: "border-slate-400/20 bg-slate-500/10 text-slate-300",
};

const zoneClassMap: Record<FlowZone, string> = {
  AI: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  Maker: "border-orange-400/30 bg-orange-500/10 text-orange-100",
  VR: "border-violet-400/30 bg-violet-500/10 text-violet-100",
};

export default function FlowCard({ flow }: FlowCardProps) {
  const isComingSoon = flow.status === "coming_soon";

  return (
    <div className="flex h-full flex-col justify-between rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)] transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.07]">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">
              {flow.shortTitle}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {flow.title}
            </h2>
          </div>

          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              statusClassMap[flow.status]
            }`}
          >
            {statusLabelMap[flow.status]}
          </span>
        </div>

        <p className="text-sm font-medium text-slate-200">{flow.subtitle}</p>
        <p className="text-sm leading-6 text-slate-300">{flow.description}</p>

        <div className="flex flex-wrap gap-2">
          {flow.zones.map((zone: FlowZone) => (
            <span
              key={zone}
              className={`rounded-full border px-3 py-1 text-xs ${zoneClassMap[zone]}`}
            >
              {zone}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-slate-400">Yaş</p>
            <p className="mt-1 font-semibold text-white">{flow.ageBand}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs text-slate-400">Süre</p>
            <p className="mt-1 font-semibold text-white">
              {flow.durationMin} dk
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
            Çıktılar
          </p>

          <div className="flex flex-wrap gap-2">
            {flow.outputs.map((output: string) => (
              <span
                key={output}
                className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-200"
              >
                {output}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        {isComingSoon ? (
          <button
            disabled
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-400"
          >
            {flow.ctaLabel}
          </button>
        ) : (
          <Link
            href={`/create?flow=${flow.key}`}
            className="block w-full rounded-2xl bg-cyan-500 px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            {flow.ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}