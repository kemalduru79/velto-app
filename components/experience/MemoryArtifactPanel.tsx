const artifactItems = [
  {
    label: "Signal Archive",
    title: "Recovered transmission fragment",
    description:
      "A short collectible recap of the signal the child helped restore.",
  },
  {
    label: "Explorer Memory",
    title: "First contact decision log",
    description:
      "A child-friendly summary of the meaningful choice and its consequence.",
  },
  {
    label: "World Continuation",
    title: "Next discovery unlocked",
    description:
      "A cinematic hook that makes the experience feel like it can continue later.",
  },
];

export default function MemoryArtifactPanel() {
  return (
    <section className="relative overflow-hidden rounded-[38px] border border-cyan-300/15 bg-[#030712] p-5 text-white shadow-[0_30px_110px_rgba(8,47,73,0.22)] md:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(34,211,238,0.15),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.13),transparent_32%)]" />
      <div className="pointer-events-none absolute -bottom-24 right-10 h-64 w-64 rounded-full bg-cyan-300/12 blur-3xl" />

      <div className="relative z-10 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-100/64">
            Memory artifact
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">
            The experience should leave a trace.
          </h2>

          <p className="mt-4 text-sm leading-7 text-cyan-50/74">
            Immersive worlds should not end with a plain completion message.
            They should produce a small collectible memory: a signal archive,
            discovery card, decision log, or scene artifact that gives the child
            a reason to remember and continue.
          </p>

          <div className="mt-6 rounded-[28px] border border-emerald-200/12 bg-emerald-300/[0.07] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100/62">
              Child-facing reward
            </p>
            <p className="mt-3 text-sm leading-6 text-cyan-50/76">
              “You restored the first signal. A new fragment has been saved to
              your Explorer Memory.”
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {artifactItems.map((item) => (
            <div
              key={item.label}
              className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200/26 hover:bg-white/[0.065]"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100/58">
                {item.label}
              </p>
              <h3 className="mt-2 text-lg font-black tracking-tight text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-cyan-50/70">
                {item.description}
              </p>
            </div>
          ))}

          <div className="rounded-[28px] border border-cyan-200/12 bg-cyan-300/[0.06] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100/62">
              Platform logic
            </p>
            <p className="mt-3 text-sm leading-7 text-cyan-50/76">
              This memory layer can later connect to Storyverse exports,
              Creator Lab packaging, Supabase project records, or parent-facing
              progress summaries without changing the experience grammar.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}