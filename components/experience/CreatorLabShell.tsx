import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function CreatorLabShell({ children }: Props) {
  return (
    <div className="creatorlab-premium-surface relative min-h-screen overflow-hidden bg-[#070711] text-[#fff7ed]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(244,63,94,0.18),transparent_31%),radial-gradient(circle_at_88%_14%,rgba(251,146,60,0.16),transparent_32%),radial-gradient(circle_at_58%_92%,rgba(124,58,237,0.16),transparent_40%),linear-gradient(180deg,#070711_0%,#120914_48%,#070a15_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b from-white/[0.065] to-transparent" />
      <div className="pointer-events-none absolute -left-36 top-24 h-[32rem] w-[32rem] rounded-full bg-rose-500/[0.12] blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-40 h-[34rem] w-[34rem] rounded-full bg-orange-400/[0.12] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-80 w-[52rem] -translate-x-1/2 rounded-full bg-violet-500/[0.08] blur-3xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
