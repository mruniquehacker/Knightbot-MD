/** États observables de Raphaël. Ils pilotent le noyau et les indicateurs. */
export type RaphaelState = "idle" | "listening" | "thinking" | "speaking" | "offline";

export const STATE_META: Record<RaphaelState, { label: string; color: string; hint: string }> = {
  idle: { label: "En veille", color: "#22d3ee", hint: "Prêt." },
  listening: { label: "Écoute", color: "#67e8f9", hint: "Je vous écoute." },
  thinking: { label: "Réflexion", color: "#3b82f6", hint: "Analyse en cours…" },
  speaking: { label: "Réponse", color: "#e6f6ff", hint: "Je réponds." },
  offline: { label: "Hors ligne", color: "#4b5a78", hint: "Connexion au serveur indisponible." },
};

export const RAPHAEL_STATES = Object.keys(STATE_META) as RaphaelState[];
