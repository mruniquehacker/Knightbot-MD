"use client";

import Link from "next/link";
import { RaphaelCore } from "@/components/core/RaphaelCore";
import { ConnectionStatus, useConnection } from "@/components/ui/ConnectionStatus";
import { Logo } from "@/components/ui/Logo";
import { STATE_META } from "@/lib/raphael-state";

/** Écran d'accueil — Phase 1.
 *  L'état du noyau reflète la connexion réelle au serveur. La conversation (Phase 3) et la voix
 *  (Phase 4) ne sont pas encore branchées : leurs contrôles sont affichés désactivés. */
export default function Home() {
  const conn = useConnection();
  const state = conn.kind === "online" ? "idle" : "offline";

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 py-6">
      <header className="flex items-start justify-between gap-4">
        <Logo />
        <ConnectionStatus conn={conn} />
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 py-10">
        <RaphaelCore state={state} size={200} />
        <p className="text-center text-mist" aria-live="polite">
          {conn.kind === "checking" ? "Initialisation…" : STATE_META[state].hint}
        </p>

        <button
          type="button"
          disabled
          className="grid size-16 place-items-center rounded-full border border-line bg-night text-mist opacity-60"
          aria-label="Conversation vocale — disponible en phase 4"
          title="Disponible en phase 4"
        >
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
          </svg>
        </button>
        <span className="font-mono text-[11px] text-mist/70">Voix : phase 4 · Conversation : phase 3</span>
      </section>

      <footer className="flex items-center justify-between border-t border-line pt-4 font-mono text-xs text-mist">
        <span>Phase 1 — architecture &amp; design</span>
        <Link href="/design" className="text-cyan-soft hover:text-ice">
          Système de design →
        </Link>
      </footer>
    </main>
  );
}
