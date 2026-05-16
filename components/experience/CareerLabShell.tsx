import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function CareerLabShell({ children }: Props) {
  return (
    <div
      className="
        relative overflow-hidden
        bg-gradient-to-b
        from-[#060b12]
        via-[#0d1726]
        to-[#060b12]
      "
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.14),transparent_40%)]" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}