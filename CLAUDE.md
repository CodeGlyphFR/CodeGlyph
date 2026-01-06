# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

```bash
docker-compose build          # Build container
docker-compose up -d          # Start service (port 4000)
docker-compose down           # Stop service
```

Production runs via Gunicorn with 2 workers and 120s timeout.

## Architecture

**Backend** (`app.py`): Flask 3.0.0 REST API serving:
- Service cards CRUD at `/api/cards`
- Git commit heatmap at `/api/git/repos` and `/api/git/heatmap/<repo_id>`
- Icon upload at `/api/cards/upload-icon`
- Static files from `static/`

**Frontend** (`static/index.html`): Vanilla JS SPA with two sections:
1. Git heatmap visualization (commits by date/hour)
2. Service cards grid with CRUD modal

**Data Storage**: JSON file at `data/cards.json`

## Key Configuration

- `GIT_REPO_PATHS` list in `app.py` defines monitored git repositories
- Environment variables: `GIT_REPOS_BASE=/repos`, `FLASK_ENV=production`
- Icon uploads: 5MB max, allowed extensions: png, jpg, jpeg, gif, svg, webp

## Frontend Patterns

- Theme system: light/dark/auto stored in localStorage, applied via `theme-*` class on `<html>`
- CSS Grid layout with 250px min column width, mobile breakpoint at 768px
- UI text is in French
