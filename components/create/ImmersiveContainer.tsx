import { ReactNode } from "react";
import { radius } from "@/lib/design/radius";
import { surfaces } from "@/lib/design/surfaces";
import { glow } from "@/lib/design/glow";

type Props = {
  children: ReactNode;
  className?: string;
};

export default function ImmersiveContainer({
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`
        ${surfaces.immersive}
        ${glow.subtle}
        p-6 md:p-8
        ${className}
      `}
      style={{
        borderRadius: radius.immersive,
      }}
    >
      {children}
    </div>
  );
}