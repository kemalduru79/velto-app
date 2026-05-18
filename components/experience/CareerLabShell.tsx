import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function CareerLabShell({ children }: Props) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-cyan-50 to-lime-50 text-slate-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/80 to-transparent" />
      <div className="pointer-events-none absolute -left-24 top-24 h-80 w-80 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-36 h-96 w-96 rounded-full bg-cyan-300/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-lime-200/30 blur-3xl" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
