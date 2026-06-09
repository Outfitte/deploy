# deploy

Docker Compose orchestration for Outfitte — wardrobe management application.

For a full operations guide (backup, upgrades, TLS, version pinning) see [SELF_HOSTING.md](SELF_HOSTING.md).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin (v2)

## Quick start

1. Copy the environment template and fill in the required values:

   ```sh
   cp .env.example .env
   ```

   At minimum, set a secure `JWT_SECRET` (minimum 32 characters):

   ```sh
   openssl rand -hex 32
   ```

2. Pull the latest images and start all services:

   ```sh
   docker compose pull
   docker compose up -d
   ```

   The frontend is available at `http://localhost:30080`.  
   The backend is not exposed directly — all traffic flows through the Nginx proxy.

   > **Local-from-source development only:** clone the `backend` and `frontend` repos
   > as siblings of this directory (`../backend`, `../frontend`), then use `--build`:
   > ```sh
   > docker compose up --build -d
   > ```

## Configuration

All options are set via the `.env` file. See `.env.example` for the full reference.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `30080` | Public port for the Nginx frontend container |
| `SERVER_PORT` | `8080` | Internal backend port |
| `JWT_SECRET` | — | **Required.** Secret key for JWT signing |
| `DB_DRIVER` | `sqlite` | Database driver (`sqlite`, `json`) |
| `DB_DSN` | `/data/outfitte.db` | Database path |
| `MEDIA_STORAGE_PATH` | `/data/media` | Media storage path inside the container |
| `APP_ENV` | `production` | Application environment |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `BACKEND_URL` | `http://backend:8080` | Backend URL used by the Nginx proxy |

## Host access to data (bind mounts)

By default, data is stored in named Docker volumes (`sqlite_data`, `media_storage`) managed by Docker. This is the simplest setup and has no permission issues.

If you need direct access to the database file or media files from the host (e.g. for backups or external library tools), you can switch to bind mounts:

1. Pre-create the directories and set ownership to the container's `nonroot` user (UID 65532):

   ```sh
   mkdir -p ./data ./media
   sudo chown -R 65532:65532 ./data ./media
   ```

2. Replace the `volumes:` block in `docker-compose.yml`:

   ```yaml
   # Replace named volumes:
   volumes:
     - sqlite_data:/data
     - media_storage:/data/media

   # With bind mounts:
   volumes:
     - ./data:/data
     - ./media:/data/media
   ```

3. Remove the top-level `volumes:` section (the `sqlite_data:` / `media_storage:` declarations) from the compose file.

The database file will then be at `./data/outfitte.db` and media files under `./media/`.

## E2E tests

Tests use Playwright with worker-scoped fixtures. Each worker spins up its own isolated Docker Compose stack on a dedicated port, so spec files run in parallel without sharing state.

```sh
npm install
npx playwright install chromium --with-deps   # first time only
npm test                                       # auto-scales to CPUs/2
PLAYWRIGHT_WORKERS=4 npm test                 # explicit count
npm run test:report                           # open HTML report
```

Each worker starts a stack on port `40080+N` (e.g. worker 0 → `40080`, worker 1 → `40081`) under project name `outfitte-wN`. Stacks are torn down automatically after each worker finishes. No pre-running stack is needed — the fixture manages everything.

## Local development (without Docker)

Run the backend directly:

```sh
cd ../backend
# configure .env as needed
go run ./cmd/server
```

Run the frontend with the Vite dev server, pointing it at the local backend:

```sh
cd ../frontend
echo "VITE_API_URL=http://localhost:8080" > .env.local
npm install
npm run dev
```
