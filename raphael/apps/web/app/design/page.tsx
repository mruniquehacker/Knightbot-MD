"use client";

import Link from "next/link";
import { useState } from "react";
import { RaphaelCore } from "@/components/core/RaphaelCore";
import { Logo } from "@/components/ui/Logo";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { RAPHAEL_STATES, STATE_META, type RaphaelState } from "@/lib/raphael-state";

const PALETTE = [
  ["void", "#05070D", "Fond"],
  ["abyss", "#0A1020", "Panneaux"],
  ["night", "#101A33", "Surfaces"],
  ["line", "#1C2A4A", "Bordures"],
  ["cyan", "#22D3EE", "Identité · écoute"],
  ["cyan-soft", "#67E8F9", "Accent"],
  ["azure", "#3B82F6", "Réflexion"],
  ["ice", "#E6F6FF", "Texte · réponse"],
  ["mist", "#8CA3C7", "Texte secondaire"],
  ["warn", "#F5B544", "Confirmation"],
  ["danger", "#F25F7A", "Erreur"],
] as const;

const SECTIONS = ["Accueil", "Conversation", "Mémoire", "Analyse", "Projets", "Agenda", "Finances", "Paramètres"];

/** Référence visuelle du système de design. Les états sont choisis manuellement ici :
 *  c'est un banc d'essai de l'interface, pas une simulation de l'IA. */
export default function DesignPage() {
  const [state, setState] = useState<RaphaelState>("idle");

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-10 flex items-center justify-between">
        <Logo />
        <Link href="/" className="font-mono text-xs text-cyan-soft hover:text-ice">
          ← Accueil
        </Link>
      </header>

      <h1 className="font-display text-2xl font-semibold">Système de design</h1>
      <p className="mt-2 max-w-prose text-sm text-mist">
        Banc d&apos;essai des composants. Sélectionnez un état pour prévisualiser le noyau et les indicateurs.
      </p>

      <section className="mt-8 grid gap-8 rounded-2xl border border-line bg-abyss/70 p-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="justify-self-center">
          <RaphaelCore state={state} size={240} />
        </div>
        <div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="État de Raphaël">
            {RAPHAEL_STATES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={s === state}
                onClick={() => setState(s)}
                className="rounded-full"
              >
                <StatusIndicator state={s} active={s === state} />
              </button>
            ))}
          </div>
          <p className="mt-6 font-display text-lg">{STATE_META[state].hint}</p>
          <p className="mt-1 font-mono text-xs text-mist">state = &quot;{state}&quot;</p>
        </div>
      </section>

      <h2 className="mt-12 font-display text-lg font-semibold">Palette</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {PALETTE.map(([name, hex, use]) => (
          <li key={name} className="overflow-hidden rounded-xl border border-line bg-abyss">
            <div className="h-14" style={{ backgroundColor: hex }} />
            <div className="p-3">
              <div className="font-mono text-xs text-ice">{name}</div>
              <div className="font-mono text-[11px] text-mist">
                {hex} · {use}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 font-display text-lg font-semibold">Typographie</h2>
      <div className="mt-4 space-y-2 rounded-2xl border border-line bg-abyss/70 p-6">
        <p className="font-display text-3xl tracking-[0.35em]">RAPHAËL</p>
        <p className="font-sans">Inter — texte courant. Calme, précis, lisible sur tous les écrans.</p>
        <p className="font-mono text-sm text-cyan-soft">JetBrains Mono — données, états, code.</p>
      </div>

      <h2 className="mt-12 font-display text-lg font-semibold">Composants</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-abyss/70 p-5">
          <p className="mb-3 font-mono text-xs text-mist">Message</p>
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-night px-4 py-2 text-sm">
            Quelle est la meilleure option ?
          </div>
          <div className="mt-2 w-fit max-w-[85%] rounded-2xl rounded-bl-sm border border-cyan/30 bg-cyan/5 px-4 py-2 text-sm">
            Je compare les deux scénarios. Le second présente moins de risques.
          </div>
        </div>
        <div className="rounded-2xl border border-warn/50 bg-warn/5 p-5">
          <p className="font-mono text-xs uppercase tracking-wider text-warn">Confirmation requise</p>
          <p className="mt-2 text-sm">Raphaël souhaite envoyer un message à « Marie ».</p>
          <div className="mt-4 flex gap-2">
            <button type="button" className="rounded-lg bg-warn px-4 py-1.5 text-sm font-medium text-void">
              Autoriser
            </button>
            <button type="button" className="rounded-lg border border-line px-4 py-1.5 text-sm text-mist">
              Refuser
            </button>
          </div>
        </div>
      </div>

      <h2 className="mt-12 font-display text-lg font-semibold">Navigation (8 sections)</h2>
      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Aperçu de la navigation">
        {SECTIONS.map((s, i) => (
          <span
            key={s}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              i === 0 ? "border-cyan/50 bg-cyan/10 text-ice shadow-glow" : "border-line text-mist"
            }`}
          >
            {s}
          </span>
        ))}
      </nav>
    </main>
  );
}
