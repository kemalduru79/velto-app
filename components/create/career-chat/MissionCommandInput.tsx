"use client";

type MissionCommandInputProps = {
  isTurkish: boolean;
  input: string;
  isSending: boolean;
  commandPanelClass: string;
  inputFocusClass: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
};

export default function MissionCommandInput({
  isTurkish,
  input,
  isSending,
  commandPanelClass,
  inputFocusClass,
  onInputChange,
  onSubmit,
}: MissionCommandInputProps) {
  return (
    <div className={`relative z-40 rounded-[1.75rem] border p-4 shadow-lg lg:p-5 ${commandPanelClass}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/70">
            {isTurkish ? "Komut Kanalı" : "Command Channel"}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {isTurkish
              ? "Bu bir form değil. Canlı göreve doğrudan komut gönderiyorsun."
              : "This is not a form. You are sending a direct command into the live mission."}
          </p>
        </div>
        {isSending ? (
          <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
            {isTurkish ? "Yeni aktarım geliyor..." : "Incoming transmission..."}
          </span>
        ) : null}
      </div>

      <textarea
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            onSubmit();
          }
        }}
        rows={3}
        placeholder={
          isTurkish ? "Komut Merkezi'ne sinyalini gönder..." : "Send your command to Mission Control..."
        }
        className={`relative z-40 min-h-[96px] w-full resize-none rounded-2xl border border-white/20 bg-slate-950/90 px-4 py-3 text-sm leading-6 text-white shadow-[inset_0_0_24px_rgba(15,23,42,0.75)] outline-none transition placeholder:text-slate-400 focus:ring-4 ${inputFocusClass}`}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {isTurkish
            ? "Cevap yazmıyorsun; canlı göreve yön veriyorsun."
            : "You are not writing an answer; you are steering a live mission."}
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!input.trim() || isSending}
          className={`relative z-40 rounded-full border px-4 py-2 text-xs font-semibold shadow-[0_0_24px_rgba(255,255,255,0.14)] transition ${
            !input.trim() || isSending
              ? "border-white/25 bg-white/20 text-white/75"
              : "border-white/70 bg-white text-slate-950 hover:bg-cyan-50"
          } disabled:cursor-not-allowed`}
        >
          {isSending
            ? isTurkish
              ? "Aktarım geliyor..."
              : "Transmission incoming..."
            : isTurkish
              ? "Sinyali gönder"
              : "Send signal"}
        </button>
      </div>
    </div>
  );
}
