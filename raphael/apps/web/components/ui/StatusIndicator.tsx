import { STATE_META, type RaphaelState } from "@/lib/raphael-state";

/** Indicateur d'état : couleur + libellé (jamais la couleur seule). */
export function StatusIndicator({ state, active }: { state: RaphaelState; active: boolean }) {
  const { label, color } = STATE_META[state];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider transition-colors ${
        active ? "border-line bg-night text-ice" : "border-transparent text-mist/60"
      }`}
      aria-current={active ? "true" : undefined}
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color, opacity: active ? 1 : 0.35, boxShadow: active ? `0 0 8px ${color}` : "none" }}
      />
      {label}
    </span>
  );
}
