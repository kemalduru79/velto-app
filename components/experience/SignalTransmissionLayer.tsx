export default function SignalTransmissionLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
      <div className="absolute left-0 top-1/4 h-px w-full bg-cyan-200 animate-pulse" />
      <div className="absolute left-0 top-2/4 h-px w-full bg-cyan-200/60" />
      <div className="absolute left-0 top-3/4 h-px w-full bg-cyan-200/40 animate-pulse" />
    </div>
  );
}