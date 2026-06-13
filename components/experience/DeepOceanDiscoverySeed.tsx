const oceanSignals = [
  {
    label: "Depth",
    value: "940m",
    detail: "Below the light zone",
  },
  {
    label: "Signal",
    value: "Soft pulse",
    detail: "Bioluminescent response detected",
  },
  {
    label: "Mood",
    value: "Calm mystery",
    detail: "Wonder-first pacing",
  },
];

const oceanBeats = [
  {
    index: "01",
    title: "Descent begins",
    description:
      "The child enters through a slow underwater descent instead of a space transmission.",
  },
  {
    index: "02",
    title: "Marine guide arrives",
    description:
      "The AI guide feels observational, calm and protective — not mission-control oriented.",
  },
  {
    index: "03",
    title: "Careful scan",
    description:
      "The choice pattern changes from restore/listen to scan/observe/protect.",
  },
  {
    index: "04",
    title: "Discovery archive",
    description:
      "The memory artifact becomes a creature card, expedition log or ocean signal archive.",
  },
];

export default function DeepOceanDiscoverySeed() {
  return (
    <section className="relative overflow-hidden rounded-[40px] border border-sky-300/14 bg-[#01111f] p-5 text-white shadow-[0_30px_120px_rgba(7,89,133,0.24)] md:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(56,189,248,0.16),transparent_30%),radial-gradient(circle_at_84%_20%,rgba(45,212,191,0.13),transparent_36%),linear-gradient(180deg,rgba(1,17,31,0.94),rgba(2,44,74,0.9))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
        <div className="absolute left-0 top-[24%] h-px w-full bg-sky-200" />
        <div className="absolute left-0 top-[54%] h-px w-full bg-teal-200" />
        <div className="absolute left-0 top-[82%] h-px w-full bg-cyan-200" />
      </div>

      <div className="relative z-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/18 bg-sky-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-sky-100">
            <span className="h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_18px_rgba(94,234,212,0.9)]" />
            Second world validation
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Deep Ocean Discovery proves this is not just a space interface.
          </h2>

          <p className="mt-5 text-sm leading-7 text-sky-50/74 md:text-base">
            This seed uses the same Immersive AI Experience grammar, but changes
            the emotional tone, visual language, guide behavior and interaction verbs.
            The goal is to validate reusable world creation.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {oceanSignals.map((signal) => (
              <div
                key={signal.label}
                className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-100/52">
                  {signal.label}
                </p>
                <p className="mt-2 text-lg font-black text-white">
                  {signal.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-sky-50/64">
                  {signal.detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          {oceanBeats.map((beat) => (
            <div
              key={beat.index}
              className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-teal-200/28 hover:bg-white/[0.065]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-200/18 bg-teal-300/10 text-sm font-black text-teal-100">
                  {beat.index}
                </div>

                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    {beat.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-sky-50/70">
                    {beat.description}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-[28px] border border-teal-200/12 bg-teal-300/[0.06] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-teal-100/62">
              World factory signal
            </p>
            <p className="mt-3 text-sm leading-7 text-sky-50/76">
              If this second world feels meaningfully different while using the same
              arc, the platform is ready to move toward a configurable World Pack system.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}