import {
  CREATOR_OUTCOME_DEFINITIONS,
  type CreatorOutcome,
  type CreatorOutcomeLanguage,
} from "@/lib/creator/creatorOutcome";

type CreatorOutcomeStartProps = {
  language: CreatorOutcomeLanguage;
  value?: CreatorOutcome;
  onSelect: (outcome: CreatorOutcome) => void;
};

export default function CreatorOutcomeStart({
  language,
  value,
  onSelect,
}: CreatorOutcomeStartProps) {
  const headingId = "creator-outcome-start-title";

  return (
    <section
      aria-labelledby={headingId}
      className="creatorlab-uxp2a-card creatorlab-uxp2a-outcome-card"
    >
      <div className="creatorlab-uxp2a-outcome-copy">
        <p className="creatorlab-uxp2a-kicker">
          {language === "en" ? "Start with an outcome" : "Sonuçla başla"}
        </p>
        <h2 id={headingId} className="creatorlab-uxp2a-title">
          {language === "en" ? "What do you want to create?" : "Ne oluşturmak istiyorsun?"}
        </h2>
        <p className="creatorlab-uxp2a-description">
          {language === "en"
            ? "Choose the result you want Velto to help you produce. You can refine the production settings before generation."
            : "Velto'nun üretmene yardımcı olmasını istediğin sonucu seç. Üretimden önce ayarları detaylandırabilirsin."}
        </p>
      </div>

      <div className="creatorlab-uxp2a-outcome-grid">
        {CREATOR_OUTCOME_DEFINITIONS.map((definition, index) => {
          const isSelected = value === definition.value;

          return (
            <button
              key={definition.value}
              type="button"
              aria-pressed={isSelected}
              data-selected={isSelected ? "true" : "false"}
              onClick={() => onSelect(definition.value)}
              className={`creatorlab-format-choice ${isSelected ? "is-selected" : ""}`}
            >
              <span className="creatorlab-format-choice-mark" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <strong>{definition.label[language]}</strong>
                <small>{definition.description[language]}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
