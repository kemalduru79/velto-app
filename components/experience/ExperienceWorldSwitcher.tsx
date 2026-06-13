
"use client";

type WorldKey = "space" | "ocean";

type Props = {
  activeWorld: WorldKey;
  onSwitch: (world: WorldKey) => void;
};

export default function ExperienceWorldSwitcher({
  activeWorld,
  onSwitch,
}: Props) {
  return (
    <section className="rounded-[24px] border border-white/8 bg-white/[0.03] p-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/48">
            Experience Worlds
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
            Choose the mission.
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSwitch("space")}
            className={`rounded-full px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition ${
              activeWorld === "space"
                ? "bg-cyan-300 text-slate-950"
                : "border border-white/10 bg-white/[0.04] text-white"
            }`}
          >
            Lunar Station
          </button>

          <button
            type="button"
            onClick={() => onSwitch("ocean")}
            className={`rounded-full px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition ${
              activeWorld === "ocean"
                ? "bg-blue-300 text-slate-950"
                : "border border-white/10 bg-white/[0.04] text-white"
            }`}
          >
            Deep Ocean
          </button>
        </div>
      </div>
    </section>
  );
}
