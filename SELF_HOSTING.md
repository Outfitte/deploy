# Self-hosting Outfitte

This guide covers running Outfitte on your own server using Docker Compose.

## Requirements

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin (v2)

## First run

1. Copy the environment template:

   ```sh
   cp .env.example .env
   ```

2. Set a secure `JWT_SECRET` (minimum 32 characters, required):

   ```sh
   openssl rand -hex 32
   ```

   Open `.env` and paste the output as the value of `JWT_SECRET`.

3. Pull the latest images and start all services:

   ```sh
   docker compose pull
   docker compose up -d
   ```

4. Open `http://localhost:30080` in your browser.

**First-user bootstrap:** the first account registered becomes the administrator. Once logged in as admin, go to Settings and enable registration so other users can sign up. This is a runtime toggle — no container restart is needed.

## Configuration

All options are set in `.env`. See `.env.example` for the full reference.

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

## Data & volumes

By default, data lives in two named Docker volumes managed by Docker:

| Volume | Contents |
|--------|----------|
| `sqlite_data` | SQLite database (`/data`) |
| `media_storage` | Uploaded media files (`/data/media`) |

Named volumes have no permission issues and are the simplest setup.

### Bind mounts (host access)

If you need direct access to the files from the host (for backups, external tools, etc.), switch to bind mounts:

1. Pre-create the directories and set ownership to the container's `nonroot` user (UID 65532):

   ```sh
   mkdir -p ./data ./media
   sudo chown -R 65532:65532 ./data ./media
   ```

2. Replace the `volumes:` block in `docker-compose.yml` for the `backend` service:

   ```yaml
   # Before (named volumes):
   volumes:
     - sqlite_data:/data
     - media_storage:/data/media

   # After (bind mounts):
   volumes:
     - ./data:/data
     - ./media:/data/media
   ```

3. Remove the top-level `volumes:` declarations (`sqlite_data:` / `media_storage:`) from the compose file.

The database file will be at `./data/outfitte.db` and media files under `./media/`.

## Backup & restore

Back up with the stack stopped — SQLite writes a WAL (write-ahead log) and stopping the stack ensures a clean checkpoint before the snapshot.

> **Volume name prefix:** Docker Compose prepends the project name to each volume name. The project name defaults to the directory containing `docker-compose.yml` (e.g. `deploy` if you cloned into `deploy/`). Verify your volume names with `docker volume ls | grep sqlite_data`. The examples below use `deploy_` — replace it with your actual prefix if different.

### Backup

```sh
docker compose down
mkdir -p ./backups
docker run --rm \
  -v deploy_sqlite_data:/data \
  -v "$(pwd)/backups":/backups \
  alpine tar czf /backups/sqlite_data.tar.gz -C /data .
docker run --rm \
  -v deploy_media_storage:/data \
  -v "$(pwd)/backups":/backups \
  alpine tar czf /backups/media_storage.tar.gz -C /data .
docker compose up -d
```

With bind mounts, copy `./data/` and `./media/` while the stack is stopped:

```sh
docker compose down
cp -a ./data ./backups/data-$(date +%Y%m%d)
cp -a ./media ./backups/media-$(date +%Y%m%d)
docker compose up -d
```

### Restore

Stop the stack, restore the volume contents, then restart:

```sh
docker compose down
docker run --rm \
  -v deploy_sqlite_data:/data \
  -v "$(pwd)/backups":/backups \
  alpine tar xzf /backups/sqlite_data.tar.gz -C /data
docker run --rm \
  -v deploy_media_storage:/data \
  -v "$(pwd)/backups":/backups \
  alpine tar xzf /backups/media_storage.tar.gz -C /data
docker compose up -d
```

With bind mounts:

```sh
docker compose down
cp -a ./backups/data-<date> ./data
cp -a ./backups/media-<date> ./media
docker compose up -d
```

## Upgrades

Migrations run automatically when the backend container starts and are fatal on error — the container will exit if a migration fails rather than serving traffic on a broken schema.

```sh
docker compose pull        # fetch latest images
docker compose up -d       # recreate containers from new images
```

Rolling `:latest` means each pull gives you the newest published release. See [Version pinning](#version-pinning) below if you want reproducible deployments.

## Version pinning

By default, `docker-compose.yml` uses the `:latest` tag, which always pulls the most recent published image. To pin to a specific release, edit the image lines:

```yaml
services:
  backend:
    image: ghcr.io/outfitte/backend:0.1.0   # pin to a release
  frontend:
    image: ghcr.io/outfitte/frontend:0.1.0
```

| Tag style | Behaviour |
|-----------|-----------|
| `:latest` | Always the newest published image. Simplest; may include breaking changes. |
| `:0.1.0` | Exact release. Reproducible; you control when to upgrade. |
| `:0.1` | Floating minor — newest patch on that minor line. |

To upgrade a pinned deployment, bump the tag and pull:

```sh
# edit docker-compose.yml image tags to the new version, then:
docker compose pull
docker compose up -d
```

## Reverse proxy & TLS

The frontend container serves **plain HTTP** on `PORT`. For production, put it behind a TLS-terminating reverse proxy (Nginx, Caddy, Traefik, etc.).

- Set `Strict-Transport-Security` (HSTS) **at the reverse proxy level** — the app deliberately does not set HSTS itself, so you retain control over the header parameters.
- The in-container Nginx already sets `Content-Security-Policy` and other security headers — do not duplicate these at the proxy layer.

Example Caddy snippet (replace `30080` with your configured `PORT` value if different):

```
outfitte.example.com {
    reverse_proxy localhost:30080
}
```

Caddy provisions a certificate automatically. For Nginx or other proxies, configure TLS termination and `proxy_pass http://localhost:30080;` (or your configured `PORT`) as you normally would.
