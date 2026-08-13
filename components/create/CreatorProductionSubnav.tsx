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
      className="creatorlab-uxp2a-production-nav"
      aria-label={language === "en" ? "Production sections" : "Üretim bölümleri"}
    >
      {items.map((item) => {
        const active = value === item.value;

        return (
          <button
            key={item.value}
            type="button"
            aria-current={active ? "step" : undefined}
            data-active={active ? "true" : "false"}
            data-production-substep-selected={active ? "true" : "false"}
            onClick={() => onChange(item.value)}
            className="creatorlab-uxp2a-production-nav-item"
          >
            <span className="creatorlab-uxp2a-production-step" aria-hidden="true">
              {item.number}
            </span>
            <span className="min-w-0">
              <strong className="creatorlab-uxp2a-production-label">{item.label}</strong>
              <span className="creatorlab-uxp2a-production-description">
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
