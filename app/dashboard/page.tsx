import Link from "next/link";
import FlowCard from "../../components/FlowCard";
import { experienceFlows } from "../../lib/flows";

export default function DashboardPage() {
  const activeCount = experienceFlows.filter((flow) => flow.status === "active").length;
  const pilotCount = experienceFlows.filter((flow) => flow.status === "pilot").length;
  const comingSoonCount = experienceFlows.filter((flow) => flow.status === "coming_soon").length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_30%),linear-gradient(180deg,_#050816_0%,_#020617_45%,_#000000_100%)] px-4 py-8 text-white md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.35)] md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                AI Experience Lab Platform
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
                  7 flow üzerinden ürünleşmiş deneyim platformu
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                  Bu dashboard, mevcut çalışan Storyverse üretim motorunu bozmadan platform algısını başlatır. Her flow aynı çekirdek motor üzerine bağlanacak; ilk aktif MVP Storyverse, diğerleri pilot/roadmap modunda ilerleyecek.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-300 md:text-sm">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Scenario Engine hazırlığı</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Flow Registry</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Create page reuse</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">MVP → Pilot → Product</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Aktif MVP</p>
                <p className="mt-3 text-3xl font-semibold">{activeCount}</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Pilot Flow</p>
                <p className="mt-3 text-3xl font-semibold">{pilotCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-400/20 bg-slate-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Roadmap</p>
                <p className="mt-3 text-3xl font-semibold">{comingSoonCount}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {experienceFlows.map((flow) => (
            <FlowCard key={flow.key} flow={flow} />
          ))}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-slate-300">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-white">Güvenli başlangıç prensibi</p>
              <p className="mt-1">
                Bu sprint backend’i değiştirmez. Dashboard sadece flow seçimini görünür hale getirir ve mevcut create page’e query parametre ile bağlanır.
              </p>
            </div>
            <Link href="/create?flow=storyverse" className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 font-semibold text-cyan-100 hover:bg-cyan-400/20">
              Mevcut çalışan akışa dön
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
