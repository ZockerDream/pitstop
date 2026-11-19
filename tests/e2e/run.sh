#!/bin/sh
# Führt ein Drehbuch-Skript in echtem Chromium aus (Playwright-Container, keine lokale Installation nötig).
#
#   tests/e2e/run.sh demo.mjs [BASE-URL]          # Demo-Drehbuch, Standard http://localhost:8080
#   tests/e2e/run.sh echtbetrieb.mjs BASE-URL     # Echtbetrieb, braucht einen frischen Stack (siehe Kopf der Datei)
#
# Screenshots landen in tests/e2e/shots/ (nicht in Git). Exit-Code 1, wenn ein Schritt fehlschlägt.
set -e
DIR=$(cd "$(dirname "$0")" && pwd)
SCRIPT=${1:-demo.mjs}
BASE=${2:-http://localhost:8080}
docker run --rm --network host \
  -e BASE="$BASE" -e ADMIN_EMAIL -e ADMIN_PASSWORD \
  -v "$DIR":/work -w /work \
  mcr.microsoft.com/playwright:v1.49.1-noble \
  sh -c "[ -d node_modules/playwright ] || npm i --no-save --no-audit --no-fund playwright@1.49.1 >/dev/null 2>&1; node $SCRIPT"
