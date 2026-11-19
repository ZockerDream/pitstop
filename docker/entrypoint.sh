#!/bin/sh
# Bind-Mounts (./data, ./logs/app) gehören beim ersten Start root. Ordner anlegen, dem App-Benutzer
# übergeben und die App ohne Root-Rechte starten.
set -e
mkdir -p /app/data/backups /app/logs
chown -R node:node /app/data /app/logs
exec su-exec node "$@"
