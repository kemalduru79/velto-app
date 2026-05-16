import { typography } from "@/lib/design/typography";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: Props) {
  return (
    <div
      className={`flex flex-col gap-3 ${
        align === "center" ? "items-center text-center" : ""
      }`}
    >
      {eyebrow ? (
        <span className={`${typography.micro} text-white/50`}>
          {eyebrow}
        </span>
      ) : null}

      <h2 className={`${typography.sectionTitle} text-white`}>
        {title}
      </h2>

      {description ? (
        <p className="max-w-2xl text-white/60 leading-7">
          {description}
        </p>
      ) : null}
    </div>
  );
}