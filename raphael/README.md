# RAPHAËL — Personal Intelligence System

Assistant IA personnel : conversation écrite et vocale, mémoire persistante, synchronisation
multi-appareils, modules stratégiques. PWA installable (iPhone, iPad, Android, Windows, macOS).

- [Architecture](docs/ARCHITECTURE.md) · [Système de design](docs/DESIGN.md) · [Plan de développement](docs/ROADMAP.md)

## Structure
```
raphael/
├── docs/                    Architecture, design, roadmap
├── docker-compose.yml       PostgreSQL 16 + pgvector (dev)
└── apps/
    ├── api/                 FastAPI (Python 3.12+)
    │   ├── app/core/        config, base de données, en-têtes de sécurité
    │   ├── app/modules/     un dossier par module (health, puis auth, conversation, voice, memory…)
    │   ├── migrations/      SQL versionné (001_init.sql = schéma complet)
    │   ├── scripts/         migrate.py
    │   └── tests/
    └── web/                 Next.js 15 + TypeScript + Tailwind 4 + Framer Motion
        ├── app/             routes (/, /design, manifest PWA)
        ├── components/      core/RaphaelCore, ui/*
        ├── lib/             client API, états de Raphaël
        └── public/icons/    icônes PWA / iOS
```

## Démarrage depuis un iPad (GitHub Codespaces)
1. Dans Safari : github.com → dépôt **Knightbot-MD** → choisir la branche
   `claude/raphael-personal-ai-assistant-ngpin9`.
2. **Code** → onglet **Codespaces** → **Create codespace on …**
   (la base PostgreSQL + pgvector et les dépendances s'installent seules, ~3–5 min).
3. Dans le terminal du Codespace : `cd raphael && ./dev.sh`
4. Onglet **Ports** → port **3000** → icône 🌐 pour ouvrir RAPHAËL.

## Démarrage (ordinateur)
```bash
# 1. Base de données
docker compose up -d db

# 2. Installation + lancement (API port 8000, interface port 3000)
./setup.sh
./dev.sh               # http://localhost:3000
```

## Tests
```bash
cd apps/api
RAPHAEL_TEST_DATABASE_URL=postgresql://raphael:raphael@localhost:5432/raphael_test .venv/bin/pytest
cd ../web && npm run typecheck && npm run build
```
Sans `RAPHAEL_TEST_DATABASE_URL`, les tests de base de données sont ignorés (signalés `skipped`).
