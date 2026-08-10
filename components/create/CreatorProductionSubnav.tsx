export type CreatorProductionSubstep = "setup" | "create_review";

export default function CreatorProductionSubnav({
  value,
  onChange,
  language,
}: {
  value: CreatorProductionSubstep;
  onChange: (value: CreatorProductionSubstep) => void;
  language: "tr" | "en";
}) {
  const items: Array<{
    value: CreatorProductionSubstep;
    number: number;
    label: string;
    description: string;
  }> = [
    {
      value: "setup",
      number: 1,
      label: language === "en" ? "Setup" : "Kurulum",
      description:
        language === "en"
          ? "Decide how your video should look and sound."
          : "Videonun nasıl görüneceğine ve duyulacağına karar ver.",
    },
    {
      value: "create_review",
      number: 2,
      label: language === "en" ? "Create & Review" : "Üret ve İncele",
      description:
        language === "en"
          ? "Generate, review and refine your scenes."
          : "Sahnelerini üret, incele ve geliştir.",
    },
  ];

  return (
    <nav
      className="grid gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:grid-cols-2"
      aria-label={language === "en" ? "Production sections" : "Üretim bölümleri"}
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            aria-current={active ? "step" : undefined}
            data-production-substep-selected={active ? "true" : "false"}
            onClick={() => onChange(item.value)}
            className={`flex min-h-12 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
              active
                ? "border-blue-600 bg-white text-slate-950 shadow-sm ring-2 ring-blue-100"
                : "border-transparent text-slate-400 hover:bg-white/60 hover:text-slate-600"
            }`}
          >
            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${active ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-400"}`}>
              {item.number}
            </span>
            <span className="min-w-0">
              <strong className="block text-sm">{item.label}</strong>
              <span className={`mt-0.5 hidden text-[11px] leading-4 sm:block ${active ? "text-slate-600" : "text-slate-400"}`}>
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
