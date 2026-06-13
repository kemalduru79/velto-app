const timelineSteps = [
  {
    id: "entry",
    index: "01",
    title: "World Entry",
    subtitle: "The signal appears",
    description:
      "The child enters through atmosphere first, not through a task dashboard.",
  },
  {
    id: "guide",
    index: "02",
    title: "Guide Presence",
    subtitle: "The companion arrives",
    description:
      "The AI guide behaves like part of the world and gives emotional context.",
  },
  {
    id: "choice",
    index: "03",
    title: "Focused Choice",
    subtitle: "One decision matters",
    description:
      "A simple decision changes the next beat without creating quiz pressure.",
  },
  {
    id: "memory",
    index: "04",
    title: "Memory Artifact",
    subtitle: "The world leaves a trace",
    description:
      "The experience ends with a collectible signal archive or continuation hook.",
  },
];

export default function ExperienceTimeline() {
  return (
    <section className="relative overflow-hidden rounded-[40px] border border-cyan-300/14 bg-[#020617] p-5 text-white shadow-[0_30px_120px_rgba(8,47,73,0.24)] md:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(16,185,129,0.12),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 hidden h-px bg-cyan-200/16 lg:block" />

      <div className="relative z-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100/62">
              Experience timeline
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
              One continuous cinematic arc.
            </h2>
          </div>

          <p className="max-w-xl text-sm leading-7 text-cyan-50/72">
            This timeline turns the current layers into a reusable product grammar:
            every new world should feel like a guided arc, not a collection of cards.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          {timelineSteps.map((step) => (
            <div
              key={step.id}
              className="relative rounded-[30px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/28 hover:bg-white/[0.07]"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/18 bg-cyan-300/10 text-sm font-black text-cyan-100">
                  {step.index}
                </div>

                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
              </div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/52">
                {step.subtitle}
              </p>

              <h3 className="mt-2 text-lg font-black tracking-tight text-white">
                {step.title}
              </h3>

              <p className="mt-3 text-sm leading-6 text-cyan-50/70">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[30px] border border-emerald-200/12 bg-emerald-300/[0.06] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-100/62">
            Why this matters
          </p>
          <p className="mt-3 text-sm leading-7 text-cyan-50/76">
            This creates the bridge from a single Lost Space Signal prototype to
            a repeatable Immersive AI Experience Worlds system. Ocean Discovery,
            Dream Explorer, Time Mission, and future worlds can reuse the same arc.
          </p>
        </div>
      </div>
    </section>
  );
}