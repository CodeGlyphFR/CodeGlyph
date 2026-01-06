# CodeGlyph

**Portfolio technique vivant.**

Dashboard centralisant mon activité de développement, mes projets et mon infrastructure.

**[codeglyph.fr](https://codeglyph.fr)**

## Fonctionnalités

- **Activité Git** — Heatmap de commits par projet
- **Side projects** — Applications et SaaS en cours
- **Infrastructure** — Services auto-hébergés
- **Serveur** — Monitoring CPU, RAM, stockage, Docker

## Stack technique

| Couche | Technologies | Détails |
|--------|--------------|---------|
| **Backend** | Python 3.12, Flask 3.0 | API REST, architecture modulaire |
| **Frontend** | Vanilla JS, CSS Grid | SPA sans framework, responsive |
| **Data** | JSON, GitPython | Stockage fichier, parsing commits Git |
| **Infra** | Docker, Gunicorn | 2 workers, timeout 120s, reverse proxy ready |
| **Extras** | OpenAI API | Traduction automatique FR ↔ EN |

## Déploiement

### Prérequis

- Docker & Docker Compose
- Des dépôts Git à monitorer

### Installation

```bash
git clone https://github.com/CodeGlyphFR/CodeGlyph.git
cd CodeGlyph
cp .env.example .env
```

Éditer `.env` :
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — Requis au premier lancement
- `OPENAI_API_KEY` — Optionnel, pour la traduction auto

### Configuration des dépôts Git

Adapter les volumes dans `docker-compose.yml` :

```yaml
volumes:
  - /path/to/your/repo:/repos/repo-name:ro
```

### Lancement

```bash
docker-compose build
docker-compose up -d
```

Accessible sur `http://localhost:4000`

## Licence

© 2026 CodeGlyph — Tous droits réservés

---

# CodeGlyph (English)

**Living technical portfolio.**

Dashboard centralizing my development activity, projects and infrastructure.

**[codeglyph.fr](https://codeglyph.fr)**

## Features

- **Git activity** — Commit heatmap by project
- **Side projects** — Apps and SaaS in progress
- **Infrastructure** — Self-hosted services
- **Server** — CPU, RAM, storage, Docker monitoring

## Tech stack

| Layer | Technologies | Details |
|-------|--------------|---------|
| **Backend** | Python 3.12, Flask 3.0 | REST API, modular architecture |
| **Frontend** | Vanilla JS, CSS Grid | Framework-free SPA, responsive |
| **Data** | JSON, GitPython | File storage, Git commit parsing |
| **Infra** | Docker, Gunicorn | 2 workers, 120s timeout, reverse proxy ready |
| **Extras** | OpenAI API | Auto-translation FR ↔ EN |

## Deployment

### Prerequisites

- Docker & Docker Compose
- Git repositories to monitor

### Installation

```bash
git clone https://github.com/CodeGlyphFR/CodeGlyph.git
cd CodeGlyph
cp .env.example .env
```

Edit `.env`:
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — Required on first run
- `OPENAI_API_KEY` — Optional, for auto-translation

### Git repositories setup

Edit volumes in `docker-compose.yml`:

```yaml
volumes:
  - /path/to/your/repo:/repos/repo-name:ro
```

### Run

```bash
docker-compose build
docker-compose up -d
```

Available at `http://localhost:4000`

## License

© 2026 CodeGlyph — All rights reserved
