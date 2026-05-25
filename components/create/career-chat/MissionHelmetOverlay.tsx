"use client";

type MissionHelmetOverlayProps = {
  viewportShape?: string;
};

export default function MissionHelmetOverlay({
  viewportShape = "helmet-oval",
}: MissionHelmetOverlayProps) {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-5 z-10 rounded-[2.5rem] border border-cyan-100/10 opacity-80"
        data-velto-layer="helmet-corner-scanner"
        data-velto-profession-surface={viewportShape}
      >
        <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-[2rem] border-l border-t border-cyan-200/50 shadow-[0_0_18px_rgba(103,232,249,0.32)]" />
        <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-[2rem] border-r border-t border-cyan-200/50 shadow-[0_0_18px_rgba(103,232,249,0.32)]" />
        <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[2rem] border-b border-l border-cyan-200/35 shadow-[0_0_18px_rgba(103,232,249,0.24)]" />
        <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[2rem] border-b border-r border-cyan-200/35 shadow-[0_0_18px_rgba(103,232,249,0.24)]" />
        <span className="absolute left-10 right-10 top-16 h-px animate-pulse bg-gradient-to-r from-transparent via-cyan-100/22 to-transparent" />
      </div>

      <div
        className="pointer-events-none absolute inset-x-8 top-3 z-10 flex items-center gap-2 opacity-90"
        data-velto-layer="helmet-runtime-energy-rail"
        data-velto-profession-surface={viewportShape}
      >
        <span className="h-px flex-1 animate-pulse bg-gradient-to-r from-transparent via-cyan-200/70 to-cyan-100/25" />
        <span className="h-2 w-2 animate-ping rounded-full bg-cyan-200 shadow-[0_0_26px_rgba(103,232,249,0.95)]" />
        <span className="h-px flex-1 animate-pulse bg-gradient-to-l from-transparent via-cyan-200/70 to-cyan-100/25" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(34,211,238,0.28),transparent_26%),radial-gradient(circle_at_58%_40%,rgba(37,99,235,0.18),transparent_33%),radial-gradient(ellipse_at_50%_24%,rgba(14,165,233,0.18),transparent_50%),linear-gradient(90deg,rgba(34,211,238,0.06),transparent_17%,transparent_83%,rgba(34,211,238,0.06))]" />

      <div className="pointer-events-none absolute inset-x-7 top-20 h-56 overflow-hidden rounded-[2rem] border border-cyan-100/12 bg-[radial-gradient(circle_at_68%_28%,rgba(125,211,252,0.28),transparent_18%),radial-gradient(circle_at_78%_28%,rgba(59,130,246,0.22),transparent_22%),linear-gradient(180deg,rgba(8,47,73,0.32),rgba(2,6,23,0.08))] opacity-80 shadow-[inset_0_0_70px_rgba(34,211,238,0.12)]">
        <div className="absolute bottom-8 left-1/2 h-px w-[84%] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-100/36 to-transparent" />
        <div className="absolute bottom-11 left-[18%] h-10 w-20 rounded-t-full border-t border-cyan-100/12 bg-cyan-200/5" />
        <div className="absolute bottom-11 left-[34%] h-16 w-28 rounded-t-full border-t border-cyan-100/14 bg-cyan-200/6" />
        <div className="absolute bottom-11 right-[22%] h-12 w-24 rounded-t-full border-t border-cyan-100/12 bg-cyan-200/5" />
      </div>

      <div className="pointer-events-none absolute left-6 top-6 h-10 w-10 border-l border-t border-cyan-100/46" />
      <div className="pointer-events-none absolute right-6 top-6 h-10 w-10 border-r border-t border-cyan-100/46" />
      <div className="pointer-events-none absolute bottom-6 left-6 h-10 w-10 border-b border-l border-cyan-100/34" />
      <div className="pointer-events-none absolute bottom-6 right-6 h-10 w-10 border-b border-r border-cyan-100/34" />
      <div className="pointer-events-none absolute inset-x-8 top-16 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent shadow-[0_0_18px_rgba(103,232,249,0.45)]" />
    </>
  );
}
