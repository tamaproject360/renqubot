#!/bin/sh
set -eu

cd /opt/renqubot

echo "[deploy] starting renqubot deploy"
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] containers"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

echo "[deploy] done"
