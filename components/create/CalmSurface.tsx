"use client";

import { ReactNode } from "react";

type CalmSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export default function CalmSurface({
  children,
  className = "",
}: CalmSurfaceProps) {
  return (
    <div
      className={`rounded-[28px] border border-white/10 bg-white/[0.025] p-5 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04] ${className}`}
    >
      {children}
    </div>
  );
}
