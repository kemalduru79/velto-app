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
  sceneCount,
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
  sceneCount: number;
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
          <p className="creatorlab-p2c-production-plan-primary-meta">
            {format} · {runtime} · {quality} · {sceneCount} {language === "en" ? "scenes" : "sahne"}
          </p>
          <p className="creatorlab-p2c-production-plan-secondary-meta">
            {approach} · {language === "en" ? "Music" : "Müzik"} {music} · {continuity}
          </p>
          <details className="creatorlab-p2c-production-plan-details">
            <summary>{language === "en" ? "View plan" : "Planı görüntüle"}</summary>
            <div>
              <strong>{title}</strong>
              {premise && <p className="creatorlab-p2c-production-plan-premise">{premise}</p>}
              <small>{castSummary}</small>
            </div>
          </details>
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
