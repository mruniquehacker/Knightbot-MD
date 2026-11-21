"use client";

import { useEffect, useState } from "react";
import { fetchHealth, type Health } from "@/lib/api";

type Conn = { kind: "checking" } | { kind: "online"; health: Health } | { kind: "offline" };

/** État de connexion réel : interroge /v1/health toutes les 15 s. */
export function useConnection(): Conn {
  const [conn, setConn] = useState<Conn>({ kind: "checking" });
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      try {
        const health = await fetchHealth(ctrl.signal);
        if (alive) setConn({ kind: "online", health });
      } catch {
        if (alive) setConn({ kind: "offline" });
      } finally {
        clearTimeout(timer);
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return conn;
}

export function ConnectionStatus({ conn }: { conn: Conn }) {
  const view =
    conn.kind === "checking"
      ? { text: "Vérification…", color: "#8ca3c7" }
      : conn.kind === "offline"
        ? { text: "Serveur injoignable", color: "#f25f7a" }
        : conn.health.status === "ok"
          ? { text: "Connecté", color: "#22d3ee" }
          : { text: "Connecté · base indisponible", color: "#f5b544" };
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs text-mist" role="status" aria-live="polite">
      <span className="size-2 rounded-full" style={{ backgroundColor: view.color, boxShadow: `0 0 6px ${view.color}` }} />
      {view.text}
    </span>
  );
}
