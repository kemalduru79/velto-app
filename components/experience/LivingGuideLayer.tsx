"use client";

import { useEffect, useMemo, useState } from "react";

const transmissionMoments = [
  {
    id: "arrival",
    label: "Incoming transmission",
    speaker: "Guide",
    text:
      "Explorer… if you can hear this, stay calm. The station is responding to your signal.",
  },
  {
    id: "observation",
    label: "Environment update",
    speaker: "System",
    text:
      "Low-energy movement detected near the observation deck. No danger signatures found.",
  },
  {
    id: "decision",
    label: "Guide recommendation",
    speaker: "Guide",
    text:
      "We should restore one system first. Choose carefully — the next signal fragment depends on it.",
  },
];

export default function LivingGuideLayer() {
  const [activeIndex, setActiveIndex] = useState(0);

  const activeMoment = useMemo(
    () => transmissionMoments[activeIndex],
    [activeIndex]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) =>
        prev === transmissionMoments.length - 1 ? 0 : prev + 1
      );
    }, 4200);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[40px] border border-cyan-300/14 bg-[#020817] p-5 text-white shadow-[0_30px_120px_rgba(8,47,73,0.26)] md:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(99,102,241,0.16),transparent_34%)]" />

      <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
        <div className="absolute left-0 top-[26%] h-px w-full bg-cyan-200" />
        <div className="absolute left-0 top-[72%] h-px w-full bg-indigo-200" />
        <div className="absolute left-[18%] top-0 h-full w-px bg-cyan-200/80" />
      </div>

      <div className="relative z-10 grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/16 bg-cyan-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
            Living guide runtime
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
            The guide now behaves like a presence inside the world.
          </h2>

          <p className="mt-5 text-sm leading-7 text-cyan-50/74 md:text-base">
            The experience is no longer built around static role cards or isolated
            UI panels. The AI guide speaks through the atmosphere, the signal,
            and the child’s decisions.
          </p>

          <div className="mt-6 rounded-[28px] border border-cyan-200/12 bg-black/24 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/56">
              Runtime direction
            </p>

            <p className="mt-3 text-sm leading-6 text-cyan-50/74">
              Future worlds should reuse this structure:
              guide presence → focused choice → emotional response → memory artifact.
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[32px] border border-cyan-200/12 bg-black/26 p-5 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_42%)]" />

          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/56">
                  Live signal channel
                </p>

                <h3 className="mt-2 text-2xl font-black tracking-tight text-white">
                  {activeMoment.label}
                </h3>
              </div>

              <div className="rounded-full border border-cyan-200/14 bg-cyan-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                {activeMoment.speaker}
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.045] p-5">
              <p className="font-mono text-sm leading-8 text-cyan-50/82">
                {activeMoment.text}
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              {transmissionMoments.map((moment, index) => (
                <button
                  key={moment.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-2 flex-1 rounded-full transition ${
                    index === activeIndex
                      ? "bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]"
                      : "bg-white/12 hover:bg-cyan-200/40"
                  }`}
                />
              ))}
            </div>

            <div className="mt-6 rounded-[26px] border border-indigo-200/12 bg-indigo-300/[0.06] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-100/58">
                Emotional pacing
              </p>

              <p className="mt-3 text-sm leading-6 text-cyan-50/72">
                The system intentionally alternates between calm discovery and
                safe tension instead of overwhelming the child with constant alerts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}