"use client";

import { ReactNode } from "react";

type StoryverseShellProps = {
  children: ReactNode;
};

export default function StoryverseShell({ children }: StoryverseShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#040510] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.16),transparent_30%),linear-gradient(180deg,#040510_0%,#020617_50%,#000000_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-white/[0.055] to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-12 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {children}
      </div>
    </div>
  );
}
