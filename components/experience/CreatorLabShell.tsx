import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function CreatorLabShell({ children }: Props) {
  return (
    <div className="creatorlab-premium-surface creatorlab-uxp2a-shell relative min-h-screen overflow-x-hidden">
      <div aria-hidden="true" className="creatorlab-uxp2a-ambient" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/90"
      />
      <div className="creatorlab-uxp2a-content">{children}</div>
    </div>
  );
}
