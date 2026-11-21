# RAPHAËL — Personal Intelligence System
## Architecture

> Document de référence de la Phase 1. Il décrit ce qui **sera** construit et ce qui **existe déjà**.
> Chaque section indique son statut : ✅ implémenté · 🔜 phase prévue.

---

## 1. Vue d'ensemble

```
┌──────────────────────────── Clients (PWA unique) ────────────────────────────┐
│  iPhone · iPad · Android · Windows · macOS · navigateurs                     │
│  Next.js (App Router) + TypeScript + Tailwind + Framer Motion                │
│  ├─ UI (noyau animé, chat, tableau de bord)                                  │
│  ├─ Moteur audio : micro (getUserMedia) · VAD · lecture audio · barge-in     │
│  ├─ Service Worker : cache hors-ligne, installation, notifications push     │
│  └─ Client de synchro : REST + WebSocket (événements temps réel)             │
└───────────────┬───────────────────────────────┬──────────────────────────────┘
                │ HTTPS (REST, cookies httpOnly)│ WSS (chat stream, voix, synchro)
┌───────────────▼───────────────────────────────▼──────────────────────────────┐
│                       API RAPHAËL — Python FastAPI                           │
│  core/        config · base de données · sécurité · journal d'audit          │
│  modules/                                                                     │
│   ├─ auth          comptes, sessions, appareils, passkeys (WebAuthn)          │
│   ├─ conversation  orchestrateur LLM, streaming, outils, contexte            │
│   ├─ voice         passerelle temps réel STT ↔ LLM ↔ TTS                      │
│   ├─ memory        extraction, consolidation, recherche vectorielle          │
│   ├─ actions       actions sensibles → file de confirmation                   │
│   ├─ planning      objectifs, projets, tâches, agenda                         │
│   ├─ finance       budget, transactions (lecture/saisie, jamais de paiement) │
│   ├─ knowledge     documents, fichiers, recherche web                         │
│   └─ sync          bus d'événements → WebSocket multi-appareils               │
└───────┬──────────────────────┬───────────────────────────┬───────────────────┘
        │                      │                           │
┌───────▼────────┐   ┌─────────▼──────────┐    ┌───────────▼──────────────────┐
│ PostgreSQL 16  │   │ Stockage fichiers  │    │ Fournisseurs IA (serveur)    │
│ + pgvector     │   │ (S3 / disque)      │    │ LLM · Embeddings · STT · TTS │
│ données+mémoire│   │ documents chiffrés │    │ clés API jamais côté client  │
└────────────────┘   └────────────────────┘    └──────────────────────────────┘
```

**Principe directeur :** le client est « bête et beau », le serveur est « intelligent et sûr ».
Toute la logique IA, la mémoire et les clés API vivent côté serveur. Le client affiche,
capte la voix, et se synchronise.

---

## 2. Technologies retenues et justification

