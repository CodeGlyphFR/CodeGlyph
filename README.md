# CodeGlyph

**Portfolio technique vivant / Living technical portfolio**

[![FR](https://img.shields.io/badge/lang-FR-blue)](#-français)
[![EN](https://img.shields.io/badge/lang-EN-red)](#-english)

**[codeglyph.fr](https://codeglyph.fr)**

---

<details open>
<summary>🇫🇷 Français</summary>

## Description

Dashboard centralisant mon activité de développement, mes projets et mon infrastructure.

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

### Monitoring système (optionnel)

Le dashboard peut afficher l'état du serveur (CPU, RAM, disques, services). Ces métriques sont collectées par un script bash exécuté sur l'hôte (pas dans le conteneur).

**Installation :**

```bash
# Copier les fichiers
sudo cp scripts/codeglyph-monitor.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/codeglyph-monitor.sh
sudo cp scripts/codeglyph-monitor.service /etc/systemd/system/
sudo cp scripts/codeglyph-monitor.timer /etc/systemd/system/

# Activer et démarrer (exécution toutes les 5 secondes)
sudo systemctl daemon-reload
sudo systemctl enable --now codeglyph-monitor.timer
```

**Vérification :**

```bash
systemctl status codeglyph-monitor.timer
systemctl list-timers | grep codeglyph
```

**Configuration du script :**

Éditer `/usr/local/bin/codeglyph-monitor.sh` pour personnaliser :

```bash
# Services systemd à monitorer
SYSTEMD_SERVICES=(
    "nginx.service"
    "postgresql.service"
    # ...
)

# Processus à vérifier
PROCESSES=(
    "node"
    "python3"
)

# Conteneurs Docker à ignorer
DOCKER_BLACKLIST=(
    "^test_"           # Conteneurs de test
    "hello-world"      # Conteneurs temporaires
)
```

### Lancement

```bash
docker-compose build
docker-compose up -d
```

Accessible sur `http://localhost:4000`

## Licence

© 2026 CodeGlyph — Tous droits réservés

</details>

<details>
<summary>🇬🇧 English</summary>

## Description

Dashboard centralizing my development activity, projects and infrastructure.

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

### System monitoring (optional)

The dashboard can display server status (CPU, RAM, disks, services). These metrics are collected by a bash script running on the host (not inside the container).

**Installation:**

```bash
# Copy files
sudo cp scripts/codeglyph-monitor.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/codeglyph-monitor.sh
sudo cp scripts/codeglyph-monitor.service /etc/systemd/system/
sudo cp scripts/codeglyph-monitor.timer /etc/systemd/system/

# Enable and start (runs every 5 seconds)
sudo systemctl daemon-reload
sudo systemctl enable --now codeglyph-monitor.timer
```

**Verification:**

```bash
systemctl status codeglyph-monitor.timer
systemctl list-timers | grep codeglyph
```

**Script configuration:**

Edit `/usr/local/bin/codeglyph-monitor.sh` to customize:

```bash
# Systemd services to monitor
SYSTEMD_SERVICES=(
    "nginx.service"
    "postgresql.service"
    # ...
)

# Processes to check
PROCESSES=(
    "node"
    "python3"
)

# Docker containers to ignore
DOCKER_BLACKLIST=(
    "^test_"           # Test containers
    "hello-world"      # Temporary containers
)
```

### Run

```bash
docker-compose build
docker-compose up -d
```

Available at `http://localhost:4000`

## License

© 2026 CodeGlyph — All rights reserved

</details>
