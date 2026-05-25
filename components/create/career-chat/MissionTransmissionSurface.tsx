"use client";

type MissionCharacterView = {
  name: string;
  role: string;
  channel: string;
  openingLine: string;
};

type MissionMessageView = {
  role: "child" | "mentor" | "character";
  text: string;
  speaker?: string;
};

type MissionSkinView = {
  viewportLabel: string;
  streamPanelClass: string;
  badgeClass: string;
};

type MissionTransmissionSurfaceProps = {
  isTurkish: boolean;
  missionSkin: MissionSkinView;
  mentorName: string;
  mentorLines: string[];
  isLiveMentorStreaming: boolean;
  activeMissionCharacter: MissionCharacterView;
  latestCharacterMessage?: MissionMessageView;
  latestChildMessage?: MissionMessageView;
  conversation: MissionMessageView[];
  roleLabels: Record<MissionMessageView["role"], string>;
  childTurnCount: number;
};

export default function MissionTransmissionSurface({
  isTurkish,
  missionSkin,
  mentorName,
  mentorLines,
  isLiveMentorStreaming,
  activeMissionCharacter,
  latestCharacterMessage,
  latestChildMessage,
  conversation,
  roleLabels,
  childTurnCount,
}: MissionTransmissionSurfaceProps) {
  return (
    <div className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-[0_0_56px_rgba(14,165,233,0.18)] backdrop-blur-xl lg:p-6 ${missionSkin.streamPanelClass}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(103,232,249,0.16),transparent_28%),linear-gradient(115deg,transparent_0%,rgba(34,211,238,0.08)_46%,transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.45)]" />
      <div className="pointer-events-none absolute inset-x-8 bottom-5 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent" />
      <div className="pointer-events-none absolute right-6 top-6 h-16 w-16 rounded-full border border-cyan-100/10 bg-cyan-200/5 blur-[1px]" />
      <div className="relative z-10 mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/70">
            {missionSkin.viewportLabel}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-white">
            {isTurkish ? "Komut kanalı canlı yayında" : "Command channel is live"}
          </h3>
        </div>
        <span className="rounded-full border border-cyan-200/20 px-3 py-1 text-xs text-cyan-100">
          {isTurkish ? `Adım ${Math.min(childTurnCount + 1, 4)} / 4` : `Step ${Math.min(childTurnCount + 1, 4)} / 4`}
        </span>
      </div>

      <div className="relative z-10 mb-4 grid grid-cols-3 gap-2 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-cyan-100/62">
        <div className="rounded-full border border-cyan-100/12 bg-cyan-300/5 px-3 py-2">
          {isTurkish ? "Röle açık" : "Relay open"}
        </div>
        <div className="rounded-full border border-cyan-100/12 bg-cyan-300/5 px-3 py-2 text-center">
          {isLiveMentorStreaming ? (isTurkish ? "Akış canlı" : "Live flow") : (isTurkish ? "Sinyal temiz" : "Signal clear")}
        </div>
        <div className="rounded-full border border-cyan-100/12 bg-cyan-300/5 px-3 py-2 text-right">
          {isTurkish ? "Ekip hatta" : "Crew online"}
        </div>
      </div>

      <div className="relative z-10 space-y-3">
        <div className={`relative overflow-hidden rounded-[1.65rem] border p-5 shadow-[inset_0_0_42px_rgba(8,145,178,0.18),0_0_36px_rgba(34,211,238,0.12)] ${missionSkin.badgeClass}`}>
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent" />
          <div className="pointer-events-none absolute bottom-4 left-5 right-5 flex h-5 items-end gap-1 opacity-45">
            <span className="h-2 w-1 rounded-full bg-cyan-200/60 motion-safe:animate-pulse" />
            <span className="h-4 w-1 rounded-full bg-cyan-100/70 motion-safe:animate-pulse" />
            <span className="h-3 w-1 rounded-full bg-sky-200/55 motion-safe:animate-pulse" />
            <span className="h-5 w-1 rounded-full bg-cyan-200/75 motion-safe:animate-pulse" />
            <span className="h-2 w-1 rounded-full bg-emerald-200/55 motion-safe:animate-pulse" />
            <span className="h-4 w-1 rounded-full bg-cyan-100/65 motion-safe:animate-pulse" />
            <span className="h-3 w-1 rounded-full bg-sky-200/55 motion-safe:animate-pulse" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100/80">
              {mentorName}
            </p>
            {isLiveMentorStreaming ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" />
                {isTurkish ? "Canlı aktarım" : "Live stream"}
              </span>
            ) : null}
          </div>
          {mentorLines.length > 0 ? (
            <div className="relative z-10 mt-4 space-y-3 text-base leading-7 text-slate-50 lg:text-lg lg:leading-8">
              {mentorLines.map((line: string, index: number) => (
                <p key={`${line}-${index}`}>
                  {line}
                  {isLiveMentorStreaming && index === mentorLines.length - 1 ? (
                    <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-pulse rounded-sm bg-cyan-200/80" />
                  ) : null}
                </p>
              ))}
            </div>
          ) : (
            <p className="relative z-10 mt-4 text-base leading-7 text-slate-50 lg:text-lg lg:leading-8">
              {isTurkish
                ? "Sana cevabı vermeyeceğim. Cevabı bulabilecek bir komutana dönüşmene yardım edeceğim."
                : "I will not give you the answer. I will help you become the kind of commander who can find it."}
            </p>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-cyan-100/12 bg-cyan-950/20 p-4 shadow-[inset_0_0_28px_rgba(34,211,238,0.08)]">
          <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-1 opacity-60">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
            <span className="h-px w-10 bg-gradient-to-r from-emerald-200/60 to-transparent" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            {activeMissionCharacter.channel}
          </p>
          <p className="mt-1 font-semibold text-white">
            {activeMissionCharacter.name} · {activeMissionCharacter.role}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {latestCharacterMessage?.text ?? activeMissionCharacter.openingLine}
          </p>
        </div>

        {latestChildMessage ? (
          <div className="ml-auto max-w-[88%] rounded-2xl border border-emerald-200/22 bg-emerald-300/12 p-4 text-sm leading-6 text-emerald-50 shadow-[0_0_28px_rgba(110,231,183,0.10)]">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-100/70">
              {isTurkish ? "Senin sinyalin" : "Your signal"}
            </p>
            <p className="mt-2">{latestChildMessage.text}</p>
          </div>
        ) : null}

        {conversation.length > 3 ? (
          <details className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-slate-300">
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">
              {isTurkish ? "Eski kayıtları göster" : "Show earlier logs"}
            </summary>
            <div className="mt-3 space-y-3">
              {conversation.slice(0, -3).map((message: MissionMessageView, index: number) => (
                <div key={`${message.role}-${index}`} className="rounded-xl bg-slate-950/50 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{roleLabels[message.role]}</p>
                  <p className="mt-1 leading-6">{message.text}</p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
