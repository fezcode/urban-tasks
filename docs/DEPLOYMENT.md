# Deployment Guide

How to self‑host Urban Tasks on a single Linux server using Docker Compose. The
whole stack — reverse proxy, web UI, API, database, and backups — runs as one
Compose project and is fronted by Caddy.

> Placeholders used below: `<server-ip>` (your server's public IP),
> `<ssh-user>` (the Linux user you SSH in as), `<domain>` (a hostname you
> control, if you want HTTPS). Replace them with your real values.

---

## 1. Architecture

```
                         ┌─────────────────────── server (Docker) ───────────────────────┐
   browser  ──:80/:443──▶│  caddy                                                          │
                         │   ├─ serves the built SPA from /srv/frontend (static files)     │
                         │   └─ reverse_proxy /api/* and /health ─▶ backend:8080           │
                         │                                                                 │
                         │  backend (Go)  ──▶  postgres:5432   (internal Docker network)   │
                         │   └─ runs DB migrations on boot, serves the REST API            │
                         │                                                                 │
                         │  frontend-build (one-shot)  ─ builds the SPA ─▶ frontend_build  │
                         │  db-backup  ─ daily pg_dump ─▶ db_backups volume                │
                         └─────────────────────────────────────────────────────────────────┘
```

Only Caddy is exposed to the public (ports 80/443). Postgres is **never**
published to the host — it is reachable only by the backend over the internal
Docker network.

## 2. Tech stack

| Component | Image / tech | Role |
|---|---|---|
| **Caddy** | `caddy:2-alpine` | Reverse proxy + static file server. Serves the built SPA, proxies `/api/*` and `/health` to the backend, gzip/zstd compression, security headers. With a real domain it auto‑provisions a Let's Encrypt TLS certificate (HTTP/1.1, H2, and HTTP/3 on UDP 443). |
| **backend** | Go (multi‑stage `backend/Dockerfile`) | REST API on `:8080` (internal). Runs database migrations on startup via golang‑migrate. |
| **postgres** | `postgres:17-alpine` | Database. Data persisted in the `pgdata` volume. Not exposed to the host. |
| **frontend-build** | `node:22-alpine` (one‑shot) | Builds the React/Vite SPA into static assets, published into the `frontend_build` volume that Caddy serves. Exits 0 when done; Caddy waits for it. |
| **db-backup** | `postgres:17-alpine` | Loops `pg_dump -Fc` once a day into the `db_backups` volume; prunes dumps older than 7 days. |
| **Docker Compose** | `docker-compose.prod.yml` | Orchestrates all of the above. |

### Two compose files

- **`docker-compose.yml`** — *development* only. Runs Postgres + backend, plus
  the Vite dev server with hot reload, ports exposed on localhost. Do **not**
  use this in production.
- **`docker-compose.prod.yml`** — *production*. Caddy + built SPA + backend +
  Postgres + daily backups. This is the file every command below uses.

## 3. Prerequisites

- A Linux server (tested on **Ubuntu 24.04 LTS**). 2 GB RAM is enough; the
  frontend build is the heaviest step, so make sure some swap exists (see
  [Troubleshooting](#9-troubleshooting)).
- **Docker Engine + Docker Compose v2+**. The SSH user must be in the `docker`
  group (so `docker` works without `sudo`).
- Ports **80** and **443** open in the firewall and **free** (no other web
  server / reverse proxy bound to them — see step 4.2).
- Outbound HTTPS so the backend's geocoding proxy can reach OpenStreetMap
  Nominatim (for the task‑location feature).

`deploy/setup.sh` provisions a fresh Ubuntu box end‑to‑end (installs Docker,
creates a `deploy` user, configures the `ufw` firewall for 80/443, enables
unattended security updates):

```bash
ssh root@<server-ip> 'bash -s' < deploy/setup.sh
```

## 4. First deployment

### 4.1 Get the code onto the server

```bash
ssh <ssh-user>@<server-ip>
git clone https://github.com/fezcode/urban-tasks ~/urban-tasks
cd ~/urban-tasks
```

(Any directory works; this guide uses `~/urban-tasks`. The repo is public, so no
credentials are needed to clone or pull.)

### 4.2 Make sure ports 80/443 are free

Caddy needs to bind 80 (and 443 for HTTPS). If another service already holds
them, stop it first. To find the holder:

```bash
sudo ss -tulpn | grep -E ':80 |:443 '
```

- Another **Docker** app: stop its stack with `docker compose down` in its
  directory (omit `-v` to keep its data volumes).
- A **host** web server / reverse proxy (nginx, Caddy, Apache) running under
  systemd: `sudo systemctl disable --now <service>` to stop it and keep it from
  grabbing the port again on reboot. Its config stays on disk, so it's
  reversible with `sudo systemctl enable --now <service>`.

### 4.3 Create the production `.env`

The prod compose reads these variables (see also `.env.example`). Generate the
secrets on the server so they never leave it:

```bash
cd ~/urban-tasks
umask 077
cat > .env <<EOF
DOMAIN=:80
POSTGRES_USER=urban
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=urban_tasks
JWT_SECRET=$(openssl rand -hex 32)
RATE_LIMIT_RPS=60
EOF
chmod 600 .env
```

| Variable | Required | Meaning |
|---|---|---|
| `DOMAIN` | yes | Caddy site address. `:80` = HTTP‑only on the bare IP (no TLS). A hostname like `tasks.example.com` = automatic HTTPS. See [section 5](#5-http-only-vs-https). |
| `POSTGRES_USER` | yes | Database user. |
| `POSTGRES_PASSWORD` | yes | Database password. Generate it; don't reuse. |
| `POSTGRES_DB` | yes | Database name. |
| `JWT_SECRET` | yes | Signs auth tokens. Use ≥ 32 random chars (`openssl rand -hex 32`). |
| `RATE_LIMIT_RPS` | no | Per‑IP API rate limit (requests/min window). Defaults to 60 in prod. |

> The prod compose derives `DATABASE_URL` and `ALLOWED_ORIGINS` from `DOMAIN` and
> the Postgres vars automatically — you don't set them directly.

### 4.4 Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This pulls images, builds the backend, runs the one‑shot frontend build, starts
Postgres, runs migrations, then starts the backend, Caddy, and the backup loop.
On a 2 GB box the npm/Vite build takes a few minutes the first time.

### 4.5 Verify

```bash
# from the server
curl -s http://localhost/health            # -> {"data":{"status":"ok"}}
curl -sI http://localhost/ | head -3       # -> 200, text/html (the SPA)
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend | grep "migrations complete"
#   -> ...\"msg\":\"migrations complete\",\"version\":N,\"dirty\":false

# from your laptop
curl -sI http://<server-ip>/ | head -3
```

The app is now reachable at `http://<server-ip>` (or `https://<domain>` if you
configured a domain).

## 5. HTTP‑only vs HTTPS

Caddy's behaviour is driven entirely by `DOMAIN`:

- **`DOMAIN=:80`** — serves plain **HTTP on port 80**. No certificate, no
  redirect. Use this when you only have an IP and no domain yet. Note that the
  derived `ALLOWED_ORIGINS` (`https://:80`) is cosmetically wrong but harmless:
  the web UI and API are same‑origin through Caddy, so CORS isn't involved. It
  only matters if you point a **separate cross‑origin client** (e.g. the mobile
  app) at the server — then switch to a real domain.
- **`DOMAIN=<domain>`** — Caddy automatically obtains and renews a Let's Encrypt
  certificate and serves **HTTPS** (with HTTP→HTTPS redirect). Requirements:
  1. A DNS **A record** for `<domain>` pointing at `<server-ip>`.
  2. Ports 80 **and** 443 open and reachable (ACME HTTP‑01 challenge).

To switch from IP/HTTP to a domain later:

```bash
cd ~/urban-tasks
sed -i 's/^DOMAIN=.*/DOMAIN=tasks.example.com/' .env
docker compose -f docker-compose.prod.yml up -d
```

## 6. Database migrations

Migrations live in `backend/migrations/` as numbered `NNN_name.up.sql` /
`.down.sql` pairs and are applied automatically by the backend on startup
(golang‑migrate). You never run them by hand. Confirm the applied version in the
backend logs:

```bash
docker compose -f docker-compose.prod.yml logs backend | grep "migrations complete"
```

## 7. Updating an existing deployment

The standard "pull and rebuild" flow:

```bash
cd ~/urban-tasks
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f          # optional: reclaim old image layers
```

`deploy/deploy.sh` automates exactly this plus a health‑check wait. **Note:** it
hard‑codes `APP_DIR=/opt/urban-tasks`; if you deployed somewhere else (e.g.
`~/urban-tasks`), either edit that variable or run the commands above directly.

## 8. Backups

The `db-backup` service writes a compressed dump (`pg_dump -Fc`) to the
`db_backups` volume once a day and deletes dumps older than 7 days.

Take a manual backup:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB" > backup_$(date +%Y%m%d).dump
```

Restore a dump into the running database:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup_YYYYMMDD.dump
```

(Both read `POSTGRES_USER` / `POSTGRES_DB` from your shell — `source .env` first,
or substitute the literal values.)

## 9. Operations

```bash
cd ~/urban-tasks
COMPOSE="docker compose -f docker-compose.prod.yml"

$COMPOSE ps                      # status of every service
$COMPOSE logs -f backend         # follow backend logs
$COMPOSE logs -f caddy           # follow proxy logs
$COMPOSE restart backend         # restart one service
$COMPOSE up -d                    # apply .env / compose changes
$COMPOSE down                     # stop everything (keeps volumes/data)
$COMPOSE down -v                  # stop AND delete volumes — DESTROYS DATA
```

All long‑running services use `restart: unless-stopped`, so they come back up
after a server reboot.

## 10. Troubleshooting

**`bind: address already in use` on :80 / :443** — another web server or app
holds the port. Find it with `sudo ss -tulpn | grep -E ':80 |:443 '` and stop it
(see step 4.2).

**`frontend-build` exits non‑zero with `ENOENT ... mkdir '/app/node_modules'`** —
the build needs a writable working dir. The compose mounts the source read‑only
and builds in a writable copy (`cp -a /app/. /build/ && npm ci && npm run build`).
If you customized this, make sure `npm` is not asked to write into the read‑only
`/app` mount.

**Frontend build is slow or gets OOM‑killed on a small box** — the Vite build is
the memory‑heavy step. Ensure swap exists:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile \
  && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Caddy never starts** — it waits for `frontend-build` to finish successfully
(`depends_on: condition: service_completed_successfully`). Check
`docker compose -f docker-compose.prod.yml logs frontend-build`.

**Mobile app / cross‑origin client can't call the API** — `ALLOWED_ORIGINS` is
derived from `DOMAIN`. Use a real domain (section 5) so the origin is valid.

## 11. Task‑location feature (OpenStreetMap)

The task‑location feature proxies geocoding through the backend to OpenStreetMap
Nominatim. By default it uses the public endpoint
(`https://nominatim.openstreetmap.org`) with a throttle and an in‑memory cache to
respect OSM's usage policy. To point at a self‑hosted or commercial Nominatim,
add `NOMINATIM_URL` to the backend service environment in
`docker-compose.prod.yml`:

```yaml
  backend:
    environment:
      # ...existing vars...
      NOMINATIM_URL: ${NOMINATIM_URL:-https://nominatim.openstreetmap.org}
```

and set `NOMINATIM_URL=...` in `.env`. For heavier use, also set a real contact
in the proxy's `User-Agent` (in `backend/cmd/server/main.go`) per OSM policy.

## 12. Quick reference

```bash
# First deploy
git clone https://github.com/fezcode/urban-tasks ~/urban-tasks && cd ~/urban-tasks
# create .env (section 4.3)
docker compose -f docker-compose.prod.yml up -d --build

# Update
cd ~/urban-tasks && git pull --ff-only && docker compose -f docker-compose.prod.yml up -d --build

# Health
curl -s http://localhost/health
```