| Couche | Choix | Pourquoi |
|---|---|---|
| Frontend | **Next.js 15 + TypeScript** | Une seule base de code pour tous les appareils via PWA ; typage strict ; App Router pour un découpage par section. |
| Style | **Tailwind CSS 4** | Système de design par *tokens* CSS (`@theme`), cohérence garantie, aucun CSS mort. |
| Animation | **Framer Motion** | Animations déclaratives fluides (noyau, transitions d'état) avec respect de `prefers-reduced-motion`. |
| Backend | **Python FastAPI** | Écosystème IA le plus riche (SDK fournisseurs, traitement audio, parsing de documents), async natif, WebSockets intégrés, validation Pydantic. |
| Base de données | **PostgreSQL 16** | Fiable, transactionnel, JSONB pour la flexibilité. |
| Mémoire vectorielle | **pgvector** (index HNSW) | Recherche sémantique *dans la même base* que les données → jointures, transactions et suppression RGPD en une requête. Pas de second système à sécuriser. |
| LLM | **API Claude (Anthropic)** derrière un adaptateur | Excellente qualité de raisonnement et d'outils ; l'adaptateur `LLMProvider` permet de changer de fournisseur sans toucher au reste. |
| Embeddings | Fournisseur configurable (dimension paramétrée, 1024 par défaut) | Anthropic ne fournit pas d'embeddings ; on garde le choix ouvert. |
| Voix | Pipeline **STT en streaming → LLM → TTS en streaming** relayé par le serveur, *ou* API vocale temps réel | Le serveur garde les clés et la mémoire ; le streaming bidirectionnel permet le barge-in (interruption). |
| Temps réel | **WebSockets** (FastAPI) | Streaming des réponses, voix, synchro instantanée entre appareils. |
| Auth | Sessions serveur (cookie `httpOnly`, `Secure`, `SameSite=Strict`) + **Argon2id** + **passkeys WebAuthn** | Révocables appareil par appareil ; Face ID / Touch ID / Windows Hello via passkeys. Pas de JWT longue durée stocké dans le navigateur. |
| Déploiement | Docker Compose (dev) → conteneurs derrière un reverse proxy TLS (prod) | Reproductible ; HTTPS obligatoire (requis aussi par le micro et la PWA). |

### Alternatives écartées
- **Node.js backend** : viable, mais l'outillage audio/documents/IA est plus mature en Python.
- **Base vectorielle séparée (Pinecone, Qdrant)** : complexité et surface d'attaque supplémentaires sans gain à l'échelle d'un utilisateur.
- **Applications natives** : coûteuses ; la PWA couvre l'essentiel. Une coque native (Capacitor) reste possible plus tard pour les fonctions que le web ne permet pas (voir §5.3).

---

## 3. Modules backend

Chaque module expose un `router.py` (API), un `service.py` (logique), un `schemas.py`
(Pydantic) et ne communique avec les autres que par leurs services ou le bus d'événements.
On peut ainsi faire évoluer ou remplacer un module sans reconstruire l'application.

| Module | Rôle | Phase |
|---|---|---|
| `health` | Sonde de vie + état base de données / pgvector | ✅ 1 |
| `auth` | Inscription unique (propriétaire), connexion, sessions, appareils, passkeys | 🔜 2–3 |
| `conversation` | Orchestration LLM, prompt système de Raphaël, streaming, appels d'outils | 🔜 3 |
| `voice` | WebSocket audio, VAD, STT/TTS en flux, interruption | 🔜 4 |
| `memory` | Extraction de souvenirs, consolidation, recherche hybride (vecteur + texte) | 🔜 5 |
| `sync` | Diffusion des événements à tous les appareils connectés | 🔜 6 |
| `planning`, `finance`, `knowledge`, `analysis` | Modules stratégiques et outils | 🔜 7 |
| `actions` | File de confirmation des actions sensibles | 🔜 3 (socle) → 7 |

---

## 4. Mémoire intelligente

| Niveau | Implémentation |
|---|---|
| **Immédiate** | Fenêtre de messages de la conversation + résumé glissant (`conversations.summary`) quand la fenêtre déborde. |
| **Long terme** | Table `memories` : souvenirs atomiques typés (`fact`, `preference`, `goal`, `project`, `decision`, `habit`, `lesson`), chacun avec embedding, importance, confiance, et lien vers le message source (traçabilité : *« d'où sais-tu ça ? »*). |
| **Évolutive** | Tâche de consolidation périodique : fusionne les doublons, détecte les erreurs répétées et les progrès (`lesson`, `progress`), ajuste `importance` selon l'usage (`access_count`, `last_accessed_at`). Les souvenirs remplacés sont conservés via `superseded_by` (historique, pas d'écrasement silencieux). |

**Récupération** : à chaque tour, recherche hybride (similarité cosinus pgvector + plein texte
PostgreSQL), pondérée par importance et récence, puis injection des *k* meilleurs souvenirs
dans le contexte.

**Contrôle utilisateur** : la section *Mémoire* liste, modifie, épingle et supprime chaque
souvenir. La suppression est réelle (`DELETE`, cascade sur l'embedding), pas un masquage.

---

## 5. Système vocal

### 5.1 Conversation vocale (navigateur) — 🔜 Phase 4
```
Micro → AudioWorklet (PCM 16 kHz) → VAD local ─┐
                                               ▼  WSS /v1/voice
                          Serveur : STT flux → LLM flux → TTS flux
                                               │
Haut-parleur ← lecture en flux ◄───────────────┘
```
- **Barge-in** : si le VAD détecte la voix pendant que Raphaël parle, le client coupe la lecture
  immédiatement et envoie `interrupt` ; le serveur annule la génération LLM/TTS en cours et
  enregistre la réponse comme tronquée (le contexte reste exact).
- **Mode appel** : écran plein façon appel téléphonique, mains libres, `Wake Lock` pour garder
  l'écran actif, annulation d'écho via les contraintes `getUserMedia`.

### 5.2 Contraintes réelles des plateformes
- **iOS/iPadOS Safari** : le micro exige un geste utilisateur et HTTPS ; l'audio s'arrête quand
  la PWA passe en arrière-plan. Le mode appel fonctionne donc **app au premier plan**.
- **Android Chrome** : comportement similaire ; un peu plus tolérant en arrière-plan, sans garantie.

### 5.3 Appels téléphoniques classiques (GSM) — architecture future, honnête
**Un navigateur ne peut pas décrocher un appel GSM.** Ni iOS ni Android ne l'autorisent à une
web app. Options réalistes, à étudier en Phase 7+ :
1. **Numéro virtuel** (ex. Twilio / Vonage) : l'utilisateur renvoie ses appels (renvoi
   conditionnel opérateur : non-réponse / occupé) vers un numéro dont l'audio est relayé au
   module `voice`. Raphaël répond, prend un message, résume. Fonctionne sur tous les téléphones.
2. **Android natif** (coque Capacitor + `CallScreeningService` / application de numérotation par
   défaut) : filtrage d'appels possible, avec permissions explicites.
3. **iOS** : aucune API ne permet à une app tierce de répondre à un appel GSM. Seule l'option 1
   est possible.

Le module `voice` est conçu autour d'une interface `AudioSession` indépendante de la source
(navigateur ou téléphonie) pour accueillir l'option 1 sans réécriture.

---

## 6. Synchronisation multi-appareils — 🔜 Phase 6
- Source de vérité unique : le serveur. Chaque appareil = une session (`sessions`) liée à un
  `devices`.
- Chaque écriture produit un événement (`message.created`, `memory.updated`…) diffusé par
  WebSocket aux autres appareils de l'utilisateur.
- À la reconnexion, le client demande les changements depuis son dernier `updated_at` connu.
- Cache hors-ligne en lecture (Service Worker + IndexedDB) ; les écritures hors-ligne sont mises
  en file et rejouées.

---

## 7. Sécurité

| Exigence | Mesure |
|---|---|
| Authentification personnelle | Compte propriétaire unique, Argon2id, passkeys, limitation de débit sur la connexion. |
| Chiffrement des communications | HTTPS/WSS obligatoire (HSTS) ; aucune donnée en clair sur le réseau. |
| Protection des données | Chiffrement au repos (disque/volume), fichiers chiffrés, sauvegardes chiffrées. |
| Sessions | Jetons opaques aléatoires ; seul leur **hachage SHA-256** est stocké ; révocation par appareil. |
| Clés API | Uniquement dans les variables d'environnement du serveur. Jamais envoyées au client. |
| Autorisations | Chaque outil déclare un niveau de risque : `read` / `write` / `sensitive`. |
| Actions sensibles | Envoyer un message, supprimer un fichier, toute opération financière → enregistrées dans `pending_actions` et **exécutées uniquement après confirmation explicite** de l'utilisateur. Raphaël n'effectue **aucun paiement**. |
| Traçabilité | `audit_log` de toutes les actions et accès sensibles. |
| Données personnelles | Export complet (JSON) et suppression totale depuis les Paramètres. |
| Web | CSP stricte, `X-Frame-Options: DENY`, CORS limité à l'origine du frontend, protection CSRF (SameSite + vérification d'origine). |

---

## 8. Personnalité (prompt système, Phase 3)
Calme, analytique, précis, discret, loyal. Réponses courtes par défaut, développées sur demande.
Signale les erreurs de l'utilisateur avec tact. **N'invente jamais** : distingue *je sais*,
*je déduis*, *je ne sais pas*, et cite la source d'un souvenir quand il s'en sert.
