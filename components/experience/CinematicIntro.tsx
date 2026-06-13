export default function CinematicIntro() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-cyan-400/20 bg-black px-6 py-12 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_45%)]" />
      <div className="relative z-10">
        <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">
          Incoming Signal
        </p>

        <h2 className="mt-4 text-4xl font-black tracking-tight">
          Signal lock established.
        </h2>

        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
          A distant orbital station has transmitted a fragmented distress signal.
          The experience begins with discovery, isolation, and guided exploration.
        </p>
      </div>
    </div>
  );
}