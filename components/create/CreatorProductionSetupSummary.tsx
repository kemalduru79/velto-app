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
    <section data-production-compact-header="true" className="border-b border-slate-200 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
          {premise && <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-5 text-slate-500">{premise}</p>}
          <p className="mt-3 text-xs font-semibold text-slate-700">
            {format} · {runtime} · {quality}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {approach} · {castSummary} · {language === "en" ? "Music" : "Müzik"} {music} · {continuity}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-10 shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
        >
          {language === "en" ? "Edit Setup" : "Kurulumu Düzenle"}
        </button>
      </div>
    </section>
  );
}
