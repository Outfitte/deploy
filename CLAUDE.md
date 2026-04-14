# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This is the `deploy` repo for the Outfitte wardrobe management application. It contains:
- **Docker Compose** orchestration for running the full stack
- **Playwright E2E smoke tests** that validate the deployed stack end-to-end

The repo expects sibling repositories at the same level:
```
Outfitte/
├── backend/   (Go, built from ../backend)
├── frontend/  (Vite/Node, built from ../frontend)
└── deploy/    ← this repo
```

## Commands

### Run the stack
```sh
docker compose up --build        # foreground
docker compose up --build -d     # background
docker compose down -v           # stop and remove volumes
```

### E2E tests
```sh
npm install
npx playwright install chromium --with-deps   # first time only
npm test                                       # run all tests
npm run test:report                            # open HTML report
```

Run a single test file:
```sh
npx playwright test e2e/tests/03-auth.spec.ts
```

Run a single test by title:
```sh
npx playwright test --grep "unauthenticated access"
```

## Architecture

### Docker Compose services
- **backend** — Go server, not port-exposed; only reachable through the frontend Nginx proxy. Has a `/health` healthcheck on `SERVER_PORT` (default `8080`).
- **frontend** — Nginx container serving the built Vite app and proxying API calls to backend. Exposed on `PORT` (default `30080`).

All configuration comes from `.env` (copy from `.env.example`). `JWT_SECRET` is required and must be ≥32 characters (`openssl rand -hex 32`).

### E2E test structure (`e2e/`)
- `playwright.config.ts` — two Playwright projects: `setup` (runs `admin.setup.ts` first) then `e2e` (all numbered specs). Tests run serially (`fullyParallel: false`).
- `tests/admin.setup.ts` — registers the first user (who becomes admin), re-enables registration, and writes credentials to `e2e/.auth/admin-creds.json` for subsequent tests.
- `helpers.ts` — `adminLogin()` helper that reads saved credentials and logs in.
- `global-teardown.ts` — runs `docker compose down -v` after the test suite.
- The `webServer` config starts `docker compose up` automatically when running tests locally if a server isn't already running; on CI it expects pre-pulled images.

### CI (`smoke-test.yml`)
Triggered on pushes/PRs to `main` and via `repository_dispatch` events (`backend-published`, `frontend-published`) from the backend and frontend repos. Pulls `ghcr.io/outfitte/backend:latest` and `ghcr.io/outfitte/frontend:latest` from GHCR, generates a `.env`, then runs the full Playwright suite.
