import { ReactNode } from "react";
import { radius } from "@/lib/design/radius";

type Props = {
  title: string;
  description: string;
  icon?: ReactNode;
  active?: boolean;
};

export default function ExperienceCard({
  title,
  description,
  icon,
  active,
}: Props) {
  return (
    <div
      className={`
        relative overflow-hidden border border-white/10
        bg-white/[0.04] backdrop-blur-xl
        transition-all duration-300
        hover:scale-[1.01]
        hover:border-white/20
        ${active ? "ring-1 ring-indigo-400/50" : ""}
      `}
      style={{
        borderRadius: radius.card,
      }}
    >
      <div className="flex flex-col gap-4 p-6">
        {icon ? (
          <div className="text-white/80">
            {icon}
          </div>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-white">
            {title}
          </h3>

          <p className="text-sm leading-6 text-white/60">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}