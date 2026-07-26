import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function CreatorLabShell({ children }: Props) {
  return (
    <div className="creatorlab-premium-surface relative min-h-screen overflow-x-hidden bg-[#faf9f6] text-[#13243e]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#fffdf9_0%,#faf9f6_38%,#f8f7f3_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white"
      />
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
