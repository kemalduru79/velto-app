"use client";

import { ReactNode } from "react";

type CreatorLabShellProps = {
  children: ReactNode;
};

export default function CreatorLabShell({ children }: CreatorLabShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08050a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.20),transparent_34%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_30%),linear-gradient(180deg,#08050a_0%,#130914_48%,#000000_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.055] to-transparent" />
      <div className="pointer-events-none absolute right-10 top-20 h-80 w-80 rounded-full bg-pink-500/10 blur-3xl" />
      <div className="pointer-events-none absolute left-10 top-44 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />

      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
