"use client";

import { useState } from "react";

type CareerMissionChatRecoveryProps = {
  language: string;
  professionKey: string;
  professionTitle: string;
  missionTitle: string;
  missionBriefing: string;
  missionObjective: string;
  mentorName: string;
};

export default function CareerMissionChatRecovery({
  professionTitle,
  missionTitle,
  mentorName,
}: CareerMissionChatRecoveryProps) {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  function handleSend() {
    if (!input.trim()) return;

    setMessages((current) => [
      ...current,
      `👦 ${input}`,
      `🤖 ${mentorName}: Good thinking. The mission is reacting to your decision.`,
    ]);

    setInput("");
  }

  return (
    <div className="rounded-[32px] border border-cyan-300/20 bg-slate-950 p-6 text-white">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
          {professionTitle}
        </p>

        <h3 className="mt-2 text-2xl font-semibold">
          {missionTitle}
        </h3>
      </div>

      <div className="space-y-3">
        {messages.map((message, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm"
          >
            {message}
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Tell the mentor what you would do..."
          className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
        />

        <button
          onClick={handleSend}
          className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
        >
          Send
        </button>
      </div>
    </div>
  );
}