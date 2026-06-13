"use client";

import { useMemo, useState } from "react";

type SignalChoice = {
  key: string;
  label: string;
  title: string;
  description: string;
  resultTitle: string;
  result: string;
};

const signalChoices: SignalChoice[] = [
  {
    key: "restore_audio",
    label: "Choice A",
    title: "Restore the audio channel",
    description:
      "Listen for the human part of the broken signal and help the guide understand who sent it.",
    resultTitle: "Audio fragment restored",
    result:
      "A calm voice appears beneath the static: 'If anyone hears this, follow the blue light.' The guide lowers the alarm level and opens the next clue.",
  },
  {
    key: "scan_station",
    label: "Choice B",
    title: "Scan the silent station",
    description:
      "Look for movement, power signatures, and safe entry routes before responding to the signal.",
    resultTitle: "Station scan completed",
    result:
      "The scan reveals one warm room inside the station. Something is still active, but it is not dangerous. The guide marks a safe path.",
  },
  {
    key: "stabilize_signal",
    label: "Choice C",
    title: "Stabilize the signal beam",
    description:
      "Focus the transmission first so the world can reveal the message without losing the connection.",
    resultTitle: "Signal stabilized",
    result:
      "The flicker slows down. A hidden image appears in the transmission: a child-sized explorer badge floating near the observation deck.",
  },
];

export default function FocusedChoicePanel() {
  const [selectedChoiceKey, setSelectedChoiceKey] = useState(signalChoices[0].key);

  const selectedChoice = useMemo(
    () =>
      signalChoices.find((choice) => choice.key === selectedChoiceKey) ||
      signalChoices[0],
    [selectedChoiceKey]
  );

  return (
    <section className="relative overflow-hidden rounded-[38px] border border-cyan-300/15 bg-[#020617] p-5 text-white shadow-[0_30px_110px_rgba(8,47,73,0.22)] md:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_12%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_82%_20%,rgba(129,140,248,0.14),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.09]">
        <div className="absolute left-0 top-[30%] h-px w-full bg-cyan-200" />
        <div className="absolute left-0 top-[68%] h-px w-full bg-indigo-200" />
      </div>

      <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_0.92fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100/62">
            Focused choice layer
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">
            One meaningful decision changes the next beat.
          </h2>

          <p className="mt-4 text-sm leading-7 text-cyan-50/74">
            This is the first visible step from a static CareerLab experience toward
            an immersive AI world. The interaction stays simple, cinematic, and
            consequence-based instead of becoming a quiz or dashboard task list.
          </p>

          <div className="mt-6 grid gap-3">
            {signalChoices.map((choice) => {
              const active = choice.key === selectedChoiceKey;

              return (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => setSelectedChoiceKey(choice.key)}
                  className={`rounded-[28px] border p-4 text-left transition duration-300 ${
                    active
                      ? "border-cyan-200/42 bg-cyan-300/12 shadow-[0_0_28px_rgba(34,211,238,0.14)]"
                      : "border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-cyan-200/26 hover:bg-white/[0.06]"
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/54">
                    {choice.label}
                  </p>
                  <h3 className="mt-2 text-base font-black text-white">
                    {choice.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-cyan-50/68">
                    {choice.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[30px] border border-cyan-200/12 bg-black/24 p-5 backdrop-blur-md">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100/62">
              Runtime response
            </p>

            <h3 className="mt-4 text-2xl font-black tracking-tight text-white">
              {selectedChoice.resultTitle}
            </h3>

            <p className="mt-4 text-sm leading-7 text-cyan-50/76">
              {selectedChoice.result}
            </p>
          </div>

          <div className="mt-7 rounded-[26px] border border-white/10 bg-white/[0.045] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/54">
              Next design principle
            </p>
            <p className="mt-3 text-sm leading-6 text-cyan-50/72">
              Every world should use focused choices as cinematic pivots:
              listen, scan, restore, protect, create, reveal.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}