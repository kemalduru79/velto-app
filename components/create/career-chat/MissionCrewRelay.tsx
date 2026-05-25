"use client";

type MissionCrewRelayProps = {
  isTurkish: boolean;
  characterChannel: string;
  characterName: string;
  characterMessage: string;
  latestChildMessage?: string;
};

export default function MissionCrewRelay({
  isTurkish,
  characterChannel,
  characterName,
  characterMessage,
  latestChildMessage,
}: MissionCrewRelayProps) {
  return (
    <aside className="hidden min-h-0 flex-col gap-3 overflow-hidden lg:flex lg:translate-x-1 xl:translate-x-2">
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-3 shadow-[inset_0_0_34px_rgba(255,255,255,0.025)] backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-300/70">
          {characterChannel}
        </p>
        <p className="mt-2 font-semibold text-white">{characterName}</p>
        <p className="mt-2 max-h-24 overflow-hidden text-xs leading-5 text-slate-300/78">
          {characterMessage}
        </p>
      </div>

      {latestChildMessage ? (
        <div className="rounded-[1.75rem] border border-emerald-200/15 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-50 backdrop-blur-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-100/70">
            {isTurkish ? "Son sinyalin" : "Last signal"}
          </p>
          <p className="mt-2 max-h-24 overflow-hidden">{latestChildMessage}</p>
        </div>
      ) : null}

      <div className="mt-auto rounded-[1.75rem] border border-cyan-100/12 bg-cyan-950/16 p-3 text-[10px] uppercase tracking-[0.24em] text-cyan-100/56 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <span>{isTurkish ? "Röle" : "Relay"}</span>
          <span>{isTurkish ? "Temiz" : "Clear"}</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-cyan-300/30 via-cyan-100/80 to-emerald-200/60 shadow-[0_0_18px_rgba(103,232,249,0.65)] motion-safe:animate-pulse" />
        </div>
      </div>
    </aside>
  );
}
