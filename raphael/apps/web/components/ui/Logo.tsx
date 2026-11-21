export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="select-none">
      <div className="font-display text-xl font-semibold tracking-[0.35em] text-ice sm:text-2xl">RAPHAËL</div>
      {!compact && (
        <div className="mt-1 font-mono text-[10px] tracking-[0.3em] text-mist">PERSONAL INTELLIGENCE SYSTEM</div>
      )}
    </div>
  );
}
