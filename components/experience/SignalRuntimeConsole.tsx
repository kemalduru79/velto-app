const runtimeBeats = [
  {
    code: "01",
    title: "Signal detected",
    detail: "A broken transmission becomes the reason to enter the world.",
  },
  {
    code: "02",
    title: "Guide channel open",
    detail: "The AI guide enters as part of the environment, not as a generic panel.",
  },
  {
    code: "03",
    title: "Focused choice",
    detail: "One clear child decision changes the next cinematic beat.",
  },
  {
    code: "04",
    title: "Memory artifact",
    detail: "The ending becomes a collectible signal archive or scene memory.",
  },
];

export default function SignalRuntimeConsole() {
  return (
    <section className="relative overflow-hidden rounded-[38px] border border-cyan-300/15 bg-[#020617] p-5 text-white shadow-[0_30px_110px_rgba(8,47,73,0.24)] md:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.2),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(168,85,247,0.16),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.1]">
        <div className="absolute left-0 top-[22%] h-px w-full bg-cyan-200" />
        <div className="absolute left-0 top-[62%] h-px w-full bg-violet-200" />
        <div className="absolute left-[20%] top-0 h-full w-px bg-cyan-200" />
        <div className="absolute right-[26%] top-0 h-full w-px bg-violet-200" />
      </div>

      <div className="relative z-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.055] p-5 backdrop-blur-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/18 bg-cyan-300/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
            Signal runtime active
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
            The workspace now behaves like a live experience layer.
          </h2>

          <p className="mt-5 text-sm leading-7 text-cyan-50/76 md:text-base">
            This layer intentionally reduces the old CareerLab dashboard feeling.
            The child is entering a cinematic signal sequence first, then the
            existing interactive systems can continue below as a safe fallback.
          </p>

          <div className="mt-6 rounded-3xl border border-cyan-200/14 bg-black/22 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100/54">
              Live transmission
            </p>
            <p className="mt-3 font-mono text-sm leading-7 text-cyan-100/82">
              &gt; signal.lock: partial<br />
              &gt; child.role: explorer<br />
              &gt; guide.channel: opening<br />
              &gt; next.beat: choose what to restore
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {runtimeBeats.map((beat) => (
            <div
              key={beat.code}
              className="group rounded-[28px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-cyan-200/28 hover:bg-white/[0.07]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/18 bg-cyan-300/10 text-sm font-black text-cyan-100">
                  {beat.code}
                </div>

                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    {beat.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-cyan-50/70">
                    {beat.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-[28px] border border-violet-200/12 bg-violet-300/[0.07] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-100/62">
              Sprint 2.3 shift
            </p>
            <p className="mt-3 text-sm leading-7 text-cyan-50/76">
              CareerLab is now visually moving from profession simulation toward
              atmosphere-driven immersive world runtime.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}