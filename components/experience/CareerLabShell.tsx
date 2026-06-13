
"use client";

import { useMemo, useState } from "react";
import ExperienceWorldSwitcher from "./ExperienceWorldSwitcher";

type WorldKey = "space" | "ocean";

const WORLDS = {
  space: {
    title: "Lunar Station Rescue",
    subtitle: "Orbital emergency response runtime",
    guide: "Commander Orion",
    prompt: "Transmit your stabilization command...",
    alerts: ["Oxygen Alert", "Orbital Relay", "Crew Channel Live"],
    telemetry: ["O₂", "Crew", "Relay", "Signal"],
    cinematic: [
      "Emergency lights fade while the orbital ring stabilizes.",
      "The crew regains calm after your live relay command.",
    ],
    bg: "bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.20),transparent_32%),linear-gradient(180deg,#020817_0%,#04111f_45%,#061b2d_100%)]",
    accent: "cyan",
  },
  ocean: {
    title: "Deep Ocean Discovery",
    subtitle: "Deep sonar mystery runtime",
    guide: "Navigator Kaia",
    prompt: "Transmit your sonar relay command...",
    alerts: ["Pressure Warning", "Sonar Online", "Deep Channel Active"],
    telemetry: ["Depth", "Crew", "Sonar", "Pressure"],
    cinematic: [
      "Blue sonar waves illuminate the trench corridor.",
      "The submarine follows the safer route you established.",
    ],
    bg: "bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_32%),linear-gradient(180deg,#03121c_0%,#072032_45%,#0a2f47_100%)]",
    accent: "blue",
  },
};

export default function CareerLabShell() {
  const [activeWorld, setActiveWorld] = useState<WorldKey>("space");
  const [command, setCommand] = useState("");
  const [sentCount, setSentCount] = useState(0);

  const world = WORLDS[activeWorld];

  const telemetryValues = useMemo(() => {
    if (activeWorld === "space") {
      return ["97%", "Recovering", "Stable", "Clear"];
    }

    return ["2980m", "Focused", "Scanning", "Balanced"];
  }, [activeWorld]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020817] text-white">
      <div className={`absolute inset-0 ${world.bg}`} />

      <div className="absolute inset-0 opacity-[0.08]">
        <div className="absolute left-0 top-[12%] h-px w-full bg-cyan-200/30" />
        <div className="absolute left-0 top-[48%] h-px w-full bg-cyan-200/20" />
        <div className="absolute left-[12%] top-0 h-full w-px bg-cyan-200/10" />
      </div>

      <div className="relative z-20 mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 md:px-6">
        <ExperienceWorldSwitcher
          activeWorld={activeWorld}
          onSwitch={(worldId) => {
            setActiveWorld(worldId);
            setCommand("");
            setSentCount(0);
          }}
        />

        <section className="relative overflow-hidden rounded-[36px] border border-white/8 bg-black/20 backdrop-blur-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_35%)]" />

          <div className="flex flex-wrap items-center gap-2 border-b border-white/6 px-5 py-4">
            {world.alerts.map((alert) => (
              <div
                key={alert}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/84"
              >
                {alert}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[0.64fr_0.36fr]">
            <div className="relative border-r border-white/6 px-6 py-6">
              <div className="absolute right-[-120px] top-[15%] h-[320px] w-[320px] rounded-full bg-cyan-300/10 blur-3xl" />

              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/42">
                Cinematic Interaction Surface
              </p>

              <h1 className="mt-3 max-w-4xl text-7xl font-black tracking-[-0.08em] leading-[0.92]">
                {world.title}
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/68">
                {world.subtitle}
              </p>

              <div className="mt-8 flex items-center gap-4">
                <div className="h-3 w-3 animate-pulse rounded-full bg-white" />

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                    {world.guide}
                  </p>

                  <p className="mt-1 text-sm text-white/78">
                    {sentCount > 0
                      ? "Runtime continuity active. The world is reacting to your previous signal."
                      : "The command channel is waiting for your first calm transmission."}
                  </p>
                </div>
              </div>

              <div className="mt-10">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/50">
                    Orbital Transmission Console
                  </p>

                  <div className="rounded-full border border-cyan-300/16 bg-cyan-300/[0.08] px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-cyan-100/70">
                    Live Relay
                  </div>
                </div>

                <div className="relative mt-4 overflow-hidden rounded-[30px] border border-cyan-300/14 bg-black/30">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_55%)]" />

                  <div className="absolute left-0 top-0 h-px w-full bg-cyan-200/20" />

                  <textarea
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder={world.prompt}
                    className="relative z-10 min-h-[240px] w-full resize-none bg-transparent px-6 py-6 text-base leading-8 text-white outline-none placeholder:text-white/26"
                  />

                  <div className="relative z-10 flex items-center justify-between border-t border-white/6 px-5 py-4">
                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-white/36">
                      <span>Transmission uplink ready</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!command.trim()) return;
                        setSentCount((prev) => prev + 1);
                        setCommand("");
                      }}
                      className={`rounded-full px-6 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.03] ${
                        activeWorld === "space"
                          ? "bg-cyan-300"
                          : "bg-blue-300"
                      }`}
                    >
                      Transmit Signal
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-white/55">
                  Runtime Active
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-white/55">
                  Memory Layer Online
                </div>

                <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-white/55">
                  Storyverse Bridge Ready
                </div>
              </div>
            </div>

            <div className="relative bg-black/18 px-5 py-6">
              <div className="absolute left-[-80px] top-[18%] h-[260px] w-[260px] rounded-full bg-amber-300/10 blur-3xl" />

              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
                Runtime HUD
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {world.telemetry.map((label, index) => (
                  <div
                    key={label}
                    className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                      {label}
                    </p>

                    <p className="mt-3 text-3xl font-black tracking-tight">
                      {telemetryValues[index]}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/55">
                    Cinematic Memory Layer
                  </p>

                  <div className="rounded-full border border-white/10 bg-black/18 px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-white/55">
                    Secondary Overlay
                  </div>
                </div>

                <div className="relative mt-4 overflow-hidden rounded-[30px] border border-amber-300/14 bg-amber-300/[0.06] p-5">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_55%)]" />

                  <div className="relative z-10">
                    <h2 className="text-4xl font-black tracking-[-0.05em] leading-tight">
                      Memory Continuity
                    </h2>

                    <div className="mt-6 flex flex-col gap-3">
                      {world.cinematic.map((scene, index) => (
                        <div
                          key={scene}
                          className="rounded-2xl border border-white/10 bg-black/18 p-4"
                        >
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                            Cinematic Beat 0{index + 1}
                          </p>

                          <p className="mt-2 text-sm leading-7 text-white/78">
                            {scene}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 rounded-2xl border border-cyan-300/16 bg-cyan-300/[0.08] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/55">
                        Runtime → Storyverse Continuity
                      </p>

                      <p className="mt-2 text-sm leading-7 text-white/76">
                        Your live mission transmission is now shaping a cinematic AI memory sequence.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
