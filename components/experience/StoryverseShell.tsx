import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function StoryverseShell({ children }: Props) {
  return (
    <div className="storyverse-premium-surface relative min-h-screen overflow-hidden bg-[#050816] text-[#eef7ff]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(45,212,191,0.18),transparent_32%),radial-gradient(circle_at_86%_12%,rgba(79,70,229,0.18),transparent_34%),radial-gradient(circle_at_48%_96%,rgba(245,158,11,0.10),transparent_42%),linear-gradient(180deg,#050816_0%,#071526_46%,#050817_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b from-white/[0.07] to-transparent" />
      <div className="pointer-events-none absolute -left-36 top-24 h-[32rem] w-[32rem] rounded-full bg-teal-300/[0.10] blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-48 h-[34rem] w-[34rem] rounded-full bg-indigo-500/[0.13] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-80 w-[52rem] -translate-x-1/2 rounded-full bg-amber-300/[0.06] blur-3xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
