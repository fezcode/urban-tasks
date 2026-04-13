#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Urban Tasks — Deploy / update script
# Run from /opt/urban-tasks on the server
# Usage: ./deploy/deploy.sh
# ──────────────────────────────────────────────

APP_DIR="/opt/urban-tasks"
COMPOSE_FILE="docker-compose.prod.yml"

cd "$APP_DIR"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building and deploying"
docker compose -f "$COMPOSE_FILE" build --no-cache backend
docker compose -f "$COMPOSE_FILE" up -d --force-recreate

echo "==> Cleaning up old images"
docker image prune -f

echo "==> Waiting for health check"
for i in $(seq 1 30); do
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        echo "==> Backend is healthy"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "==> ERROR: Backend failed to start"
        docker compose -f "$COMPOSE_FILE" logs backend --tail=50
        exit 1
    fi
    sleep 2
done

echo "==> Deploy complete!"
