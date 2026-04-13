# deploy

Docker Compose orchestration for Outfitte — wardrobe management application.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin (v2)
- The following repositories cloned side-by-side:
  ```
  Outfitte/
  ├── backend/
  ├── frontend/
  └── deploy/   ← you are here
  ```

## Quick start

1. Copy the environment template and fill in the required values:

   ```sh
   cp .env.example .env
   ```

   At minimum, set a secure `JWT_SECRET` (minimum 32 characters):

   ```sh
   openssl rand -hex 32
   ```

2. Build and start all services:

   ```sh
   docker compose up --build
   ```

   The frontend is available at `http://localhost` (port 80 by default).  
   The backend is not exposed directly — all traffic flows through the Nginx proxy.

3. To run in the background:

   ```sh
   docker compose up --build -d
   ```

## Configuration

All options are set via the `.env` file. See `.env.example` for the full reference.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `80` | Public port for the Nginx frontend container |
| `SERVER_PORT` | `8080` | Internal backend port |
| `JWT_SECRET` | — | **Required.** Secret key for JWT signing |
| `DB_DRIVER` | `sqlite` | Database driver (`sqlite`, `json`) |
| `DB_DSN` | `/data/outfitte.db` | Database path |
| `MEDIA_STORAGE_PATH` | `/data/media` | Media storage path inside the container |
| `APP_ENV` | `production` | Application environment |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |

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
