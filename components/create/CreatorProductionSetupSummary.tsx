export default function CreatorProductionSetupSummary({
  title,
  premise,
  format,
  runtime,
  quality,
  approach,
  castSummary,
  music,
  continuity,
  onEdit,
  language,
}: {
  title: string;
  premise?: string;
  format: string;
  runtime: string;
  quality: string;
  approach: string;
  castSummary: string;
  music: string;
  continuity: string;
  onEdit: () => void;
  language: "tr" | "en";
}) {
  return (
    <section data-production-compact-header="true" className="creatorlab-p2c-production-plan">
      <div className="creatorlab-p2c-production-plan-layout">
        <div className="creatorlab-p2c-production-plan-copy">
          <span className="creatorlab-p2c-production-plan-kicker">
            {language === "en" ? "Production Plan" : "Üretim Planı"}
          </span>
          <h2>{title}</h2>
          {premise && <p className="creatorlab-p2c-production-plan-premise">{premise}</p>}
          <p className="creatorlab-p2c-production-plan-primary-meta">
            {format} · {runtime} · {quality}
          </p>
          <p className="creatorlab-p2c-production-plan-secondary-meta">
            {approach} · {castSummary} · {language === "en" ? "Music" : "Müzik"} {music} · {continuity}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="creatorlab-p2c-production-plan-edit"
        >
          {language === "en" ? "Edit Setup" : "Kurulumu Düzenle"}
        </button>
      </div>
    </section>
  );
}
