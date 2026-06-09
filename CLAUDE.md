# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

This is the `deploy` repo for the Outfitte wardrobe management application. It contains:
- **Docker Compose** orchestration for running the full stack
- **Playwright E2E smoke tests** that validate the deployed stack end-to-end

The default and CI path pulls published images from GHCR (`ghcr.io/outfitte/*:latest`). Building from sibling repositories is an optional local-development path:
```
Outfitte/
├── backend/   (optional: local-dev source)
├── frontend/  (optional: local-dev source)
└── deploy/    ← this repo
```

## Commands

### Run the stack
```sh
docker compose pull && docker compose up -d   # fetch latest images and start (default)
docker compose up                             # foreground (log watching)
docker compose up --build -d                  # build from sibling repos (local dev only)
docker compose down -v                        # stop and remove volumes
```

### E2E tests
```sh
npm install
npx playwright install chromium --with-deps   # first time only
npm test                                       # run all tests (auto-scales to CPUs/2)
npm run test:report                            # open HTML report
```

Override worker count:
```sh
PLAYWRIGHT_WORKERS=4 npm test
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
- `playwright.config.ts` — single `e2e` project, `fullyParallel: false` (tests within a file stay ordered), workers auto-scale to CPUs/2 locally and default to 2 on CI.
- `fixtures/worker-stack.ts` — worker-scoped fixture that starts an isolated Docker Compose stack (`PORT=40080+workerIndex`, project name `outfitte-wN`) for each Playwright worker, runs admin setup (register admin, enable registration, pre-register member + recipient), exposes credentials and `baseURL`, and tears down the stack with `docker compose -p outfitte-wN down -v` when the worker exits. Each worker gets its own SQLite volume (`outfitte-wN_sqlite_data`), so stacks share nothing.
- `fixtures/index.ts` — single import point for `test` and `expect` in all spec files.
- `helpers.ts` — pure utility functions (`loginAs`, `logout`, `registerUser`, `switchUser`). No file I/O or credential files.
- **Spec files are self-contained**: each spec creates and cleans up its own data. No spec relies on state left by another spec. This applies **per `test.describe` block too**: a `test.describe.configure({ mode: 'serial' })` block is an independently schedulable unit, so under multiple workers each serial describe can run on its own isolated Docker stack. A block must create the items/data it needs in its own first test(s) — never rely on a shared "setup" describe, or flow blocks will fail with "item not found" when scheduled onto a different stack.
- **Use fixed string item names** across describe blocks (e.g. `'WearLog-E2E-Item'`), never `Date.now()` at module scope — Playwright re-evaluates each `test.describe` block in a separate worker, so dynamic names diverge between blocks.
- **Navigate to cards with `exact: true`**: use `page.getByRole('link', { name: 'View ' + name, exact: true })` instead of `new RegExp('View ' + name)` — substring matching causes a strict-mode violation when one test entity name is a prefix of another (e.g. `'Outfit-E2E'` vs `'Outfit-E2E-Zero'`).

### CI (`smoke-test.yml`)
Triggered on pushes/PRs to `main` and via `repository_dispatch` events (`backend-published`, `frontend-published`) from the backend and frontend repos. Pulls `ghcr.io/outfitte/backend:latest` and `ghcr.io/outfitte/frontend:latest` from GHCR, generates a `.env`, then runs the full Playwright suite.
