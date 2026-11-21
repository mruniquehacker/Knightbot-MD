# RAPHAËL — Système de design

Esthétique : **IA holographique sobre**. Futuriste mais calme — l'interface doit inspirer la
confiance, pas le spectacle. La lumière est un *signal* (état de Raphaël), jamais une décoration.

## Palette (tokens définis dans `apps/web/app/globals.css`)

| Token | Valeur | Usage |
|---|---|---|
| `void` | `#05070D` | Fond principal (noir bleuté) |
| `abyss` | `#0A1020` | Fond des panneaux |
| `night` | `#101A33` | Surfaces élevées, cartes |
| `line` | `#1C2A4A` | Bordures, séparateurs |
| `cyan` | `#22D3EE` | Couleur d'identité, état *écoute* |
| `cyan-soft` | `#67E8F9` | Halo, texte d'accent |
| `azure` | `#3B82F6` | État *réflexion* |
| `ice` | `#E6F6FF` | État *réponse*, texte principal |
| `mist` | `#8CA3C7` | Texte secondaire |
| `warn` | `#F5B544` | Confirmation requise, avertissements |
| `danger` | `#F25F7A` | Erreurs, actions destructrices |

Contraste : texte `ice` sur `void` ≈ 18:1, `mist` sur `void` ≈ 7.8:1 (AA large et normal).

## Typographie
- **Titres / logo** : *Orbitron*-like → on utilise **Space Grotesk** (lisible, technique, sans excès).
- **Texte** : **Inter**. **Données / code** : **JetBrains Mono**.
- Logo : `RAPHAËL` en capitales, interlettrage large (`0.35em`), sous-titre
  `PERSONAL INTELLIGENCE SYSTEM` en mono, petit corps, `mist`.

## Le noyau (composant `RaphaelCore`)
Sphère lumineuse composée de : halo diffus, anneaux orbitaux en rotation lente, cœur radial.
Il **est** l'indicateur d'état principal :

| État | Couleur | Mouvement |
|---|---|---|
| `idle` | cyan atténué | respiration lente (4 s) |
| `listening` | cyan vif | anneaux qui s'ouvrent, pulsation rapide |
| `thinking` | azur | rotation accélérée des anneaux |
| `speaking` | blanc glacé | pulsation au rythme de la voix (amplitude audio en Phase 4) |
| `offline` | gris | immobile |

`prefers-reduced-motion` : les rotations sont désactivées, seuls les changements de couleur restent.

## Écran principal (Phase 2)
```
┌─────────────────────────────────────────────┐
│ RAPHAËL                         ● Connecté  │  ← logo + état de connexion
│                                             │
│                 ◯  noyau  ◯                 │  ← RaphaelCore (état)
│            « Je vous écoute. »              │  ← indicateur textuel
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ fil de discussion                     │  │
│  └───────────────────────────────────────┘  │
│  [ Écrire à Raphaël…            ] (🎙)  ➤   │  ← saisie + bouton vocal central
├─────────────────────────────────────────────┤
│ ⌂  💬  ◈  ∴  ▣  ◷  ¤  ⚙                    │  ← navigation (barre basse mobile,
└─────────────────────────────────────────────┘     rail latéral sur tablette/ordinateur)
```
Sections : Accueil · Conversation · Mémoire · Analyse · Projets · Agenda · Finances · Paramètres.

## Responsive
- **< 768 px** (téléphone) : barre de navigation basse, noyau 160 px, respect des `safe-area-inset`.
- **768–1279 px** (tablette) : rail latéral d'icônes, noyau 220 px.
- **≥ 1280 px** (ordinateur) : rail avec libellés, conversation centrée (max 760 px), panneau
  latéral contextuel (souvenirs utilisés, actions en attente).

## Principes
1. **Un état, un signal** : chaque état de Raphaël a une couleur et un libellé, jamais la couleur seule (accessibilité).
2. **Rien de factice** : un bouton non encore fonctionnel est affiché désactivé avec sa phase.
3. **Confirmation visible** : toute action sensible ouvre une carte `warn` à valider.
4. **Lenteur maîtrisée** : transitions 200–400 ms, courbes douces.
