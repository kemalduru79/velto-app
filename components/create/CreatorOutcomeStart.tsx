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
      className="rounded-[28px] border border-orange-200/40 bg-white/72 p-5 shadow-[0_18px_50px_rgba(148,83,32,0.08)] sm:p-6"
    >
      <div className="mb-4 max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700">
          {language === "en" ? "Start with an outcome" : "Sonuçla başla"}
        </p>
        <h2 id={headingId} className="mt-1 text-xl font-semibold text-slate-950 sm:text-2xl">
          {language === "en" ? "What do you want to create?" : "Ne oluşturmak istiyorsun?"}
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {language === "en"
            ? "Choose a starting point. You can adjust every production setting below."
            : "Bir başlangıç noktası seç. Aşağıdaki tüm üretim ayarlarını değiştirebilirsin."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CREATOR_OUTCOME_DEFINITIONS.map((definition, index) => {
          const isSelected = value === definition.value;

          return (
            <button
              key={definition.value}
              type="button"
              aria-pressed={isSelected}
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
