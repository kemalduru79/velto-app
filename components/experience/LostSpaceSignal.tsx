import CinematicIntro from "./CinematicIntro";
import SignalTransmissionLayer from "./SignalTransmissionLayer";

export default function LostSpaceSignal() {
  return (
    <section className="relative min-h-[720px] overflow-hidden rounded-[36px] border border-cyan-400/10 bg-[#020617] text-white shadow-[0_0_120px_rgba(34,211,238,0.14)]">
      <SignalTransmissionLayer />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100/80">
          Immersive AI Experience World
        </div>

        <CinematicIntro />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/60">
              Discovery
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              The child investigates a mysterious signal from a silent orbital station.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/60">
              Atmosphere
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Minimal interface, cinematic pacing, signal distortion, and ambient tension.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/60">
              Guide Presence
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              AI guidance behaves like a living companion instead of a dashboard widget.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}