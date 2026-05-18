import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function StoryverseShell({ children }: Props) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-sky-50 via-indigo-50 to-orange-50 text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-white/80 to-transparent" />
      <div className="pointer-events-none absolute -left-24 top-28 h-80 w-80 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-36 h-96 w-96 rounded-full bg-violet-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-200/30 blur-3xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
